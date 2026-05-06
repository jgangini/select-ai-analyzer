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
);
--
CREATE INDEX idx_analytics_dashboards_user
    ON analytics_dashboards (created_by_user_id, updated_at);
--
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
);
--
CREATE INDEX idx_dashboard_items_dashboard
    ON analytics_dashboard_items (dashboard_id, item_order);
--
