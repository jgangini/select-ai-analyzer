from datetime import date

import pytest

from apps.backend.app.select_ai.query_execution import execute_read_only_select


class FakeCursor:
    description = [("id",), ("created_at",)]

    def __init__(self) -> None:
        self.executed_sql = ""
        self.fetch_size = 0
        self.closed = False

    def execute(self, sql: str) -> None:
        self.executed_sql = sql

    def fetchmany(self, *, size: int):
        self.fetch_size = size
        return [(1, date(2026, 5, 7)), (2, date(2026, 5, 8))]

    def close(self) -> None:
        self.closed = True


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def close(self) -> None:
        self.closed = True


def test_execute_read_only_select_validates_and_serializes_rows() -> None:
    connection = FakeConnection()

    columns, rows = execute_read_only_select(lambda: connection, "select id, created_at from audit_log", max_rows=25)

    assert columns == ["ID", "CREATED_AT"]
    assert rows == [
        {"ID": 1, "CREATED_AT": "2026-05-07"},
        {"ID": 2, "CREATED_AT": "2026-05-08"},
    ]
    assert connection.cursor_instance.executed_sql == "select id, created_at from audit_log"
    assert connection.cursor_instance.fetch_size == 25
    assert connection.cursor_instance.closed
    assert connection.closed


def test_execute_read_only_select_rejects_mutating_sql_before_opening_connection() -> None:
    opened = False

    def connection_factory():
        nonlocal opened
        opened = True
        return FakeConnection()

    with pytest.raises(ValueError):
        execute_read_only_select(connection_factory, "delete from audit_log")

    assert not opened
