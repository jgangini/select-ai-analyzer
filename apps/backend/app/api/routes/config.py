from fastapi import APIRouter

from apps.backend.app.services.app_status_service import AppStatusService

router = APIRouter(tags=["config"])


@router.get("/config/status")
def config_status() -> dict:
    return AppStatusService().config_status()
