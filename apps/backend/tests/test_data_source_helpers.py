from datetime import datetime
from decimal import Decimal

import pytest

from apps.backend.app.select_ai.data_source_operations import SelectAIDataSourceMixin
from apps.backend.app.select_ai.data_source_preview import SelectAIDataSourcePreviewMixin
from apps.backend.app.select_ai.constants import DEFAULT_DATA_SCHEMA
from apps.backend.app.select_ai.sql_names import (
    _clean_optional_text,
    _qualified_name,
    _safe_identifier,
    _sql_string_literal,
)
from apps.backend.app.select_ai.value_serialization import _json_safe


class FakeLob:
    def __init__(self, value: str) -> None:
        self.value = value

    def read(self) -> str:
        return self.value


class PreviewCursor:
    def __init__(self) -> None:
        self.description = []
        self.executed: list[tuple[str, dict]] = []
        self._fetchone = None
        self._fetchall = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.executed.append((statement, params))
        if "FROM data_sources ds" in statement:
            self.description = [
                ("DATA_SOURCE_ID",),
                ("SOURCE_NAME",),
                ("SOURCE_TYPE",),
                ("OWNER_NAME",),
                ("TABLE_NAME",),
                ("ACCESS_SCOPE",),
                ("ROW_COUNT",),
                ("COLUMN_COUNT",),
                ("STATUS",),
                ("CREATED_AT",),
            ]
            self._fetchone = (
                "ds1",
                "Accounts",
                "csv",
                "APP_AGENT_DATA",
                "ACCOUNTS",
                "all",
                Decimal("2"),
                2,
                "active",
                datetime(2026, 1, 2, 3, 4, 5),
            )
            self._fetchall = []
        elif "FROM source_columns sc" in statement:
            self.description = []
            self._fetchone = None
            self._fetchall = [
                ("account_no", "varchar2", 64, "N", 1, FakeLob("Customer account"), "identifier", "Y"),
                ("balance", "number", 22, "Y", 2, None, "financial", "N"),
            ]
        elif statement.startswith("SELECT COUNT(*) FROM"):
            self.description = [("COUNT",)]
            self._fetchone = (234,)
            self._fetchall = []
        elif "OFFSET :offset_value ROWS FETCH NEXT :limit_value ROWS ONLY" in statement:
            self.description = [("ACCOUNT_NO",), ("BALANCE",)]
            self._fetchone = None
            self._fetchall = [("001", Decimal("10.25"))]

    def fetchone(self):
        return self._fetchone

    def fetchall(self):
        return self._fetchall

    def close(self) -> None:
        self.closed = True


