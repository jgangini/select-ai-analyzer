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
