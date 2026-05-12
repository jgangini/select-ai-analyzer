from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol

from apps.backend.app.services.bootstrap_status_service import SetupStatusService
from apps.backend.app.services.settings_avatar import AvatarFile, AvatarStorage, AvatarValidationError
from apps.backend.app.services.runtime_config_service import ConfigService

_DYNAMIC_APP_FIELDS = {"avatar_url", "avatar_updated_at"}
_HIDDEN_CONFIG_CATEGORIES: set[str] = set()
_RETIRED_CONFIG_KEYS: set[str] = set()
SUGGESTED_QUESTIONS_CONFIG_KEY = "suggested_questions.items"
RETIRED_SUGGESTED_QUESTION_PREFIX = "suggested_questions.question_"
DEFAULT_APP_NAME = "Select AI Analytics"
DEFAULT_AGENT_NAME = "Nadia Analytics"
STARTER_SUGGESTED_QUESTIONS = (
    "¿Cuál es el saldo actual por moneda y sucursal?",
    "¿Qué cuentas tienen mayor saldo bloqueado?",
    "¿Qué productos tienen mayor volumen de transacciones este mes?",
    "¿Cuál es la tendencia diaria de débitos vs créditos en marzo?",
    "¿Qué clientes tienen mayor volumen de transacciones este mes?",
    "¿Qué cuentas tienen más retiros ATM?",
    "¿Qué préstamos tienen mayor deuda pendiente?",
    "¿Qué contratos de depósito vencen en los próximos 30 días?",
    "¿Qué cuentas tienen transacciones ocultas en estados de cuenta?",
    "¿Qué usuarios autorizaron más movimientos contables?",
)


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
        "suggested_questions": _starter_suggested_questions_payload(),
    }


def _compact_suggested_questions(values: list[Any] | tuple[Any, ...]) -> list[str]:
    seen: set[str] = set()
    questions: list[str] = []
    for value in values:
        question = str(value or "").strip()
        normalized = " ".join(question.lower().split()).strip(" ?¿!¡.")
        if not question or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        questions.append(question)
    return questions


def _starter_suggested_questions_payload() -> dict[str, list[str]]:
    return {"items": list(STARTER_SUGGESTED_QUESTIONS)}


def _coerce_suggested_questions(value: Any, *, minimum: int) -> list[str]:
    if isinstance(value, dict):
        if isinstance(value.get("items"), list):
            questions = _compact_suggested_questions(value.get("items") or [])
        else:
            raise ValueError("Starter questions must be submitted as an items list.")
    elif isinstance(value, list):
        questions = _compact_suggested_questions(value)
    else:
        raise ValueError("Starter questions must be submitted as an items list.")
    if len(questions) < minimum:
        raise ValueError(f"At least {minimum} starter questions are required.")
    return questions


def _stored_suggested_questions(value: Any) -> list[str]:
    try:
        parsed = json.loads(str(value or ""))
    except json.JSONDecodeError as exc:
        raise ValueError("Stored starter questions are not valid JSON.") from exc
    return _coerce_suggested_questions({"items": parsed}, minimum=1)


def _suggested_questions_from_config_groups(groups: dict[str, list[dict[str, Any]]]) -> list[str]:
    entries = groups.get("suggested_questions") or []
    for entry in entries:
        key = str(entry.get("key") or "")
        if key == SUGGESTED_QUESTIONS_CONFIG_KEY:
            return _stored_suggested_questions(entry.get("value"))
    return list(STARTER_SUGGESTED_QUESTIONS)


def _suggested_question_entries(values: Any) -> list[dict[str, Any]]:
    questions = _coerce_suggested_questions(values, minimum=3)
    return [
        {
            "key": SUGGESTED_QUESTIONS_CONFIG_KEY,
            "value": json.dumps(questions, ensure_ascii=False),
            "category": "suggested_questions",
            "type": "json",
            "description": "Global starter question library",
        }
    ]


def _retired_suggested_question_keys_from_config(groups: dict[str, list[dict[str, Any]]]) -> list[str]:
    return sorted(
        str(entry.get("key") or "")
        for entry in groups.get("suggested_questions", [])
        if str(entry.get("key") or "").startswith(RETIRED_SUGGESTED_QUESTION_PREFIX)
    )


def _entry_from_setting(category: str, field: str, value: Any) -> dict[str, Any]:
    key = f"{category}.{field}"
    return {
        "key": key,
        "value": value,
        "category": category,
        "description": f"Updated from settings UI: {key}",
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
            },
            "suggested_questions": payload.get("suggested_questions") or _starter_suggested_questions_payload(),
        }

    def update(self, updates: dict[str, Any]) -> dict[str, Any]:
        entries = []
        deleted_keys = set(_RETIRED_CONFIG_KEYS)
        current_groups = self.config_service.list_grouped()
        deleted_keys.update(_retired_suggested_question_keys_from_config(current_groups))
        for category, values in updates.items():
            category_key = str(category)
            if category_key in _HIDDEN_CONFIG_CATEGORIES:
                continue
            if category_key == "suggested_questions":
                entries.extend(_suggested_question_entries(values))
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
                        "description": f"Updated from settings UI: {key}",
                    }
                )
        if entries:
            self.config_service.upsert_many(entries)
        self.config_service.delete_keys(sorted(deleted_keys))
        return {"success": True, "settings": self._build_payload()}

    def is_setup_complete(self) -> bool:
        return bool(self.setup_service.check_setup_status())

    def reset(self) -> dict[str, Any]:
        entries = []
        for category, values in _default_payload().items():
            if not isinstance(values, dict):
                continue
            if category == "suggested_questions":
                entries.extend(_suggested_question_entries(values))
                continue
            for field, value in values.items():
                key = f"{category}.{field}"
                entries.append(
                    {
                        "key": key,
                        "value": value,
                        "category": category,
                        "description": f"Seed value: {key}",
                    }
                )
        self.config_service.upsert_many(entries)
        current_groups = self.config_service.list_grouped()
        retired_keys = set(_RETIRED_CONFIG_KEYS)
        retired_keys.update(_retired_suggested_question_keys_from_config(current_groups))
        self.config_service.delete_keys(sorted(retired_keys))
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
                if category == "suggested_questions":
                    continue
                if category in _HIDDEN_CONFIG_CATEGORIES:
                    continue
                if category == "app" and field in _DYNAMIC_APP_FIELDS:
                    continue
                payload.setdefault(category, {})
                payload[category][field] = value
        payload["suggested_questions"] = {"items": _suggested_questions_from_config_groups(groups)}
        avatar_path = self.avatar_storage.resolve_file()
        payload.setdefault("app", {})
        payload["app"]["avatar_url"] = self.avatar_storage.url(avatar_path)
        payload["app"]["avatar_updated_at"] = int(avatar_path.stat().st_mtime) if avatar_path else 0
        return payload
