from __future__ import annotations

import logging

from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.core.tracing import trace
from apps.backend.app.services.bootstrap_support import (
    open_runtime_database_connection,
    summarize_oracle_connect_error,
)

logger = logging.getLogger(__name__)


class BootstrapStatusMixin:
    @trace
    def check_setup_status(self) -> bool:
        try:
            if self.db_manager is None:
                return False
            conn = self._get_direct_connection()
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
                    return value == "true"
                logger.debug("check_setup_status: wizard.completed not found")
                return False
            finally:
                cursor.close()
                conn.close()
        except Exception as e:
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
