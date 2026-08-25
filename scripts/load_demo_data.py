from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.source_seed_db import ensure_data_schema
from scripts.source_seed_metadata import apply_metadata
from scripts.source_seed_registry import replace_data_source
from scripts.source_seed_runtime import runtime_connection_config
from scripts.source_seed_table_io import table_columns
from scripts.source_seed_values import convert_csv_value


BACKEND_ROOT = ROOT / "apps" / "backend"
DEMO_ROOT = ROOT / "data"
APP_SCHEMA_RE = re.compile(r"^APP_AGENT(?:_\d+)?$")
IDENTIFIER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_$#]{0,127}$")
DATA_TYPE_RE = re.compile(
    r"^(?:CHAR|VARCHAR2|NCHAR|NVARCHAR2)\(\d{1,4}(?: (?:CHAR|BYTE))?\)"
    r"|NUMBER(?:\(\d{1,2}(?:,\d{1,2})?\))?"
    r"|DATE|TIMESTAMP(?:\(\d\))?$"
)


@dataclass(frozen=True)
class DemoSchemaEntry:
    schema: str
    folder: str
    metadata_path: str
    tables: tuple[str, ...]

    @property
    def data_dir(self) -> Path:
        return DEMO_ROOT / self.folder / self.metadata_path


def _identifier(value: object, *, label: str) -> str:
    identifier = str(value or "").strip().upper()
    if not IDENTIFIER_RE.fullmatch(identifier):
        raise ValueError(f"Invalid {label}: {value!r}")
    return identifier


def _identifiers(value: object, *, label: str) -> tuple[str, ...]:
    raw_values = [value] if isinstance(value, str) else value
    if not isinstance(raw_values, list) or not raw_values:
        raise ValueError(f"{label} must be a non-empty list of identifiers")
    return tuple(_identifier(item, label=label) for item in raw_values)


def _sql_identifier(value: object, *, label: str) -> str:
    return f'"{_identifier(value, label=label)}"'


