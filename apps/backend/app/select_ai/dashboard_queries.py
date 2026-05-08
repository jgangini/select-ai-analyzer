from __future__ import annotations

import json
from typing import Any

from apps.backend.app.select_ai.charting import validate_chart_spec
from apps.backend.app.select_ai.dashboard_query_store import (
    _select_dashboard,
    _select_dashboard_items,
    _select_dashboards,
)
from apps.backend.app.select_ai.dashboard_schema import _normalize_visibility
from apps.backend.app.select_ai.sql_validation import validate_read_only_select
from apps.backend.app.select_ai.value_serialization import _json_safe


def _safe_max_rows(max_rows: int | None, *, default: int = 500, upper_bound: int = 5000) -> int:
    return max(1, min(int(max_rows or default), upper_bound))


def _json_loads(value: Any, *, default: Any) -> Any:
    raw_value = value.read() if hasattr(value, "read") else value
    if raw_value is None:
        return default
    try:
        return json.loads(str(raw_value))
    except Exception as exc:
        raise ValueError(f"Stored dashboard JSON is invalid: {exc}") from exc


def _materialize_stored_result(
    *,
    generated_sql: Any,
    chart_spec_json: Any,
    chart_spec_validator,
    execute_select,
    max_rows: int | None = 500,
) -> dict[str, Any]:
    safe_sql = validate_read_only_select(str(generated_sql or ""))
    columns, rows = execute_select(safe_sql, max_rows=_safe_max_rows(max_rows))
    chart_spec = chart_spec_validator(_json_loads(chart_spec_json, default={}), columns)
    return {
        "sql": safe_sql,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "chart_spec": chart_spec,
    }


class DashboardQueryMixin:
    def list_dashboards(self, *, user_id: int = 0, limit: int = 50, owner_only: bool = False) -> list[dict[str, Any]]:
        self.ensure_tables()
        safe_limit = max(1, min(int(limit or 50), 100))
        owner_only_value = 1 if owner_only else 0
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_dashboards(
                cursor,
                user_id=int(user_id or 0),
                owner_only=owner_only_value,
                limit_value=safe_limit,
            )
            columns = [desc[0].lower() for desc in cursor.description or []]
            return [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def get_dashboard(
        self,
        *,
        dashboard_id: str,
        user_id: int = 0,
        max_rows: int = 500,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = str(dashboard_id or "").strip()
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")

        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_dashboard(
                cursor,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            dashboard = cursor.fetchone()
            if not dashboard:
                raise ValueError("Dashboard was not found.")

            _select_dashboard_items(cursor, dashboard_id=normalized_dashboard_id)
            item_columns = [desc[0].lower() for desc in cursor.description or []]
            stored_items = [
                {column: _json_safe(value) for column, value in zip(item_columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

        def execute_dashboard_select(sql: str, *, max_rows: int = 500) -> tuple[list[str], list[dict[str, Any]]]:
            conn = self._connection()
            cursor = conn.cursor()
            try:
                cursor.execute(sql)
                columns = [str(desc[0]).upper() for desc in cursor.description or []]
                rows = [
                    {column: _json_safe(value) for column, value in zip(columns, raw_row)}
                    for raw_row in cursor.fetchmany(size=max_rows)
                ]
                return columns, rows
            finally:
                cursor.close()
                conn.close()

        items: list[dict[str, Any]] = []
        for item in stored_items:
            result = _materialize_stored_result(
                generated_sql=item.get("generated_sql"),
                chart_spec_json=item.get("chart_spec_json"),
                chart_spec_validator=validate_chart_spec,
                execute_select=execute_dashboard_select,
                max_rows=max_rows,
            )
            items.append(
                {
                    "dashboard_item_id": str(item.get("dashboard_item_id") or ""),
                    "order": int(item.get("item_order") or 0),
                    "run_id": str(item.get("question_run_id") or ""),
                    "title": str(item.get("item_title") or "Visualization"),
                    "question": str(item.get("question_text") or ""),
                    **result,
                    "layout": _json_loads(item.get("layout_json"), default={}),
                    "created_at": item.get("created_at"),
                }
            )

        return {
            "dashboard_id": str(dashboard[0] or normalized_dashboard_id),
            "dashboard_name": str(dashboard[1] or "Analytics dashboard"),
            "dashboard_desc": str(dashboard[2] or ""),
            "status": str(dashboard[3] or "active"),
            "visibility": _normalize_visibility(str(dashboard[4] or "private")),
            "created_by_user_id": int(dashboard[5] or 0),
            "created_at": _json_safe(dashboard[6]),
            "updated_at": _json_safe(dashboard[7]),
            "item_count": len(items),
            "items": items,
        }
