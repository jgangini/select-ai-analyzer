from __future__ import annotations

from contextlib import contextmanager
import json
from typing import Any
import uuid

from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id
from apps.backend.app.select_ai.conversation_store import (
    _analytics_conversation_exists,
    _delete_analytics_conversation,
    _delete_question_runs,
    _insert_question_run,
    _insert_question_run_snapshot,
    _rename_analytics_conversation,
    _select_conversation_header,
    _select_conversation_list,
    _select_conversation_owner,
    _select_conversation_summary,
    _select_question_runs,
    _select_user_question_usage,
)
from apps.backend.app.select_ai.charting import validate_chart_spec
from apps.backend.app.select_ai.question_recommendations import build_question_recommendations
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


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _assert_conversation_writable(cursor, *, conversation_id: str, user_id: int) -> str | None:
    _select_conversation_owner(cursor, conversation_id=conversation_id)
    row = cursor.fetchone()
    if not row or int(user_id or 0) == 0:
        return str(row[1] or conversation_id) if row else None
    if int(row[0] or 0) not in {0, int(user_id or 0)}:
        raise ValueError("Conversation was not found.")
    return str(row[1] or conversation_id)


@contextmanager
def _open_cursor(service):
    conn = service._connection()
    cursor = conn.cursor()
    try:
        yield conn, cursor
    finally:
        cursor.close()
        conn.close()


@contextmanager
def _transaction_cursor(service):
    with _open_cursor(service) as (conn, cursor):
        try:
            yield conn, cursor
        except Exception:
            conn.rollback()
            raise


class SelectAIConversationMutationMixin:
    def delete_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        with _transaction_cursor(self) as (conn, cursor):
            if not _analytics_conversation_exists(
                cursor,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            ):
                raise ValueError("Conversation was not found.")
            deleted_runs = _delete_question_runs(cursor, conversation_id=resolved_conversation_id)
            deleted_conversations = _delete_analytics_conversation(cursor, conversation_id=resolved_conversation_id)
            if deleted_conversations != 1:
                raise ValueError("Conversation was not deleted.")
            conn.commit()
            return {
                "conversation_id": resolved_conversation_id,
                "deleted": True,
                "deleted_runs": deleted_runs,
            }

    def rename_conversation(
        self,
        *,
        conversation_id: str,
        title: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        normalized_title = str(title or "").strip()[:500]
        if not normalized_title:
            raise ValueError("Conversation title is required.")
        with _transaction_cursor(self) as (conn, cursor):
            updated_count = _rename_analytics_conversation(
                cursor,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
                title=normalized_title,
            )
            if updated_count != 1:
                raise ValueError("Conversation was not found.")
            _select_conversation_summary(cursor, conversation_id=resolved_conversation_id)
            row = cursor.fetchone()
            if not row:
                raise ValueError("Conversation was not found.")
            conn.commit()
            return {
                "conversation_id": str(row[0] or resolved_conversation_id),
                "title": str(row[1] or normalized_title),
                "created_at": _json_safe(row[2]),
                "updated_at": _json_safe(row[3]),
                "turns": int(row[4] or 0),
                "last_message_preview": str(row[5] or ""),
            }

    def record_question_run(
        self,
        *,
        question: str,
        sql: str,
        answer: str,
        row_count: int,
        chart_spec: dict[str, Any],
        conversation_id: str,
        columns: list[str],
        rows: list[dict[str, Any]],
        max_rows: int = 500,
        oracle_conversation_id: str | None = None,
        user_id: int = 0,
        profile_name: str | None = None,
    ) -> str:
        run_id = uuid.uuid4().hex
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        with _transaction_cursor(self) as (conn, cursor):
            _assert_conversation_writable(
                cursor,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            )
            ensure_conversation(
                cursor,
                conversation_id=resolved_conversation_id,
                oracle_conversation_id=oracle_conversation_id or resolved_conversation_id,
                conversation_type="analytics",
                title=question,
                user_id=user_id,
            )
            # ADB can raise ORA-12860 when the parent conversation MERGE and child
            # question_runs insert are kept in the same transaction under FK checks.
            conn.commit()
            _insert_question_run(
                cursor,
                run_id=run_id,
                conversation_id=resolved_conversation_id,
                profile_name=profile_name or self._profile_name(),
                question=question,
                sql=sql,
                answer=answer,
                row_count=row_count,
                chart_spec=json.dumps(chart_spec),
            )
            _insert_question_run_snapshot(
                cursor,
                run_id=run_id,
                columns_json=_json_dump(columns),
                rows_json=_json_dump(rows),
                row_count=int(row_count or 0),
                max_rows=int(max_rows or 0),
                truncated_flag="Y" if int(row_count or 0) >= int(max_rows or 0) else "N",
            )
            conn.commit()
            return run_id

    def resolve_oracle_conversation_id(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
    ) -> str:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        with _open_cursor(self) as (_conn, cursor):
            return _assert_conversation_writable(
                cursor,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            ) or resolved_conversation_id


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
        with _open_cursor(self) as (_conn, cursor):
            _select_conversation_list(
                cursor,
                user_id=int(user_id or 0),
                search_filter=search_filter,
                limit_value=safe_limit,
            )
            return _rows_as_dicts(cursor)

    def question_recommendations(
        self,
        *,
        catalog_questions: list[str],
        user_id: int = 0,
        limit: int = 12,
    ) -> dict[str, Any]:
        with _open_cursor(self) as (_conn, cursor):
            _select_user_question_usage(cursor, user_id=int(user_id or 0))
            usage_rows = _rows_as_dicts(cursor)
        return build_question_recommendations(
            catalog_questions=catalog_questions,
            usage_rows=usage_rows,
            limit=limit,
        )

    def get_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
        max_rows: int = 500,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        with _open_cursor(self) as (_conn, cursor):
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
