CREATE TABLE config (
    config_id          NUMBER NOT NULL,
    config_key         VARCHAR2(200) NOT NULL,
    config_value       CLOB,
    config_type        VARCHAR2(50) DEFAULT 'string',
    config_category    VARCHAR2(100),
    config_description VARCHAR2(500),
    config_encrypted   NUMBER DEFAULT 0,
    config_state       NUMBER DEFAULT 1 NOT NULL,
    config_updated     TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    config_created     TIMESTAMP(6) DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_config_id PRIMARY KEY (config_id),
    CONSTRAINT uk_config_key UNIQUE (config_key)
);
--
CREATE SEQUENCE config_id_seq START WITH 1 INCREMENT BY 1 NOCACHE;
--
CREATE OR REPLACE TRIGGER trg_config_id
    BEFORE INSERT ON config
    FOR EACH ROW
    WHEN (NEW.config_id IS NULL)
BEGIN
    :NEW.config_id := config_id_seq.NEXTVAL;
END;
/
--
CREATE OR REPLACE TRIGGER trg_config_updated
BEFORE UPDATE ON config
FOR EACH ROW
BEGIN
    :NEW.config_updated := SYSDATE;
END;
/
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('wizard.completed', 'false', 'string', 'general', 'Initial setup completion flag');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('app.name', 'Select AI Analytics', 'string', 'app', 'Display name');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('app.agent_name', 'Nadia Analytics', 'string', 'app', 'Assistant display name');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('app.session_timeout_minutes', '480', 'number', 'app', 'JWT session timeout in minutes');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('app.timezone', 'America/Lima', 'string', 'app', 'Runtime timezone');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('app.language', 'en', 'string', 'app', 'Default response language');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES (
    'suggested_questions.items',
    q'~["¿Cuál es el saldo actual por moneda y sucursal?","¿Qué cuentas tienen mayor saldo bloqueado?","¿Qué productos tienen mayor volumen de transacciones este mes?","¿Cuál es la tendencia diaria de débitos vs créditos en marzo?","¿Qué clientes tienen mayor volumen de transacciones este mes?","¿Qué cuentas tienen más retiros ATM?","¿Qué préstamos tienen mayor deuda pendiente?","¿Qué contratos de depósito vencen en los próximos 30 días?","¿Qué cuentas tienen transacciones ocultas en estados de cuenta?","¿Qué usuarios autorizaron más movimientos contables?"]~',
    'json',
    'suggested_questions',
    'Global starter question library'
);
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('select_ai.profile_name', 'APP_AGENT_ANALYTICS', 'string', 'select_ai', 'Default Select AI profile');
--
INSERT INTO config (config_key, config_value, config_type, config_category, config_description)
VALUES ('select_ai.credential_name', 'APP_AGENT_OCI_CRED', 'string', 'select_ai', 'OCI credential for DBMS_CLOUD_AI');
--
