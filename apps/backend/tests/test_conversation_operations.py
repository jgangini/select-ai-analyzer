import json

import pytest

from apps.backend.app.select_ai.conversation_operations import SelectAIConversationMixin, _materialize_stored_result
from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id


class RecordingCursor:
    def __init__(self) -> None:
        self.execute_calls: list[tuple[str, dict]] = []
        self.fetchone_rows: list[tuple | None] = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.execute_calls.append((statement, params))

    def fetchone(self):
        return self.fetchone_rows.pop(0) if self.fetchone_rows else None

    def close(self) -> None:
        self.closed = True


class RecordingConnection:
    def __init__(self, cursor: RecordingCursor) -> None:
        self._cursor = cursor
        self.commit_count = 0
        self.rollback_count = 0
        self.closed = False

    def cursor(self) -> RecordingCursor:
        return self._cursor

    def commit(self) -> None:
        self.commit_count += 1

    def rollback(self) -> None:
        self.rollback_count += 1

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
    cursor.fetchone_rows.append(None)
    connection = RecordingConnection(cursor)
    service = ConversationService(connection)

    run_id = service.record_question_run(
        question="Balance by account",
        sql="SELECT * FROM APP_AGENT_DATA.ACCOUNTS",
        answer="Done",
        row_count=3,
        chart_spec={"type": "table", "title": "Accounts"},
        conversation_id="chat-1",
        columns=["ACCOUNT_NO", "BALANCE"],
        rows=[{"ACCOUNT_NO": "001", "BALANCE": 1200}],
        max_rows=500,
        user_id=7,
    )

    assert len(run_id) == 32
    assert connection.commit_count == 2
    assert "SELECT created_by_user_id" in cursor.execute_calls[0][0]
    assert "MERGE INTO analytics_conversations" in cursor.execute_calls[1][0]
    assert "INSERT INTO question_runs" in cursor.execute_calls[2][0]
    assert "INSERT INTO question_run_result_snapshots" in cursor.execute_calls[3][0]
    conversation_params = cursor.execute_calls[1][1]
    assert conversation_params["oracle_conversation_id"] == "chat-1"
    insert_params = cursor.execute_calls[2][1]
    assert insert_params["conversation_id"] == "chat-1"
    assert insert_params["profile_name"] == "APP_AGENT_ANALYTICS"
    assert json.loads(insert_params["chart_spec"]) == {"type": "table", "title": "Accounts"}
    snapshot_params = cursor.execute_calls[3][1]
    assert json.loads(snapshot_params["columns_json"]) == ["ACCOUNT_NO", "BALANCE"]
    assert json.loads(snapshot_params["rows_json"]) == [{"ACCOUNT_NO": "001", "BALANCE": 1200}]
    assert cursor.closed is True
    assert connection.closed is True


def test_resolve_oracle_conversation_id_requires_writable_conversation() -> None:
    cursor = RecordingCursor()
    cursor.fetchone_rows.append((7, "oracle-chat-1"))
    service = ConversationService(RecordingConnection(cursor))

    assert service.resolve_oracle_conversation_id(conversation_id="chat-1", user_id=7) == "oracle-chat-1"


def test_record_question_run_rejects_other_users_conversation() -> None:
    cursor = RecordingCursor()
    cursor.fetchone_rows.append((99, "oracle-chat-1"))
    connection = RecordingConnection(cursor)
    service = ConversationService(connection)

    with pytest.raises(ValueError, match="Conversation was not found"):
        service.record_question_run(
            question="Balance by account",
            sql="SELECT * FROM APP_AGENT_DATA.ACCOUNTS",
            answer="Done",
            row_count=3,
            chart_spec={"type": "table", "title": "Accounts"},
            conversation_id="chat-1",
            columns=["ACCOUNT_NO"],
            rows=[{"ACCOUNT_NO": "001"}],
            user_id=7,
        )

    assert len(cursor.execute_calls) == 1
    assert connection.rollback_count == 1


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


def test_materialize_stored_conversation_result_uses_snapshot_without_querying() -> None:
    def execute_select(_sql: str, *, max_rows: int) -> tuple[list[str], list[dict]]:
        raise AssertionError("stored snapshots should not re-run historical SQL")

    result = _materialize_stored_result(
        generated_sql="SELECT account_no, balance FROM app_agent_data.accounts",
        chart_spec_json='{"type":"bar","x":"ACCOUNT_NO","y":"BALANCE"}',
        columns_json='["ACCOUNT_NO","BALANCE"]',
        rows_json='[{"ACCOUNT_NO":"001","BALANCE":1200}]',
        snapshot_row_count=1,
        execute_select=execute_select,
        max_rows=500,
    )

    assert result == {
        "sql": "SELECT account_no, balance FROM app_agent_data.accounts",
        "columns": ["ACCOUNT_NO", "BALANCE"],
        "rows": [{"ACCOUNT_NO": "001", "BALANCE": 1200}],
        "row_count": 1,
        "chart_spec": {"type": "bar", "x": "ACCOUNT_NO", "y": "BALANCE"},
    }
