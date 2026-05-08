from __future__ import annotations

from typing import Any

from apps.backend.app.select_ai.conversation_mutations import SelectAIConversationMutationMixin
from apps.backend.app.select_ai.conversations import normalize_conversation_id
from apps.backend.app.select_ai.conversation_store import (
    _select_conversation_header,
    _select_conversation_list,
    _select_question_runs,
)
from apps.backend.app.select_ai.charting import validate_chart_spec
from apps.backend.app.select_ai.sql_validation import validate_read_only_select
from apps.backend.app.select_ai.value_serialization import _json_loads
from apps.backend.app.select_ai.value_serialization import _json_safe, _rows_as_dicts


def _safe_max_rows(max_rows: int | None, *, default: int = 500, upper_bound: int = 5000) -> int:
    return max(1, min(int(max_rows or default), upper_bound))


def _materialize_stored_result(
    *,
    generated_sql: Any,
    chart_spec_json: Any,
    columns_json: Any = None,
    rows_json: Any = None,
    snapshot_row_count: Any = None,
    execute_select,
    max_rows: int | None = 500,
) -> dict[str, Any]:
    safe_sql = validate_read_only_select(str(generated_sql or ""))
    if columns_json is not None and rows_json is not None:
        columns = _json_loads(columns_json, default=[])
        rows = _json_loads(rows_json, default=[])
    else:
        columns, rows = execute_select(safe_sql, max_rows=_safe_max_rows(max_rows))
    chart_spec = validate_chart_spec(_json_loads(chart_spec_json, default={}), columns)
    return {
        "sql": safe_sql,
        "columns": columns,
        "rows": rows,
        "row_count": int(snapshot_row_count or len(rows)),
        "chart_spec": chart_spec,
    }


class SelectAIConversationMixin(SelectAIConversationMutationMixin):
    def list_conversations(
        self,
        *,
        user_id: int = 0,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        normalized_search = str(search or "").strip().lower()
        search_filter = f"%{normalized_search}%" if normalized_search else None
        safe_limit = max(1, min(int(limit or 50), 100))
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_conversation_list(
                cursor,
                user_id=int(user_id or 0),
                search_filter=search_filter,
                limit_value=safe_limit,
            )
            return _rows_as_dicts(cursor)
        finally:
            cursor.close()
            conn.close()

    def get_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
        max_rows: int = 500,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_conversation_header(
                cursor,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            )
            conversation = cursor.fetchone()
            if not conversation:
                raise ValueError("Conversation was not found.")

            _select_question_runs(cursor, conversation_id=resolved_conversation_id)
            runs = _rows_as_dicts(cursor)
        finally:
            cursor.close()
            conn.close()

        messages: list[dict[str, Any]] = []
        for run in runs:
            result = _materialize_stored_result(
                generated_sql=run.get("generated_sql"),
                chart_spec_json=run.get("chart_spec_json"),
                columns_json=run.get("columns_json"),
                rows_json=run.get("rows_json"),
                snapshot_row_count=run.get("snapshot_row_count"),
                execute_select=self.execute_select,
                max_rows=max_rows,
            )
            messages.append(
                {
                    "run_id": str(run.get("question_run_id") or ""),
                    "question": str(run.get("question_text") or ""),
                    "created_at": run.get("created_at"),
                    "result": {
                        "run_id": str(run.get("question_run_id") or ""),
                        "conversation_id": resolved_conversation_id,
                        "answer": str(run.get("answer_text") or ""),
                        **result,
                        "agent_trace": [
                            {
                                "stage": "history.restore_select",
                                "status": "completed",
                                "rows": result["row_count"],
                            }
                        ],
                    },
                }
            )

        return {
            "conversation_id": str(conversation[0] or resolved_conversation_id),
            "title": str(conversation[1] or "Analytics chat"),
            "created_at": _json_safe(conversation[2]),
            "updated_at": _json_safe(conversation[3]),
            "messages": messages,
        }
