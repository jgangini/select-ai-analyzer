from __future__ import annotations


def _analytics_conversation_exists(cursor, *, conversation_id: str, user_id: int) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM analytics_conversations
        WHERE conversation_id = :conversation_id
          AND conversation_type = 'analytics'
          AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
        """,
        conversation_id=conversation_id,
        user_id=user_id,
    )
    row = cursor.fetchone()
    return bool(row and int(row[0] or 0) == 1)


def _select_conversation_owner(cursor, *, conversation_id: str) -> None:
    cursor.execute(
        """
        SELECT created_by_user_id, oracle_conversation_id
        FROM analytics_conversations
        WHERE conversation_id = :conversation_id
          AND conversation_type = 'analytics'
        """,
        conversation_id=conversation_id,
    )


def _delete_question_runs(cursor, *, conversation_id: str) -> int:
    cursor.execute(
        """
        DELETE FROM question_runs
        WHERE conversation_id = :conversation_id
        """,
        conversation_id=conversation_id,
    )
    return int(cursor.rowcount or 0)


def _delete_analytics_conversation(cursor, *, conversation_id: str) -> int:
    cursor.execute(
        """
        DELETE FROM analytics_conversations
        WHERE conversation_id = :conversation_id
          AND conversation_type = 'analytics'
        """,
        conversation_id=conversation_id,
    )
    return int(cursor.rowcount or 0)


def _rename_analytics_conversation(cursor, *, conversation_id: str, title: str, user_id: int) -> int:
    cursor.execute(
        """
        UPDATE analytics_conversations
           SET title = :title,
               updated_at = SYSDATE
         WHERE conversation_id = :conversation_id
           AND conversation_type = 'analytics'
           AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
        """,
        title=title,
        conversation_id=conversation_id,
        user_id=user_id,
    )
    return int(cursor.rowcount or 0)


def _select_conversation_summary(cursor, *, conversation_id: str) -> None:
    cursor.execute(
        """
        SELECT
            c.conversation_id,
            c.title,
            c.created_at,
            c.updated_at,
            (
                SELECT COUNT(*)
                FROM question_runs qr
                WHERE qr.conversation_id = c.conversation_id
            ) AS turns,
            (
                SELECT DBMS_LOB.SUBSTR(qr.question_text, 240, 1)
                FROM question_runs qr
                WHERE qr.conversation_id = c.conversation_id
                ORDER BY qr.created_at DESC
                FETCH FIRST 1 ROW ONLY
            ) AS last_message_preview
        FROM analytics_conversations c
        WHERE c.conversation_id = :conversation_id
          AND c.conversation_type = 'analytics'
        """,
        conversation_id=conversation_id,
    )


def _insert_question_run(cursor, **params: object) -> None:
    cursor.execute(
        """
        INSERT INTO question_runs (
            question_run_id, conversation_id, profile_name, question_text, generated_sql,
            answer_text, row_count, chart_spec_json, status
        ) VALUES (
            :run_id, :conversation_id, :profile_name, :question, :sql,
            :answer, :row_count, :chart_spec, 'completed'
        )
        """,
        **params,
    )


def _insert_question_run_snapshot(cursor, **params: object) -> None:
    cursor.execute(
        """
        INSERT INTO question_run_result_snapshots (
            question_run_id, columns_json, rows_json, row_count, max_rows, truncated_flag
        ) VALUES (
            :run_id, :columns_json, :rows_json, :row_count, :max_rows, :truncated_flag
        )
        """,
        **params,
    )


def _select_conversation_list(cursor, *, user_id: int, search_filter: str | None, limit_value: int) -> None:
    cursor.execute(
        """
        SELECT *
        FROM (
            SELECT
                c.conversation_id,
                c.title,
                c.created_at,
                c.updated_at,
                (
                    SELECT COUNT(*)
                    FROM question_runs qr
                    WHERE qr.conversation_id = c.conversation_id
                ) AS turns,
                (
                    SELECT DBMS_LOB.SUBSTR(qr.question_text, 240, 1)
                    FROM question_runs qr
                    WHERE qr.conversation_id = c.conversation_id
                    ORDER BY qr.created_at DESC
                    FETCH FIRST 1 ROW ONLY
                ) AS last_message_preview
            FROM analytics_conversations c
            WHERE c.conversation_type = 'analytics'
              AND (:user_id = 0 OR c.created_by_user_id IN (:user_id, 0))
              AND (
                :search_filter IS NULL
                OR LOWER(c.title) LIKE :search_filter
                OR EXISTS (
                    SELECT 1
                    FROM question_runs qr
                    WHERE qr.conversation_id = c.conversation_id
                      AND (
                        LOWER(DBMS_LOB.SUBSTR(qr.question_text, 1000, 1)) LIKE :search_filter
                        OR LOWER(DBMS_LOB.SUBSTR(qr.answer_text, 1000, 1)) LIKE :search_filter
                      )
                )
              )
            ORDER BY c.updated_at DESC, c.created_at DESC
        )
        WHERE ROWNUM <= :limit_value
        """,
        user_id=user_id,
        search_filter=search_filter,
        limit_value=limit_value,
    )


def _select_conversation_header(cursor, *, conversation_id: str, user_id: int) -> None:
    cursor.execute(
        """
        SELECT conversation_id, title, created_at, updated_at
        FROM analytics_conversations
        WHERE conversation_id = :conversation_id
          AND conversation_type = 'analytics'
          AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
        """,
        conversation_id=conversation_id,
        user_id=user_id,
    )


def _select_question_runs(cursor, *, conversation_id: str) -> None:
    cursor.execute(
        """
        SELECT
            qr.question_run_id,
            qr.profile_name,
            qr.question_text,
            qr.generated_sql,
            qr.answer_text,
            qr.row_count,
            qr.chart_spec_json,
            qr.status,
            qr.created_at,
            s.columns_json,
            s.rows_json,
            s.row_count AS snapshot_row_count,
            s.max_rows AS snapshot_max_rows,
            s.truncated_flag AS snapshot_truncated_flag,
            s.captured_at AS snapshot_captured_at
        FROM question_runs qr
        LEFT JOIN question_run_result_snapshots s
          ON s.question_run_id = qr.question_run_id
        WHERE qr.conversation_id = :conversation_id
        ORDER BY qr.created_at ASC
        """,
        conversation_id=conversation_id,
    )
