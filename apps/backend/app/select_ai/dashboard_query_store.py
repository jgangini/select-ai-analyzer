from __future__ import annotations


def _select_dashboards(cursor, *, user_id: int, owner_only: int, limit_value: int) -> None:
    cursor.execute(
        """
        SELECT *
        FROM (
            SELECT
                d.dashboard_id,
                d.dashboard_name,
                d.dashboard_desc,
                d.status,
                d.visibility,
                d.created_by_user_id,
                d.created_at,
                d.updated_at,
                (
                    SELECT COUNT(*)
                    FROM analytics_dashboard_items i
                    WHERE i.dashboard_id = d.dashboard_id
                ) AS item_count
            FROM analytics_dashboards d
            WHERE d.status = 'active'
              AND (
                    :user_id = 0
                 OR d.created_by_user_id = :user_id
                 OR (:owner_only = 0 AND d.visibility = 'shared')
              )
            ORDER BY d.updated_at DESC, d.created_at DESC
        )
        WHERE ROWNUM <= :limit_value
        """,
        user_id=user_id,
        owner_only=owner_only,
        limit_value=limit_value,
    )


def _select_dashboard(cursor, *, dashboard_id: str, user_id: int) -> None:
    cursor.execute(
        """
        SELECT dashboard_id, dashboard_name, dashboard_desc, status, visibility,
               created_by_user_id, created_at, updated_at
        FROM analytics_dashboards
        WHERE dashboard_id = :dashboard_id
          AND status = 'active'
          AND (
                :user_id = 0
             OR created_by_user_id = :user_id
             OR visibility = 'shared'
          )
        """,
        dashboard_id=dashboard_id,
        user_id=user_id,
    )


def _select_dashboard_items(cursor, *, dashboard_id: str) -> None:
    cursor.execute(
        """
        SELECT dashboard_item_id, item_order, question_run_id, item_title,
               question_text, generated_sql, chart_spec_json, layout_json, created_at
        FROM analytics_dashboard_items
        WHERE dashboard_id = :dashboard_id
        ORDER BY item_order ASC, created_at ASC
        """,
        dashboard_id=dashboard_id,
    )
