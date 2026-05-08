import json

import pytest

from apps.backend.app.select_ai.conversation_operations import SelectAIConversationMixin, _materialize_stored_result
from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id


class RecordingCursor:
    def __init__(self) -> None:
        self.execute_calls: list[tuple[str, dict]] = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.execute_calls.append((statement, params))

    def close(self) -> None:
        self.closed = True


class RecordingConnection:
    def __init__(self, cursor: RecordingCursor) -> None:
        self._cursor = cursor
        self.commit_count = 0
        self.closed = False

    def cursor(self) -> RecordingCursor:
        return self._cursor

    def commit(self) -> None:
        self.commit_count += 1

    def close(self) -> None:
        self.closed = True


class ConversationService(SelectAIConversationMixin):
    def __init__(self, connection: RecordingConnection) -> None:
        self.connection = connection

    def _connection(self) -> RecordingConnection:
        return self.connection

    def _profile_name(self) -> str:
        return "APP_AGENT_ANALYTICS"


def test_normalize_conversation_id_sanitizes_and_limits_length() -> None:
    assert normalize_conversation_id("chat 1/2") == "chat_1_2"
    assert len(normalize_conversation_id("a" * 200)) == 128


def test_ensure_conversation_rejects_unknown_type() -> None:
    with pytest.raises(ValueError, match="Unsupported conversation_type"):
        ensure_conversation(
            RecordingCursor(),
            conversation_id="chat-1",
            conversation_type="unknown",
            title="Question",
        )


def test_record_question_run_commits_conversation_before_insert() -> None:
    cursor = RecordingCursor()
    connection = RecordingConnection(cursor)
    service = ConversationService(connection)

    run_id = service.record_question_run(
        question="Saldo por cuenta",
        sql="SELECT * FROM APP_AGENT_DATA.ACCOUNTS",
        answer="Listo",
        row_count=3,
        chart_spec={"type": "table", "title": "Accounts"},
        conversation_id="chat-1",
        user_id=7,
    )

    assert len(run_id) == 32
    assert connection.commit_count == 2
    assert "MERGE INTO analytics_conversations" in cursor.execute_calls[0][0]
    assert "INSERT INTO question_runs" in cursor.execute_calls[1][0]
    insert_params = cursor.execute_calls[1][1]
    assert insert_params["conversation_id"] == "chat-1"
    assert insert_params["profile_name"] == "APP_AGENT_ANALYTICS"
    assert json.loads(insert_params["chart_spec"]) == {"type": "table", "title": "Accounts"}
    assert cursor.closed is True
    assert connection.closed is True


def test_materialize_stored_conversation_result_validates_sql_and_chart_spec() -> None:
    calls: list[tuple[str, int]] = []

    def execute_select(sql: str, *, max_rows: int) -> tuple[list[str], list[dict]]:
        calls.append((sql, max_rows))
        return ["ACCOUNT_NO", "BALANCE"], [{"ACCOUNT_NO": "001", "BALANCE": 1200}]

    result = _materialize_stored_result(
        generated_sql="SELECT account_no, balance FROM app_agent_data.accounts",
        chart_spec_json='{"type":"bar","x":"ACCOUNT_NO","y":"BALANCE"}',
        execute_select=execute_select,
        max_rows=9000,
    )

    assert calls == [("SELECT account_no, balance FROM app_agent_data.accounts", 5000)]
    assert result["row_count"] == 1
    assert result["chart_spec"] == {"type": "bar", "x": "ACCOUNT_NO", "y": "BALANCE"}
