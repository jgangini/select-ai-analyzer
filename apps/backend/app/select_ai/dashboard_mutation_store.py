from __future__ import annotations

from typing import Any


def _insert_dashboard(
    cursor,
    *,
    dashboard_id: str,
    dashboard_name: str,
    dashboard_desc: str | None,
    visibility: str,
    user_id: int,
) -> None:
    cursor.execute(
        """
        INSERT INTO analytics_dashboards (
            dashboard_id, dashboard_name, dashboard_desc, visibility, created_by_user_id
        ) VALUES (
            :dashboard_id, :dashboard_name, :dashboard_desc, :visibility, :user_id
        )
        """,
        dashboard_id=dashboard_id,
        dashboard_name=dashboard_name,
        dashboard_desc=dashboard_desc,
        visibility=visibility,
        user_id=user_id,
    )


def _update_dashboard(cursor, *, updates: list[str], params: dict[str, Any]) -> int:
    cursor.execute(
        f"""
        UPDATE analytics_dashboards
           SET {", ".join(updates)},
               updated_at = SYSDATE
         WHERE dashboard_id = :dashboard_id
           AND status = 'active'
            AND (:user_id = 0 OR created_by_user_id = :user_id)
        """,
        params,
    )
    return int(cursor.rowcount or 0)


def _archive_dashboard(cursor, *, dashboard_id: str, user_id: int) -> int:
    cursor.execute(
        """
        UPDATE analytics_dashboards
           SET status = 'archived',
               updated_at = SYSDATE
         WHERE dashboard_id = :dashboard_id
           AND status = 'active'
            AND (:user_id = 0 OR created_by_user_id = :user_id)
        """,
        dashboard_id=dashboard_id,
        user_id=user_id,
    )
    return int(cursor.rowcount or 0)
