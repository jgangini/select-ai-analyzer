from __future__ import annotations

import json
from typing import Any
import uuid

from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id
from apps.backend.app.select_ai.conversation_store import (
    _analytics_conversation_exists,
    _delete_analytics_conversation,
    _delete_question_runs,
    _insert_question_run,
    _rename_analytics_conversation,
    _select_conversation_summary,
)
from apps.backend.app.select_ai.value_serialization import _json_safe


class SelectAIConversationMutationMixin:
    def delete_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        conn = self._connection()
        cursor = conn.cursor()
        try:
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
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

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
        conn = self._connection()
        cursor = conn.cursor()
        try:
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
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def record_question_run(
        self,
        *,
        question: str,
        sql: str,
        answer: str,
        row_count: int,
        chart_spec: dict[str, Any],
        conversation_id: str,
        user_id: int = 0,
        profile_name: str | None = None,
    ) -> str:
        run_id = uuid.uuid4().hex
        conn = self._connection()
        cursor = conn.cursor()
        try:
            ensure_conversation(
                cursor,
                conversation_id=conversation_id,
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
                conversation_id=conversation_id,
                profile_name=profile_name or self._profile_name(),
                question=question,
                sql=sql,
                answer=answer,
                row_count=row_count,
                chart_spec=json.dumps(chart_spec),
            )
            conn.commit()
            return run_id
        finally:
            cursor.close()
            conn.close()
