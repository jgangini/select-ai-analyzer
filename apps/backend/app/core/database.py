import logging
import json
import os
import stat
from pathlib import Path

import oracledb

logger = logging.getLogger(__name__)

REQUIRED_DB_KEYS = (
    "user",
    "password",
    "dsn",
    "wallet_path",
    "wallet_password",
)


class RuntimeDBConfigStore:
    """Persist DB connection chosen in setup wizard."""

    def __init__(self, config_path: Path):
        self.config_path = config_path

    def load(self) -> dict[str, str] | None:
        if not self.config_path.exists():
            return None

        raw = self.config_path.read_text(encoding="utf-8")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("Runtime DB config must be a JSON object.")

        data = {key: str(payload.get(key, "")).strip() for key in REQUIRED_DB_KEYS}
        if any(not value for value in data.values()):
            return None
        return data

    def save(self, config: dict[str, str]) -> None:
        payload = {key: str(config.get(key, "")).strip() for key in REQUIRED_DB_KEYS}
        missing = [key for key, value in payload.items() if not value]
        if missing:
            raise ValueError(f"Missing runtime DB config fields: {', '.join(missing)}")

        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.config_path.with_suffix(self.config_path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self._restrict_permissions(tmp_path)
        tmp_path.replace(self.config_path)
        self._restrict_permissions(self.config_path)

    def _restrict_permissions(self, path: Path) -> None:
        try:
            if os.name == "nt":
                os.chmod(path, stat.S_IREAD | stat.S_IWRITE)
            else:
                os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
        except OSError as exc:
            logger.debug("Could not tighten permissions on %s: %s", path, exc)


class DatabaseManager:
    """Singleton to manage connection pool to Autonomous Database."""

    _instance = None

    def __init__(self, settings):
        self.settings = settings
        self._pool: oracledb.ConnectionPool | None = None
        self._initialized = False
        self._runtime_store = RuntimeDBConfigStore(settings.runtime_db_config_path)

    def _base_connection_config(self) -> dict[str, str]:
        return {
            "user": (self.settings.ADB_USER or "").strip(),
            "password": (self.settings.ADB_PASSWORD or "").strip(),
            "dsn": (self.settings.ADB_DSN or "").strip(),
            "wallet_path": (self.settings.ADB_WALLET_DIR or "").strip(),
            "wallet_password": (self.settings.ADB_WALLET_PASSWORD or "").strip(),
        }

    def resolve_connection_config(
        self,
        *,
        wallet_path: str | None = None,
        wallet_password: str | None = None,
        user: str | None = None,
        password: str | None = None,
        dsn: str | None = None,
    ) -> dict[str, str]:
        config = self._base_connection_config()
        try:
            runtime_config = self._runtime_store.load()
        except Exception as exc:
            logger.warning("Runtime DB config could not be loaded: %s", exc)
            runtime_config = None
        if runtime_config:
            config.update(runtime_config)

        overrides = {
            "wallet_path": wallet_path,
            "wallet_password": wallet_password,
            "user": user,
            "password": password,
            "dsn": dsn,
        }
        for key, value in overrides.items():
            if value is not None and str(value).strip():
                config[key] = str(value).strip()
        return config

    def save_runtime_connection_config(
        self,
        *,
        wallet_path: str,
        wallet_password: str,
        user: str,
        password: str,
        dsn: str,
    ) -> None:
        self._runtime_store.save(
            {
                "wallet_path": wallet_path,
                "wallet_password": wallet_password,
                "user": user,
                "password": password,
                "dsn": dsn,
            }
        )

        # Force pool re-init with the latest credentials from runtime config.
        self.close_pool()

    @staticmethod
    def _missing_required_config(config: dict[str, str]) -> list[str]:
        return [key for key in ("user", "password", "dsn") if not str(config.get(key) or "").strip()]

    def init_pool(self):
        """Initialize connection pool (thin mode, no Oracle Client)."""
        if self._initialized:
            return
        try:
            config = self.resolve_connection_config()
            missing = self._missing_required_config(config)
            if missing:
                logger.info(
                    "Database pool not initialized; setup DB config is incomplete. Missing: %s",
                    ", ".join(missing),
                )
                return
            pool_kwargs = {
                "user": config["user"],
                "password": config["password"],
                "dsn": config["dsn"],
                "min": self.settings.ADB_POOL_MIN,
                "max": self.settings.ADB_POOL_MAX,
                "increment": self.settings.ADB_POOL_INCREMENT,
            }
            if config["wallet_path"]:
                pool_kwargs["config_dir"] = config["wallet_path"]
                pool_kwargs["wallet_location"] = config["wallet_path"]
            if config["wallet_password"]:
                pool_kwargs["wallet_password"] = config["wallet_password"]

            self._pool = oracledb.create_pool(**pool_kwargs)
            self._initialized = True
            logger.info("Database pool initialized: %s@%s", config["user"], config["dsn"])
        except Exception as e:
            logger.warning("Error initializing database pool: %s", e, exc_info=True)

    def get_connection(self):
        """Get connection from pool."""
        if not self._initialized:
            self.init_pool()
        if self._pool is None:
            raise Exception("Database pool not initialized. Please complete the initial setup.")
        return self._pool.acquire()

    def close_pool(self):
        """Close pool (on shutdown)."""
        if self._pool:
            self._pool.close()
            self._pool = None
            self._initialized = False

    def table_exists(self, table_name: str) -> bool:
        """Return whether a table exists in the current schema."""
        try:
            connection = self.get_connection()
        except Exception:
            return False
        cursor = connection.cursor()
        try:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM user_tables
                WHERE table_name = :table_name
                """,
                table_name=(table_name or "").upper(),
            )
            row = cursor.fetchone()
            return bool(row and int(row[0]) > 0)
        finally:
            cursor.close()
            connection.close()

    @classmethod
    def get_instance(cls, settings):
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls(settings)
        return cls._instance
