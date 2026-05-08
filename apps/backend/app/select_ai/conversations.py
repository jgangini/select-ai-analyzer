from __future__ import annotations

import re
import uuid


def normalize_conversation_id(value: str | None = None) -> str:
    raw_value = str(value or uuid.uuid4().hex).strip()
    cleaned = re.sub(r"[^A-Za-z0-9_$#-]", "_", raw_value)[:128]
    if not cleaned:
        raise ValueError("conversation_id is required.")
    return cleaned


def ensure_conversation(
    cursor,
    *,
    conversation_id: str,
    oracle_conversation_id: str | None = None,
    conversation_type: str,
    title: str,
    user_id: int = 0,
) -> None:
    normalized_type = str(conversation_type or "").strip().lower()
    if normalized_type not in {"analytics", "agent"}:
        raise ValueError(f"Unsupported conversation_type: {conversation_type}")
    cursor.execute(
        """
        MERGE INTO analytics_conversations c
        USING DUAL
           ON (c.conversation_id = :conversation_id AND c.conversation_type = :conversation_type)
        WHEN MATCHED THEN
            UPDATE SET c.updated_at = SYSDATE,
                       c.title = COALESCE(c.title, :title),
                       c.oracle_conversation_id = COALESCE(c.oracle_conversation_id, :oracle_conversation_id)
        WHEN NOT MATCHED THEN
            INSERT (
                conversation_id, oracle_conversation_id, conversation_type, title, created_by_user_id
            ) VALUES (
                :conversation_id, :oracle_conversation_id, :conversation_type, :title, :user_id
            )
        """,
        conversation_id=conversation_id,
        oracle_conversation_id=oracle_conversation_id or conversation_id,
        conversation_type=normalized_type,
        title=str(title or "")[:500],
        user_id=int(user_id or 0),
    )
