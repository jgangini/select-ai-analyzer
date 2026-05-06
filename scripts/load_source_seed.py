from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
import sys
import uuid
from typing import Any, Iterable

import oracledb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.backend.app.core.config import get_settings
from apps.backend.app.core.db_runtime_config import RuntimeDBConfigStore
from apps.backend.app.select_ai.source_parser import SourceTable, build_create_table_sql, parse_source_tables


APP_SCHEMA = "APP_AGENT"
DATA_SCHEMA = "APP_AGENT_DATA"
DEFAULT_PROFILE = "APP_AGENT_ANALYTICS"


@dataclass(frozen=True, slots=True)
class ColumnMetadata:
    name: str
    data_type: str
    data_length: int
    nullable: str
    ordinal_position: int


def _is_number_type(data_type: str) -> bool:
    return str(data_type or "").upper().startswith(("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE"))


def _is_date_type(data_type: str) -> bool:
    return str(data_type or "").upper().startswith("DATE")


def _is_timestamp_type(data_type: str) -> bool:
    return str(data_type or "").upper().startswith("TIMESTAMP")


def _parse_datetime(text: str) -> datetime:
    normalized = text.strip().replace("Z", "+00:00")
    if len(normalized) == 10:
        return datetime.combine(date.fromisoformat(normalized), datetime.min.time())
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
            try:
                return datetime.strptime(normalized, fmt)
            except ValueError:
                continue
    raise ValueError(f"Invalid date/timestamp value: {text!r}")


def convert_csv_value(raw_value: Any, data_type: str) -> Any:
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if text == "":
        return None
    if _is_timestamp_type(data_type):
        return _parse_datetime(text)
    if _is_date_type(data_type):
        return _parse_datetime(text).date()
    if _is_number_type(data_type):
        try:
            return Decimal(text)
        except InvalidOperation as exc:
            raise ValueError(f"Invalid numeric value for {data_type}: {text!r}") from exc
    return text


