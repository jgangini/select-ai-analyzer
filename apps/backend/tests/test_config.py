from pathlib import Path
import zipfile

import pytest
from fastapi import HTTPException

from apps.backend.app.api.upload_validation import extract_zip_safely, safe_upload_name
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


def test_setup_upload_name_strips_client_path_and_requires_suffix() -> None:
    assert safe_upload_name("..\\secrets\\api.pem", ".pem", "File must be .pem") == "api.pem"

    with pytest.raises(HTTPException) as exc_info:
        safe_upload_name(None, ".pem", "File must be .pem")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "File must be .pem"


def test_extract_zip_safely_rejects_paths_outside_destination(tmp_path: Path) -> None:
    archive = tmp_path / "wallet.zip"
    with zipfile.ZipFile(archive, "w") as zip_ref:
        zip_ref.writestr("../escape.txt", "nope")

    with pytest.raises(HTTPException) as exc_info:
        extract_zip_safely(archive, tmp_path / "wallet")

    assert exc_info.value.status_code == 400
    assert not (tmp_path / "escape.txt").exists()


def test_extract_zip_safely_extracts_normal_wallet_members(tmp_path: Path) -> None:
    archive = tmp_path / "wallet.zip"
    destination = tmp_path / "wallet"
    with zipfile.ZipFile(archive, "w") as zip_ref:
        zip_ref.writestr("tnsnames.ora", "appagent_medium = demo")
        zip_ref.writestr("nested/sqlnet.ora", "wallet_location = demo")

    extract_zip_safely(archive, destination)

    assert (destination / "tnsnames.ora").read_text(encoding="utf-8") == "appagent_medium = demo"
    assert (destination / "nested" / "sqlnet.ora").read_text(encoding="utf-8") == "wallet_location = demo"
