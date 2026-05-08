from __future__ import annotations

from apps.backend.app.select_ai.base_service import SelectAIBaseService
from apps.backend.app.select_ai.constants import DEFAULT_PROFILE


class FakeLob:
    def __init__(self, value: str) -> None:
        self.value = value

    def read(self) -> str:
        return self.value


class BaseCursor:
    def __init__(self, row=None) -> None:
        self.row = row
        self.executed: list[tuple[str, dict]] = []
        self.calls: list[tuple[str, list]] = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.executed.append((statement, params))

    def fetchone(self):
        return self.row

    def callproc(self, name: str, args: list) -> None:
        self.calls.append((name, args))

    def close(self) -> None:
        self.closed = True


class BaseConnection:
    def __init__(self, cursor: BaseCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.closed = False

    def cursor(self) -> BaseCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def close(self) -> None:
        self.closed = True


class BaseDbManager:
    def __init__(self, *, table_exists: bool, row=None) -> None:
        self._table_exists = table_exists
        self.cursor = BaseCursor(row)
        self.connection = BaseConnection(self.cursor)

    def table_exists(self, table_name: str) -> bool:
        return self._table_exists and table_name == "config"

    def get_connection(self) -> BaseConnection:
        return self.connection


def test_profile_name_uses_default_when_config_table_is_missing() -> None:
    service = SelectAIBaseService(BaseDbManager(table_exists=False))

    assert service._profile_name() == DEFAULT_PROFILE


def test_profile_name_reads_config_value_and_lobs() -> None:
    service = SelectAIBaseService(BaseDbManager(table_exists=True, row=[FakeLob("  CUSTOM_PROFILE  ")]))

    assert service._profile_name() == "CUSTOM_PROFILE"


def test_refresh_profile_calls_profile_procedure() -> None:
    db_manager = BaseDbManager(table_exists=True, row=["RUN_PROFILE"])
    service = SelectAIBaseService(db_manager)

    service.refresh_profile(user_id=42)

    assert db_manager.cursor.calls == [("SP_SEL_AI_PROFILE", ["RUN_PROFILE", 42])]
    assert db_manager.connection.committed is True
    assert db_manager.cursor.closed is True
    assert db_manager.connection.closed is True