def _chunks(rows: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def _runtime_connection_config() -> dict[str, str]:
    settings = get_settings()
    config = RuntimeDBConfigStore(settings.runtime_db_config_path).load()
    if not config:
        raise RuntimeError(f"Runtime DB config is missing or incomplete: {settings.runtime_db_config_path}")
    return config


def _connect(config: dict[str, str]):
    kwargs: dict[str, Any] = {
        "user": config["user"],
        "password": config["password"],
        "dsn": config["dsn"],
    }
    if config.get("wallet_path"):
        kwargs["config_dir"] = config["wallet_path"]
        kwargs["wallet_location"] = config["wallet_path"]
    if config.get("wallet_password"):
        kwargs["wallet_password"] = config["wallet_password"]
    return oracledb.connect(**kwargs)


def _assert_app_agent(cursor) -> None:
    cursor.execute("SELECT USER FROM DUAL")
    connected_user = str(cursor.fetchone()[0]).upper()
    if connected_user != APP_SCHEMA:
        raise RuntimeError(f"Seed loader must connect as {APP_SCHEMA}; connected as {connected_user}.")


def _schema_exists(cursor, schema_name: str) -> bool:
    cursor.execute("SELECT COUNT(*) FROM all_users WHERE username = :schema_name", schema_name=schema_name)
    row = cursor.fetchone()
    return bool(row and int(row[0] or 0) > 0)


def _ensure_data_schema(cursor) -> None:
    if _schema_exists(cursor, DATA_SCHEMA):
        return
    password = "Ag" + uuid.uuid4().hex[:28]
    cursor.execute(
        f'CREATE USER {DATA_SCHEMA} IDENTIFIED BY "{password}" DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS'
    )
    cursor.execute(f"GRANT CREATE SESSION TO {DATA_SCHEMA}")
    cursor.execute(f"GRANT CREATE TABLE TO {DATA_SCHEMA}")


def _drop_table_if_exists(cursor, table_name: str) -> None:
    try:
        cursor.execute(f"DROP TABLE {DATA_SCHEMA}.{table_name} PURGE")
    except Exception as exc:
        if "ORA-00942" not in str(exc):
            raise


def _column_type_label(row: tuple[Any, ...]) -> str:
    data_type, data_length, precision, scale = row[1], row[2], row[3], row[4]
    normalized = str(data_type or "").upper()
    if normalized == "NUMBER" and precision:
        return f"NUMBER({int(precision)},{int(scale or 0)})" if scale is not None else f"NUMBER({int(precision)})"
    if normalized in {"VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2"}:
        return f"{normalized}({int(data_length or 0)})"
    return normalized


def _table_columns(cursor, table_name: str) -> list[ColumnMetadata]:
    cursor.execute(
        """
        SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, column_id
        FROM all_tab_columns
        WHERE owner = :owner_name
          AND table_name = :table_name
        ORDER BY column_id
        """,
        owner_name=DATA_SCHEMA,
        table_name=table_name,
    )
    rows = cursor.fetchall()
    if not rows:
        raise RuntimeError(f"No columns found for {DATA_SCHEMA}.{table_name}")
    return [
        ColumnMetadata(
            name=str(row[0]).upper(),
            data_type=_column_type_label(row),
            data_length=int(row[2] or 0),
            nullable=str(row[5] or "Y")[:1],
            ordinal_position=int(row[6] or 0),
        )
        for row in rows
    ]


def _read_csv_rows(csv_path: Path, columns: list[ColumnMetadata]) -> list[dict[str, Any]]:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV seed file not found: {csv_path}")
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = [str(header or "").upper() for header in (reader.fieldnames or [])]
        expected = [column.name for column in columns]
        if headers != expected:
            raise ValueError(f"CSV headers do not match {csv_path.name}. expected={expected} actual={headers}")
        rows: list[dict[str, Any]] = []
        for row_number, raw_row in enumerate(reader, start=2):
            try:
                rows.append(
                    {
                        column.name: convert_csv_value(raw_row.get(column.name), column.data_type)
                        for column in columns
                    }
                )
            except Exception as exc:
                raise ValueError(f"{csv_path.name}:{row_number}: {exc}") from exc
    if not rows:
        raise ValueError(f"CSV seed file has no data rows: {csv_path}")
    return rows


def _replace_data_source(cursor, table_name: str, row_count: int, columns: list[ColumnMetadata]) -> str:
    data_source_id = uuid.uuid4().hex
    cursor.execute(
        """
        INSERT INTO data_sources (
            data_source_id, source_name, source_type, owner_name, table_name,
            source_file_name, access_scope, row_count, status, created_by_user_id
        ) VALUES (
            :id, :name, 'csv', :owner_name, :table_name,
            :source_file_name, 'all', :row_count, 'active', 0
        )
        """,
        id=data_source_id,
        name=table_name,
        owner_name=DATA_SCHEMA,
        table_name=table_name,
        source_file_name=f"{table_name}.csv",
        row_count=row_count,
    )
    for column in columns:
        cursor.execute(
            """
            INSERT INTO source_columns (
                source_column_id, data_source_id, column_name, data_type,
                data_length, nullable_flag, ordinal_position
            ) VALUES (
                :source_column_id, :data_source_id, :column_name, :data_type,
                :data_length, :nullable_flag, :ordinal_position
            )
            """,
            source_column_id=uuid.uuid4().hex,
            data_source_id=data_source_id,
            column_name=column.name,
            data_type=column.data_type,
            data_length=column.data_length,
            nullable_flag=column.nullable,
            ordinal_position=column.ordinal_position,
        )
    return data_source_id


def _load_table(cursor, table: SourceTable, csv_dir: Path, *, batch_size: int) -> int:
    columns = _table_columns(cursor, table.name)
    rows = _read_csv_rows(csv_dir / f"{table.name}.csv", columns)
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
    _replace_data_source(cursor, table.name, len(rows), columns)
    return len(rows)


def load_source_seed(
    *,
    source_path: Path,
    csv_dir: Path,
    batch_size: int = 1000,
    refresh_profile: bool = True,
) -> dict[str, Any]:
    tables = parse_source_tables(source_path.read_text(encoding="utf-8", errors="ignore"))
    if not tables:
        raise RuntimeError(f"No valid source tables parsed from {source_path}")

    conn = _connect(_runtime_connection_config())
    cursor = conn.cursor()
    try:
        _assert_app_agent(cursor)
        _ensure_data_schema(cursor)
        conn.commit()
        table_names = [table.name for table in tables]
        cursor.executemany(
            "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
            [{"owner_name": DATA_SCHEMA, "table_name": table_name} for table_name in table_names],
        )
        conn.commit()
        for table in tables:
            _drop_table_if_exists(cursor, table.name)
        for table in tables:
            cursor.execute(build_create_table_sql(table, target_owner=DATA_SCHEMA))

        loaded: list[dict[str, Any]] = []
        total_rows = 0
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
                row_count = _load_table(cursor, table, csv_dir, batch_size=batch_size)
                cursor.execute(
                    "UPDATE load_jobs SET status = 'completed', row_count = :row_count WHERE load_job_id = :id",
                    row_count=row_count,
                    id=load_job_id,
                )
                conn.commit()
            except Exception as exc:
                conn.rollback()
                cursor.execute(
                    "UPDATE load_jobs SET status = 'failed', error_message = :message WHERE load_job_id = :id",
                    message=str(exc)[:4000],
                    id=load_job_id,
                )
                conn.commit()
                raise
            loaded.append({"table_name": table.name, "row_count": row_count})
            total_rows += row_count

        if refresh_profile:
            cursor.callproc("SP_SEL_AI_PROFILE", [DEFAULT_PROFILE, 0])
            cursor.callproc("SP_SEL_AI_AGENT", [DEFAULT_PROFILE])
            conn.commit()

        return {"tables_loaded": len(loaded), "rows_loaded": total_rows, "tables": loaded}
    finally:
        cursor.close()
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load generated APP_AGENT_DATA source seed CSVs into Oracle.")
    parser.add_argument("--source", type=Path, default=ROOT / ".source" / "decoupling_tables_structures.sql")
    parser.add_argument("--csv-dir", type=Path, default=ROOT / "apps" / "backend" / "data" / "source_seed" / "csv")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--skip-profile-refresh", action="store_true")
    args = parser.parse_args()

    result = load_source_seed(
        source_path=args.source,
        csv_dir=args.csv_dir,
        batch_size=args.batch_size,
        refresh_profile=not args.skip_profile_refresh,
    )
    print(f"TABLES_LOADED={result['tables_loaded']}")
    print(f"ROWS_LOADED={result['rows_loaded']}")
    for table in result["tables"]:
        print(f"{table['table_name']}={table['row_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
