from fastapi import APIRouter

from apps.backend.app.services.app_status_service import AppStatusService

router = APIRouter(tags=["status"])


@router.get("/health")
def health() -> dict:
    return AppStatusService().health()


@router.get("/config/status")
def config_status() -> dict:
    return AppStatusService().config_status()
