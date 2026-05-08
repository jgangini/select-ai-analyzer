from pathlib import Path

from apps.backend.app.services.app_status_service import AppStatusService


class FakeSettings:
    app_name = "Test Select AI"
    database_backend = "oracle"
    oci_genai_model = "default-model"

    def __init__(self, *, wallet_dir: Path, oci_config_file: Path) -> None:
        self.wallet_dir = wallet_dir
        self.oci_config_file = oci_config_file


class FakeConfigService:
    def get_genai_model(self, *, default: str) -> str:
        return f"{default}-runtime"

    def get_oci_compartment_id(self) -> str:
        return "ocid1.compartment.oc1..test"

    def get_value(self, key: str, default: str) -> str:
        values = {
            "select_ai.profile_name": "TEST_PROFILE",
            "select_ai.credential_name": "TEST_CREDENTIAL",
        }
        return values.get(key, default)


def test_health_status_uses_runtime_model_default(tmp_path) -> None:
    service = AppStatusService(
        db_manager=object(),
        settings=FakeSettings(wallet_dir=tmp_path / "wallet", oci_config_file=tmp_path / "config"),
        config_service=FakeConfigService(),
    )

    assert service.health() == {
        "status": "ok",
        "app": "Test Select AI",
        "model": "default-model-runtime",
        "database_backend": "oracle",
        "install_state": {},
    }


def test_config_status_reports_select_ai_and_storage_state(tmp_path, monkeypatch) -> None:
    wallet_dir = tmp_path / "wallet"
    oci_config_file = tmp_path / "config"
    wallet_dir.mkdir()
    oci_config_file.write_text("[DEFAULT]\nregion=us-ashburn-1\n", encoding="utf-8")
    monkeypatch.setattr(
        "apps.backend.app.services.app_status_service.get_oci_namespace",
        lambda _db_manager: "namespace",
    )
    monkeypatch.setattr(
        "apps.backend.app.services.app_status_service.get_oci_bucket_name",
        lambda _db_manager: "bucket",
    )
    service = AppStatusService(
        db_manager=object(),
        settings=FakeSettings(wallet_dir=wallet_dir, oci_config_file=oci_config_file),
        config_service=FakeConfigService(),
    )

    status = service.config_status()

    assert status["wallet_present"] is True
    assert status["oci_config_present"] is True
    assert status["oci_genai_configured"] is True
    assert status["object_storage_live_enabled"] is True
    assert status["select_ai"] == {
        "schema": "APP_AGENT",
        "profile": "TEST_PROFILE",
        "credential": "TEST_CREDENTIAL",
        "model": "default-model-runtime",
    }
