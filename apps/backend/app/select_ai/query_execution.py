from __future__ import annotations

from collections.abc import Callable
from typing import Any

from apps.backend.app.select_ai.value_serialization import _json_safe
from apps.backend.app.select_ai.sql_validation import validate_read_only_select


ConnectionFactory = Callable[[], Any]


def execute_read_only_select(
    connection_factory: ConnectionFactory,
    sql: str,
    *,
    max_rows: int = 500,
) -> tuple[list[str], list[dict[str, Any]]]:
    safe_sql = validate_read_only_select(sql)
    conn = connection_factory()
    cursor = conn.cursor()
    try:
        cursor.execute(safe_sql)
        columns = [str(desc[0]).upper() for desc in cursor.description or []]
        rows: list[dict[str, Any]] = []
        for raw_row in cursor.fetchmany(size=max_rows):
            rows.append({column: _json_safe(value) for column, value in zip(columns, raw_row)})
        return columns, rows
    finally:
        cursor.close()
        conn.close()
