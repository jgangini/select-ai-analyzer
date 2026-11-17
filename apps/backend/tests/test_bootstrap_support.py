from pathlib import Path

import pytest

from apps.backend.app.services.bootstrap_support import (
    OCI_CLIENT_REQUIRED_KEYS,
    build_oci_client_config,
    build_oracle_connection_kwargs,
    missing_required_oci_config_keys,
    normalize_oci_config_value,
    normalize_oci_config_rows,
    open_runtime_database_connection,
    is_ignorable_bootstrap_sql_error,
    parse_bootstrap_sql_statements,
    parse_tns_aliases,
    read_private_key_for_db_credential,
    resolve_oci_cli_config_path,
    select_preferred_wallet_dsn,
    summarize_oracle_connect_error,
    write_oci_cli_config_file,
)


class ReadableValue:
    def __init__(self, value: str, *, raises: bool = False) -> None:
        self.value = value
        self.raises = raises

    def read(self) -> str:
        if self.raises:
            raise RuntimeError("cannot read")
        return self.value


class Settings:
    def __init__(self, config_file: Path) -> None:
        self.oci_config_file = config_file


class DbManager:
    def __init__(self, config_file: Path, runtime_config: dict[str, str] | None = None) -> None:
        self.settings = Settings(config_file)
        self.runtime_config = runtime_config or {}

    def resolve_connection_config(self, **overrides: str | None) -> dict[str, str]:
        return {**self.runtime_config, **{key: value for key, value in overrides.items() if value is not None}}


def test_normalize_oci_config_value_reads_lobs_and_trims() -> None:
    assert normalize_oci_config_value(None) == ""
    assert normalize_oci_config_value("  ocid  ") == "ocid"
    assert normalize_oci_config_value(ReadableValue("  value  ")) == "value"
    assert normalize_oci_config_value(ReadableValue("unused", raises=True)) == ""


def test_normalize_oci_config_rows_strips_prefix_and_reads_values() -> None:
    rows = [
        ("oci.user", ReadableValue("  ocid1.user  ")),
        ("oci.region", "  us-ashburn-1  "),
    ]

    assert normalize_oci_config_rows(rows) == {
        "user": "ocid1.user",
        "region": "us-ashburn-1",
    }


def test_missing_required_oci_config_keys_preserves_required_order() -> None:
    values = {key: "value" for key in OCI_CLIENT_REQUIRED_KEYS}
    values["region"] = " "
    values.pop("key_file")

    assert missing_required_oci_config_keys(values) == ["region", "key_file"]


def test_build_oci_client_config_uses_api_signing_fields() -> None:
    values = {
        "user": "ocid1.user",
        "fingerprint": "aa:bb",
        "tenancy": "ocid1.tenancy",
        "region": "us-ashburn-1",
    }

    assert build_oci_client_config(values, key_content="PRIVATE_KEY") == {
        "user": "ocid1.user",
        "key_content": "PRIVATE_KEY",
        "fingerprint": "aa:bb",
        "tenancy": "ocid1.tenancy",
        "region": "us-ashburn-1",
    }


def test_build_oracle_connection_kwargs_includes_wallet_options_when_present() -> None:
    assert build_oracle_connection_kwargs(
        {
            "user": "APP_AGENT",
            "password": "secret",
            "dsn": "db_medium",
            "wallet_path": "D:/wallet",
            "wallet_password": "wallet-secret",
        }
    ) == {
        "user": "APP_AGENT",
        "password": "secret",
        "dsn": "db_medium",
        "config_dir": "D:/wallet",
        "wallet_location": "D:/wallet",
        "wallet_password": "wallet-secret",
    }


def test_open_runtime_database_connection_uses_resolved_config(monkeypatch, tmp_path) -> None:
    calls: list[dict[str, str]] = []

    def fake_connect(**kwargs):
        calls.append(kwargs)
        return "connection"

    monkeypatch.setattr("apps.backend.app.services.bootstrap_support.oracledb.connect", fake_connect)
    db_manager = DbManager(
        tmp_path / "config",
        {
            "user": "APP_AGENT",
            "password": "secret",
            "dsn": "db_medium",
        },
    )

    assert open_runtime_database_connection(db_manager, dsn="db_high") == "connection"
    assert calls == [{"user": "APP_AGENT", "password": "secret", "dsn": "db_high"}]


def test_open_runtime_database_connection_reports_missing_config(tmp_path) -> None:
    db_manager = DbManager(tmp_path / "config", {"user": "APP_AGENT", "password": "", "dsn": "db_medium"})

    with pytest.raises(ValueError, match="Missing: password"):
        open_runtime_database_connection(db_manager)


