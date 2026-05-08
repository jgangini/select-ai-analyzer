from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from scripts.source_seed_values import ColumnMetadata, convert_csv_value


def column_type_label(row: tuple[Any, ...]) -> str:
    data_type, data_length, precision, scale = row[1], row[2], row[3], row[4]
    normalized = str(data_type or "").upper()
    if normalized == "NUMBER" and precision:
        return f"NUMBER({int(precision)},{int(scale or 0)})" if scale is not None else f"NUMBER({int(precision)})"
    if normalized in {"VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2"}:
        return f"{normalized}({int(data_length or 0)})"
    return normalized


def table_columns(cursor, table_name: str, data_schema: str) -> list[ColumnMetadata]:
    cursor.execute(
        """
        SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, column_id
        FROM all_tab_columns
        WHERE owner = :owner_name
          AND table_name = :table_name
        ORDER BY column_id
        """,
        owner_name=data_schema,
        table_name=table_name,
    )
    rows = cursor.fetchall()
    if not rows:
        raise RuntimeError(f"No columns found for {data_schema}.{table_name}")
    return [
        ColumnMetadata(
            name=str(row[0]).upper(),
            data_type=column_type_label(row),
            data_length=int(row[2] or 0),
            nullable=str(row[5] or "Y")[:1],
            ordinal_position=int(row[6] or 0),
        )
        for row in rows
    ]


def read_csv_rows(csv_path: Path, columns: list[ColumnMetadata]) -> list[dict[str, Any]]:
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
