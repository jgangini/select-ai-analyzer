from __future__ import annotations

from typing import Any


def _touch_dashboard(cursor, *, dashboard_id: str) -> None:
    cursor.execute(
        """
        UPDATE analytics_dashboards
           SET updated_at = SYSDATE
         WHERE dashboard_id = :dashboard_id
        """,
        dashboard_id=dashboard_id,
    )


def _dashboard_exists_for_owner(cursor, *, dashboard_id: str, user_id: int) -> bool:
    cursor.execute(
        """
        SELECT dashboard_id
          FROM analytics_dashboards
         WHERE dashboard_id = :dashboard_id
           AND status = 'active'
           AND (:user_id = 0 OR created_by_user_id = :user_id)
        """,
        dashboard_id=dashboard_id,
        user_id=user_id,
    )
    return bool(cursor.fetchone())


def _next_item_order(cursor, *, dashboard_id: str) -> int:
    cursor.execute(
        """
        SELECT NVL(MAX(item_order), 0)
          FROM analytics_dashboard_items
         WHERE dashboard_id = :dashboard_id
        """,
        dashboard_id=dashboard_id,
    )
    return int((cursor.fetchone() or [0])[0] or 0) + 1


def _insert_dashboard_item(cursor, params: dict[str, Any]) -> None:
    cursor.execute(
        """
        INSERT INTO analytics_dashboard_items (
            dashboard_item_id, dashboard_id, item_order, question_run_id,
            item_title, question_text, generated_sql, chart_spec_json, layout_json
        ) VALUES (
            :dashboard_item_id, :dashboard_id, :item_order, :question_run_id,
            :item_title, :question_text, :generated_sql, :chart_spec_json, :layout_json
        )
        """,
        **params,
    )


def _update_dashboard_item(cursor, *, updates: list[str], params: dict[str, Any]) -> None:
    cursor.execute(
        f"""
        UPDATE analytics_dashboard_items i
           SET {", ".join(updates)}
         WHERE i.dashboard_item_id = :dashboard_item_id
           AND i.dashboard_id = :dashboard_id
           AND EXISTS (
                SELECT 1
                  FROM analytics_dashboards d
                 WHERE d.dashboard_id = i.dashboard_id
                   AND d.status = 'active'
                    AND (:user_id = 0 OR d.created_by_user_id = :user_id)
           )
        """,
        params,
    )


def _delete_dashboard_item(cursor, *, dashboard_id: str, dashboard_item_id: str, user_id: int) -> None:
    cursor.execute(
        """
        DELETE FROM analytics_dashboard_items i
         WHERE i.dashboard_item_id = :dashboard_item_id
           AND i.dashboard_id = :dashboard_id
           AND EXISTS (
                SELECT 1
                  FROM analytics_dashboards d
                 WHERE d.dashboard_id = i.dashboard_id
                   AND d.status = 'active'
                    AND (:user_id = 0 OR d.created_by_user_id = :user_id)
           )
        """,
        dashboard_item_id=dashboard_item_id,
        dashboard_id=dashboard_id,
        user_id=user_id,
    )


def _ordered_dashboard_item_rows(cursor, *, dashboard_id: str) -> list[Any]:
    cursor.execute(
        """
        SELECT dashboard_item_id
          FROM analytics_dashboard_items
         WHERE dashboard_id = :dashboard_id
         ORDER BY item_order ASC, created_at ASC
        """,
        dashboard_id=dashboard_id,
    )
    return cursor.fetchall()


def _dashboard_item_ids_for_owner(cursor, *, dashboard_id: str, user_id: int) -> set[str]:
    cursor.execute(
        """
        SELECT i.dashboard_item_id
          FROM analytics_dashboard_items i
          JOIN analytics_dashboards d
            ON d.dashboard_id = i.dashboard_id
         WHERE i.dashboard_id = :dashboard_id
           AND d.status = 'active'
            AND (:user_id = 0 OR d.created_by_user_id = :user_id)
        """,
        dashboard_id=dashboard_id,
        user_id=user_id,
    )
    return {str(row[0] or "") for row in cursor.fetchall()}


def _set_dashboard_item_order(cursor, *, dashboard_id: str, dashboard_item_id: str, item_order: int) -> None:
    cursor.execute(
        """
        UPDATE analytics_dashboard_items
           SET item_order = :item_order
         WHERE dashboard_id = :dashboard_id
           AND dashboard_item_id = :dashboard_item_id
        """,
        item_order=item_order,
        dashboard_id=dashboard_id,
        dashboard_item_id=dashboard_item_id,
    )
