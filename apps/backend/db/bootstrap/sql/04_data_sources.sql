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
