from __future__ import annotations

from datetime import datetime
from typing import Any
import uuid

from apps.backend.app.select_ai.dashboard_mutation_store import (
    _archive_dashboard,
    _insert_dashboard,
    _update_dashboard,
)
from apps.backend.app.select_ai.dashboard_visibility import _normalize_visibility


class DashboardMutationMixin:
    def create_dashboard(
        self,
        *,
        name: str,
        items: list[dict[str, Any]],
        description: str | None = None,
        visibility: str | None = "private",
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_items = list(items or [])
        if not normalized_items:
            raise ValueError("At least one visualization is required to generate a dashboard.")

        dashboard_id = uuid.uuid4().hex
        dashboard_name = str(name or "").strip()[:255]
        if not dashboard_name:
            dashboard_name = f"Analytics Dashboard {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        normalized_visibility = _normalize_visibility(visibility)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            _insert_dashboard(
                cursor,
                dashboard_id=dashboard_id,
                dashboard_name=dashboard_name,
                dashboard_desc=(description or None),
                visibility=normalized_visibility,
                user_id=int(user_id or 0),
            )

            self._insert_dashboard_items(
                cursor,
                dashboard_id=dashboard_id,
                items=normalized_items,
                start_order=1,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=dashboard_id, user_id=user_id)

    def update_dashboard(
        self,
        *,
        dashboard_id: str,
        user_id: int = 0,
        name: str | None = None,
        description: str | None = None,
        visibility: str | None = None,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = str(dashboard_id or "").strip()
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")

        updates: list[str] = []
        params: dict[str, Any] = {
            "dashboard_id": normalized_dashboard_id,
            "user_id": int(user_id or 0),
        }

        if name is not None:
            normalized_name = str(name or "").strip()[:255]
            if not normalized_name:
                raise ValueError("Dashboard name is required.")
            updates.append("dashboard_name = :dashboard_name")
            params["dashboard_name"] = normalized_name

        if description is not None:
            updates.append("dashboard_desc = :dashboard_desc")
            params["dashboard_desc"] = str(description or "").strip()[:1000] or None

        if visibility is not None:
            updates.append("visibility = :visibility")
            params["visibility"] = _normalize_visibility(visibility)

        if not updates:
            return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            if _update_dashboard(cursor, updates=updates, params=params) != 1:
                raise ValueError("Dashboard was not found.")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

    def delete_dashboard(
        self,
        *,
        dashboard_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = str(dashboard_id or "").strip()
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")

        conn = self._connection()
        cursor = conn.cursor()
        try:
            if _archive_dashboard(cursor, dashboard_id=normalized_dashboard_id, user_id=int(user_id or 0)) != 1:
                raise ValueError("Dashboard was not found.")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return {"dashboard_id": normalized_dashboard_id, "deleted": True}
