from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from apps.backend.app.api.setup_guard import require_setup_completed
from apps.backend.app.core.security import get_current_user
from apps.backend.app.select_ai.errors import (
    GENAI_RESOURCE_EXHAUSTED_DETAIL,
    SelectAIModelCapacityError,
    is_genai_resource_exhausted,
)
from apps.backend.app.select_ai.service import SelectAIAnalyticsService


router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_setup_completed)],
)


class AskAnalyticsRequest(BaseModel):
    question: str = Field(min_length=1)
    max_rows: int = Field(default=500, ge=1, le=5000)
    conversation_id: str | None = None


class RenameAnalyticsConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)


def _analytics_http_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, SelectAIModelCapacityError) or is_genai_resource_exhausted(exc):
        return HTTPException(status_code=429, detail=GENAI_RESOURCE_EXHAUSTED_DETAIL)
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/ask")
def ask_analytics(
    request: AskAnalyticsRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return SelectAIAnalyticsService.from_runtime().ask(
            question=request.question,
            max_rows=request.max_rows,
            conversation_id=request.conversation_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise _analytics_http_exception(exc) from exc


@router.get("/conversations")
def list_analytics_conversations(
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        items = SelectAIAnalyticsService.from_runtime().list_conversations(
            user_id=int(current_user.get("user_id") or 0),
            search=search,
            limit=limit,
        )
        return {"items": items}
    except Exception as exc:
        raise _analytics_http_exception(exc) from exc


@router.get("/conversations/{conversation_id}")
def get_analytics_conversation(
    conversation_id: str,
    max_rows: int = Query(default=500, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return SelectAIAnalyticsService.from_runtime().get_conversation(
            conversation_id=conversation_id,
            user_id=int(current_user.get("user_id") or 0),
            max_rows=max_rows,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise _analytics_http_exception(exc) from exc


@router.put("/conversations/{conversation_id}")
def rename_analytics_conversation(
    conversation_id: str,
    request: RenameAnalyticsConversationRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return SelectAIAnalyticsService.from_runtime().rename_conversation(
            conversation_id=conversation_id,
            title=request.title,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise _analytics_http_exception(exc) from exc


@router.delete("/conversations/{conversation_id}")
def delete_analytics_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return SelectAIAnalyticsService.from_runtime().delete_conversation(
            conversation_id=conversation_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise _analytics_http_exception(exc) from exc