class PreviewConnection:
    def __init__(self, cursor: PreviewCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> PreviewCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


class PreviewService(SelectAIDataSourcePreviewMixin):
    def __init__(self, connection: PreviewConnection) -> None:
        self.connection = connection

    def _connection(self) -> PreviewConnection:
        return self.connection


class CatalogCursor:
    def __init__(self) -> None:
        self.description = []
        self.executed: list[tuple[str, dict]] = []
        self._fetchall = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.executed.append((statement, params))
        if "FROM data_sources ds" in statement:
            self.description = [
                ("DATA_SOURCE_ID",),
                ("SOURCE_NAME",),
                ("SOURCE_TYPE",),
                ("OWNER_NAME",),
                ("TABLE_NAME",),
                ("ACCESS_SCOPE",),
                ("ROW_COUNT",),
                ("COLUMN_COUNT",),
                ("STATUS",),
                ("CREATED_AT",),
            ]
            self._fetchall = [
                (
                    "ds1",
                    "Reporting Accounts",
                    "existing_table",
                    "REPORTING",
                    "ACCOUNTS",
                    "all",
                    Decimal("12"),
                    Decimal("4"),
                    "active",
                    datetime(2026, 1, 2, 3, 4, 5),
                )
            ]
        elif "FROM all_users" in statement:
            self._fetchall = [("REPORTING",)]
        elif "FROM data_sources" in statement and "GROUP BY owner_name" in statement:
            self._fetchall = [("REPORTING", 2)]
        else:
            self._fetchall = []

    def fetchall(self):
        return self._fetchall

    def close(self) -> None:
        self.closed = True


class CatalogConnection:
    def __init__(self, cursor: CatalogCursor) -> None:
        self._cursor = cursor
        self.closed = False

    def cursor(self) -> CatalogCursor:
        return self._cursor

    def close(self) -> None:
        self.closed = True


class CatalogService(SelectAIDataSourceMixin):
    def __init__(self, connection: CatalogConnection) -> None:
        self.connection = connection

    def _connection(self) -> CatalogConnection:
        return self.connection


class RegisterCursor(CatalogCursor):
    def execute(self, statement: str, **params) -> None:
        self.executed.append((statement, params))
        if "FROM all_tab_columns" in statement:
            self._fetchall = [("ACCOUNT_NO", "VARCHAR2", 64, "Y", 1)]


class RegisterConnection(CatalogConnection):
    def __init__(self, cursor: RegisterCursor) -> None:
        super().__init__(cursor)
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class RegisterService(SelectAIDataSourceMixin):
    def __init__(self, connection: RegisterConnection) -> None:
        self.connection = connection
        self.refreshed = False

    def _connection(self) -> RegisterConnection:
        return self.connection

    def _apply_select_ai_metadata(self, *_args, **_kwargs) -> list[str]:
        return []

    def _replace_source_columns(self, *_args, **_kwargs) -> None:
        raise RuntimeError("source column failure")

    def refresh_profile(self, *, user_id: int = 0) -> None:
        self.refreshed = True


class MetadataCursor:
    def __init__(self, *, fail_on: str | None = None, primary_key_exists: bool = False) -> None:
        self.fail_on = fail_on
        self.primary_key_exists = primary_key_exists
        self.execute_calls: list[tuple[str, dict]] = []

    def execute(self, statement: str, **params) -> None:
        self.execute_calls.append((statement, params))
        if self.fail_on and self.fail_on in statement:
            raise RuntimeError("metadata statement failed")

    def fetchone(self):
        return (1 if self.primary_key_exists else 0,)


def test_sql_name_helpers_normalize_identifiers_and_literals() -> None:
    assert _safe_identifier(" account no ") == "ACCOUNT_NO"
    assert _safe_identifier("123 ledger") == "T_123_LEDGER"
    assert _safe_identifier("A" * 140, max_len=12) == "A" * 12
    assert _qualified_name("app agent data", "account ledger") == "APP_AGENT_DATA.ACCOUNT_LEDGER"
    assert _sql_string_literal("Nadia's account") == "'Nadia''s account'"
    assert _clean_optional_text("  important note  ", limit=9) == "important"


def test_sql_name_helpers_reject_blank_identifier() -> None:
    with pytest.raises(ValueError, match="Identifier"):
        _safe_identifier(" !!! ")


def test_json_safe_reads_lobs_and_serializes_runtime_values() -> None:
    assert _json_safe(FakeLob("hello")) == "hello"
    assert _json_safe(datetime(2026, 1, 2, 3, 4, 5)) == "2026-01-02T03:04:05"
    assert _json_safe(Decimal("12.50")) == 12.5


def test_data_schema_assertion_blocks_app_and_system_schemas() -> None:
    assert SelectAIDataSourceMixin._assert_data_schema(" app agent data ") == "APP_AGENT_DATA"
    with pytest.raises(ValueError, match="APP_AGENT is reserved"):
        SelectAIDataSourceMixin._assert_data_schema("APP_AGENT")
    with pytest.raises(ValueError, match="not an allowed data schema"):
        SelectAIDataSourceMixin._assert_data_schema("SYS")


def test_create_data_schema_creates_upload_only_owner_without_login_grants() -> None:
    class SchemaCursor:
        def __init__(self) -> None:
            self.executed: list[str] = []

        def execute(self, statement: str, **_params) -> None:
            self.executed.append(statement)

        def fetchone(self) -> tuple[int]:
            return (0,)

        def close(self) -> None:
            return None

    class SchemaConnection:
        def __init__(self, cursor: SchemaCursor) -> None:
            self._cursor = cursor
            self.commits = 0
            self.rollbacks = 0

        def cursor(self) -> SchemaCursor:
            return self._cursor

        def commit(self) -> None:
            self.commits += 1

        def rollback(self) -> None:
            self.rollbacks += 1

        def close(self) -> None:
            return None

    cursor = SchemaCursor()
    connection = SchemaConnection(cursor)
    service = CatalogService(connection)  # type: ignore[arg-type]

    result = service.create_data_schema("APP_AGENT_DATA")

    assert result == {"schema_name": "APP_AGENT_DATA", "created": True}
    assert any(statement.startswith("CREATE USER APP_AGENT_DATA") for statement in cursor.executed)
    assert not any(statement.startswith("GRANT ") for statement in cursor.executed)
    assert connection.commits == 1
    assert connection.rollbacks == 0


def test_list_schemas_includes_default_schema_and_source_counts() -> None:
    cursor = CatalogCursor()
    connection = CatalogConnection(cursor)
    service = CatalogService(connection)

    result = service.list_schemas()

    assert result == [
        {
            "schema_name": DEFAULT_DATA_SCHEMA,
            "exists": False,
            "is_app_schema": False,
            "source_count": 0,
        },
        {
            "schema_name": "REPORTING",
            "exists": True,
            "is_app_schema": False,
            "source_count": 2,
        },
    ]
    assert cursor.closed is True
    assert connection.closed is True


def test_list_data_sources_returns_json_safe_catalog_rows() -> None:
    cursor = CatalogCursor()
    connection = CatalogConnection(cursor)
    service = CatalogService(connection)

    result = service.list_data_sources()

    assert result == [
        {
            "data_source_id": "ds1",
            "source_name": "Reporting Accounts",
            "source_type": "existing_table",
            "owner_name": "REPORTING",
            "table_name": "ACCOUNTS",
            "access_scope": "all",
            "row_count": 12.0,
            "column_count": 4.0,
            "status": "active",
            "created_at": "2026-01-02T03:04:05",
        }
    ]
    assert cursor.closed is True
    assert connection.closed is True


def test_register_existing_table_rolls_back_when_source_column_sync_fails() -> None:
    cursor = RegisterCursor()
    connection = RegisterConnection(cursor)
    service = RegisterService(connection)

    with pytest.raises(RuntimeError, match="source column failure"):
        service.register_existing_table(owner=DEFAULT_DATA_SCHEMA, table_name="accounts")

    assert connection.rollbacks == 1
    assert connection.commits == 0
    assert service.refreshed is False
    assert cursor.closed is True
    assert connection.closed is True


def test_apply_select_ai_metadata_adds_comments_annotations_and_primary_key() -> None:
    cursor = MetadataCursor()
    service = SelectAIDataSourceMixin()

    warnings = service._apply_select_ai_metadata(
        cursor,
        owner_name="APP_AGENT_DATA",
        table_name="accounts",
        table_comment=" Account master ",
        column_metadata=[
            {
                "column_name": "account no",
                "comment": "Customer account",
                "ui_display": "Account",
                "classification": "identifier",
                "primary_key": True,
            },
            "not metadata",
        ],
    )

    statements = [statement for statement, _ in cursor.execute_calls]
    assert warnings == []
    assert "COMMENT ON TABLE APP_AGENT_DATA.ACCOUNTS IS 'Account master'" in statements
    assert any("COMMENT ON COLUMN APP_AGENT_DATA.ACCOUNTS.ACCOUNT_NO IS 'Customer account'" in item for item in statements)
    assert any("UI_DISPLAY 'Account'" in item for item in statements)
    assert any("CLASSIFICATION 'identifier'" in item for item in statements)
    assert any("ADD CONSTRAINT PK_ACCOUNTS_" in item and "PRIMARY KEY (ACCOUNT_NO)" in item for item in statements)


def test_apply_select_ai_metadata_collects_statement_warnings() -> None:
    cursor = MetadataCursor(fail_on="COMMENT ON COLUMN")
    service = SelectAIDataSourceMixin()

    warnings = service._apply_select_ai_metadata(
        cursor,
        owner_name="APP_AGENT_DATA",
        table_name="accounts",
        table_comment=None,
        column_metadata=[{"column_name": "account no", "comment": "Customer account"}],
    )

    assert len(warnings) == 1
    assert warnings[0].startswith("Comment for ACCOUNT_NO was not applied: metadata statement failed")


def test_preview_data_source_rows_serializes_rows_and_clamps_pagination() -> None:
    cursor = PreviewCursor()
    connection = PreviewConnection(cursor)
    service = PreviewService(connection)

    result = service.preview_data_source_rows(" ds1 ", limit=500, offset=-5)

    assert result["limit"] == 100
    assert result["offset"] == 0
    assert result["row_count"] == 234
    assert result["data_source"]["row_count"] == 2.0
    assert result["data_source"]["created_at"] == "2026-01-02T03:04:05"
    assert result["columns"] == ["ACCOUNT_NO", "BALANCE"]
    assert result["rows"] == [{"ACCOUNT_NO": "001", "BALANCE": 10.25}]
    assert result["column_details"][0]["comment"] == "Customer account"
    assert result["column_details"][0]["primary_key"] is True
    assert any("SELECT COUNT(*) FROM APP_AGENT_DATA.ACCOUNTS" in statement for statement, _ in cursor.executed)
    assert cursor.closed is True
    assert connection.closed is True
