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
        "object_list_mode":"automated",
        "object_list":' || l_object_list || ',
        "enforce_object_list":"true",
        "region":"' || l_region || '",
        "oci_compartment_id":"' || l_compartment_id || '"
    }';

    DBMS_CLOUD_AI.CREATE_PROFILE(
        profile_name => p_profile_name,
        attributes   => l_json_attributes
    );

    BEGIN
        DBMS_CLOUD_AI_AGENT.DROP_TOOL(tool_name => p_profile_name || '_SQL_TOOL', force => TRUE);
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -4043 OR INSTR(LOWER(SQLERRM), 'not exist') > 0 THEN
                NULL;
            ELSE
                RAISE;
            END IF;
    END;

    DBMS_CLOUD_AI_AGENT.CREATE_TOOL(
        tool_name  => p_profile_name || '_SQL_TOOL',
        attributes => '{"tool_type":"SQL","tool_params":{"profile_name":"' || p_profile_name || '"}}'
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
--
CREATE OR REPLACE PROCEDURE SP_SEL_AI_AGENT (
    p_profile_name IN VARCHAR2
) AS
    l_agent_name      VARCHAR2(128) := p_profile_name || '_AGENT';
    l_answer_task     VARCHAR2(128) := p_profile_name || '_ANSWER_TASK';
    l_chart_task      VARCHAR2(128) := p_profile_name || '_CHART_TASK';
    l_sql_tool        VARCHAR2(128) := p_profile_name || '_SQL_TOOL';
    l_team_name       VARCHAR2(128) := p_profile_name || '_TEAM';
BEGIN
    BEGIN
        DBMS_CLOUD_AI_AGENT.DROP_AGENT(agent_name => l_agent_name, force => TRUE);
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -4043 AND INSTR(LOWER(SQLERRM), 'not exist') = 0 THEN RAISE; END IF;
    END;
    DBMS_CLOUD_AI_AGENT.CREATE_AGENT(
        agent_name => l_agent_name,
        attributes => '{
            "profile_name":"' || p_profile_name || '",
            "role":"You are a senior banking analytics agent. Use only the registered SQL tool, explain the result in Spanish, and never invent data.",
            "enable_human_tool":"False"
        }'
    );

    BEGIN
        DBMS_CLOUD_AI_AGENT.DROP_TASK(task_name => l_answer_task, force => TRUE);
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -4043 AND INSTR(LOWER(SQLERRM), 'not exist') = 0 THEN RAISE; END IF;
    END;
    DBMS_CLOUD_AI_AGENT.CREATE_TASK(
        task_name => l_answer_task,
        attributes => '{
            "instruction":"Answer the user query {query} using the SQL tool. Include the SQL reasoning briefly and highlight business insights.",
            "tools":["' || l_sql_tool || '"]
        }'
    );

    BEGIN
        DBMS_CLOUD_AI_AGENT.DROP_TASK(task_name => l_chart_task, force => TRUE);
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -4043 AND INSTR(LOWER(SQLERRM), 'not exist') = 0 THEN RAISE; END IF;
    END;
    DBMS_CLOUD_AI_AGENT.CREATE_TASK(
        task_name => l_chart_task,
        attributes => '{
            "instruction":"Given {query}, recommend a compact JSON chart spec with type, title, x and y fields when a chart is useful.",
            "tools":["' || l_sql_tool || '"]
        }'
    );

    BEGIN
        DBMS_CLOUD_AI_AGENT.DROP_TEAM(team_name => l_team_name, force => TRUE);
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -4043 AND INSTR(LOWER(SQLERRM), 'not exist') = 0 THEN RAISE; END IF;
    END;
    DBMS_CLOUD_AI_AGENT.CREATE_TEAM(
        team_name => l_team_name,
        attributes => '{"agents":[{"name":"' || l_agent_name || '","task":"' || l_answer_task || '"},{"name":"' || l_agent_name || '","task":"' || l_chart_task || '"}],"process":"sequential"}'
    );
END;
/
--
CREATE OR REPLACE PROCEDURE SP_AI_NAME_VALIDATE (
    p_object_type IN VARCHAR2,
    p_object_name IN VARCHAR2
) AS
    v_cnt INTEGER := 0;
    v_type VARCHAR2(16) := UPPER(TRIM(p_object_type));
    v_name VARCHAR2(256) := TRIM(p_object_name);
BEGIN
    IF v_type IS NULL OR v_name IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'object_type and object_name are required');
    END IF;

    IF v_type = 'TEAM' THEN
        SELECT COUNT(*) INTO v_cnt FROM USER_AI_AGENT_TEAMS WHERE UPPER(AGENT_TEAM_NAME) = UPPER(v_name);
    ELSIF v_type = 'AGENT' THEN
        SELECT COUNT(*) INTO v_cnt FROM USER_AI_AGENTS WHERE UPPER(AGENT_NAME) = UPPER(v_name);
    ELSIF v_type = 'TASK' THEN
        SELECT COUNT(*) INTO v_cnt FROM USER_AI_AGENT_TASKS WHERE UPPER(TASK_NAME) = UPPER(v_name);
    ELSIF v_type = 'TOOL' THEN
        SELECT COUNT(*) INTO v_cnt FROM USER_AI_AGENT_TOOLS WHERE UPPER(TOOL_NAME) = UPPER(v_name);
    ELSE
        RAISE_APPLICATION_ERROR(-20005, 'Unsupported object_type: ' || v_type);
    END IF;

    IF v_cnt > 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Name already exists for ' || v_type || ': ' || v_name);
    END IF;
END;
/
--
