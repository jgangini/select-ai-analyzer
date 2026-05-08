from __future__ import annotations

from fastapi import HTTPException

from apps.backend.app.core.session import get_db_manager
from apps.backend.app.services.bootstrap_status_service import SetupStatusService


def require_setup_completed() -> None:
    """Bloquea operaciones de runtime hasta completar el wizard."""
    status_service = SetupStatusService(get_db_manager())
    if not status_service.check_setup_status():
        raise HTTPException(
            status_code=503,
            detail="Setup wizard not completed. Complete installation before running tests.",
        )
