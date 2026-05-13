from datetime import date, datetime
from decimal import Decimal

import pytest

from scripts.load_source_seed import _runtime_db_config_path, convert_csv_value
from scripts.source_seed_db import assert_connected_schema, drop_table_if_exists, ensure_data_schema
from scripts.source_seed_metadata import apply_metadata, metadata_by_column, safe_constraint_name, sql_string_literal
from scripts.source_seed_parser import SourceColumn, SourceTable
from scripts.source_seed_registry import replace_data_source
from scripts.source_seed_sidecar import build_source_table_metadata
from scripts.source_seed_runtime import runtime_connection_config
from scripts.source_seed_table_io import column_type_label, read_csv_rows, table_columns
from scripts.source_seed_values import ColumnMetadata, convert_csv_value as convert_seed_value


def test_convert_csv_value_uses_oracle_column_type() -> None:
    assert convert_csv_value("2025-01-02", "DATE") == date(2025, 1, 2)
    assert convert_csv_value("2025-01-02 13:45:00", "TIMESTAMP(6)") == datetime(2025, 1, 2, 13, 45)
    assert convert_csv_value("11724.000", "NUMBER(24,3)") == Decimal("11724.000")
    assert convert_csv_value("", "NUMBER") is None
    assert convert_csv_value("PEN", "VARCHAR2(3)") == "PEN"


def test_convert_csv_value_rejects_bad_dates_and_numbers() -> None:
    with pytest.raises(ValueError):
        convert_csv_value("not-a-date", "DATE")
    with pytest.raises(ValueError):
        convert_csv_value("12x", "NUMBER")


def test_seed_value_module_keeps_loader_conversion_contract() -> None:
    assert convert_seed_value("2025/01/02 03:04:05", "TIMESTAMP") == datetime(2025, 1, 2, 3, 4, 5)
    assert convert_seed_value("02/01/2025", "DATE") == date(2025, 1, 2)


def test_runtime_db_config_path_prefers_environment_override(monkeypatch, tmp_path) -> None:
    configured_path = tmp_path / "runtime" / "db.json"

    monkeypatch.setenv("DB_RUNTIME_CONFIG_PATH", str(configured_path))

    assert _runtime_db_config_path() == configured_path


def test_runtime_db_config_path_reads_backend_env_file(monkeypatch, tmp_path) -> None:
    backend_root = tmp_path / "apps" / "backend"
    backend_root.mkdir(parents=True)
    (backend_root / ".env").write_text("DB_RUNTIME_CONFIG_PATH=custom/runtime.json\n", encoding="utf-8")

    monkeypatch.delenv("DB_RUNTIME_CONFIG_PATH", raising=False)
    monkeypatch.setattr("scripts.load_source_seed.BACKEND_ROOT", backend_root)

    assert _runtime_db_config_path() == backend_root / "custom" / "runtime.json"


def test_runtime_connection_config_requires_complete_json(tmp_path) -> None:
    backend_root = tmp_path / "apps" / "backend"
    runtime_dir = backend_root / "data" / "runtime"
    runtime_dir.mkdir(parents=True)
    runtime_path = runtime_dir / "db_connection.json"

    runtime_path.write_text('{"user":"APP_AGENT","password":"secret","dsn":"db"}', encoding="utf-8")
    with pytest.raises(RuntimeError, match="missing or incomplete"):
        runtime_connection_config(backend_root)

    runtime_path.write_text(
        """
        {
          "user": "APP_AGENT",
          "password": "secret",
          "dsn": "db",
          "wallet_path": "wallet",
          "wallet_password": "wallet-secret"
        }
        """,
        encoding="utf-8",
    )

    assert runtime_connection_config(backend_root) == {
        "user": "APP_AGENT",
        "password": "secret",
        "dsn": "db",
        "wallet_path": "wallet",
        "wallet_password": "wallet-secret",
    }


def test_source_seed_metadata_helpers_normalize_sql_values() -> None:
    assert sql_string_literal("branch's account") == "'branch''s account'"
    assert len(safe_constraint_name("pk table with long generated name")) <= 30
    assert metadata_by_column(
        [
            {"column_name": "amount", "comment": "Ledger amount"},
            {"column_name": "", "comment": "ignored"},
            {"not_a_column": "ignored"},
        ]
    ) == {"AMOUNT": {"column_name": "amount", "comment": "Ledger amount"}}


def test_source_seed_sidecar_translates_business_content_only() -> None:
    table = SourceTable(
        owner="APP_AGENT_DATA",
        name="FLEX_EXT_ACCOUNT_TRANSACTIONS",
        columns=(
            SourceColumn(name="DRCR_IND", data_type="VARCHAR2(1)", nullable=True),
            SourceColumn(name="ACCOUNT_NO", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="BOOK_DT", data_type="DATE", nullable=True),
        ),
    )

    payload = build_source_table_metadata(table)

    assert payload["table_name"] == "FLEX_EXT_ACCOUNT_TRANSACTIONS"
    assert "débitos" in payload["table_comment"]
    first_column = payload["columns"][0]
    assert first_column["column_name"] == "DRCR_IND"
    assert first_column["ui_display"] == "Drcr Ind"
    assert first_column["classification"] == "status"
    assert first_column["comment"] == "Indicador de débito/crédito. D significa débito y C significa crédito."
    generic_column = payload["columns"][2]
    assert generic_column["column_name"] == "BOOK_DT"
    assert generic_column["ui_display"] == "Book Dt"
    assert generic_column["classification"] == "date"
    assert generic_column["comment"] == (
        "Fecha operativa o marca de tiempo usada por la tabla FLEX_EXT_ACCOUNT_TRANSACTIONS."
    )