def _data_type(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if not DATA_TYPE_RE.fullmatch(normalized):
        raise ValueError(f"Unsupported Oracle data type: {value!r}")
    return normalized


def _constraint_name(value: object, *, prefix: str = "") -> str:
    raw = _identifier(f"{prefix}_{value}" if prefix else value, label="constraint name")
    if len(raw) <= 30:
        return raw
    return f"{raw[:21]}_{hashlib.sha1(raw.encode('utf-8')).hexdigest()[:8].upper()}"[:30]


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return payload


def demo_entries() -> dict[str, DemoSchemaEntry]:
    manifest = _read_json(DEMO_ROOT / "manifest.json")
    raw_demos = manifest.get("demos")
    if not isinstance(raw_demos, list):
        raise ValueError("data/manifest.json must contain a demos array")
    entries: dict[str, DemoSchemaEntry] = {}
    for raw_entry in raw_demos:
        if not isinstance(raw_entry, dict):
            raise ValueError("Demo catalog entries must be JSON objects")
        schema = _identifier(raw_entry.get("schema"), label="demo schema")
        folder = str(raw_entry.get("folder") or "").strip()
        metadata_path = str(raw_entry.get("metadata_path") or "data").strip()
        if Path(folder).name != folder or Path(metadata_path).name != metadata_path:
            raise ValueError(f"Demo {schema} uses an unsupported data path")
        tables = _identifiers(raw_entry.get("tables"), label=f"{schema} table")
        if schema in entries:
            raise ValueError(f"Duplicate demo schema: {schema}")
        entries[schema] = DemoSchemaEntry(
            schema=schema,
            folder=folder,
            metadata_path=metadata_path,
            tables=tables,
        )
    return entries


def selected_demo_entries(raw_schemas: str) -> list[DemoSchemaEntry]:
    requested = [schema.strip().upper() for schema in raw_schemas.split(",") if schema.strip()]
    if not requested:
        return []
    if len(requested) != len(set(requested)):
        raise ValueError("Demo schemas must not contain duplicates")
    entries = demo_entries()
    missing = [schema for schema in requested if schema not in entries]
    if missing:
        raise ValueError(f"Unsupported demo schema selection: {', '.join(missing)}")
    return [entries[schema] for schema in requested]


def table_metadata(entry: DemoSchemaEntry) -> list[tuple[Path, dict[str, Any]]]:
    metadata: list[tuple[Path, dict[str, Any]]] = []
    created_tables: set[str] = set()
    for table_name in entry.tables:
        path = entry.data_dir / f"{table_name}.json"
        table = _read_json(path)
        if _identifier(table.get("owner_name"), label="metadata owner") != entry.schema:
            raise ValueError(f"{path}: owner_name must be {entry.schema}")
        if _identifier(table.get("table_name"), label="metadata table") != table_name:
            raise ValueError(f"{path}: table_name must be {table_name}")
        columns = table.get("columns")
        if not isinstance(columns, list) or not columns:
            raise ValueError(f"{path}: columns must be a non-empty array")
        declared_columns = []
        for column in columns:
            if not isinstance(column, dict):
                raise ValueError(f"{path}: column must be an object")
            declared_columns.append(_identifier(column.get("column_name"), label="column name"))
            _data_type(column.get("data_type"))
            if str(column.get("nullable", "Y")).upper() not in {"Y", "N"}:
                raise ValueError(f"{path}: nullable must be Y or N")
        if len(declared_columns) != len(set(declared_columns)):
            raise ValueError(f"{path}: column names must be unique")
        csv_path = path.with_suffix(".csv")
        if not csv_path.exists():
            raise FileNotFoundError(f"Missing CSV file: {csv_path}")
        _validate_foreign_keys(entry, table, declared_columns, created_tables, path)
        metadata.append((path, table))
        created_tables.add(table_name)
    return metadata


def _validate_foreign_keys(
    entry: DemoSchemaEntry,
    table: dict[str, Any],
    columns: list[str],
    created_tables: set[str],
    path: Path,
) -> None:
    foreign_keys = table.get("foreign_keys", [])
    if not isinstance(foreign_keys, list):
        raise ValueError(f"{path}: foreign_keys must be an array")
    for foreign_key in foreign_keys:
        if not isinstance(foreign_key, dict):
            raise ValueError(f"{path}: foreign key must be an object")
        _constraint_name(foreign_key.get("name"))
        source_columns = _identifiers(foreign_key.get("columns"), label="foreign key column")
        reference = foreign_key.get("references")
        if not isinstance(reference, dict):
            raise ValueError(f"{path}: foreign key reference must be an object")
        target_table = _identifier(reference.get("table"), label="foreign key target table")
        target_columns = _identifiers(reference.get("columns"), label="foreign key target column")
        if target_table not in created_tables or any(column not in columns for column in source_columns):
            raise ValueError(f"{path}: foreign key must refer to a previously declared table and known columns")
        if len(source_columns) != len(target_columns):
            raise ValueError(f"{path}: foreign key column count does not match its reference")


def _render_create_table(entry: DemoSchemaEntry, table: dict[str, Any]) -> str:
    table_name = _identifier(table["table_name"], label="table name")
    definitions: list[str] = []
    primary_key_columns: list[str] = []
    for column in sorted(table["columns"], key=lambda item: int(item.get("ordinal_position", 0))):
        column_name = _identifier(column.get("column_name"), label="column name")
        definitions.append(
            f"  {_sql_identifier(column_name, label='column name')} {_data_type(column.get('data_type'))}"
            f"{' NOT NULL' if str(column.get('nullable', 'Y')).upper() == 'N' else ''}"
        )
        if column.get("primary_key") is True:
            primary_key_columns.append(column_name)
    if primary_key_columns:
        columns = ", ".join(_sql_identifier(column, label="primary key column") for column in primary_key_columns)
        definitions.append(
            f"  CONSTRAINT {_sql_identifier(_constraint_name(table_name, prefix='PK'), label='constraint name')} "
            f"PRIMARY KEY ({columns})"
        )
    for foreign_key in table.get("foreign_keys", []):
        source_columns = _identifiers(foreign_key["columns"], label="foreign key column")
        reference = foreign_key["references"]
        target_columns = _identifiers(reference["columns"], label="foreign key target column")
        source_list = ", ".join(_sql_identifier(column, label="foreign key column") for column in source_columns)
        target_list = ", ".join(_sql_identifier(column, label="foreign key target column") for column in target_columns)
        definitions.append(
            f"  CONSTRAINT {_sql_identifier(_constraint_name(foreign_key['name']), label='constraint name')} "
            f"FOREIGN KEY ({source_list}) REFERENCES {_sql_identifier(entry.schema, label='schema')}."
            f"{_sql_identifier(reference['table'], label='foreign key target table')} ({target_list})"
        )
    return f"CREATE TABLE {_sql_identifier(entry.schema, label='schema')}.{_sql_identifier(table_name, label='table name')} (\n" + ",\n".join(definitions) + "\n)"


def _drop_table(cursor: Any, entry: DemoSchemaEntry, table_name: str) -> None:
    try:
        cursor.execute(
            f"DROP TABLE {_sql_identifier(entry.schema, label='schema')}."
            f"{_sql_identifier(table_name, label='table name')} CASCADE CONSTRAINTS PURGE"
        )
    except Exception as exc:
        if "ORA-00942" not in str(exc):
            raise


def _chunks(rows: list[list[object]], size: int) -> Iterable[list[list[object]]]:
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def _load_rows(cursor: Any, entry: DemoSchemaEntry, metadata_path: Path, table: dict[str, Any]) -> int:
    ordered_columns = sorted(table["columns"], key=lambda item: int(item.get("ordinal_position", 0)))
    names = [_identifier(column["column_name"], label="column name") for column in ordered_columns]
    data_types = {name: _data_type(column["data_type"]) for name, column in zip(names, ordered_columns)}
    insert_sql = (
        f"INSERT INTO {_sql_identifier(entry.schema, label='schema')}."
        f"{_sql_identifier(table['table_name'], label='table name')} "
        f"({', '.join(_sql_identifier(name, label='column name') for name in names)}) "
        f"VALUES ({', '.join(f':{index}' for index in range(1, len(names) + 1))})"
    )
    rows: list[list[object]] = []
    with metadata_path.with_suffix(".csv").open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = [str(header or "").upper() for header in reader.fieldnames or []]
        if headers != names:
            raise ValueError(f"{metadata_path.with_suffix('.csv')}: CSV header does not match metadata columns")
        for line_number, row in enumerate(reader, start=2):
            try:
                rows.append([convert_csv_value(row.get(name), data_types[name]) for name in names])
            except Exception as exc:
                raise ValueError(f"{metadata_path.with_suffix('.csv')}:{line_number}: {exc}") from exc
    for batch in _chunks(rows, 1000):
        cursor.executemany(insert_sql, batch)
    return len(rows)


def _assert_app_schema(cursor: Any) -> None:
    cursor.execute("SELECT USER FROM DUAL")
    row = cursor.fetchone()
    user = str(row[0] if row else "").upper()
    if not APP_SCHEMA_RE.fullmatch(user):
        raise RuntimeError(f"Demo loader must connect as APP_AGENT; connected as {user or 'unknown'}.")


def _connect():
    import oracledb

    config = runtime_connection_config(BACKEND_ROOT)
    return oracledb.connect(
        user=config["user"],
        password=config["password"],
        dsn=config["dsn"],
        config_dir=config["wallet_path"],
        wallet_location=config["wallet_path"],
        wallet_password=config["wallet_password"],
    )


def validate_demo_assets() -> list[str]:
    messages: list[str] = []
    for entry in demo_entries().values():
        rows = 0
        for metadata_path, table in table_metadata(entry):
            _render_create_table(entry, table)
            with metadata_path.with_suffix(".csv").open("r", encoding="utf-8-sig", newline="") as handle:
                rows += max(sum(1 for _ in handle) - 1, 0)
        messages.append(f"{entry.schema}: {len(entry.tables)} tables, {rows} rows")
    return messages


def load_demo_schemas(raw_schemas: str) -> list[dict[str, Any]]:
    entries = selected_demo_entries(raw_schemas)
    if not entries:
        return []
    connection = _connect()
    cursor = connection.cursor()
    try:
        _assert_app_schema(cursor)
        results: list[dict[str, Any]] = []
        for entry in entries:
            metadata = table_metadata(entry)
            ensure_data_schema(cursor, entry.schema)
            cursor.executemany(
                "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
                [{"owner_name": entry.schema, "table_name": table_name} for table_name in entry.tables],
            )
            for _metadata_path, table in reversed(metadata):
                _drop_table(cursor, entry, _identifier(table["table_name"], label="table name"))
            for _metadata_path, table in metadata:
                cursor.execute(_render_create_table(entry, table))
            metadata_warnings: list[str] = []
            rows = 0
            for metadata_path, table in metadata:
                metadata_warnings.extend(
                    apply_metadata(
                        cursor,
                        _identifier(table["table_name"], label="table name"),
                        data_schema=entry.schema,
                        table_comment=str(table.get("table_comment") or ""),
                        column_metadata=table["columns"],
                    )
                )
                row_count = _load_rows(cursor, entry, metadata_path, table)
                replace_data_source(
                    cursor,
                    _identifier(table["table_name"], label="table name"),
                    row_count,
                    table_columns(cursor, _identifier(table["table_name"], label="table name"), entry.schema),
                    table["columns"],
                    data_schema=entry.schema,
                )
                rows += row_count
            results.append({"schema": entry.schema, "tables": len(metadata), "rows": rows, "warnings": metadata_warnings})
        cursor.callproc("SP_SEL_AI_PROFILE", ["APP_AGENT_ANALYTICS", 0])
        connection.commit()
        return results
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Load the selected versioned Select AI demo schemas.")
    parser.add_argument("--schemas", default=os.environ.get("SELECT_AI_DEMO_SCHEMAS", ""))
    parser.add_argument("--validate", action="store_true", help="Validate packaged demo metadata and CSV files without a database.")
    args = parser.parse_args()
    if args.validate:
        for message in validate_demo_assets():
            print(message)
        return 0
    results = load_demo_schemas(args.schemas)
    print(f"DEMO_SCHEMAS_LOADED={len(results)}")
    for result in results:
        print(f"{result['schema']}: {result['tables']} tables, {result['rows']} rows")
        if result["warnings"]:
            print(f"{result['schema']}_METADATA_WARNINGS={len(result['warnings'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
