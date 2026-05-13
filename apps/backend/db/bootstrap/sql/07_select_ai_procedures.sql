CREATE OR REPLACE PROCEDURE SP_SEL_AI_PROFILE (
    p_profile_name IN VARCHAR2,
    p_user_id      IN NUMBER DEFAULT 0
) AS
    l_model           VARCHAR2(255);
    l_credential      VARCHAR2(128);
    l_region          VARCHAR2(255);
    l_compartment_id  VARCHAR2(255);
    l_object_list     CLOB;
    l_json_attributes CLOB;
    l_object_count    NUMBER := 0;
BEGIN
    SELECT MAX(CASE WHEN config_key = 'genai.model' THEN TRIM(DBMS_LOB.SUBSTR(config_value, 4000, 1)) END),
           NVL(MAX(CASE WHEN config_key = 'select_ai.credential_name' THEN DBMS_LOB.SUBSTR(config_value, 4000, 1) END), 'APP_AGENT_OCI_CRED'),
           NVL(MAX(CASE WHEN config_key = 'oci.region' THEN DBMS_LOB.SUBSTR(config_value, 4000, 1) END), ''),
           NVL(MAX(CASE WHEN config_key = 'oci.compartment_id' THEN DBMS_LOB.SUBSTR(config_value, 4000, 1) END), '')
      INTO l_model, l_credential, l_region, l_compartment_id
      FROM config;

    IF l_model IS NULL THEN
        RAISE_APPLICATION_ERROR(
            -20011,
            'Generative AI model is not configured. Save Generative AI configuration before creating Select AI profile.'
        );
    END IF;

    l_object_list := '[';
    FOR rec IN (
        SELECT owner_name, table_name
          FROM data_sources
         WHERE status = 'active'
           AND access_scope = 'all'
           AND owner_name <> 'APP_AGENT'
         ORDER BY owner_name, table_name
    ) LOOP
        IF l_object_count > 0 THEN
            l_object_list := l_object_list || ',';
        END IF;
        l_object_list := l_object_list
            || '{"owner":"' || rec.owner_name || '","name":"' || rec.table_name || '"}';
        l_object_count := l_object_count + 1;
    END LOOP;
    l_object_list := l_object_list || ']';

    BEGIN
        DBMS_CLOUD_AI.DROP_PROFILE(profile_name => p_profile_name, force => TRUE);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -4043 OR INSTR(LOWER(SQLERRM), 'not exist') > 0 THEN
                NULL;
            ELSE
                RAISE;
            END IF;
    END;

    l_json_attributes := '{
        "provider":"oci",
        "credential_name":"' || l_credential || '",
        "model":"' || l_model || '",
        "temperature":0.2,
        "comments":"true",
        "annotations":"true",
        "constraints":"true",
        "conversation":"true",
        "object_list":' || l_object_list || ',
        "enforce_object_list":"true",
        "region":"' || l_region || '",
        "oci_compartment_id":"' || l_compartment_id || '"
    }';

    DBMS_CLOUD_AI.CREATE_PROFILE(
        profile_name => p_profile_name,
        attributes   => l_json_attributes
    );

    MERGE INTO select_ai_profiles p
    USING DUAL ON (p.profile_name = p_profile_name)
    WHEN MATCHED THEN
        UPDATE SET p.user_id = NVL(p_user_id, 0),
                   p.credential_name = l_credential,
                   p.model_name = l_model,
                   p.object_count = l_object_count,
                   p.status = 'active',
                   p.updated_at = SYSDATE
    WHEN NOT MATCHED THEN
        INSERT (profile_name, user_id, credential_name, model_name, object_count, status)
        VALUES (p_profile_name, NVL(p_user_id, 0), l_credential, l_model, l_object_count, 'active');
END;
/
