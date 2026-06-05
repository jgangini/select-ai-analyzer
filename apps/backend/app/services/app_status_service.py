from __future__ import annotations

from typing import TYPE_CHECKING

from apps.backend.app.core.config import Settings, get_settings
from apps.backend.app.core.oci_db_config import get_oci_bucket_name, get_oci_namespace
from apps.backend.app.core.session import get_db_manager
from apps.backend.app.select_ai.constants import APP_SCHEMA
from apps.backend.app.services.runtime_config_service import ConfigService

if TYPE_CHECKING:
    from apps.backend.app.core.database import DatabaseManager


class AppStatusService:
    def __init__(
        self,
        db_manager: DatabaseManager | None = None,
        settings: Settings | None = None,
        config_service: ConfigService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.db_manager = db_manager or get_db_manager()
        self.config_service = config_service or ConfigService(self.db_manager)

    def health(self) -> dict:
        return {
            "status": "ok",
            "app": self.settings.app_name,
            "model": self.config_service.get_genai_model(default=self.settings.oci_genai_model),
            "database_backend": self.settings.database_backend,
            "install_state": {},
        }

    def config_status(self) -> dict:
        compartment_id = self.config_service.get_oci_compartment_id()
        namespace = str(get_oci_namespace(self.db_manager) or "").strip()
        bucket_name = str(get_oci_bucket_name(self.db_manager) or "").strip()
        generative_model = self.config_service.get_genai_model(default=self.settings.oci_genai_model)
        resolve_connection_config = getattr(self.db_manager, "resolve_connection_config", None)
        runtime_schema = APP_SCHEMA
        if callable(resolve_connection_config):
            runtime_schema = resolve_connection_config().get("user") or APP_SCHEMA
        return {
            "database_backend": self.settings.database_backend,
            "wallet_present": self.settings.wallet_dir.exists(),
            "oci_config_present": self.settings.oci_config_file.exists(),
            "oci_genai_configured": bool(compartment_id and generative_model),
            "oci_genai_model": generative_model,
            "object_storage_live_enabled": bool(self.settings.oci_config_file.exists() and namespace and bucket_name),
            "select_ai": {
                "schema": runtime_schema,
                "profile": self.config_service.get_value("select_ai.profile_name", "APP_AGENT_ANALYTICS"),
                "credential": self.config_service.get_value("select_ai.credential_name", "APP_AGENT_OCI_CRED"),
                "model": generative_model,
            },
            "install_state": {},
        }
