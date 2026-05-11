import pytest

from apps.backend.app.services.bootstrap_status_service import BootstrapStatusMixin, SetupStatusService


class ReadableValue:
    def __init__(self, value: str) -> None:
        self.value = value

    def read(self) -> str:
        return self.value


class FakeCursor:
    def __init__(self, row) -> None:
        self.row = row
        self.closed = False
        self.executed = False

    def execute(self, *_args, **_kwargs) -> None:
        self.executed = True

    def fetchone(self):
        return self.row

    def close(self) -> None:
        self.closed = True


class FakeConnection:
    def __init__(self, row) -> None:
        self.cursor_instance = FakeCursor(row)
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def close(self) -> None:
        self.closed = True


class PooledDbManager:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection
        self.get_connection_calls = 0

    def get_connection(self) -> FakeConnection:
        self.get_connection_calls += 1
        return self.connection


class FakeStatusReader(BootstrapStatusMixin):
    def __init__(self, connection: FakeConnection | None) -> None:
        self.db_manager = object()
        self.connection = connection

    def _get_direct_connection(self):
        if self.connection is None:
            raise RuntimeError("Database runtime connection is not configured")
        return self.connection


class DbManager:
    def __init__(self, config: dict[str, str]) -> None:
        self.config = config

    def resolve_connection_config(self, **_overrides) -> dict[str, str]:
        return self.config


@pytest.fixture(autouse=True)
def clear_setup_status_cache():
    SetupStatusService.clear_status_cache()
    yield
    SetupStatusService.clear_status_cache()


def test_bootstrap_status_mixin_reads_completed_flag_from_lob() -> None:
    connection = FakeConnection((ReadableValue("true"),))
    service = FakeStatusReader(connection)

    assert service.check_setup_status() is True
    assert connection.cursor_instance.executed is True
    assert connection.cursor_instance.closed is True
    assert connection.closed is True


def test_bootstrap_status_mixin_returns_false_when_runtime_config_is_missing() -> None:
    service = FakeStatusReader(None)

    assert service.check_setup_status() is False


def test_setup_status_service_prefers_pooled_connection() -> None:
    connection = FakeConnection(("true",))
    db_manager = PooledDbManager(connection)
    service = SetupStatusService(db_manager)  # type: ignore[arg-type]

    assert service.check_setup_status() is True
    assert db_manager.get_connection_calls == 1
    assert connection.closed is True


def test_setup_status_service_caches_completed_status() -> None:
    connection = FakeConnection(("true",))
    db_manager = PooledDbManager(connection)
    service = SetupStatusService(db_manager)  # type: ignore[arg-type]

    assert service.check_setup_status() is True
    assert service.check_setup_status() is True
    assert db_manager.get_connection_calls == 1


def test_setup_status_service_uses_runtime_database_config(monkeypatch) -> None:
    calls: list[dict[str, str]] = []

    def fake_connect(**kwargs):
        calls.append(kwargs)
        return object()

    monkeypatch.setattr("apps.backend.app.services.bootstrap_support.oracledb.connect", fake_connect)
    service = SetupStatusService(
        DbManager(
            {
                "user": "APP_AGENT",
                "password": "secret",
                "dsn": "db_medium",
                "wallet_path": "D:/wallet",
                "wallet_password": "wallet-secret",
            }
        )
    )

    assert service._get_direct_connection() is not None
    assert calls == [
        {
            "user": "APP_AGENT",
            "password": "secret",
            "dsn": "db_medium",
            "config_dir": "D:/wallet",
            "wallet_location": "D:/wallet",
            "wallet_password": "wallet-secret",
        }
    ]


def test_setup_status_service_reports_missing_required_database_config() -> None:
    service = SetupStatusService(DbManager({"user": "APP_AGENT", "password": "", "dsn": "db"}))

    with pytest.raises(ValueError, match="Missing: password"):
        service._get_direct_connection()
