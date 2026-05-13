from __future__ import annotations

import pytest

from apps.backend.app.api.routes.analytics import _analytics_http_exception
from apps.backend.app.select_ai.errors import (
    GENAI_RESOURCE_EXHAUSTED_DETAIL,
    SelectAIModelCapacityError,
    is_genai_resource_exhausted,
)
from apps.backend.app.select_ai.select_ai_ask import SelectAIAskMixin


RESOURCE_EXHAUSTED_ORA = """
ORA-20400: Request failed with status HTTP 400 - https://inference.generativeai.us-chicago-1.oci.example/actions/chat
Error response - { "code": "400", "message": "{ \"error\": { \"code\": 429, \"message\": \"Resource exhausted.\", \"status\": \"RESOURCE_EXHAUSTED\" } }" }
ORA-06512: at "C##CLOUD$SERVICE.DBMS_CLOUD_AI", line 19576
"""


def test_genai_resource_exhausted_detection_sanitizes_oracle_stack() -> None:
    assert is_genai_resource_exhausted(RuntimeError(RESOURCE_EXHAUSTED_ORA))

    http_error = _analytics_http_exception(RuntimeError(RESOURCE_EXHAUSTED_ORA))
    direct_http_error = _analytics_http_exception(SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL))

    assert http_error.status_code == 429
    assert http_error.detail == GENAI_RESOURCE_EXHAUSTED_DETAIL
    assert direct_http_error.status_code == 429
    assert direct_http_error.detail == GENAI_RESOURCE_EXHAUSTED_DETAIL
    assert "ORA-06512" not in str(http_error.detail)


class CapacityExhaustedDuringSqlAskService(SelectAIAskMixin):
    def __init__(self) -> None:
        self.dropped_profile = ""
        self.executed_select = False
        self.narrated = False
        self.recorded = False

    def _create_select_ai_conversation(self, *, title: str) -> str:
        return "conversation-1"

    def create_scoped_profile(self, question: str):
        return "SCOPED_PROFILE", []

    def generate_sql(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        raise SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL)

    def execute_select(self, sql: str, *, max_rows: int = 500):
        self.executed_select = True
        raise AssertionError("ask must not execute SQL when Select AI cannot generate SQL")

    def narrate(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        self.narrated = True
        raise AssertionError("ask must not narrate when Select AI cannot generate SQL")

    def record_question_run(self, **kwargs):
        self.recorded = True
        raise AssertionError("ask must not record a run when Select AI cannot generate SQL")

    def drop_scoped_profile(self, profile_name: str) -> None:
        self.dropped_profile = profile_name


def test_ask_propagates_capacity_error_during_sql_generation_without_fallback() -> None:
    service = CapacityExhaustedDuringSqlAskService()

    with pytest.raises(SelectAIModelCapacityError):
        service.ask(question="Que clientes aumentaron su volumen de transacciones mas del 50% este mes?")

    assert service.dropped_profile == "SCOPED_PROFILE"
    assert service.executed_select is False
    assert service.narrated is False
    assert service.recorded is False


class CapacityExhaustedDuringNarrateAskService(SelectAIAskMixin):
    def __init__(self) -> None:
        self.dropped_profile = ""
        self.executed_sql = ""
        self.recorded = False

    def _create_select_ai_conversation(self, *, title: str) -> str:
        return "conversation-1"

    def create_scoped_profile(self, question: str):
        return "SCOPED_PROFILE", []

    def generate_sql(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        return "SELECT 1 AS VALUE FROM DUAL"

    def execute_select(self, sql: str, *, max_rows: int = 500):
        self.executed_sql = sql
        return ["VALUE"], [{"VALUE": 1}]

    def narrate(self, question: str, *, conversation_id: str | None = None, profile_name: str | None = None) -> str:
        raise SelectAIModelCapacityError(GENAI_RESOURCE_EXHAUSTED_DETAIL)

    def record_question_run(self, **kwargs):
        self.recorded = True
        raise AssertionError("ask must not record a run when Select AI cannot narrate")

    def drop_scoped_profile(self, profile_name: str) -> None:
        self.dropped_profile = profile_name


def test_ask_propagates_capacity_error_during_narration_without_fallback_answer() -> None:
    service = CapacityExhaustedDuringNarrateAskService()

    with pytest.raises(SelectAIModelCapacityError):
        service.ask(question="Resume el resultado")

    assert service.executed_sql == "SELECT 1 AS VALUE FROM DUAL"
    assert service.dropped_profile == "SCOPED_PROFILE"
    assert service.recorded is False
