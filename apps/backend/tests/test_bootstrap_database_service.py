from apps.backend.app.services.bootstrap_database_service import BootstrapDatabaseMixin


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
