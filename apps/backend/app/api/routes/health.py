from fastapi import APIRouter

from apps.backend.app.services.app_status_service import AppStatusService

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return AppStatusService().health()
