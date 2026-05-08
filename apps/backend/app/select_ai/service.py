from __future__ import annotations

from apps.backend.app.select_ai.base_service import SelectAIBaseService
from apps.backend.app.select_ai.conversation_operations import SelectAIConversationMixin
from apps.backend.app.select_ai.scoped_profile_operations import SelectAIScopedProfileMixin
from apps.backend.app.select_ai.select_ai_ask import SelectAIAskMixin
from apps.backend.app.select_ai.select_ai_generation import SelectAIGenerationMixin
from apps.backend.app.select_ai.source_intents import _is_velocity_window_intent
from apps.backend.app.select_ai.source_scoring import _score_source_match
from apps.backend.app.select_ai.source_sql_guidance import (
    _fallback_sql_for_question,
    _sql_generation_hints,
    _uses_current_clock,
    _uses_current_clock_for_velocity_sql,
)


class SelectAIAnalyticsService(
    SelectAIBaseService,
    SelectAIConversationMixin,
    SelectAIScopedProfileMixin,
    SelectAIGenerationMixin,
    SelectAIAskMixin,
):
    pass
