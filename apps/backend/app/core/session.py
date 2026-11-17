"""Helpers de sesion/conexion para FastAPI."""

from __future__ import annotations

from apps.backend.app.core.database import DatabaseManager


def get_db_manager() -> DatabaseManager:
    """Retorna singleton de DatabaseManager."""
    from apps.backend.app.core.config import get_settings

    return DatabaseManager.get_instance(get_settings())
