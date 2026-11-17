from __future__ import annotations


def _create_if_missing(cursor, ddl: str) -> None:
    try:
        cursor.execute(ddl)
    except Exception as exc:
        if "ORA-00955" not in str(exc):
            raise


def _alter_if_missing(cursor, ddl: str) -> None:
    try:
        cursor.execute(ddl)
    except Exception as exc:
        message = str(exc)
        if "ORA-01430" not in message and "ORA-02264" not in message:
            raise


def _normalize_visibility(value: str | None) -> str:
    visibility = str(value or "private").strip().lower()
    if visibility not in {"private", "shared"}:
        raise ValueError("Dashboard visibility must be private or shared.")
    return visibility


class DashboardSchemaMixin:
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
                    visibility          VARCHAR2(20) DEFAULT 'private' NOT NULL,
                    created_by_user_id  NUMBER DEFAULT 0 NOT NULL,
                    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
                    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
                    CONSTRAINT pk_analytics_dashboards PRIMARY KEY (dashboard_id),
                    CONSTRAINT ck_analytics_dashboards_status CHECK (status IN ('active', 'archived')),
                    CONSTRAINT ck_analytics_dashboards_visibility CHECK (visibility IN ('private', 'shared'))
                )
                """,
            )
            _alter_if_missing(
                cursor,
                """
                ALTER TABLE analytics_dashboards
                    ADD (visibility VARCHAR2(20) DEFAULT 'private' NOT NULL)
                """,
            )
            _alter_if_missing(
                cursor,
                """
                ALTER TABLE analytics_dashboards
                    ADD CONSTRAINT ck_analytics_dashboards_visibility
                    CHECK (visibility IN ('private', 'shared'))
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
