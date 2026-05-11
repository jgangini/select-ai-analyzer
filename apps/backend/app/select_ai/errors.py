from __future__ import annotations

import re


GENAI_RESOURCE_EXHAUSTED_DETAIL = (
    "The generative AI service is temporarily saturated or out of quota "
    "(429 RESOURCE_EXHAUSTED). Wait a few minutes and try again, "
    "or change the configured model in Settings."
)


class SelectAIModelCapacityError(RuntimeError):
    """Raised when the configured model provider reports temporary capacity exhaustion."""


def is_genai_resource_exhausted(error: object) -> bool:
    message = str(error or "")
    normalized = message.lower()
    has_capacity_signal = any(
        signal in normalized
        for signal in (
            "resource_exhausted",
            "resource exhausted",
            "too many requests",
        )
    ) or bool(re.search(r'"code"\s*:\s*"?429"?', message))
    has_genai_signal = any(
        signal in normalized
        for signal in (
            "dbms_cloud_ai",
            "generativeai",
            "vertex-ai",
            "ora-20400",
        )
    )
    return has_capacity_signal and has_genai_signal