def test_select_preferred_wallet_dsn_prefers_medium_alias() -> None:
    assert select_preferred_wallet_dsn([]) == ""
    assert select_preferred_wallet_dsn(["db_low", "db_medium", "db_high"]) == "db_medium"
    assert select_preferred_wallet_dsn(["custom_one", "custom_two"]) == "custom_one"


def test_parse_tns_aliases_returns_unique_aliases_in_file_order() -> None:
    content = """
    app_low =
      (DESCRIPTION = ...)
    app_medium =
      (DESCRIPTION = ...)
    app_low =
      (DESCRIPTION = ...)
    """

    assert parse_tns_aliases(content) == ["app_low", "app_medium"]


def test_write_oci_cli_config_file_uses_runtime_settings_path(tmp_path) -> None:
    config_path = tmp_path / "keys" / "config"
    write_oci_cli_config_file(
        DbManager(config_path),
        config_values={
            "user": "ocid1.user",
            "fingerprint": "aa:bb",
            "tenancy": "ocid1.tenancy",
            "region": "us-ashburn-1",
            "key_file": "D:/keys/api.pem",
        },
    )

    assert resolve_oci_cli_config_path(DbManager(config_path)) == config_path
    assert config_path.read_text(encoding="utf-8") == (
        "[DEFAULT]\n"
        "user=ocid1.user\n"
        "fingerprint=aa:bb\n"
        "tenancy=ocid1.tenancy\n"
        "region=us-ashburn-1\n"
        "key_file=D:/keys/api.pem\n"
    )


def test_write_oci_cli_config_file_reports_missing_values(tmp_path) -> None:
    with pytest.raises(ValueError, match="fingerprint"):
        write_oci_cli_config_file(
            DbManager(tmp_path / "config"),
            config_values={
                "user": "ocid1.user",
                "fingerprint": "",
                "tenancy": "ocid1.tenancy",
                "region": "us-ashburn-1",
                "key_file": "key.pem",
            },
        )


def test_parse_bootstrap_sql_statements_cleans_script_chunks() -> None:
    content = """
    -- create application table
    CREATE TABLE demo_table (
        id NUMBER
    );
    --
    COMMIT;
    --
    -- only a comment block
    --
    BEGIN
        NULL;
    END;
    /
    """

    assert parse_bootstrap_sql_statements(content) == [
        "CREATE TABLE demo_table (\n        id NUMBER\n    )",
        "BEGIN\n        NULL;\n    END;",
    ]


def test_bootstrap_sql_files_are_grouped_by_domain() -> None:
    sql_dir = Path(__file__).resolve().parents[1] / "db" / "bootstrap" / "sql"
    sql_files = [path.name for path in sorted(sql_dir.glob("*.sql"))]

    assert sql_files == [
        "01_user_group.sql",
        "02_users.sql",
        "03_config.sql",
        "04_data_sources.sql",
        "05_select_ai_profiles.sql",
        "06_analytics_runtime.sql",
        "07_select_ai_procedures.sql",
        "08_dashboards.sql",
    ]
    for sql_file in sql_files:
        content = (sql_dir / sql_file).read_text(encoding="utf-8")
        assert parse_bootstrap_sql_statements(content), f"{sql_file} must contain executable statements"


def test_is_ignorable_bootstrap_sql_error_matches_idempotent_oracle_errors() -> None:
    assert is_ignorable_bootstrap_sql_error(Exception("ORA-00955 name is already used"))
    assert is_ignorable_bootstrap_sql_error(Exception("ORA-04080 trigger does not exist"))
    assert not is_ignorable_bootstrap_sql_error(Exception("ORA-00904 invalid identifier"))


def test_read_private_key_for_db_credential_strips_pem_markers(tmp_path) -> None:
    key_file = tmp_path / "key.pem"
    key_file.write_text(
        "-----BEGIN PRIVATE KEY-----\n"
        "abc\n"
        "def\n"
        "-----END PRIVATE KEY-----\n",
        encoding="utf-8",
    )

    assert read_private_key_for_db_credential(str(key_file)) == "abcdef"


def test_read_private_key_for_db_credential_rejects_empty_key(tmp_path) -> None:
    key_file = tmp_path / "empty.pem"
    key_file.write_text("-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n", encoding="utf-8")

    with pytest.raises(ValueError, match="empty"):
        read_private_key_for_db_credential(str(key_file))


def test_summarize_oracle_connect_error_maps_known_errors() -> None:
    service_error = summarize_oracle_connect_error(Exception("ORA-12514 listener"))
    credential_error = summarize_oracle_connect_error(Exception("ORA-01017 invalid"))

    assert service_error is not None and "service is not registered" in service_error
    assert credential_error is not None and "credentials are invalid" in credential_error
    assert summarize_oracle_connect_error(Exception("unmapped")) is None
