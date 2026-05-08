from __future__ import annotations

import json
import os
from pathlib import Path


RUNTIME_DB_KEYS = ("user", "password", "dsn", "wallet_path", "wallet_password")


def read_env_file_value(path: Path, key: str) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, raw_value = stripped.split("=", 1)
        if name.strip() == key:
            return raw_value.strip().strip('"').strip("'")
    return None


def runtime_db_config_path(backend_root: Path) -> Path:
    configured_path = (
        os.environ.get("DB_RUNTIME_CONFIG_PATH")
        or read_env_file_value(backend_root / ".env", "DB_RUNTIME_CONFIG_PATH")
        or "data/runtime/db_connection.json"
    )
    runtime_path = Path(configured_path)
    if runtime_path.is_absolute():
        return runtime_path
    return backend_root / runtime_path


def runtime_connection_config(backend_root: Path) -> dict[str, str]:
    runtime_path = runtime_db_config_path(backend_root)
    config = None
    if runtime_path.exists():
        payload = json.loads(runtime_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise RuntimeError(f"Runtime DB config must be a JSON object: {runtime_path}")
        config = {key: str(payload.get(key, "")).strip() for key in RUNTIME_DB_KEYS}
        if any(not value for value in config.values()):
            config = None
    if not config:
        raise RuntimeError(f"Runtime DB config is missing or incomplete: {runtime_path}")
    return config