def test_apply_metadata_collects_nonfatal_ddl_warnings() -> None:
    class Cursor:
        def __init__(self) -> None:
            self.statements: list[str] = []

        def execute(self, statement: str, **_params) -> None:
            self.statements.append(statement)
            if "Classification" in statement:
                raise RuntimeError("annotations unavailable")

        def fetchone(self) -> tuple[int]:
            return (0,)

    cursor = Cursor()

    warnings = apply_metadata(
        cursor,
        "FLEX_ACCOUNT",
        data_schema="APP_AGENT_DATA",
        table_comment="Core account table",
        column_metadata=[
            {
                "column_name": "account_no",
                "comment": "Account number",
                "ui_display": "Account",
                "classification": "identifier",
                "primary_key": True,
            }
        ],
    )

    executed_sql = "\n".join(cursor.statements)
    assert "COMMENT ON TABLE APP_AGENT_DATA.FLEX_ACCOUNT" in executed_sql
    assert "COMMENT ON COLUMN APP_AGENT_DATA.FLEX_ACCOUNT.ACCOUNT_NO" in executed_sql
    assert "PRIMARY KEY (ACCOUNT_NO)" in executed_sql
    assert warnings == ["Classification for FLEX_ACCOUNT.ACCOUNT_NO was not applied: annotations unavailable"]


def test_source_seed_db_helpers_execute_expected_schema_statements() -> None:
    class Cursor:
        def __init__(self) -> None:
            self.statements: list[str] = []
            self.fetchone_result: tuple[object, ...] = ("APP_AGENT",)

        def execute(self, statement: str, **_params) -> None:
            self.statements.append(statement)

        def fetchone(self) -> tuple[object, ...]:
            return self.fetchone_result

    cursor = Cursor()

    assert_connected_schema(cursor, "APP_AGENT")
    cursor.fetchone_result = (0,)
    ensure_data_schema(cursor, "APP_AGENT_DATA")
    drop_table_if_exists(cursor, "FLEX_ACCOUNT", "APP_AGENT_DATA")

    executed_sql = "\n".join(cursor.statements)
    assert "CREATE USER APP_AGENT_DATA" in executed_sql
    assert "GRANT CREATE TABLE TO APP_AGENT_DATA" not in executed_sql
    assert "GRANT CREATE SESSION TO APP_AGENT_DATA" not in executed_sql
    assert "DROP TABLE APP_AGENT_DATA.FLEX_ACCOUNT PURGE" in executed_sql


def test_source_seed_data_schema_creates_upload_owner_without_login_grants() -> None:
    class Cursor:
        def __init__(self) -> None:
            self.statements: list[str] = []

        def execute(self, statement: str, **_params) -> None:
            self.statements.append(statement)

        def fetchone(self) -> tuple[int]:
            return (0,)

    cursor = Cursor()

    ensure_data_schema(cursor, "APP_AGENT_DATA")

    executed_sql = "\n".join(cursor.statements)
    assert "CREATE USER APP_AGENT_DATA" in executed_sql
    assert "GRANT CREATE SESSION TO APP_AGENT_DATA" not in executed_sql
    assert "GRANT CREATE TABLE TO APP_AGENT_DATA" not in executed_sql


def test_source_seed_table_io_reads_typed_csv_rows(tmp_path) -> None:
    assert column_type_label(("AMOUNT", "NUMBER", 0, 12, 2, "Y", 1)) == "NUMBER(12,2)"
    assert column_type_label(("NAME", "VARCHAR2", 64, None, None, "Y", 1)) == "VARCHAR2(64)"

    class Cursor:
        def execute(self, *_args, **_kwargs) -> None:
            return None

        def fetchall(self) -> list[tuple[object, ...]]:
            return [
                ("ID", "NUMBER", 0, 10, 0, "N", 1),
                ("CREATED_AT", "DATE", 0, None, None, "Y", 2),
            ]

    columns = table_columns(Cursor(), "FLEX_ACCOUNT", "APP_AGENT_DATA")
    csv_path = tmp_path / "FLEX_ACCOUNT.csv"
    csv_path.write_text("ID,CREATED_AT\n100,2026-01-02\n", encoding="utf-8")

    assert read_csv_rows(csv_path, columns) == [{"ID": Decimal("100"), "CREATED_AT": date(2026, 1, 2)}]


def test_replace_data_source_registers_columns_with_metadata() -> None:
    class Cursor:
        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        def execute(self, statement: str, **params) -> None:
            self.calls.append({"statement": statement, "params": params})

    cursor = Cursor()
    data_source_id = replace_data_source(
        cursor,
        "FLEX_ACCOUNT",
        2,
        [ColumnMetadata("ACCOUNT_NO", "VARCHAR2(20)", 20, "N", 1)],
        [{"column_name": "account_no", "comment": "Account number", "classification": "identifier"}],
        data_schema="APP_AGENT_DATA",
    )

    assert len(data_source_id) == 32
    assert cursor.calls[0]["params"]["owner_name"] == "APP_AGENT_DATA"
    assert cursor.calls[1]["params"]["business_comment"] == "Account number"
    assert cursor.calls[1]["params"]["classification"] == "identifier"
