from __future__ import annotations

import re
from pathlib import Path, PureWindowsPath
from typing import Iterable, Mapping

import oracledb


PREFERRED_WALLET_DSN_SUFFIXES = (
    "_medium",
    "_high",
    "_tp",
    "_low",
    "_tpurgent",
)
OCI_CLIENT_REQUIRED_KEYS = ("user", "fingerprint", "tenancy", "region", "key_file", "compartment_id")


def _success_result(message: str | None = None, **values: object) -> dict:
    result = {"success": True}
    if message is not None:
        result["message"] = message
    result.update(values)
    return result


def _failure_result(message: str, **values: object) -> dict:
    return {"success": False, "message": message, **values}


def _missing_saved_config_result(prefix: str, missing: list[str], **values: object) -> dict:
    return _failure_result(f"{prefix} Missing: {', '.join(missing)}", **values)


def _read_key_file_content(key_file: str) -> str:
    with open(key_file, "r", encoding="utf-8") as handle:
        return handle.read()


def _inference_test_url(inference_url: str) -> str:
    url = (inference_url or "").strip()
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    from urllib.parse import urlparse

    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    return base_url.rstrip("/") + "/" if not base_url.endswith("/") else base_url


def _probe_inference_endpoint(test_url: str) -> str | None:
    from urllib.error import HTTPError, URLError
    from urllib.request import urlopen

    try:
        with urlopen(test_url, timeout=10) as _:
            pass
    except HTTPError:
        return None
    except (URLError, OSError) as exc:
        return str(exc)
    return None


def _generative_model_options(genai_response) -> list[dict[str, str]]:
    items = getattr(getattr(genai_response, "data", None), "items", None) or []
    return [
        {"id": model.id, "display_name": getattr(model, "display_name", None) or model.id}
        for model in items
    ]


def resolve_backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def normalize_oci_config_value(value: object) -> str:
    if value is None:
        return ""
    if hasattr(value, "read"):
        try:
            value = value.read()
        except Exception:
            return ""
    return str(value).strip()


def normalize_oci_config_rows(rows: Iterable[tuple[object, object]]) -> dict[str, str]:
    values: dict[str, str] = {}
    for key, value in rows:
        normalized_key = str(key).replace("oci.", "", 1).strip()
        values[normalized_key] = normalize_oci_config_value(value)
    return values


def missing_required_oci_config_keys(
    config_values: Mapping[str, str],
    required: tuple[str, ...] = OCI_CLIENT_REQUIRED_KEYS,
) -> list[str]:
    return [key for key in required if not (config_values.get(key) or "").strip()]


def build_oci_client_config(config_values: Mapping[str, str], *, key_content: str) -> dict[str, str]:
    return {
        "user": config_values["user"],
        "key_content": key_content,
        "fingerprint": config_values["fingerprint"],
        "tenancy": config_values["tenancy"],
        "region": config_values["region"],
    }


def build_oracle_connection_kwargs(config_values: Mapping[str, str]) -> dict[str, str]:
    connection_kwargs = {
        "user": config_values["user"],
        "password": config_values["password"],
        "dsn": config_values["dsn"],
    }
    if config_values.get("wallet_path"):
        connection_kwargs["config_dir"] = config_values["wallet_path"]
        connection_kwargs["wallet_location"] = config_values["wallet_path"]
    if config_values.get("wallet_password"):
        connection_kwargs["wallet_password"] = config_values["wallet_password"]
    return connection_kwargs


def resolve_runtime_database_config(db_manager, **overrides: str | None) -> dict[str, str]:
    config = db_manager.resolve_connection_config(**overrides)
    missing = [key for key in ("user", "password", "dsn") if not str(config.get(key) or "").strip()]
    if missing:
        raise ValueError(
            "Database runtime connection is not configured. "
            f"Missing: {', '.join(missing)}. Save the APP_AGENT database connection in setup."
        )
    return config


def open_runtime_database_connection(db_manager, **overrides: str | None):
    config = resolve_runtime_database_config(db_manager, **overrides)
    return oracledb.connect(**build_oracle_connection_kwargs(config))


def select_preferred_wallet_dsn(aliases: list[str]) -> str:
    if not aliases:
        return ""

    for suffix in PREFERRED_WALLET_DSN_SUFFIXES:
        for alias in aliases:
            if alias.lower().endswith(suffix):
                return alias
    return aliases[0]


def resolve_oci_cli_config_path(db_manager) -> Path:
    settings = getattr(db_manager, "settings", None)
    if settings is not None and hasattr(settings, "oci_config_file"):
        return Path(settings.oci_config_file)
    return resolve_backend_root() / "keys" / "config"


