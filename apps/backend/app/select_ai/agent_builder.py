from __future__ import annotations

import json
import re
import uuid
from typing import Any

import oracledb

from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id


OBJECT_PARAM_MAP = {
    "TOOL": "tool_name",
    "TASK": "task_name",
    "AGENT": "agent_name",
    "TEAM": "team_name",
}


def safe_agent_identifier(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    if not cleaned or not cleaned[0].isalpha():
        raise ValueError("Agent object name must start with a letter.")
    return cleaned[:125]


def build_dbms_block(object_type: str, identifier: str, attributes: dict[str, Any]) -> str:
    normalized_type = object_type.upper()
    param = OBJECT_PARAM_MAP.get(normalized_type)
    if not param:
        raise ValueError(f"Unsupported object type: {object_type}")
    name = safe_agent_identifier(identifier)
    json_text = json.dumps(attributes or {}, indent=4, ensure_ascii=False).replace("'", "''")
    indented = "\n".join(f"            {line}" for line in json_text.splitlines())
    return (
        "BEGIN\n"
        f"    DBMS_CLOUD_AI_AGENT.DROP_{normalized_type}({param} => '{name}', force => TRUE);\n\n"
        f"    DBMS_CLOUD_AI_AGENT.CREATE_{normalized_type}(\n"
        f"        {param} => '{name}',\n"
        "        attributes => '\n"
        f"{indented}\n"
        "        ');\n"
        "END;\n"
        "/"
    )


def build_attributes(object_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    normalized_type = object_type.upper()
    if normalized_type == "TOOL":
        attrs: dict[str, Any] = {"tool_type": payload.get("tool_type", "SQL")}
        if payload.get("instruction"):
            attrs["instruction"] = payload["instruction"]
        if attrs["tool_type"] == "CUSTOM" and payload.get("function"):
            attrs["function"] = payload["function"]
        if payload.get("profile_name"):
            attrs["tool_params"] = {"profile_name": payload["profile_name"]}
        if payload.get("description"):
            attrs["description"] = payload["description"]
        return attrs
    if normalized_type == "TASK":
        tools = payload.get("tools") or []
        if isinstance(tools, str):
            tools = [item.strip() for item in tools.split(",") if item.strip()]
        attrs = {"instruction": payload.get("instruction", ""), "tools": tools}
        inputs = payload.get("input")
        if inputs:
            attrs["input"] = inputs
        if payload.get("description"):
            attrs["description"] = payload["description"]
        return attrs
    if normalized_type == "AGENT":
        return {
            "profile_name": payload.get("profile_name", "APP_AGENT_ANALYTICS"),
            "role": payload.get("role", ""),
            "enable_human_tool": "True" if str(payload.get("enable_human_tool", "")).lower() in {"true", "1", "yes"} else "False",
        }
    if normalized_type == "TEAM":
        agents = payload.get("agents") or []
        if not isinstance(agents, list):
            raise ValueError("TEAM agents must be a list of {name, task} objects.")
        clean_agents = [
            {"name": safe_agent_identifier(str(item.get("name"))), "task": safe_agent_identifier(str(item.get("task")))}
            for item in agents
            if isinstance(item, dict) and item.get("name") and item.get("task")
        ]
        return {"agents": clean_agents, "process": payload.get("process", "sequential")}
    raise ValueError(f"Unsupported object type: {object_type}")


class AgentBuilderService:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def _connection(self):
        return self.db_manager.get_connection()

    def create_object(self, *, object_type: str, name: str, attributes: dict[str, Any]) -> dict[str, Any]:
        normalized_type = object_type.upper()
        param = OBJECT_PARAM_MAP.get(normalized_type)
        if not param:
            raise ValueError(f"Unsupported object type: {object_type}")
        safe_name = safe_agent_identifier(name)
        attrs = build_attributes(normalized_type, attributes)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            attrs_json = json.dumps(attrs, ensure_ascii=False)
            cursor.execute(
                f"""
                BEGIN
                    BEGIN
                        DBMS_CLOUD_AI_AGENT.DROP_{normalized_type}({param} => :object_name, force => TRUE);
                    EXCEPTION
                        WHEN OTHERS THEN
                            IF SQLCODE = -4043 OR INSTR(LOWER(SQLERRM), 'not exist') > 0 THEN
                                NULL;
                            ELSE
                                RAISE;
                            END IF;
                    END;

                    DBMS_CLOUD_AI_AGENT.CREATE_{normalized_type}(
                        {param} => :object_name,
                        attributes => :attributes_json
                    );
                END;
                """,
                object_name=safe_name,
                attributes_json=attrs_json,
            )
            definition_id = uuid.uuid4().hex
            cursor.execute(
                """
                MERGE INTO agent_definitions d
                USING DUAL
                   ON (d.object_type = :object_type AND d.object_name = :object_name)
                WHEN MATCHED THEN
                    UPDATE SET d.attributes_json = :attributes_json,
                               d.status = 'active',
                               d.updated_at = SYSDATE
                WHEN NOT MATCHED THEN
                    INSERT (agent_definition_id, object_type, object_name, attributes_json, status)
                    VALUES (:id, :object_type, :object_name, :attributes_json, 'active')
                """,
                id=definition_id,
                object_type=normalized_type,
                object_name=safe_name,
                attributes_json=attrs_json,
            )
            conn.commit()
            return {
                "agent_definition_id": definition_id,
                "object_type": normalized_type,
                "object_name": safe_name,
                "attributes": attrs,
                "script": build_dbms_block(normalized_type, safe_name, attrs),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def validate_name(cursor, object_type: str, object_name: str) -> None:
        cursor.callproc("SP_AI_NAME_VALIDATE", [object_type, object_name])

    def run_team(
        self,
        *,
        team_name: str,
        prompt: str,
        conversation_id: str | None = None,
        user_id: int = 0,
    ) -> dict[str, Any]:
        safe_team = safe_agent_identifier(team_name)
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        conn = self._connection()
        cursor = conn.cursor()
        run_id = uuid.uuid4().hex
        try:
            output_var = cursor.var(oracledb.CLOB)
            params = json.dumps({"conversation_id": resolved_conversation_id}, ensure_ascii=False)
            cursor.execute(
                """
                BEGIN
                    :out_value := DBMS_CLOUD_AI_AGENT.RUN_TEAM(
                        team_name   => :team_name,
                        user_prompt => :user_prompt,
                        params      => :params_json
                    );
                END;
                """,
                out_value=output_var,
                team_name=safe_team,
                user_prompt=prompt,
                params_json=params,
            )
            raw_output = output_var.getvalue()
            if hasattr(raw_output, "read"):
                raw_output = raw_output.read()
            ensure_conversation(
                cursor,
                conversation_id=resolved_conversation_id,
                conversation_type="agent",
                title=prompt,
                user_id=user_id,
            )
            conn.commit()
            cursor.execute(
                """
                INSERT INTO agent_builder_runs (
                    agent_builder_run_id, team_name, prompt_text, response_text,
                    conversation_id, status
                ) VALUES (
                    :id, :team_name, :prompt, :response, :conversation_id, 'completed'
                )
                """,
                id=run_id,
                team_name=safe_team,
                prompt=prompt,
                response=str(raw_output or ""),
                conversation_id=resolved_conversation_id,
            )
            conn.commit()
            return {
                "run_id": run_id,
                "conversation_id": resolved_conversation_id,
                "team_name": safe_team,
                "response": str(raw_output or ""),
            }
        finally:
            cursor.close()
            conn.close()
