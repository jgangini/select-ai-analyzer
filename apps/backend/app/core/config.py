from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore[import-untyped]

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Compatibilidad con codigo actual (DatabaseManager / security.py)
    ADB_USER: str = ""
    ADB_PASSWORD: str = ""
    ADB_DSN: str = ""
    ADB_WALLET_DIR: str = str(BACKEND_ROOT / "wallet")
    ADB_WALLET_PASSWORD: str = ""
    ADB_POOL_MIN: int = 1
    ADB_POOL_MAX: int = 10
    ADB_POOL_INCREMENT: int = 1
    DB_RUNTIME_CONFIG_PATH: str = "data/runtime/db_connection.json"

    SECRET_KEY: str = "your-secret-key-change-in-production-use-openssl-rand"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Runtime general
    APP_NAME: str = "Select AI Analytics"
    # OCI / GenAI / Select AI
    OCI_CONFIG_PATH: str = "keys/config"

    # Directorios runtime
    STAGING_DIR: str = "data/staging"
    UPLOAD_DIR: str = "data/uploads"
    USER_RUNTIME_SCOPE: str = "global"

    @model_validator(mode="before")
    @classmethod
    def _normalize_input_keys(cls, data):
        if not isinstance(data, dict):
            return data
        field_names = set(cls.model_fields.keys())
        normalized = {}
        for key, value in data.items():
            # Claves internas de BaseSettings (_env_file, etc.) no deben pasar al modelo.
            if key.startswith("_"):
                continue
            if key in field_names:
                normalized[key] = value
                continue
            upper_key = key.upper()
            if upper_key in field_names:
                normalized[upper_key] = value
            else:
                normalized[key] = value
        return normalized

    def __init__(self, **values):
        """When `_env_file=None` is explicit, force defaults/init values only."""
        if values.get("_env_file", object()) is None and "_env_prefix" not in values:
            values["_env_prefix"] = "__defaults_only__"
        super().__init__(**values)

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def app_name(self) -> str:
        return self.APP_NAME

    @property
    def database_backend(self) -> str:
        return "oracle"

    @property
    def wallet_dir(self) -> Path:
        wallet_path = Path(self.ADB_WALLET_DIR)
        if wallet_path.is_absolute():
            return wallet_path
        return BACKEND_ROOT / wallet_path

    @property
    def runtime_db_config_path(self) -> Path:
        runtime_path = Path(self.DB_RUNTIME_CONFIG_PATH)
        if runtime_path.is_absolute():
            return runtime_path
        return BACKEND_ROOT / runtime_path

    @property
    def keys_dir(self) -> Path:
        return BACKEND_ROOT / "keys"

    @property
    def logs_dir(self) -> Path:
        return BACKEND_ROOT / "logs"

    @property
    def data_dir(self) -> Path:
        return BACKEND_ROOT / "data"

    @property
    def oci_config_file(self) -> Path:
        return BACKEND_ROOT / self.OCI_CONFIG_PATH

    @property
    def staging_path(self) -> Path:
        return BACKEND_ROOT / self.STAGING_DIR

    @property
    def upload_path(self) -> Path:
        return BACKEND_ROOT / self.UPLOAD_DIR

    @property
    def user_runtime_scope(self) -> str:
        value = str(self.USER_RUNTIME_SCOPE or "global").strip().lower()
        return value or "global"

    @property
    def user_data_root(self) -> Path:
        return self.data_dir / "users" / self.user_runtime_scope

    @property
    def oci_genai_model(self) -> str:
        return "google.gemini-2.5-flash"

    def ensure_runtime_directories(self) -> None:
        for path in (
            self.wallet_dir,
            self.keys_dir,
            self.logs_dir,
            self.data_dir,
            self.runtime_db_config_path.parent,
            self.oci_config_file.parent,
            self.staging_path,
            self.upload_path,
            self.user_data_root / "uploads",
            self.user_data_root / "staging",
        ):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings(_env_file=BACKEND_ROOT / ".env")
    settings.ensure_runtime_directories()
    return settings