def resolve_bootstrap_sql_dir() -> Path:
    return resolve_backend_root() / "db" / "bootstrap" / "sql"


def parse_bootstrap_sql_statements(content: str) -> list[str]:
    statements: list[str] = []
    for raw_statement in re.split(r"(?m)^\s*--\s*$", content or ""):
        raw_statement = raw_statement.strip()
        if not raw_statement:
            continue
        lines = [
            line for line in raw_statement.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        statement = "\n".join(lines).strip()
        if statement.endswith(";") or statement.endswith("/"):
            statement = statement[:-1].strip()
        if not statement or statement.upper() == "COMMIT":
            continue
        statements.append(statement)
    return statements


def parse_tns_aliases(content: str) -> list[str]:
    aliases: list[str] = []
    for match in re.finditer(r"^\s*([A-Za-z0-9_.-]+)\s*=", content or "", re.MULTILINE):
        alias = match.group(1).strip()
        if alias and alias not in aliases:
            aliases.append(alias)
    return aliases


def is_ignorable_bootstrap_sql_error(error: Exception) -> bool:
    message = str(error)
    return any(code in message for code in ("ORA-00955", "ORA-00001", "ORA-01408", "ORA-04080"))


def resolve_oci_key_file_path(key_file_value: str) -> str:
    raw_value = (key_file_value or "").strip()
    if not raw_value:
        return ""
    key_file_path = Path(raw_value)
    backend_root = resolve_backend_root()
    bundled_key_candidate = (backend_root / "keys" / PureWindowsPath(raw_value).name).resolve()
    if key_file_path.is_absolute():
        if key_file_path.exists():
            return str(key_file_path)
        if bundled_key_candidate.exists():
            return str(bundled_key_candidate)
        return str(key_file_path)
    windows_path = PureWindowsPath(raw_value)
    if windows_path.drive:
        return str(bundled_key_candidate)
    return str((backend_root / raw_value).resolve())


def write_oci_cli_config_file(db_manager, *, config_values: dict[str, str]) -> None:
    required = ("user", "fingerprint", "tenancy", "region", "key_file")
    missing = [key for key in required if not (config_values.get(key) or "").strip()]
    if missing:
        raise ValueError(f"Missing OCI values for config file generation: {', '.join(missing)}")

    config_path = resolve_oci_cli_config_path(db_manager)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    file_content = (
        "[DEFAULT]\n"
        f"user={config_values['user']}\n"
        f"fingerprint={config_values['fingerprint']}\n"
        f"tenancy={config_values['tenancy']}\n"
        f"region={config_values['region']}\n"
        f"key_file={config_values['key_file']}\n"
    )
    config_path.write_text(file_content, encoding="utf-8")


def read_private_key_for_db_credential(key_file_path: str) -> str:
    key_path = Path(key_file_path)
    if not key_path.exists():
        raise ValueError(f"OCI private key file not found: {key_file_path}")
    lines = key_path.read_text(encoding="utf-8").splitlines()
    body_lines = [
        line.strip()
        for line in lines
        if line.strip()
        and line.strip()
        not in {
            "-----BEGIN PRIVATE KEY-----",
            "-----END PRIVATE KEY-----",
            "-----BEGIN RSA PRIVATE KEY-----",
            "-----END RSA PRIVATE KEY-----",
        }
    ]
    private_key = "".join(body_lines)
    if not private_key:
        raise ValueError("OCI private key content is empty.")
    return private_key


def summarize_oracle_connect_error(error: Exception) -> str | None:
    message = str(error)
    compact = " | ".join(part.strip() for part in message.splitlines() if part.strip())

    if "DPY-6001" in message or "ORA-12514" in message:
        return (
            "Oracle service is not registered (DPY-6001/ORA-12514). "
            "Validate wallet files and DSN alias selected in setup. "
            f"Raw: {compact}"
        )
    if "ORA-01017" in message:
        return (
            "Oracle credentials are invalid (ORA-01017). "
            "Validate username/password configured in setup for the current wallet. "
            f"Raw: {compact}"
        )
    if "DPY-4011" in message:
        return (
            "Oracle network handshake failed (DPY-4011). "
            "Validate wallet certificates and network connectivity. "
            f"Raw: {compact}"
        )
    if "DPY-6005" in message:
        return (
            "Oracle connection failed (DPY-6005). "
            "Validate wallet path, wallet password, DSN alias, and DB credentials. "
            f"Raw: {compact}"
        )
    return None
