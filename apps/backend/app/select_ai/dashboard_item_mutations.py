from __future__ import annotations

from typing import Any

from apps.backend.app.select_ai.dashboard_item_payload import (
    _dashboard_item_insert_params,
    _dashboard_item_update_fields,
    _normalize_dashboard_item_ids,
    _normalize_dashboard_items,
    _normalize_required_text,
)
from apps.backend.app.select_ai.dashboard_item_store import (
    _dashboard_exists_for_owner,
    _dashboard_item_ids_for_owner,
    _delete_dashboard_item,
    _insert_dashboard_item,
    _next_item_order,
    _ordered_dashboard_item_rows,
    _set_dashboard_item_order,
    _touch_dashboard,
    _update_dashboard_item,
)
from apps.backend.app.select_ai.sql_validation import validate_read_only_select


class DashboardItemMutationMixin:
    def _insert_dashboard_items(
        self,
        cursor,
        *,
        dashboard_id: str,
        items: list[dict[str, Any]],
        start_order: int,
    ) -> None:
        for offset, item in enumerate(items):
            sql = validate_read_only_select(str(item.get("sql") or ""))
            _insert_dashboard_item(
                cursor,
                _dashboard_item_insert_params(
                    dashboard_id=dashboard_id,
                    item=item,
                    item_order=start_order + offset,
                    generated_sql=sql,
                ),
            )

    def add_dashboard_items(
        self,
        *,
        dashboard_id: str,
        items: list[dict[str, Any]],
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = _normalize_required_text(dashboard_id, "dashboard_id")
        normalized_items = _normalize_dashboard_items(items)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            normalized_user_id = int(user_id or 0)
            if not _dashboard_exists_for_owner(cursor, dashboard_id=normalized_dashboard_id, user_id=normalized_user_id):
                raise ValueError("Dashboard was not found.")

            self._insert_dashboard_items(
                cursor,
                dashboard_id=normalized_dashboard_id,
                items=normalized_items,
                start_order=_next_item_order(cursor, dashboard_id=normalized_dashboard_id),
            )
            _touch_dashboard(cursor, dashboard_id=normalized_dashboard_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

    def update_dashboard_item(
        self,
        *,
        dashboard_id: str,
        dashboard_item_id: str,
        user_id: int = 0,
        title: str | None = None,
        layout: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = _normalize_required_text(dashboard_id, "dashboard_id")
        normalized_item_id = _normalize_required_text(dashboard_item_id, "dashboard_item_id")
        updates, update_params = _dashboard_item_update_fields(title=title, layout=layout)
        params: dict[str, Any] = {
            "dashboard_id": normalized_dashboard_id,
            "dashboard_item_id": normalized_item_id,
            "user_id": int(user_id or 0),
            **update_params,
        }

        if not updates:
            return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            _update_dashboard_item(cursor, updates=updates, params=params)
            if cursor.rowcount != 1:
                raise ValueError("Dashboard visualization was not found.")
            _touch_dashboard(cursor, dashboard_id=normalized_dashboard_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

    def delete_dashboard_item(
        self,
        *,
        dashboard_id: str,
        dashboard_item_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = _normalize_required_text(dashboard_id, "dashboard_id")
        normalized_item_id = _normalize_required_text(dashboard_item_id, "dashboard_item_id")

        conn = self._connection()
        cursor = conn.cursor()
        try:
            _delete_dashboard_item(
                cursor,
                dashboard_item_id=normalized_item_id,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            if cursor.rowcount != 1:
                raise ValueError("Dashboard visualization was not found.")

            for index, row in enumerate(_ordered_dashboard_item_rows(cursor, dashboard_id=normalized_dashboard_id), start=1):
                _set_dashboard_item_order(
                    cursor,
                    dashboard_id=normalized_dashboard_id,
                    dashboard_item_id=str(row[0] or ""),
                    item_order=index,
                )

            _touch_dashboard(cursor, dashboard_id=normalized_dashboard_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

    def reorder_dashboard_items(
        self,
        *,
        dashboard_id: str,
        dashboard_item_ids: list[str],
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = _normalize_required_text(dashboard_id, "dashboard_id")
        normalized_item_ids = _normalize_dashboard_item_ids(dashboard_item_ids)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            existing_ids = _dashboard_item_ids_for_owner(
                cursor,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            if existing_ids != set(normalized_item_ids):
                raise ValueError("Dashboard item order must include every visualization exactly once.")

            for index, item_id in enumerate(normalized_item_ids, start=1):
                _set_dashboard_item_order(
                    cursor,
                    dashboard_id=normalized_dashboard_id,
                    dashboard_item_id=item_id,
                    item_order=index,
                )
            _touch_dashboard(cursor, dashboard_id=normalized_dashboard_id)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)
