from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from apps.backend.app.api.setup_guard import require_setup_completed
from apps.backend.app.core.security import get_current_user
from apps.backend.app.core.session import get_db_manager
from apps.backend.app.select_ai.agent_builder import AgentBuilderService, build_attributes, build_dbms_block


router = APIRouter(
    prefix="/agent-builder",
    tags=["agent-builder"],
    dependencies=[Depends(require_setup_completed)],
)


class AgentObjectRequest(BaseModel):
    object_type: str = Field(pattern="^(TOOL|TASK|AGENT|TEAM|tool|task|agent|team)$")
    name: str = Field(min_length=1)
    attributes: dict[str, Any] = Field(default_factory=dict)


class TeamRunRequest(BaseModel):
    team_name: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    conversation_id: str | None = None


@router.post("/script")
def generate_script(request: AgentObjectRequest, current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    try:
        attrs = build_attributes(request.object_type, request.attributes)
        return {"script": build_dbms_block(request.object_type, request.name, attrs), "attributes": attrs}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/objects")
def create_object(request: AgentObjectRequest, current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    try:
        return AgentBuilderService(get_db_manager()).create_object(
            object_type=request.object_type,
            name=request.name,
            attributes=request.attributes,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/run-team")
def run_team(request: TeamRunRequest, current_user: dict = Depends(get_current_user)) -> dict:
    try:
        return AgentBuilderService(get_db_manager()).run_team(
            team_name=request.team_name,
            prompt=request.prompt,
            conversation_id=request.conversation_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
