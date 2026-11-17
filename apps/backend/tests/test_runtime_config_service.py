from apps.backend.app.services.runtime_config_service import ConfigService


class FakeCursor:
    def __init__(self, row=None, error: Exception | None = None) -> None:
        self.row = row
        self.error = error
        self.closed = False
        self.executions = 0

    def execute(self, *_args, **_kwargs) -> None:
        self.executions += 1
        if self.error is not None:
            raise self.error

    def fetchone(self):
        return self.row

    def close(self) -> None:
        self.closed = True


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self.cursor_instance = cursor
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def close(self) -> None:
        self.closed = True


class FakeDbManager:
    def __init__(self, connection: FakeConnection | None = None, fail_connect: bool = False) -> None:
        self.connection = connection
        self.fail_connect = fail_connect
        self.table_exists_calls = 0

    def get_connection(self) -> FakeConnection:
        if self.fail_connect or self.connection is None:
            raise RuntimeError("Database pool not initialized")
        return self.connection

    def table_exists(self, _table_name: str) -> bool:
        self.table_exists_calls += 1
        raise AssertionError("get_value should not probe table existence first")


def test_get_value_reads_config_in_one_connection() -> None:
    cursor = FakeCursor(("45",))
    db_manager = FakeDbManager(FakeConnection(cursor))
    service = ConfigService(db_manager)  # type: ignore[arg-type]

    assert service.get_value("app.session_timeout_minutes", "30") == "45"
    assert cursor.executions == 1
    assert cursor.closed is True
    assert db_manager.connection.closed is True
    assert db_manager.table_exists_calls == 0


def test_get_value_returns_default_when_config_table_is_missing() -> None:
    cursor = FakeCursor(error=RuntimeError("ORA-00942: table or view does not exist"))
    db_manager = FakeDbManager(FakeConnection(cursor))
    service = ConfigService(db_manager)  # type: ignore[arg-type]

    assert service.get_value("app.session_timeout_minutes", "30") == "30"


def test_get_value_returns_default_when_connection_is_unavailable() -> None:
    service = ConfigService(FakeDbManager(fail_connect=True))  # type: ignore[arg-type]

    assert service.get_value("app.session_timeout_minutes", "30") == "30"
