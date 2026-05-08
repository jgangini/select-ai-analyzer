from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any


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


def parse_datetime_value(text: str) -> datetime:
    normalized = text.strip().replace("Z", "+00:00")
    if len(normalized) == 10:
        try:
            return datetime.combine(date.fromisoformat(normalized), datetime.min.time())
        except ValueError:
            pass
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
        return parse_datetime_value(text)
    if _is_date_type(data_type):
        return parse_datetime_value(text).date()
    if _is_number_type(data_type):
        try:
            return Decimal(text)
        except InvalidOperation as exc:
            raise ValueError(f"Invalid numeric value for {data_type}: {text!r}") from exc
    return text
