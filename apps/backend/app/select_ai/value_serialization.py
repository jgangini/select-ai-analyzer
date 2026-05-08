from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _read_lob(value: Any) -> Any:
    return value.read() if hasattr(value, "read") else value


def _json_safe(value: Any) -> Any:
    value = _read_lob(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _json_loads(value: Any, *, default: Any) -> Any:
    if value is None:
        return default
    try:
        return json.loads(str(value))
    except Exception as exc:
        raise ValueError(f"Stored conversation result JSON is invalid: {exc}") from exc


def _rows_as_dicts(cursor) -> list[dict[str, Any]]:
    columns = [desc[0].lower() for desc in cursor.description or []]
    return [{column: _json_safe(value) for column, value in zip(columns, row)} for row in cursor.fetchall()]
