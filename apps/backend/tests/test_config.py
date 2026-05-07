from pathlib import Path

from apps.backend.app.core.config import BACKEND_ROOT, Settings


def test_settings_resolves_runtime_paths_relative_to_backend_root() -> None:
    settings = Settings(
        _env_file=None,
        ADB_WALLET_DIR="wallet",
        DB_RUNTIME_CONFIG_PATH="data/runtime/db_connection.json",
        OCI_CONFIG_PATH="keys/config",
        STAGING_DIR="data/staging",
        UPLOAD_DIR="data/uploads",
        USER_RUNTIME_SCOPE="tenant-a",
    )

    assert settings.wallet_dir == BACKEND_ROOT / "wallet"
    assert settings.runtime_db_config_path == BACKEND_ROOT / "data" / "runtime" / "db_connection.json"
    assert settings.oci_config_file == BACKEND_ROOT / "keys" / "config"
    assert settings.staging_path == BACKEND_ROOT / "data" / "staging"
    assert settings.upload_path == BACKEND_ROOT / "data" / "uploads"
    assert settings.user_data_root == BACKEND_ROOT / "data" / "users" / "tenant-a"


def test_settings_preserves_absolute_wallet_path() -> None:
    absolute_wallet = Path("D:/runtime/wallet")
    settings = Settings(_env_file=None, ADB_WALLET_DIR=str(absolute_wallet))

    assert settings.wallet_dir == absolute_wallet


def test_settings_defaults_are_safe_without_env_file() -> None:
    settings = Settings(_env_file=None)

    assert settings.app_name == "Select AI Analytics"
    assert settings.database_backend == "oracle"
    assert settings.oci_genai_model == "google.gemini-2.5-flash"
    assert settings.user_runtime_scope == "global"
