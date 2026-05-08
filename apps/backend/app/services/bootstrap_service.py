from typing import Any

from apps.backend.app.services.bootstrap_admin_service import BootstrapAdminMixin
from apps.backend.app.services.bootstrap_database_service import BootstrapDatabaseMixin
from apps.backend.app.services.bootstrap_oci_service import BootstrapOciMixin
from apps.backend.app.services.bootstrap_script_service import BootstrapScriptMixin
from apps.backend.app.services.bootstrap_status_service import BootstrapStatusMixin
from apps.backend.app.services.bootstrap_support import (
    open_runtime_database_connection,
)


class SetupService(
    BootstrapStatusMixin,
    BootstrapDatabaseMixin,
    BootstrapScriptMixin,
    BootstrapAdminMixin,
    BootstrapOciMixin,
):
    """Initial setup service (database, OCI, admin user)."""

    def __init__(self, db_manager: Any):
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
