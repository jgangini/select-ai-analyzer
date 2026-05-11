import pytest

from apps.backend.app.select_ai.charting import infer_chart_spec, validate_chart_spec
from apps.backend.app.select_ai.sql_validation import validate_read_only_select


def test_validate_read_only_select_accepts_single_select() -> None:
    assert validate_read_only_select("SELECT COUNT(*) AS TOTAL FROM APP_AGENT.DW_FCT_ACCOUNT_TXN;") == (
        "SELECT COUNT(*) AS TOTAL FROM APP_AGENT.DW_FCT_ACCOUNT_TXN"
    )


def test_validate_read_only_select_accepts_single_fenced_select() -> None:
    assert validate_read_only_select("```sql\nSELECT COUNT(*) AS TOTAL FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS;\n```") == (
        "SELECT COUNT(*) AS TOTAL FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS"
    )


def test_validate_read_only_select_rejects_select_ai_error_text() -> None:
    with pytest.raises(ValueError, match="Only SELECT statements"):
        validate_read_only_select(
            "Sorry, unfortunately a valid SELECT statement could not be generated.\n"
            "```sql\nSELECT * FROM APP_AGENT_DATA.FLEX_ICTM_ACC WHERE ACC = '1' AND\n```\n"
            "Exception encountered: ORA-00936: missing expression"
        )


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM USERS",
        "SELECT * FROM USERS; DROP TABLE USERS",
        "BEGIN NULL; END;",
        "UPDATE USERS SET USER_STATE = 0",
    ],
)
def test_validate_read_only_select_rejects_unsafe_sql(sql: str) -> None:
    with pytest.raises(ValueError):
        validate_read_only_select(sql)


def test_infer_chart_spec_prefers_bar_for_category_and_number() -> None:
    rows = [{"BRANCH_CODE": "001", "TOTAL_AMOUNT": 100.0}, {"BRANCH_CODE": "002", "TOTAL_AMOUNT": 50.0}]
    spec = infer_chart_spec(rows, ["BRANCH_CODE", "TOTAL_AMOUNT"], title="Total by branch")

    assert spec["type"] == "pie"
    assert spec["x"] == "BRANCH_CODE"
    assert spec["y"] == "TOTAL_AMOUNT"
    assert validate_chart_spec(spec, ["BRANCH_CODE", "TOTAL_AMOUNT"]) == spec


def test_infer_chart_spec_uses_bar_for_single_row_numeric_comparison() -> None:
    rows = [{"TOTAL_DEBITS": 120000, "TOTAL_CREDITS": 95000}]
    spec = infer_chart_spec(rows, ["TOTAL_DEBITS", "TOTAL_CREDITS"], title="Debits vs credits")

    assert spec["type"] == "bar"
    assert validate_chart_spec(spec, ["TOTAL_DEBITS", "TOTAL_CREDITS"]) == spec


def test_validate_chart_spec_rejects_unknown_columns() -> None:
    with pytest.raises(ValueError):
        validate_chart_spec({"type": "bar", "x": "BRANCH", "y": "MISSING"}, ["BRANCH"])
