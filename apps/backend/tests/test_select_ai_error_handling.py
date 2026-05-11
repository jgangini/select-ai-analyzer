from __future__ import annotations

from apps.backend.app.api.routes.analytics import _analytics_http_exception
from apps.backend.app.select_ai.errors import (
    GENAI_RESOURCE_EXHAUSTED_DETAIL,
    SelectAIModelCapacityError,
    is_genai_resource_exhausted,
)
from apps.backend.app.select_ai.select_ai_ask import SelectAIAskMixin
from apps.backend.app.select_ai.service import _fallback_sql_for_question
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
    sql = _fallback_sql_for_question("Which customers increased transaction volume by more than 50% this month?")

    assert sql is not None
    assert "FLEX_EXT_ACCOUNT_TRANSACTIONS" in sql
    assert "RELATED_CUSTOMER" in sql
    assert "TRANSACTION_GROWTH_PCT" in sql


def test_default_suggested_questions_have_deterministic_fallback_sql() -> None:
    for question in DEFAULT_SUGGESTED_QUESTIONS:
        assert _fallback_sql_for_question(question), question


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

    result = service.ask(question="Which customers increased transaction volume by more than 50% this month?")

    assert result["run_id"] == "run-1"
    assert result["row_count"] == 1
    assert "FLEX_EXT_ACCOUNT_TRANSACTIONS" in service.executed_sql
    assert "generative service" in result["answer"]
    assert service.recorded_answer == result["answer"]
    assert service.dropped_profile == "SCOPED_PROFILE"
