from __future__ import annotations

import json

import oracledb

from apps.backend.app.select_ai.conversations import normalize_conversation_id
from apps.backend.app.select_ai.errors import (
    GENAI_RESOURCE_EXHAUSTED_DETAIL,
    SelectAIModelCapacityError,
    is_genai_resource_exhausted,
)
from apps.backend.app.select_ai.source_intents import (
    _is_velocity_window_intent,
    _sql_generation_hints,
    _uses_current_clock,
    _uses_current_clock_for_velocity_sql,
)
from apps.backend.app.select_ai.sql_validation import validate_read_only_select
from apps.backend.app.select_ai.value_serialization import _read_lob


class SelectAIGenerationMixin:
    def _create_select_ai_conversation(self, *, title: str) -> str:
        with self._cursor() as (_, cursor):
            output_var = cursor.var(oracledb.STRING)
            attributes = json.dumps(
                {
                    "title": str(title or "APP_AGENT Analytics")[:120],
                    "retention_days": 7,
                    "conversation_length": 10,
                },
                ensure_ascii=False,
            )
            cursor.execute(
                """
                BEGIN
                    :out_value := DBMS_CLOUD_AI.CREATE_CONVERSATION(
                        attributes => :attributes_json
                    );
                END;
                """,
                out_value=output_var,
                attributes_json=attributes,
            )
            return normalize_conversation_id(str(output_var.getvalue() or ""))

    def _generate(
        self,
        *,
        prompt: str,
        action: str,
        profile_name: str | None = None,
        conversation_id: str | None = None,
    ) -> str:
        with self._cursor() as (_, cursor):
            output_var = cursor.var(oracledb.CLOB)
            params = json.dumps({"conversation_id": conversation_id}, ensure_ascii=False) if conversation_id else None
            try:
                cursor.execute(
                    """
                    BEGIN
                        :out_value := DBMS_CLOUD_AI.GENERATE(
                            prompt       => :prompt,
                            profile_name => :profile_name,
                            action       => :action,
                            params       => :params_json
                        );
                    END;
                    """,
                    out_value=output_var,
                    prompt=str(prompt or "").strip(),
                    profile_name=profile_name or self._profile_name(),
                    action=action,
                    params_json=params,
                )
            except Exception as exc:
                if is_genai_resource_exhausted(exc):
                    raise SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL) from exc
                raise
            return str(_read_lob(output_var.getvalue()) or "").strip()

    def generate_sql(
        self,
        question: str,
        *,
        conversation_id: str | None = None,
        profile_name: str | None = None,
    ) -> str:
        showsql_prompt = (
            "Return exactly one Oracle SQL SELECT statement for the user question. "
            "Do not include markdown fences, comments, explanations, DML, DDL, PL/SQL, or a trailing semicolon. "
            "Use only the tables and columns available in the Select AI profile object list. "
            f"{_sql_generation_hints(question)} "
            f"User question: {question}"
        )
        sql = self._generate(
            prompt=showsql_prompt,
            action="showsql",
            conversation_id=conversation_id,
            profile_name=profile_name,
        )
        safe_sql = validate_read_only_select(sql)
        if (
            _is_velocity_window_intent(question)
            and _uses_current_clock(safe_sql)
        ) or _uses_current_clock_for_velocity_sql(safe_sql):
            correction_prompt = (
                f"{showsql_prompt} "
                "The previous generated SQL was invalid because it filtered against the current system clock. "
                "Regenerate one SELECT statement only. Do not use SYSTIMESTAMP, SYSDATE, CURRENT_DATE, or CURRENT_TIMESTAMP. "
                "Find historical one-hour windows by grouping records from FLEX_EXT_ACCOUNT_TRANSACTIONS with REAL_DT_TIME."
            )
            safe_sql = validate_read_only_select(
                self._generate(
                    prompt=correction_prompt,
                    action="showsql",
                    conversation_id=conversation_id,
                    profile_name=profile_name,
                )
            )
            if _uses_current_clock_for_velocity_sql(safe_sql):
                raise ValueError(
                    "Select AI generated a current-time filter for a historical velocity question. "
                    "The SQL was rejected because it would hide seeded historical anomalies."
                )
        return safe_sql

    def narrate(
        self,
        question: str,
        *,
        conversation_id: str | None = None,
        profile_name: str | None = None,
    ) -> str:
        return self._generate(prompt=question, action="narrate", conversation_id=conversation_id, profile_name=profile_name)
