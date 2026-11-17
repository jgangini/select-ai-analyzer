import pytest

from apps.backend.app.services.user_service import UserService


class StubCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.closed = False
        self.executed = []

    def execute(self, sql, **params):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        return list(self.rows)

    def close(self):
        self.closed = True


class StubConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor
        self.closed = False

    def cursor(self):
        return self.cursor_instance

    def close(self):
        self.closed = True


class StubDbManager:
    def __init__(self, cursor):
        self.connection = StubConnection(cursor)

    def get_connection(self):
        return self.connection


def user_service_with_rows(rows):
    cursor = StubCursor(rows)
    return UserService(StubDbManager(cursor)), cursor


def test_list_groups_maps_active_groups_and_closes_connection() -> None:
    service, cursor = user_service_with_rows([(0, "Admin"), (1, "Analyst")])

    groups = service.list_groups()

    assert groups == [
        {"user_group_id": 0, "user_group_name": "Admin"},
        {"user_group_id": 1, "user_group_name": "Analyst"},
    ]
    assert cursor.closed is True
    assert service.db_manager.connection.closed is True


def test_ensure_admin_allows_initial_admin_group() -> None:
    service, cursor = user_service_with_rows([(0,)])

    service.ensure_admin(10)

    assert cursor.closed is True


def test_ensure_admin_rejects_missing_or_non_admin_users() -> None:
    service, _cursor = user_service_with_rows([(1,)])
    with pytest.raises(PermissionError, match="Administrators only"):
        service.ensure_admin(11)

    service, _cursor = user_service_with_rows([])
    with pytest.raises(PermissionError, match="Administrators only"):
        service.ensure_admin(12)
