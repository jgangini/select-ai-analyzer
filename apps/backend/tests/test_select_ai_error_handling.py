from __future__ import annotations

import pytest

from apps.backend.app.api.routes.analytics import _analytics_http_exception
from apps.backend.app.select_ai.charting import infer_chart_spec, validate_chart_spec
from apps.backend.app.select_ai.errors import (
    GENAI_RESOURCE_EXHAUSTED_DETAIL,
    SelectAIModelCapacityError,
    is_genai_resource_exhausted,
)
from apps.backend.app.select_ai.select_ai_ask import SelectAIAskMixin
from apps.backend.app.select_ai.service import _fallback_sql_for_question
from apps.backend.app.select_ai.sql_validation import validate_read_only_select
from apps.backend.app.services.settings_service import DEFAULT_SUGGESTED_QUESTIONS


RESOURCE_EXHAUSTED_ORA = """
ORA-20400: Request failed with status HTTP 400 - https://inference.generativeai.us-chicago-1.oci.example/actions/chat
Error response - { "code": "400", "message": "{ \"error\": { \"code\": 429, \"message\": \"Resource exhausted.\", \"status\": \"RESOURCE_EXHAUSTED\" } }" }
ORA-06512: at "C##CLOUD$SERVICE.DBMS_CLOUD_AI", line 19576
"""


def test_genai_resource_exhausted_detection_sanitizes_oracle_stack() -> None:
    assert is_genai_resource_exhausted(RuntimeError(RESOURCE_EXHAUSTED_ORA))

    http_error = _analytics_http_exception(RuntimeError(RESOURCE_EXHAUSTED_ORA))

    assert http_error.status_code == 429
    assert http_error.detail == GENAI_RESOURCE_EXHAUSTED_DETAIL
    assert "ORA-06512" not in str(http_error.detail)


def test_customer_growth_question_has_deterministic_fallback_sql() -> None:
    sql = _fallback_sql_for_question("¿Qué clientes aumentaron su volumen de transacciones más del 50% este mes?")

    assert sql is not None
    assert "FLEX_EXT_ACCOUNT_TRANSACTIONS" in sql
    assert "RELATED_CUSTOMER" in sql
    assert "TRANSACTION_GROWTH_PCT" in sql


def test_default_suggested_questions_have_deterministic_fallback_sql() -> None:
    for question in DEFAULT_SUGGESTED_QUESTIONS:
        assert _fallback_sql_for_question(question), question


