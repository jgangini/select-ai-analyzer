import pytest

from apps.backend.app.select_ai.service import SelectAIAnalyticsService, _read_csv_upload


class RecordingCursor:
    def __init__(self, *, fetchall_rows: list[tuple] | None = None) -> None:
        self.execute_calls: list[tuple[str, dict]] = []
        self.executemany_calls: list[tuple[str, list[dict]]] = []
        self._fetchall_rows = fetchall_rows or []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.execute_calls.append((statement, params))

    def executemany(self, statement: str, rows: list[dict]) -> None:
        self.executemany_calls.append((statement, rows))

    def fetchall(self) -> list[tuple]:
        return self._fetchall_rows

    def close(self) -> None:
        self.closed = True


class RecordingConnection:
    def __init__(self, cursor: RecordingCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self) -> RecordingCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


class RecordingDbManager:
    def __init__(self, connection: RecordingConnection) -> None:
        self.connection = connection

    def get_connection(self) -> RecordingConnection:
        return self.connection


def _source_column_inserts(cursor: RecordingCursor) -> list[dict]:
    return [
        params
        for statement, params in cursor.execute_calls
        if "INSERT INTO source_columns" in statement
    ]


def test_read_csv_upload_normalizes_headers_and_preserves_values(tmp_path) -> None:
    csv_path = tmp_path / "accounts.csv"
    csv_path.write_text("Account No,Amount\n001,10.50\n002,20.75\n", encoding="utf-8")

    upload = _read_csv_upload(csv_path)

    assert upload.fieldnames == ["ACCOUNT_NO", "AMOUNT"]
    assert upload.rows == [
        {"ACCOUNT_NO": "001", "AMOUNT": "10.50"},
        {"ACCOUNT_NO": "002", "AMOUNT": "20.75"},
    ]


def test_read_csv_upload_rejects_missing_headers(tmp_path) -> None:
    csv_path = tmp_path / "empty.csv"
    csv_path.write_text("", encoding="utf-8")

    with pytest.raises(ValueError, match="header row"):
        _read_csv_upload(csv_path)


def test_read_csv_upload_rejects_header_only_files(tmp_path) -> None:
    csv_path = tmp_path / "header-only.csv"
    csv_path.write_text("Account No,Amount\n", encoding="utf-8")

    with pytest.raises(ValueError, match="at least one data row"):
        _read_csv_upload(csv_path)


def test_create_table_from_csv_accepts_and_records_column_metadata(tmp_path, monkeypatch) -> None:
    csv_path = tmp_path / "accounts.csv"
    csv_path.write_text("Account No,Amount\n001,10.50\n", encoding="utf-8")
    cursor = RecordingCursor()
    connection = RecordingConnection(cursor)
    service = SelectAIAnalyticsService(RecordingDbManager(connection))
    monkeypatch.setattr(service, "schema_exists", lambda owner_name: True)
    monkeypatch.setattr(service, "refresh_profile", lambda *, user_id=0: None)

    result = service.create_table_from_csv(
        csv_path=csv_path,
        original_filename="accounts.csv",
        table_name="accounts",
        table_comment="Operational accounts loaded by CSV",
        column_metadata=[
            {
                "column_name": "Account No",
                "comment": "Customer account number",
                "classification": "identifier",
            }
        ],
        target_schema="APP_AGENT_DATA",
    )

    inserts = _source_column_inserts(cursor)
    assert result["table_name"] == "ACCOUNTS"
    assert inserts[0]["column_name"] == "ACCOUNT_NO"
    assert inserts[0]["business_comment"] == "Customer account number"
    assert inserts[0]["classification"] == "identifier"
    assert inserts[1]["column_name"] == "AMOUNT"
    assert inserts[1]["business_comment"] is None
    assert connection.committed is True


def test_register_existing_table_accepts_and_records_column_metadata(monkeypatch) -> None:
    cursor = RecordingCursor(
        fetchall_rows=[
            ("ACCOUNT_NO", "VARCHAR2", 64, "N", 1),
            ("BALANCE", "NUMBER", 22, "Y", 2),
        ]
    )
    connection = RecordingConnection(cursor)
    service = SelectAIAnalyticsService(RecordingDbManager(connection))
    monkeypatch.setattr(service, "refresh_profile", lambda *, user_id=0: None)

    result = service.register_existing_table(
        owner="APP_AGENT_DATA",
        table_name="accounts",
        table_comment="Existing account master",
        column_metadata=[
            {
                "column_name": "balance",
                "comment": "Current ledger balance",
                "classification": "financial",
            }
        ],
    )

    inserts = _source_column_inserts(cursor)
    assert result["table_name"] == "ACCOUNTS"
    assert inserts[0]["business_comment"] is None
    assert inserts[1]["column_name"] == "BALANCE"
    assert inserts[1]["business_comment"] == "Current ledger balance"
    assert inserts[1]["classification"] == "financial"
    assert connection.committed is True
