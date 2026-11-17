from __future__ import annotations

import logging
import time

from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.core.tracing import trace
from apps.backend.app.services.bootstrap_support import (
    open_runtime_database_connection,
    summarize_oracle_connect_error,
)

logger = logging.getLogger(__name__)


class BootstrapStatusMixin:
    _STATUS_CACHE_TTL_SECONDS = 30.0
    _status_cache: tuple[int, bool, float] | None = None

    @classmethod
    def clear_status_cache(cls) -> None:
        BootstrapStatusMixin._status_cache = None

    def _cached_completed_status(self) -> bool | None:
        cache = BootstrapStatusMixin._status_cache
        if cache is None:
            return None
        cache_db_id, completed, expires_at = cache
        if cache_db_id == id(self.db_manager) and time.monotonic() < expires_at:
            return completed
        BootstrapStatusMixin._status_cache = None
        return None

    def _remember_completed_status(self, completed: bool) -> None:
        if completed:
            BootstrapStatusMixin._status_cache = (
                id(self.db_manager),
                True,
                time.monotonic() + self._STATUS_CACHE_TTL_SECONDS,
            )
        else:
            BootstrapStatusMixin._status_cache = None

    def _get_direct_connection(
        self,
        *,
        wallet_path: str | None = None,
        wallet_password: str | None = None,
        user: str | None = None,
        password: str | None = None,
        dsn: str | None = None,
    ):
        return open_runtime_database_connection(
            self.db_manager,
            wallet_path=wallet_path,
            wallet_password=wallet_password,
            user=user,
            password=password,
            dsn=dsn,
        )

    def _get_status_connection(self):
        get_connection = getattr(self.db_manager, "get_connection", None)
        if callable(get_connection):
            try:
                return get_connection()
            except Exception as pool_error:
                logger.debug("Pooled setup status connection unavailable: %s", pool_error)
        return self._get_direct_connection()

    @trace
    def check_setup_status(self) -> bool:
        try:
            if self.db_manager is None:
                return False
            cached = self._cached_completed_status()
            if cached is not None:
                return cached

            conn = self._get_status_connection()
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    SELECT config_value FROM config
                    WHERE config_key = 'wizard.completed'
                    """
                )
                row = cursor.fetchone()
                if row and row[0]:
                    value = row[0]
                    if hasattr(value, "read"):
                        value = value.read()
                    logger.debug("check_setup_status: wizard.completed = '%s'", value)
                    completed = str(value).strip().lower() == "true"
                    self._remember_completed_status(completed)
                    return completed
                logger.debug("check_setup_status: wizard.completed not found")
                self._remember_completed_status(False)
                return False
            finally:
                cursor.close()
                conn.close()
        except Exception as e:
            self._remember_completed_status(False)
            error_str = str(e)
            if "Database runtime connection is not configured" in error_str:
                logger.info("Setup status unavailable because database runtime config is incomplete.")
            elif "ORA-00942" in error_str or "does not exist" in error_str:
                logger.info("Config table not found - setup not completed yet")
            elif oracle_error := summarize_oracle_connect_error(e):
                logger.error("check_setup_status connectivity error: %s", oracle_error)
            else:
                logger.exception("check_setup_status error: %s", e)
            return False


class SetupStatusService(BootstrapStatusMixin):
    """Lightweight setup-status reader used by runtime guards."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
