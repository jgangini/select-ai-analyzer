from __future__ import annotations

import re
from typing import Any


def normalize_identifier(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned:
        raise ValueError("Column name is required.")
    if not cleaned[0].isalpha():
        cleaned = f"T_{cleaned}"
    return cleaned[:128]


def _text(value: Any, *, limit: int | None = None) -> str:
    result = str(value or "").strip()
    return result[:limit] if limit else result


def _pick(raw: dict[str, Any], *keys: str) -> Any:
    lowered = {str(key).strip().lower(): value for key, value in raw.items()}
    for key in keys:
        normalized = key.strip().lower()
        if normalized in lowered:
            return lowered[normalized]
    return None


def _picked_text(raw: dict[str, Any], keys: tuple[str, ...], *, limit: int | None = None) -> str:
    return _text(_pick(raw, *keys), limit=limit)


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in {"1", "true", "t", "yes", "y", "si", "s"}


def parse_metadata_payload(raw_payload: Any) -> tuple[str | None, list[dict[str, Any]]]:
    table_comment: str | None = None
    raw_columns: Any = raw_payload
    if isinstance(raw_payload, dict):
        table_comment = _picked_text(
            raw_payload,
            ("table_comment", "tableComment", "table comment", "description", "table_description"),
            limit=1000,
        ) or None
        raw_columns = _pick(raw_payload, "columns", "data_dictionary", "dataDictionary", "fields", "items")
        if raw_columns is None and _pick(raw_payload, "column_name", "Column Name", "name", "column"):
            raw_columns = [raw_payload]
    if not isinstance(raw_columns, list):
        raise ValueError("Metadata JSON must be an object with columns or an array of columns.")

    columns: list[dict[str, Any]] = []
    for index, raw_column in enumerate(raw_columns, start=1):
        if not isinstance(raw_column, dict):
            continue
        raw_name = _pick(raw_column, "column_name", "columnName", "Column Name", "name", "column", "field")
        if not raw_name:
            continue
        column_name = normalize_identifier(str(raw_name))
        ordinal_position = _pick(raw_column, "ordinal_position", "ordinalPosition", "position", "order")
        data_length = _pick(raw_column, "data_length", "dataLength", "length")
        column = {
            "column_name": column_name,
            "data_type": _picked_text(raw_column, ("data_type", "dataType", "Type"), limit=128) or None,
            "data_length": int(data_length or 0) if str(data_length or "").strip().isdigit() else None,
            "nullable": _picked_text(raw_column, ("nullable", "nullable_flag", "nullableFlag"), limit=1) or None,
            "ordinal_position": int(ordinal_position or index)
            if str(ordinal_position or index).strip().isdigit()
            else index,
            "comment": _picked_text(raw_column, ("comment", "Comment", "description"), limit=1000),
            "ui_display": _picked_text(raw_column, ("ui_display", "uiDisplay", "UI_Display", "UI Display"), limit=255),
            "classification": _picked_text(raw_column, ("classification", "Classification", "data_class"), limit=100),
            "primary_key": _boolish(_pick(raw_column, "primary_key", "primaryKey", "Primary Key", "PK", "pk")),
        }
        columns.append({key: value for key, value in column.items() if value is not None})
    return table_comment, columns
