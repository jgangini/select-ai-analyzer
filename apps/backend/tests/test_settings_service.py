from __future__ import annotations

import json

import pytest

from apps.backend.app.services.settings_service import AvatarValidationError, SettingsService


class FakeConfigService:
    def __init__(self, *, exists: bool = True, groups: dict | None = None) -> None:
        self.exists = exists
        self.groups = groups or {}
        self.upserts: list[list[dict]] = []
        self.deleted_keys: list[list[str]] = []

    def table_exists(self) -> bool:
        return self.exists

    def list_grouped(self) -> dict:
        return self.groups

    def upsert_many(self, entries: list[dict]) -> None:
        self.upserts.append(entries)
        self.exists = True

    def delete_keys(self, keys: list[str]) -> None:
        self.deleted_keys.append(keys)


class FakeSetupService:
    def __init__(self, completed: bool = True) -> None:
        self.completed = completed

    def check_setup_status(self) -> bool:
        return self.completed


def make_service(tmp_path, *, config: FakeConfigService | None = None, setup: FakeSetupService | None = None) -> SettingsService:
    return SettingsService(
        config_service=config or FakeConfigService(),
        setup_service=setup or FakeSetupService(),
        data_dir=tmp_path,
    )


def test_get_payload_does_not_seed_case_specific_questions_when_config_table_is_missing(tmp_path) -> None:
    service = make_service(tmp_path, config=FakeConfigService(exists=False))

    payload = service.get_payload()

    assert payload["app"]["name"] == "Select AI Analytics"
    assert payload["app"]["agent_name"] == "Nadia Analytics"
    assert payload["app"]["avatar_url"] == ""
    assert payload["select_ai"]["profile_name"] == "APP_AGENT_ANALYTICS"
    assert payload["suggested_questions"]["items"] == []


def test_public_payload_uses_grouped_config_values_and_runtime_avatar(tmp_path) -> None:
    config = FakeConfigService(
        groups={
            "app": [
                {"key": "app.name", "value": "  Operations Portal  "},
                {"key": "app.agent_name", "value": "  Ada  "},
                {"key": "app.session_timeout_minutes", "value": "60"},
                {"key": "app.avatar_url", "value": "stale"},
            ],
            "suggested_questions": [
                {
                    "key": "suggested_questions.items",
                    "value": json.dumps(["  ¿Qué clientes crecieron?  "], ensure_ascii=False),
                },
            ],
            "genai": [{"key": "genai.model", "value": "cohere.command-r-plus"}],
        }
    )
    service = make_service(tmp_path, config=config)
    service.upload_avatar(content_type="image/png", content=b"png")

    public_payload = service.get_public_payload()

    assert public_payload["app"]["name"] == "Operations Portal"
    assert public_payload["app"]["agent_name"] == "Ada"
    assert public_payload["app"]["avatar_url"].startswith("/api/settings/agent-avatar?v=")
    assert public_payload["app"]["avatar_updated_at"] > 0
    assert public_payload["suggested_questions"]["items"][0] == "¿Qué clientes crecieron?"
    assert public_payload["suggested_questions"]["items"] == ["¿Qué clientes crecieron?"]


def test_update_skips_dynamic_avatar_fields_and_writes_config_entries(tmp_path) -> None:
    config = FakeConfigService(
        groups={
            "app": [{"key": "app.name", "value": "Portal"}],
            "suggested_questions": [
                {"key": "suggested_questions.question_1", "value": "Old one"},
                {"key": "suggested_questions.question_2", "value": "Old two"},
            ],
        }
    )
    service = make_service(tmp_path, config=config)

    result = service.update(
        {
            "app": {
                "name": "Portal 2",
                "avatar_url": "client-owned",
                "avatar_updated_at": 123,
            },
            "custom.flag": True,
            "suggested_questions": {
                "items": [
                    "Which customers increased volume?",
                    "Which accounts are inactive?",
                ],
            },
        }
    )

    written_keys = [entry["key"] for entry in config.upserts[0]]
    assert written_keys == [
        "app.name",
        "custom.flag",
        "suggested_questions.items",
    ]
    question_entry = config.upserts[0][-1]
    assert question_entry["type"] == "json"
    assert json.loads(question_entry["value"]) == [
        "Which customers increased volume?",
        "Which accounts are inactive?",
    ]
    assert config.deleted_keys == [["suggested_questions.question_1", "suggested_questions.question_2"]]
    assert result["success"] is True
    assert result["settings"]["app"]["name"] == "Portal"


def test_update_allows_empty_starter_questions(tmp_path) -> None:
    config = FakeConfigService()
    service = make_service(tmp_path, config=config)
    result = service.update({"suggested_questions": {"items": []}})

    assert result["success"] is True
    assert json.loads(config.upserts[0][0]["value"]) == []
    assert result["settings"]["suggested_questions"]["items"] == []


def test_avatar_upload_replaces_existing_file_and_reports_media_type(tmp_path) -> None:
    service = make_service(tmp_path)

    first = service.upload_avatar(content_type="image/png", content=b"png")
    second = service.upload_avatar(content_type="image/jpeg", content=b"jpg")
    avatar_file = service.get_avatar_file()

    assert first["avatar_url"].startswith("/api/settings/agent-avatar?v=")
    assert second["avatar_url"].startswith("/api/settings/agent-avatar?v=")
    assert avatar_file is not None
    assert avatar_file.filename == "avatar.jpg"
    assert avatar_file.media_type == "image/jpeg"
    assert not (tmp_path / "runtime" / "agent" / "avatar.png").exists()


def test_avatar_upload_rejects_invalid_payloads(tmp_path) -> None:
    service = make_service(tmp_path)

    with pytest.raises(AvatarValidationError, match="Unsupported avatar type"):
        service.upload_avatar(content_type="text/plain", content=b"x")
    with pytest.raises(AvatarValidationError, match="Empty image file"):
        service.upload_avatar(content_type="image/png", content=b"")
    with pytest.raises(AvatarValidationError, match="Image too large"):
        service.upload_avatar(content_type="image/png", content=b"x" * (2 * 1024 * 1024 + 1))


def test_status_and_delete_avatar_delegate_to_internal_services(tmp_path) -> None:
    service = make_service(tmp_path, setup=FakeSetupService(completed=False))
    service.upload_avatar(content_type="image/gif", content=b"gif")

    assert service.is_setup_complete() is False
    assert service.delete_avatar() == {"success": True, "removed": True}
    assert service.delete_avatar() == {"success": True, "removed": False}
