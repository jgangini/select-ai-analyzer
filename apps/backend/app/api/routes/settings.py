from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from apps.backend.app.api.setup_guard import require_setup_completed
from apps.backend.app.core.security import get_current_user
from apps.backend.app.services.settings_service import AvatarValidationError, SettingsService

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[Depends(require_setup_completed)],
)


class SettingsUpdateRequest(BaseModel):
    updates: dict[str, Any] = Field(default_factory=dict)


def get_settings_service() -> SettingsService:
    return SettingsService.from_runtime()


@router.get("", dependencies=[Depends(get_current_user)])
def get_settings_payload() -> dict:
    return get_settings_service().get_payload()


@router.get("/public")
def get_public_settings_payload() -> dict:
    return get_settings_service().get_public_payload()


@router.put("", dependencies=[Depends(get_current_user)])
def update_settings(request: SettingsUpdateRequest) -> dict:
    return get_settings_service().update(request.updates)


@router.get("/status", dependencies=[Depends(get_current_user)])
def settings_status() -> dict:
    return {"completed": get_settings_service().is_setup_complete()}


@router.post("/reset", dependencies=[Depends(get_current_user)])
def reset_settings() -> dict:
    return get_settings_service().reset()


@router.get("/agent-avatar")
def get_agent_avatar():
    avatar_file = get_settings_service().get_avatar_file()
    if avatar_file is None:
        raise HTTPException(status_code=404, detail="Agent avatar not found")
    return FileResponse(path=avatar_file.path, media_type=avatar_file.media_type, filename=avatar_file.filename)


@router.post("/agent-avatar", dependencies=[Depends(get_current_user)])
async def upload_agent_avatar(
    file: UploadFile = File(...),
):
    content = await file.read()
    try:
        return get_settings_service().upload_avatar(content_type=str(file.content_type or ""), content=content)
    except AvatarValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/agent-avatar", dependencies=[Depends(get_current_user)])
def delete_agent_avatar():
    return get_settings_service().delete_avatar()
