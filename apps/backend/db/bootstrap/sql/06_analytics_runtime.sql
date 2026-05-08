CREATE TABLE analytics_conversations (
    conversation_id     VARCHAR2(128) NOT NULL,
    conversation_type   VARCHAR2(20) NOT NULL,
    title               VARCHAR2(500),
    created_by_user_id  NUMBER DEFAULT 0 NOT NULL,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_analytics_conversations PRIMARY KEY (conversation_id),
    CONSTRAINT ck_analytics_conversations_type CHECK (conversation_type IN ('analytics', 'agent'))
);
--
CREATE INDEX idx_analytics_conversations_type
    ON analytics_conversations (conversation_type, updated_at);
--
CREATE TABLE load_jobs (
    load_job_id         VARCHAR2(32) NOT NULL,
    source_file_name    VARCHAR2(500) NOT NULL,
    target_table_name   VARCHAR2(128) NOT NULL,
    row_count           NUMBER DEFAULT 0 NOT NULL,
    status              VARCHAR2(40) NOT NULL,
    error_message       VARCHAR2(4000),
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_load_jobs PRIMARY KEY (load_job_id)
);
--
CREATE TABLE question_runs (
    question_run_id     VARCHAR2(32) NOT NULL,
    conversation_id     VARCHAR2(128),
    profile_name        VARCHAR2(128) NOT NULL,
    question_text       CLOB NOT NULL,
    generated_sql       CLOB NOT NULL,
    answer_text         CLOB,
    row_count           NUMBER DEFAULT 0 NOT NULL,
    chart_spec_json     CLOB,
    status              VARCHAR2(40) NOT NULL,
    error_message       VARCHAR2(4000),
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_question_runs PRIMARY KEY (question_run_id),
    CONSTRAINT fk_question_runs_conversation FOREIGN KEY (conversation_id)
        REFERENCES analytics_conversations(conversation_id)
);
--
CREATE TABLE chart_specs (
    chart_spec_id       VARCHAR2(32) NOT NULL,
    question_run_id     VARCHAR2(32) NOT NULL,
    chart_spec_json     CLOB NOT NULL,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_chart_specs PRIMARY KEY (chart_spec_id),
    CONSTRAINT fk_chart_specs_question_run FOREIGN KEY (question_run_id)
        REFERENCES question_runs(question_run_id) ON DELETE CASCADE
);
--
CREATE TABLE audit_events (
    audit_event_id      VARCHAR2(32) NOT NULL,
    event_type          VARCHAR2(100) NOT NULL,
    event_payload       CLOB,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_audit_events PRIMARY KEY (audit_event_id)
);
--
