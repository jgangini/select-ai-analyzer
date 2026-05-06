from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import json
import uuid
from typing import Any

from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.select_ai.charting import validate_chart_spec
from apps.backend.app.select_ai.service import SelectAIAnalyticsService
from apps.backend.app.select_ai.sql_validation import validate_read_only_select


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
    raw_value = _read_lob(value)
    if raw_value is None:
        return default
    try:
        return json.loads(str(raw_value))
    except Exception as exc:
        raise ValueError(f"Stored dashboard JSON is invalid: {exc}") from exc


def _create_if_missing(cursor, ddl: str) -> None:
    try:
        cursor.execute(ddl)
    except Exception as exc:
        if "ORA-00955" not in str(exc):
            raise


class DashboardService:
    def __init__(self, db_manager: DatabaseManager) -> None:
        self.db_manager = db_manager

    def _connection(self):
        return self.db_manager.get_connection()

    def ensure_tables(self) -> None:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _create_if_missing(
                cursor,
                """
                CREATE TABLE analytics_dashboards (
                    dashboard_id        VARCHAR2(32) NOT NULL,
                    dashboard_name      VARCHAR2(255) NOT NULL,
                    dashboard_desc      VARCHAR2(1000),
                    status              VARCHAR2(40) DEFAULT 'active' NOT NULL,
                    created_by_user_id  NUMBER DEFAULT 0 NOT NULL,
                    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
                    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
                    CONSTRAINT pk_analytics_dashboards PRIMARY KEY (dashboard_id),
                    CONSTRAINT ck_analytics_dashboards_status CHECK (status IN ('active', 'archived'))
                )
                """,
            )
            _create_if_missing(
                cursor,
                """
                CREATE INDEX idx_analytics_dashboards_user
                    ON analytics_dashboards (created_by_user_id, updated_at)
                """,
            )
            _create_if_missing(
                cursor,
                """
                CREATE TABLE analytics_dashboard_items (
                    dashboard_item_id   VARCHAR2(32) NOT NULL,
                    dashboard_id        VARCHAR2(32) NOT NULL,
                    item_order          NUMBER DEFAULT 0 NOT NULL,
                    question_run_id     VARCHAR2(32),
                    item_title          VARCHAR2(500) NOT NULL,
                    question_text       CLOB NOT NULL,
                    generated_sql       CLOB NOT NULL,
                    chart_spec_json     CLOB NOT NULL,
                    layout_json         CLOB,
                    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
                    CONSTRAINT pk_analytics_dashboard_items PRIMARY KEY (dashboard_item_id),
                    CONSTRAINT fk_dashboard_items_dashboard FOREIGN KEY (dashboard_id)
                        REFERENCES analytics_dashboards(dashboard_id) ON DELETE CASCADE
                )
                """,
            )
            _create_if_missing(
                cursor,
                """
                CREATE INDEX idx_dashboard_items_dashboard
                    ON analytics_dashboard_items (dashboard_id, item_order)
                """,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def create_dashboard(
        self,
        *,
        name: str,
        description: str | None = None,
        items: list[dict[str, Any]],
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

        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO analytics_dashboards (
                    dashboard_id, dashboard_name, dashboard_desc, created_by_user_id
                ) VALUES (
                    :dashboard_id, :dashboard_name, :dashboard_desc, :user_id
                )
                """,
                dashboard_id=dashboard_id,
                dashboard_name=dashboard_name,
                dashboard_desc=(description or None),
                user_id=int(user_id or 0),
            )

            for index, item in enumerate(normalized_items):
                sql = validate_read_only_select(str(item.get("sql") or ""))
                chart_spec = item.get("chart_spec") or {}
                if not isinstance(chart_spec, dict):
                    raise ValueError("chart_spec must be a JSON object.")
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
                    dashboard_item_id=uuid.uuid4().hex,
                    dashboard_id=dashboard_id,
                    item_order=index + 1,
                    question_run_id=str(item.get("run_id") or "")[:32] or None,
                    item_title=str(item.get("title") or item.get("question") or "Visualization")[:500],
                    question_text=str(item.get("question") or item.get("title") or ""),
                    generated_sql=sql,
                    chart_spec_json=json.dumps(chart_spec, ensure_ascii=False),
                    layout_json=json.dumps(item.get("layout") or {}, ensure_ascii=False),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=dashboard_id, user_id=user_id)

    def list_dashboards(self, *, user_id: int = 0, limit: int = 50) -> list[dict[str, Any]]:
        self.ensure_tables()
        safe_limit = max(1, min(int(limit or 50), 100))
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT *
                FROM (
                    SELECT
                        d.dashboard_id,
                        d.dashboard_name,
                        d.dashboard_desc,
                        d.status,
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
                      AND (:user_id = 0 OR d.created_by_user_id IN (:user_id, 0))
                    ORDER BY d.updated_at DESC, d.created_at DESC
                )
                WHERE ROWNUM <= :limit_value
                """,
                user_id=int(user_id or 0),
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
            cursor.execute(
                """
                SELECT dashboard_id, dashboard_name, dashboard_desc, status,
                       created_by_user_id, created_at, updated_at
                FROM analytics_dashboards
                WHERE dashboard_id = :dashboard_id
                  AND status = 'active'
                  AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            dashboard = cursor.fetchone()
            if not dashboard:
                raise ValueError("Dashboard was not found.")

            cursor.execute(
                """
                SELECT dashboard_item_id, item_order, question_run_id, item_title,
                       question_text, generated_sql, chart_spec_json, layout_json, created_at
                FROM analytics_dashboard_items
                WHERE dashboard_id = :dashboard_id
                ORDER BY item_order ASC, created_at ASC
                """,
                dashboard_id=normalized_dashboard_id,
            )
            item_columns = [desc[0].lower() for desc in cursor.description or []]
            stored_items = [
                {column: _json_safe(value) for column, value in zip(item_columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

        analytics = SelectAIAnalyticsService(self.db_manager)
        safe_max_rows = max(1, min(int(max_rows or 500), 5000))
        items: list[dict[str, Any]] = []
        for item in stored_items:
            sql = validate_read_only_select(str(item.get("generated_sql") or ""))
            columns, rows = analytics.execute_select(sql, max_rows=safe_max_rows)
            chart_spec = validate_chart_spec(
                _json_loads(item.get("chart_spec_json"), default={}),
                columns,
            )
            items.append(
                {
                    "dashboard_item_id": str(item.get("dashboard_item_id") or ""),
                    "order": int(item.get("item_order") or 0),
                    "run_id": str(item.get("question_run_id") or ""),
                    "title": str(item.get("item_title") or "Visualization"),
                    "question": str(item.get("question_text") or ""),
                    "sql": sql,
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows),
                    "chart_spec": chart_spec,
                    "layout": _json_loads(item.get("layout_json"), default={}),
                    "created_at": item.get("created_at"),
                }
            )

        return {
            "dashboard_id": str(dashboard[0] or normalized_dashboard_id),
            "dashboard_name": str(dashboard[1] or "Analytics dashboard"),
            "dashboard_desc": str(dashboard[2] or ""),
            "status": str(dashboard[3] or "active"),
            "created_by_user_id": int(dashboard[4] or 0),
            "created_at": _json_safe(dashboard[5]),
            "updated_at": _json_safe(dashboard[6]),
            "item_count": len(items),
            "items": items,
        }

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
        normalized_dashboard_id = str(dashboard_id or "").strip()
        normalized_item_id = str(dashboard_item_id or "").strip()
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")
        if not normalized_item_id:
            raise ValueError("dashboard_item_id is required.")

        updates: list[str] = []
        params: dict[str, Any] = {
            "dashboard_id": normalized_dashboard_id,
            "dashboard_item_id": normalized_item_id,
            "user_id": int(user_id or 0),
        }

        if title is not None:
            normalized_title = str(title or "").strip()[:500]
            if not normalized_title:
                raise ValueError("Visualization title is required.")
            updates.append("item_title = :item_title")
            params["item_title"] = normalized_title

        if layout is not None:
            if not isinstance(layout, dict):
                raise ValueError("layout must be a JSON object.")
            updates.append("layout_json = :layout_json")
            params["layout_json"] = json.dumps(layout, ensure_ascii=False)

        if not updates:
            return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

        conn = self._connection()
        cursor = conn.cursor()
        try:
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
                           AND (:user_id = 0 OR d.created_by_user_id IN (:user_id, 0))
                   )
                """,
                params,
            )
            if cursor.rowcount != 1:
                raise ValueError("Dashboard visualization was not found.")
            cursor.execute(
                """
                UPDATE analytics_dashboards
                   SET updated_at = SYSDATE
                 WHERE dashboard_id = :dashboard_id
                """,
                dashboard_id=normalized_dashboard_id,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

    def update_dashboard(
        self,
        *,
        dashboard_id: str,
        user_id: int = 0,
        name: str | None = None,
        description: str | None = None,
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

        if not updates:
            return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)

        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"""
                UPDATE analytics_dashboards
                   SET {", ".join(updates)},
                       updated_at = SYSDATE
                 WHERE dashboard_id = :dashboard_id
                   AND status = 'active'
                   AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                params,
            )
            if cursor.rowcount != 1:
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
            cursor.execute(
                """
                UPDATE analytics_dashboards
                   SET status = 'archived',
                       updated_at = SYSDATE
                 WHERE dashboard_id = :dashboard_id
                   AND status = 'active'
                   AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            if cursor.rowcount != 1:
                raise ValueError("Dashboard was not found.")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return {"dashboard_id": normalized_dashboard_id, "deleted": True}

    def delete_dashboard_item(
        self,
        *,
        dashboard_id: str,
        dashboard_item_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        self.ensure_tables()
        normalized_dashboard_id = str(dashboard_id or "").strip()
        normalized_item_id = str(dashboard_item_id or "").strip()
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")
        if not normalized_item_id:
            raise ValueError("dashboard_item_id is required.")

        conn = self._connection()
        cursor = conn.cursor()
        try:
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
                           AND (:user_id = 0 OR d.created_by_user_id IN (:user_id, 0))
                   )
                """,
                dashboard_item_id=normalized_item_id,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            if cursor.rowcount != 1:
                raise ValueError("Dashboard visualization was not found.")

            cursor.execute(
                """
                SELECT dashboard_item_id
                  FROM analytics_dashboard_items
                 WHERE dashboard_id = :dashboard_id
                 ORDER BY item_order ASC, created_at ASC
                """,
                dashboard_id=normalized_dashboard_id,
            )
            for index, row in enumerate(cursor.fetchall(), start=1):
                cursor.execute(
                    """
                    UPDATE analytics_dashboard_items
                       SET item_order = :item_order
                     WHERE dashboard_id = :dashboard_id
                       AND dashboard_item_id = :dashboard_item_id
                    """,
                    item_order=index,
                    dashboard_id=normalized_dashboard_id,
                    dashboard_item_id=str(row[0] or ""),
                )

            cursor.execute(
                """
                UPDATE analytics_dashboards
                   SET updated_at = SYSDATE
                 WHERE dashboard_id = :dashboard_id
                """,
                dashboard_id=normalized_dashboard_id,
            )
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
        normalized_dashboard_id = str(dashboard_id or "").strip()
        normalized_item_ids = [str(item_id or "").strip() for item_id in dashboard_item_ids or [] if str(item_id or "").strip()]
        if not normalized_dashboard_id:
            raise ValueError("dashboard_id is required.")
        if not normalized_item_ids:
            raise ValueError("At least one dashboard_item_id is required.")
        if len(set(normalized_item_ids)) != len(normalized_item_ids):
            raise ValueError("Dashboard item order contains duplicate items.")

        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT i.dashboard_item_id
                  FROM analytics_dashboard_items i
                  JOIN analytics_dashboards d
                    ON d.dashboard_id = i.dashboard_id
                 WHERE i.dashboard_id = :dashboard_id
                   AND d.status = 'active'
                   AND (:user_id = 0 OR d.created_by_user_id IN (:user_id, 0))
                """,
                dashboard_id=normalized_dashboard_id,
                user_id=int(user_id or 0),
            )
            existing_ids = {str(row[0] or "") for row in cursor.fetchall()}
            if existing_ids != set(normalized_item_ids):
                raise ValueError("Dashboard item order must include every visualization exactly once.")

            for index, item_id in enumerate(normalized_item_ids, start=1):
                cursor.execute(
                    """
                    UPDATE analytics_dashboard_items
                       SET item_order = :item_order
                     WHERE dashboard_id = :dashboard_id
                       AND dashboard_item_id = :dashboard_item_id
                    """,
                    item_order=index,
                    dashboard_id=normalized_dashboard_id,
                    dashboard_item_id=item_id,
                )
            cursor.execute(
                """
                UPDATE analytics_dashboards
                   SET updated_at = SYSDATE
                 WHERE dashboard_id = :dashboard_id
                """,
                dashboard_id=normalized_dashboard_id,
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

        return self.get_dashboard(dashboard_id=normalized_dashboard_id, user_id=user_id)
