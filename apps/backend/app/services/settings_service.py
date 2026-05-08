from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

from apps.backend.app.services.bootstrap_status_service import SetupStatusService
from apps.backend.app.services.settings_avatar import AvatarFile, AvatarStorage, AvatarValidationError
from apps.backend.app.services.runtime_config_service import ConfigService

_DYNAMIC_APP_FIELDS = {"avatar_url", "avatar_updated_at"}
_HIDDEN_CONFIG_CATEGORIES: set[str] = set()
_RETIRED_CONFIG_KEYS: set[str] = set()
DEFAULT_APP_NAME = "Select AI Analytics"
DEFAULT_AGENT_NAME = "Nadia Analytics"


class SetupStatusChecker(Protocol):
    def check_setup_status(self) -> bool:
        ...


def _to_scalar(value: Any) -> Any:
    if isinstance(value, str):
        lower = value.strip().lower()
        if lower in {"true", "false"}:
            return lower == "true"
        if lower.isdigit():
            try:
                return int(lower)
            except Exception:
                return value
    return value


def _default_payload() -> dict[str, Any]:
    return {
        "app": {
            "name": DEFAULT_APP_NAME,
            "agent_name": DEFAULT_AGENT_NAME,
            "session_timeout_minutes": 480,
            "timezone": "America/Lima",
            "language": "en",
            "avatar_url": "",
            "avatar_updated_at": 0,
        },
        "select_ai": {
            "profile_name": "APP_AGENT_ANALYTICS",
            "credential_name": "APP_AGENT_OCI_CRED",
        },
        "genai": {
            "model": "google.gemini-2.5-flash",
        },
    }


def _entry_from_setting(category: str, field: str, value: Any) -> dict[str, Any]:
    key = f"{category}.{field}"
    return {
        "key": key,
        "value": value,
        "category": category,
        "description": f"Actualizado desde settings UI: {key}",
    }


class SettingsService:
    def __init__(
        self,
        *,
        config_service: ConfigService,
        setup_service: SetupStatusChecker,
        data_dir: Path,
    ) -> None:
        self.config_service = config_service
        self.setup_service = setup_service
        self.data_dir = data_dir
        self.avatar_storage = AvatarStorage(data_dir)

    @classmethod
    def from_runtime(cls) -> "SettingsService":
        from apps.backend.app.core.config import get_settings
        from apps.backend.app.core.database import DatabaseManager

        settings = get_settings()
        db_manager = DatabaseManager.get_instance(settings)
        return cls(
            config_service=ConfigService(db_manager),
            setup_service=SetupStatusService(db_manager),
            data_dir=settings.data_dir,
        )

    def get_payload(self) -> dict[str, Any]:
        if not self.config_service.table_exists():
            return _default_payload()
        return self._build_payload()

    def get_public_payload(self) -> dict[str, Any]:
        payload = self.get_payload()
        app_payload = dict(payload.get("app") or {})
        return {
            "app": {
                "name": str(app_payload.get("name") or DEFAULT_APP_NAME).strip() or DEFAULT_APP_NAME,
                "agent_name": str(app_payload.get("agent_name") or DEFAULT_AGENT_NAME).strip() or DEFAULT_AGENT_NAME,
                "avatar_url": str(app_payload.get("avatar_url") or "").strip(),
                "avatar_updated_at": int(app_payload.get("avatar_updated_at") or 0),
            }
        }

    def update(self, updates: dict[str, Any]) -> dict[str, Any]:
        entries = []
        for category, values in updates.items():
            category_key = str(category)
            if category_key in _HIDDEN_CONFIG_CATEGORIES:
                continue
            if isinstance(values, dict):
                for field, value in values.items():
                    field_key = str(field)
                    key = f"{category_key}.{field_key}"
                    if category_key == "app" and field_key in _DYNAMIC_APP_FIELDS:
                        continue
                    if key in _RETIRED_CONFIG_KEYS:
                        continue
                    entries.append(_entry_from_setting(category_key, field_key, value))
            else:
                key = category_key
                if key in _RETIRED_CONFIG_KEYS:
                    continue
                entries.append(
                    {
                        "key": key,
                        "value": values,
                        "category": key.split(".", 1)[0] if "." in key else "general",
                        "description": f"Actualizado desde settings UI: {key}",
                    }
                )
        if entries:
            self.config_service.upsert_many(entries)
        self.config_service.delete_keys(sorted(_RETIRED_CONFIG_KEYS))
        return {"success": True, "settings": self._build_payload()}

    def is_setup_complete(self) -> bool:
        return bool(self.setup_service.check_setup_status())

    def reset(self) -> dict[str, Any]:
        entries = []
        for category, values in _default_payload().items():
            if not isinstance(values, dict):
                continue
            for field, value in values.items():
                key = f"{category}.{field}"
                entries.append(
                    {
                        "key": key,
                        "value": value,
                        "category": category,
                        "description": f"Valor por defecto: {key}",
                    }
                )
        self.config_service.upsert_many(entries)
        self.config_service.delete_keys(sorted(_RETIRED_CONFIG_KEYS))
        return {"success": True, "settings": self._build_payload()}

    def get_avatar_file(self) -> AvatarFile | None:
        return self.avatar_storage.get_file()

    def upload_avatar(self, *, content_type: str, content: bytes) -> dict[str, Any]:
        return self.avatar_storage.upload(content_type=content_type, content=content)

    def delete_avatar(self) -> dict[str, Any]:
        return self.avatar_storage.delete()

    def _build_payload(self) -> dict[str, Any]:
        payload = _default_payload()
        groups = self.config_service.list_grouped()
        for items in groups.values():
            for item in items:
                key = str(item.get("key") or "")
                value = _to_scalar(item.get("value"))
                if key in _RETIRED_CONFIG_KEYS:
                    continue
                if "." not in key:
                    continue
                category, field = key.split(".", 1)
                if not category or not field:
                    continue
                if category in _HIDDEN_CONFIG_CATEGORIES:
                    continue
                if category == "app" and field in _DYNAMIC_APP_FIELDS:
                    continue
                payload.setdefault(category, {})
                payload[category][field] = value
        avatar_path = self.avatar_storage.resolve_file()
        payload.setdefault("app", {})
        payload["app"]["avatar_url"] = self.avatar_storage.url(avatar_path)
        payload["app"]["avatar_updated_at"] = int(avatar_path.stat().st_mtime) if avatar_path else 0
        return payload
