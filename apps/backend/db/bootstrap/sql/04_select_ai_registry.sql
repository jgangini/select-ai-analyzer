CREATE TABLE data_sources (
    data_source_id      VARCHAR2(32) NOT NULL,
    source_name         VARCHAR2(255) NOT NULL,
    source_type         VARCHAR2(40) NOT NULL,
    owner_name          VARCHAR2(128) NOT NULL,
    table_name          VARCHAR2(128) NOT NULL,
    source_file_name    VARCHAR2(500),
    access_scope        VARCHAR2(20) DEFAULT 'all' NOT NULL,
    row_count           NUMBER DEFAULT 0 NOT NULL,
    status              VARCHAR2(40) DEFAULT 'active' NOT NULL,
    created_by_user_id  NUMBER DEFAULT 0 NOT NULL,
    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_data_sources PRIMARY KEY (data_source_id),
    CONSTRAINT ck_data_sources_type CHECK (source_type IN ('csv', 'existing_table')),
    CONSTRAINT ck_data_sources_scope CHECK (access_scope IN ('all', 'private'))
);
--
CREATE UNIQUE INDEX ux_data_sources_object
    ON data_sources (owner_name, table_name);
--
CREATE TABLE source_columns (
    source_column_id    VARCHAR2(32) NOT NULL,
    data_source_id      VARCHAR2(32) NOT NULL,
    column_name         VARCHAR2(128) NOT NULL,
    data_type           VARCHAR2(128) NOT NULL,
    data_length         NUMBER DEFAULT 0 NOT NULL,
    nullable_flag       CHAR(1) DEFAULT 'Y' NOT NULL,
    ordinal_position    NUMBER NOT NULL,
    business_comment    VARCHAR2(1000),
    classification      VARCHAR2(100),
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_source_columns PRIMARY KEY (source_column_id),
    CONSTRAINT fk_source_columns_data_source FOREIGN KEY (data_source_id)
        REFERENCES data_sources(data_source_id) ON DELETE CASCADE
);
--
CREATE INDEX idx_source_columns_source
    ON source_columns (data_source_id, ordinal_position);
--
CREATE TABLE select_ai_profiles (
    profile_name        VARCHAR2(128) NOT NULL,
    user_id             NUMBER DEFAULT 0 NOT NULL,
    credential_name     VARCHAR2(128) NOT NULL,
    model_name          VARCHAR2(255) NOT NULL,
    status              VARCHAR2(40) DEFAULT 'active' NOT NULL,
    object_count        NUMBER DEFAULT 0 NOT NULL,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_select_ai_profiles PRIMARY KEY (profile_name)
);
--
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
CREATE TABLE agent_definitions (
    agent_definition_id VARCHAR2(32) NOT NULL,
    object_type         VARCHAR2(20) NOT NULL,
    object_name         VARCHAR2(128) NOT NULL,
    attributes_json     CLOB NOT NULL,
    status              VARCHAR2(40) DEFAULT 'active' NOT NULL,
    created_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    updated_at          TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_agent_definitions PRIMARY KEY (agent_definition_id),
    CONSTRAINT ck_agent_definitions_type CHECK (object_type IN ('TOOL', 'TASK', 'AGENT', 'TEAM'))
);
--
CREATE UNIQUE INDEX ux_agent_definitions_name
    ON agent_definitions (object_type, object_name);
--
CREATE TABLE agent_builder_runs (
    agent_builder_run_id VARCHAR2(32) NOT NULL,
    team_name            VARCHAR2(128) NOT NULL,
    prompt_text          CLOB NOT NULL,
    response_text        CLOB,
    conversation_id      VARCHAR2(128),
    status               VARCHAR2(40) NOT NULL,
    created_at           TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_agent_builder_runs PRIMARY KEY (agent_builder_run_id),
    CONSTRAINT fk_agent_builder_runs_conversation FOREIGN KEY (conversation_id)
        REFERENCES analytics_conversations(conversation_id)
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
