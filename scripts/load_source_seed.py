from __future__ import annotations

import argparse
from pathlib import Path
import sys
import uuid
from typing import Any, Iterable

import oracledb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.source_seed_parser import SourceTable, build_create_table_sql, parse_source_tables
from scripts.source_seed_sidecar import read_metadata_sidecar
from scripts.source_seed_db import (
    assert_connected_schema,
    drop_table_if_exists,
    ensure_data_schema,
)
from scripts.source_seed_metadata import apply_metadata
from scripts.source_seed_registry import replace_data_source
from scripts.source_seed_runtime import (
    runtime_connection_config,
    runtime_db_config_path,
)
from scripts.source_seed_table_io import read_csv_rows, table_columns
from scripts.source_seed_values import ColumnMetadata, convert_csv_value


BACKEND_ROOT = ROOT / "apps" / "backend"
APP_SCHEMA = "APP_AGENT"
DATA_SCHEMA = "APP_AGENT_DATA"
DEFAULT_PROFILE = "APP_AGENT_ANALYTICS"


def _chunks(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def _runtime_db_config_path() -> Path:
    return runtime_db_config_path(BACKEND_ROOT)


def _connect(config: dict[str, str]):
    kwargs: dict[str, Any] = {
        "user": config["user"],
        "password": config["password"],
        "dsn": config["dsn"],
    }
    wallet_path = config.get("wallet_path")
    wallet_password = config.get("wallet_password")
    if wallet_path:
        kwargs.update(config_dir=wallet_path, wallet_location=wallet_path)
    if wallet_password:
        kwargs["wallet_password"] = wallet_password
    return oracledb.connect(**kwargs)


def _load_table(
    cursor,
    table: SourceTable,
    csv_dir: Path,
    *,
    batch_size: int,
    require_metadata: bool,
    apply_metadata_ddl: bool,
) -> tuple[int, list[str]]:
    csv_path = csv_dir / f"{table.name}.csv"
    metadata_path = csv_path.with_suffix(".json")
    table_comment: str | None = None
    column_metadata: list[dict[str, Any]] = []
    if metadata_path.exists():
        table_comment, column_metadata = read_metadata_sidecar(metadata_path)
    elif require_metadata:
        raise FileNotFoundError(f"Metadata JSON sidecar not found: {metadata_path}")

    columns = table_columns(cursor, table.name, DATA_SCHEMA)
    rows = read_csv_rows(csv_path, columns)
    column_names = [column.name for column in columns]
    insert_sql = (
        f"INSERT INTO {DATA_SCHEMA}.{table.name} ("
        + ", ".join(column_names)
        + ") VALUES ("
        + ", ".join(f":{column}" for column in column_names)
        + ")"
    )
    for batch in _chunks(rows, batch_size):
        try:
            cursor.executemany(insert_sql, batch)
        except Exception as exc:
            raise RuntimeError(f"Insert failed for {DATA_SCHEMA}.{table.name}: {exc}") from exc
    metadata_warnings = (
        apply_metadata(
            cursor,
            table.name,
            data_schema=DATA_SCHEMA,
            table_comment=table_comment,
            column_metadata=column_metadata,
        )
        if apply_metadata_ddl
        else []
    )
    replace_data_source(cursor, table.name, len(rows), columns, column_metadata, data_schema=DATA_SCHEMA)
    return len(rows), metadata_warnings


def load_source_seed(
    *,
    source_path: Path,
    csv_dir: Path,
    batch_size: int = 1000,
    refresh_profile: bool = True,
    require_metadata: bool = True,
    apply_metadata_ddl: bool = False,
) -> dict[str, Any]:
    tables = parse_source_tables(source_path.read_text(encoding="utf-8", errors="ignore"))
    if not tables:
        raise RuntimeError(f"No valid source tables parsed from {source_path}")

    conn = _connect(runtime_connection_config(BACKEND_ROOT))
    cursor = conn.cursor()
    try:
        assert_connected_schema(cursor, APP_SCHEMA)
        ensure_data_schema(cursor, DATA_SCHEMA)
        conn.commit()
        table_names = [table.name for table in tables]
        cursor.executemany(
            "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
            [{"owner_name": DATA_SCHEMA, "table_name": table_name} for table_name in table_names],
        )
        conn.commit()
        for table in tables:
            drop_table_if_exists(cursor, table.name, DATA_SCHEMA)
        for table in tables:
            cursor.execute(build_create_table_sql(table, target_owner=DATA_SCHEMA))

        loaded: list[dict[str, Any]] = []
        total_rows = 0
        metadata_warnings: list[dict[str, Any]] = []
        for table in tables:
            load_job_id = uuid.uuid4().hex
            cursor.execute(
                """
                INSERT INTO load_jobs (load_job_id, source_file_name, target_table_name, status)
                VALUES (:id, :source_file_name, :target_table_name, 'running')
                """,
                id=load_job_id,
                source_file_name=f"{table.name}.csv",
                target_table_name=table.name,
            )
            conn.commit()
            try:
                row_count, table_warnings = _load_table(
                    cursor,
                    table,
                    csv_dir,
                    batch_size=batch_size,
                    require_metadata=require_metadata,
                    apply_metadata_ddl=apply_metadata_ddl,
                )
                cursor.execute(
                    "UPDATE load_jobs SET status = 'completed', row_count = :row_count WHERE load_job_id = :id",
                    row_count=row_count,
                    id=load_job_id,
                )
                conn.commit()
            except Exception as exc:
                original_error = str(exc)
                try:
                    conn.rollback()
                    cursor.execute(
                        "UPDATE load_jobs SET status = 'failed', error_message = :message WHERE load_job_id = :id",
                        message=original_error[:4000],
                        id=load_job_id,
                    )
                    conn.commit()
                except Exception as marker_exc:
                    raise RuntimeError(
                        f"Load failed for {DATA_SCHEMA}.{table.name}: {original_error}. "
                        f"Failed to mark load job as failed: {marker_exc}"
                    ) from exc
                raise RuntimeError(f"Load failed for {DATA_SCHEMA}.{table.name}: {original_error}") from exc
            loaded.append({"table_name": table.name, "row_count": row_count})
            total_rows += row_count
            if table_warnings:
                metadata_warnings.append({"table_name": table.name, "warnings": table_warnings})

        if refresh_profile:
            cursor.callproc("SP_SEL_AI_PROFILE", [DEFAULT_PROFILE, 0])
            conn.commit()

        return {
            "tables_loaded": len(loaded),
            "rows_loaded": total_rows,
            "tables": loaded,
            "metadata_warnings": metadata_warnings,
            "metadata_ddl_applied": apply_metadata_ddl,
        }
    finally:
        cursor.close()
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load generated APP_AGENT_DATA source seed CSV/JSON files into Oracle.")
    parser.add_argument("--source", type=Path, default=ROOT / ".source" / "decoupling_tables_structures.sql")
    parser.add_argument("--csv-dir", type=Path, default=ROOT / ".data" / "csv")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--allow-missing-metadata", action="store_true")
    parser.add_argument("--apply-metadata-ddl", action="store_true")
    parser.add_argument("--skip-profile-refresh", action="store_true")
    args = parser.parse_args()

    result = load_source_seed(
        source_path=args.source,
        csv_dir=args.csv_dir,
        batch_size=args.batch_size,
        refresh_profile=not args.skip_profile_refresh,
        require_metadata=not args.allow_missing_metadata,
        apply_metadata_ddl=args.apply_metadata_ddl,
    )
    print(f"TABLES_LOADED={result['tables_loaded']}")
    print(f"ROWS_LOADED={result['rows_loaded']}")
    for table in result["tables"]:
        print(f"{table['table_name']}={table['row_count']}")
    if result["metadata_warnings"]:
        print(f"METADATA_WARNINGS={len(result['metadata_warnings'])}")
    print(f"METADATA_DDL_APPLIED={result['metadata_ddl_applied']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
