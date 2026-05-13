from apps.backend.app.services.bootstrap_database_service import (
    REQUIRED_APP_AGENT_PRIVILEGES,
    BootstrapDatabaseMixin,
    missing_required_privileges,
)


class FakeOracleCursor:
    def __init__(self, *, connected_user: str = "APP_AGENT", privileges: set[str] | None = None, data_schema_exists: bool = True) -> None:
        self.connected_user = connected_user
        self.privileges = privileges or set()
        self.data_schema_exists = data_schema_exists
        self.closed = False
        self._fetchone: tuple | None = None
        self._fetchall: list[tuple[str]] = []

    def execute(self, statement: str, **_params) -> None:
        if "SELECT USER FROM DUAL" in statement:
            self._fetchone = (self.connected_user,)
            self._fetchall = []
        elif "SELECT privilege FROM user_sys_privs" in statement:
            self._fetchone = None
            self._fetchall = [(privilege,) for privilege in sorted(self.privileges)]
        elif "FROM all_users" in statement:
            self._fetchone = (1 if self.data_schema_exists else 0,)
            self._fetchall = []

    def fetchone(self):
        return self._fetchone

    def fetchall(self):
        return self._fetchall

    def close(self) -> None:
        self.closed = True


class FakeOracleConnection:
    def __init__(self, cursor: FakeOracleCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> FakeOracleCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


class DbManager:
    def __init__(self) -> None:
        self.saved_config: dict[str, str] | None = None

    def save_runtime_connection_config(self, **kwargs: str) -> None:
        self.saved_config = kwargs


class DatabaseBootstrapper(BootstrapDatabaseMixin):
    def __init__(self) -> None:
        self.db_manager = DbManager()


def test_list_wallet_dsns_reports_missing_tnsnames(tmp_path) -> None:
    result = DatabaseBootstrapper().list_wallet_dsns(str(tmp_path))

    assert result == {
        "success": False,
        "message": f"tnsnames.ora not found in {tmp_path}",
        "dsns": [],
        "selected_dsn": "",
    }


def test_list_wallet_dsns_returns_aliases_and_prefers_medium(tmp_path) -> None:
    (tmp_path / "tnsnames.ora").write_text(
        """
        app_low =
          (DESCRIPTION = ...)
        app_medium =
          (DESCRIPTION = ...)
        app_high =
          (DESCRIPTION = ...)
        """,
        encoding="utf-8",
    )

    result = DatabaseBootstrapper().list_wallet_dsns(str(tmp_path))

    assert result == {
        "success": True,
        "message": "TNS aliases loaded successfully",
        "dsns": ["app_low", "app_medium", "app_high"],
        "selected_dsn": "app_medium",
    }


def test_save_runtime_db_config_delegates_to_db_manager() -> None:
    service = DatabaseBootstrapper()

    service.save_runtime_db_config(
        wallet_path="D:/wallet",
        wallet_password="wallet-secret",
        user="APP_AGENT",
        password="secret",
        dsn="db_medium",
    )

    assert service.db_manager.saved_config == {
        "wallet_path": "D:/wallet",
        "wallet_password": "wallet-secret",
        "user": "APP_AGENT",
        "password": "secret",
        "dsn": "db_medium",
    }


def test_missing_required_privileges_reports_data_upload_gaps() -> None:
    assert missing_required_privileges({"CREATE TABLE"}) == [
        "CREATE ANY TABLE",
        "DROP ANY TABLE",
        "INSERT ANY TABLE",
        "SELECT ANY TABLE",
    ]


def test_db_connection_rejects_missing_default_data_schema_without_create_user(tmp_path, monkeypatch) -> None:
    (tmp_path / "tnsnames.ora").write_text("db_medium = (DESCRIPTION = ...)", encoding="utf-8")
    cursor = FakeOracleCursor(privileges=set(REQUIRED_APP_AGENT_PRIVILEGES), data_schema_exists=False)
    connection = FakeOracleConnection(cursor)
    monkeypatch.setattr(
        "apps.backend.app.services.bootstrap_database_service.oracledb.connect",
        lambda **_kwargs: connection,
    )

    result = DatabaseBootstrapper().test_db_connection(
        wallet_path=str(tmp_path),
        wallet_password="wallet-secret",
        user="APP_AGENT",
        password="secret",
        dsn="db_medium",
    )

    assert result["success"] is False
    assert "APP_AGENT_DATA does not exist" in result["message"]
    assert cursor.closed is True
    assert connection.closed is True


def test_db_connection_accepts_app_agent_runtime_privileges(tmp_path, monkeypatch) -> None:
    (tmp_path / "tnsnames.ora").write_text("db_medium = (DESCRIPTION = ...)", encoding="utf-8")
    cursor = FakeOracleCursor(privileges=set(REQUIRED_APP_AGENT_PRIVILEGES), data_schema_exists=True)
    connection = FakeOracleConnection(cursor)
    monkeypatch.setattr(
        "apps.backend.app.services.bootstrap_database_service.oracledb.connect",
        lambda **_kwargs: connection,
    )

    result = DatabaseBootstrapper().test_db_connection(
        wallet_path=str(tmp_path),
        wallet_password="wallet-secret",
        user="APP_AGENT",
        password="secret",
        dsn="db_medium",
    )

    assert result == {
        "success": True,
        "message": "Database connection successful",
        "connected_user": "APP_AGENT",
    }