CHARTABLE_DEFAULT_QUESTION_SAMPLES = (
    (
        DEFAULT_SUGGESTED_QUESTIONS[0],
        ["BRANCH_CODE", "CCY", "ACCOUNT_COUNT", "TOTAL_LCY_BALANCE"],
        [
            {"BRANCH_CODE": "001", "CCY": "USD", "ACCOUNT_COUNT": 18, "TOTAL_LCY_BALANCE": 45200},
            {"BRANCH_CODE": "002", "CCY": "USD", "ACCOUNT_COUNT": 9, "TOTAL_LCY_BALANCE": 18500},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[1],
        ["CUST_AC_NO", "CUST_NO", "ACY_BLOCKED_AMOUNT", "LCY_CURR_BALANCE"],
        [
            {"CUST_AC_NO": "001234567890", "CUST_NO": "CUST000123", "ACY_BLOCKED_AMOUNT": 12000, "LCY_CURR_BALANCE": 90000},
            {"CUST_AC_NO": "009988776655", "CUST_NO": "CUST009999", "ACY_BLOCKED_AMOUNT": 8000, "LCY_CURR_BALANCE": 35000},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[2],
        ["PRODUCT_CODE", "TRANSACTION_COUNT", "TOTAL_LCY_AMOUNT"],
        [
            {"PRODUCT_CODE": "SAV", "TRANSACTION_COUNT": 180, "TOTAL_LCY_AMOUNT": 850000},
            {"PRODUCT_CODE": "CHK", "TRANSACTION_COUNT": 125, "TOTAL_LCY_AMOUNT": 420000},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[3],
        ["TRANSACTION_DATE", "DEBIT_LCY_AMOUNT", "CREDIT_LCY_AMOUNT"],
        [
            {"TRANSACTION_DATE": f"2026-03-{day:02d}", "DEBIT_LCY_AMOUNT": 10000 + day, "CREDIT_LCY_AMOUNT": 8000 + day}
            for day in range(1, 10)
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[4],
        ["RELATED_CUSTOMER", "CURRENT_TRANSACTION_COUNT", "TRANSACTION_GROWTH_PCT"],
        [
            {"RELATED_CUSTOMER": "CUST000123", "CURRENT_TRANSACTION_COUNT": 18, "TRANSACTION_GROWTH_PCT": 80},
            {"RELATED_CUSTOMER": "CUST009999", "CURRENT_TRANSACTION_COUNT": 12, "TRANSACTION_GROWTH_PCT": 55},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[5],
        ["TRANS_AC_NO", "WITHDRAWAL_COUNT", "TOTAL_WITHDRAWAL_AMOUNT"],
        [
            {"TRANS_AC_NO": "4455667788", "WITHDRAWAL_COUNT": 7, "TOTAL_WITHDRAWAL_AMOUNT": 9500},
            {"TRANS_AC_NO": "001234567890", "WITHDRAWAL_COUNT": 5, "TOTAL_WITHDRAWAL_AMOUNT": 6200},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[6],
        ["ACCOUNT_NUMBER", "CUSTOMER_ID", "ESTIMATED_PENDING_DEBT"],
        [
            {"ACCOUNT_NUMBER": "LN001", "CUSTOMER_ID": "CUST000123", "ESTIMATED_PENDING_DEBT": 180000},
            {"ACCOUNT_NUMBER": "LN002", "CUSTOMER_ID": "CUST009999", "ESTIMATED_PENDING_DEBT": 95000},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[7],
        ["REFERENCE_NO", "ACC", "TD_AMOUNT", "TD_MATURITY_AMT"],
        [
            {"REFERENCE_NO": "TD001", "ACC": "112233", "TD_AMOUNT": 25000, "TD_MATURITY_AMT": 26300},
            {"REFERENCE_NO": "TD002", "ACC": "445566", "TD_AMOUNT": 18000, "TD_MATURITY_AMT": 18850},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[8],
        ["ACCOUNT_NO", "TRN_REF_NO", "LCY_AMOUNT"],
        [
            {"ACCOUNT_NO": "4455667788", "TRN_REF_NO": "TRN123", "LCY_AMOUNT": 7200},
            {"ACCOUNT_NO": "0011223344", "TRN_REF_NO": "TRN456", "LCY_AMOUNT": 5100},
        ],
    ),
    (
        DEFAULT_SUGGESTED_QUESTIONS[9],
        ["AUTH_ID", "AUTHORIZED_MOVEMENT_COUNT", "TOTAL_LCY_AMOUNT"],
        [
            {"AUTH_ID": "USER_A01", "AUTHORIZED_MOVEMENT_COUNT": 42, "TOTAL_LCY_AMOUNT": 125000},
            {"AUTH_ID": "USER_B02", "AUTHORIZED_MOVEMENT_COUNT": 31, "TOTAL_LCY_AMOUNT": 93000},
        ],
    ),
)


@pytest.mark.parametrize("question,columns,rows", CHARTABLE_DEFAULT_QUESTION_SAMPLES)
def test_default_suggested_questions_have_chartable_results(question, columns, rows) -> None:
    sql = _fallback_sql_for_question(question)

    assert sql is not None
    validate_read_only_select(sql)
    chart_spec = validate_chart_spec(infer_chart_spec(rows, columns, title=question), columns)
    assert chart_spec["type"] != "table"


class CapacityFallbackAskService(SelectAIAskMixin):
    def __init__(self) -> None:
        self.dropped_profile = ""
        self.executed_sql = ""
        self.recorded_answer = ""

    def _create_select_ai_conversation(self, *, title: str) -> str:
        return "conversation-1"

    def create_scoped_profile(self, question: str):
        return "SCOPED_PROFILE", []

    def generate_sql(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        raise SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL)

    def execute_select(self, sql: str, *, max_rows: int = 500):
        self.executed_sql = sql
        return (
            [
                "RELATED_CUSTOMER",
                "PREVIOUS_TRANSACTION_COUNT",
                "CURRENT_TRANSACTION_COUNT",
                "TRANSACTION_GROWTH_PCT",
            ],
            [
                {
                    "RELATED_CUSTOMER": "CUST000123",
                    "PREVIOUS_TRANSACTION_COUNT": 2,
                    "CURRENT_TRANSACTION_COUNT": 4,
                    "TRANSACTION_GROWTH_PCT": 100,
                }
            ],
        )

    def narrate(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        raise SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL)

    def record_question_run(self, **kwargs):
        self.recorded_answer = str(kwargs["answer"])
        return "run-1"

    def drop_scoped_profile(self, profile_name: str) -> None:
        self.dropped_profile = profile_name


def test_ask_uses_deterministic_sql_when_model_capacity_is_exhausted() -> None:
    service = CapacityFallbackAskService()

    result = service.ask(question="¿Qué clientes aumentaron su volumen de transacciones más del 50% este mes?")

    assert result["run_id"] == "run-1"
    assert result["row_count"] == 1
    assert result["chart_spec"]["type"] in {"bar", "pie", "table"}
    assert result["chart_spec"]["title"].startswith("¿Qué clientes aumentaron")
    assert "FLEX_EXT_ACCOUNT_TRANSACTIONS" in service.executed_sql
    assert "generative service" in result["answer"]
    assert service.recorded_answer == result["answer"]
    assert service.dropped_profile == "SCOPED_PROFILE"
