import pytest

from apps.backend.app.select_ai.dashboards import DashboardService
from apps.backend.app.select_ai.charting import validate_chart_spec
from apps.backend.app.select_ai.dashboard_queries import (
    _json_loads,
    _materialize_stored_result,
    _safe_max_rows,
)
from apps.backend.app.select_ai.dashboard_schema import (
    _alter_if_missing,
    _create_if_missing,
)
from apps.backend.app.select_ai.dashboard_schema import _normalize_visibility


class FakeLob:
    def __init__(self, value: str) -> None:
        self.value = value

    def read(self) -> str:
        return self.value


class SchemaCursor:
    def __init__(self, error_message: str | None = None) -> None:
        self.error_message = error_message
        self.executed: list[str] = []
        self.closed = False

    def execute(self, statement: str) -> None:
        self.executed.append(statement)
        if self.error_message:
            raise RuntimeError(self.error_message)

    def close(self) -> None:
        self.closed = True


class SchemaConnection:
    def __init__(self, cursor: SchemaCursor) -> None:
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self) -> SchemaCursor:
        return self._cursor

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


class SchemaDbManager:
    def __init__(self, connection: SchemaConnection) -> None:
        self.connection = connection

    def get_connection(self) -> SchemaConnection:
        return self.connection


def test_normalize_visibility_defaults_and_accepts_known_values() -> None:
    assert _normalize_visibility(None) == "private"
    assert _normalize_visibility(" Shared ") == "shared"
    assert _normalize_visibility("private") == "private"


def test_normalize_visibility_rejects_unknown_values() -> None:
    with pytest.raises(ValueError, match="private or shared"):
        _normalize_visibility("public")


def test_json_loads_reads_lobs_and_uses_default_for_null() -> None:
    assert _json_loads(FakeLob('{"width": "full"}'), default={}) == {"width": "full"}
    assert _json_loads(None, default=[]) == []


def test_json_loads_reports_invalid_stored_json() -> None:
    with pytest.raises(ValueError, match="Stored dashboard JSON is invalid"):
        _json_loads("{bad json", default={})


def test_safe_max_rows_clamps_values() -> None:
    assert _safe_max_rows(None) == 500
    assert _safe_max_rows(0) == 500
    assert _safe_max_rows(-5) == 1
    assert _safe_max_rows(9000) == 5000


def test_materialize_stored_result_validates_sql_executes_rows_and_chart_spec() -> None:
    calls: list[tuple[str, int]] = []

    def execute_select(sql: str, *, max_rows: int):
        calls.append((sql, max_rows))
        return ["BRANCH_CODE", "TOTAL_AMOUNT"], [{"BRANCH_CODE": "001", "TOTAL_AMOUNT": 1200}]

    result = _materialize_stored_result(
        generated_sql="SELECT BRANCH_CODE, TOTAL_AMOUNT FROM demo;",
        chart_spec_json='{"type": "bar", "x": "BRANCH_CODE", "y": "TOTAL_AMOUNT"}',
        chart_spec_validator=validate_chart_spec,
        execute_select=execute_select,
        max_rows=50,
    )

    assert calls == [("SELECT BRANCH_CODE, TOTAL_AMOUNT FROM demo", 50)]
    assert result == {
        "sql": "SELECT BRANCH_CODE, TOTAL_AMOUNT FROM demo",
        "columns": ["BRANCH_CODE", "TOTAL_AMOUNT"],
        "rows": [{"BRANCH_CODE": "001", "TOTAL_AMOUNT": 1200}],
        "row_count": 1,
        "chart_spec": {"type": "bar", "x": "BRANCH_CODE", "y": "TOTAL_AMOUNT"},
    }


def test_create_if_missing_ignores_existing_object_error() -> None:
    cursor = SchemaCursor("ORA-00955: name is already used by an existing object")

    _create_if_missing(cursor, "CREATE TABLE analytics_dashboards")

    assert cursor.executed == ["CREATE TABLE analytics_dashboards"]


@pytest.mark.parametrize("message", ["ORA-01430: column being added already exists", "ORA-02264: name already used"])
def test_alter_if_missing_ignores_existing_column_or_constraint_errors(message: str) -> None:
    cursor = SchemaCursor(message)

    _alter_if_missing(cursor, "ALTER TABLE analytics_dashboards ADD visibility")

    assert cursor.executed == ["ALTER TABLE analytics_dashboards ADD visibility"]


def test_schema_helpers_reraise_unexpected_errors() -> None:
    cursor = SchemaCursor("ORA-00942: table or view does not exist")

    with pytest.raises(RuntimeError, match="ORA-00942"):
        _create_if_missing(cursor, "CREATE INDEX broken")


def test_ensure_tables_creates_dashboard_schema_and_commits() -> None:
    cursor = SchemaCursor()
    connection = SchemaConnection(cursor)
    service = DashboardService(SchemaDbManager(connection))

    service.ensure_tables()

    assert any("CREATE TABLE analytics_dashboards" in statement for statement in cursor.executed)
    assert any("ADD (visibility VARCHAR2(20)" in statement for statement in cursor.executed)
    assert any("CREATE TABLE analytics_dashboard_items" in statement for statement in cursor.executed)
    assert connection.committed is True
    assert connection.rolled_back is False
    assert cursor.closed is True
    assert connection.closed is True
