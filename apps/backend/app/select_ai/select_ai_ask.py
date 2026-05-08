from __future__ import annotations

from typing import Any

from apps.backend.app.select_ai.charting import infer_chart_spec, validate_chart_spec
from apps.backend.app.select_ai.conversations import normalize_conversation_id
from apps.backend.app.select_ai.query_execution import execute_read_only_select
from apps.backend.app.select_ai.source_intents import _fallback_sql_for_question
from apps.backend.app.select_ai.sql_validation import validate_read_only_select


class SelectAIAskMixin:
    def execute_select(self, sql: str, *, max_rows: int = 500) -> tuple[list[str], list[dict[str, Any]]]:
        return execute_read_only_select(self._connection, sql, max_rows=max_rows)

    def ask(
        self,
        *,
        question: str,
        max_rows: int = 500,
        conversation_id: str | None = None,
        user_id: int = 0,
    ) -> dict[str, Any]:
        if not str(question or "").strip():
            raise ValueError("Question is required.")
        resolved_conversation_id = (
            normalize_conversation_id(conversation_id)
            if conversation_id
            else self._create_select_ai_conversation(title=question)
        )
        oracle_conversation_id = (
            self.resolve_oracle_conversation_id(
                conversation_id=resolved_conversation_id,
                user_id=user_id,
            )
            if conversation_id
            else resolved_conversation_id
        )
        scoped_profile_name, scoped_objects = self.create_scoped_profile(question)
        try:
            sql = self.generate_sql(
                question,
                conversation_id=oracle_conversation_id,
                profile_name=scoped_profile_name,
            )
            columns, rows = self.execute_select(sql, max_rows=max_rows)
            fallback_sql = _fallback_sql_for_question(question)
            validated_fallback_sql = validate_read_only_select(fallback_sql) if fallback_sql else None
            if validated_fallback_sql and not rows and validated_fallback_sql != sql:
                fallback_columns, fallback_rows = self.execute_select(validated_fallback_sql, max_rows=max_rows)
                if fallback_rows:
                    sql = validated_fallback_sql
                    columns = fallback_columns
                    rows = fallback_rows
            answer = self.narrate(
                question,
                conversation_id=oracle_conversation_id,
                profile_name=scoped_profile_name,
            )
            chart_spec = validate_chart_spec(
                infer_chart_spec(rows, columns, title=question[:120] or "Resultado analitico"),
                columns,
            )
            run_id = self.record_question_run(
                question=question,
                sql=sql,
                answer=answer,
                row_count=len(rows),
                chart_spec=chart_spec,
                conversation_id=resolved_conversation_id,
                oracle_conversation_id=oracle_conversation_id,
                columns=columns,
                rows=rows,
                max_rows=max_rows,
                user_id=user_id,
                profile_name=scoped_profile_name,
            )
        finally:
            self.drop_scoped_profile(scoped_profile_name)
        return {
            "run_id": run_id,
            "conversation_id": resolved_conversation_id,
            "answer": answer,
            "sql": sql,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "chart_spec": chart_spec,
            "agent_trace": [
                {
                    "stage": "select_ai.scope_profile",
                    "status": "completed",
                    "profile_name": scoped_profile_name,
                    "objects": scoped_objects,
                },
                {"stage": "select_ai.showsql", "status": "completed"},
                {"stage": "oracle.execute_select", "status": "completed", "rows": len(rows)},
                {"stage": "select_ai.narrate", "status": "completed"},
                {"stage": "chart_spec.infer", "status": "completed"},
            ],
        }
