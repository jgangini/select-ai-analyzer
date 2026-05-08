from pathlib import Path
from urllib.error import HTTPError, URLError

from apps.backend.app.services.bootstrap_oci_service import BootstrapOciMixin


class Settings:
    def __init__(self, config_file: Path) -> None:
        self.oci_config_file = config_file


class DbManager:
    def __init__(self, config_file: Path) -> None:
        self.settings = Settings(config_file)


class FakeCursor:
    def __init__(self, rows: list[tuple[str, object]] | None = None) -> None:
        self.rows = rows or []
        self.executions: list[tuple[str, dict[str, object]]] = []
        self.closed = False

    def execute(self, statement: str, **params: object) -> None:
        self.executions.append((statement, params))

    def fetchall(self) -> list[tuple[str, object]]:
        return self.rows

    def close(self) -> None:
        self.closed = True


class FakeConnection:
    def __init__(self, rows: list[tuple[str, object]] | None = None) -> None:
        self.cursor_instance = FakeCursor(rows)
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1

    def close(self) -> None:
        self.closed = True


class FakeBootstrapOciService(BootstrapOciMixin):
    def __init__(self, db_manager: DbManager, connections: list[FakeConnection]) -> None:
        self.db_manager = db_manager
        self.connections = connections
        self.synced_credentials: list[tuple[dict[str, str], str]] = []

    def _get_direct_connection(self) -> FakeConnection:
        return self.connections.pop(0)

    def _sync_select_ai_credential(self, *, config_values: dict[str, str], compartment_id: str) -> None:
        self.synced_credentials.append((config_values, compartment_id))


def test_save_oci_config_persists_config_and_writes_runtime_config(tmp_path: Path) -> None:
    config_file = tmp_path / "keys" / "config"
    key_file = tmp_path / "api.pem"
    key_file.write_text("PRIVATE KEY", encoding="utf-8")
    connection = FakeConnection()
    service = FakeBootstrapOciService(DbManager(config_file), [connection])

    assert service.save_oci_config(
        {
            "compartment_id": "ocid1.compartment",
            "user": "ocid1.user",
            "fingerprint": "aa:bb",
            "tenancy": "ocid1.tenancy",
            "region": "us-ashburn-1",
            "key_file": str(key_file),
            "namespace": "demo_namespace",
            "bucket_name": "demo_bucket",
        }
    )

    saved_keys = {params["key"] for _, params in connection.cursor_instance.executions}
    assert {
        "oci.compartment_id",
        "oci.user",
        "oci.fingerprint",
        "oci.tenancy",
        "oci.region",
        "oci.key_file",
        "oci.namespace",
        "oci.bucket_name",
        "select_ai.profile_name",
        "select_ai.credential_name",
    } == saved_keys
    assert connection.commits == 1
    assert config_file.read_text(encoding="utf-8").startswith("[DEFAULT]\nuser=ocid1.user\n")
    assert service.synced_credentials == [
        (
            {
                "user": "ocid1.user",
                "fingerprint": "aa:bb",
                "tenancy": "ocid1.tenancy",
                "region": "us-ashburn-1",
                "key_file": str(key_file),
            },
            "ocid1.compartment",
        )
    ]


def test_save_generative_ai_config_upserts_only_genai_keys(tmp_path: Path) -> None:
    connection = FakeConnection()
    service = FakeBootstrapOciService(DbManager(tmp_path / "config"), [connection])

    assert service.save_generative_ai_config(
        {
            "inference_url": "https://inference.generativeai.us-ashburn-1.oci.oraclecloud.com",
            "generative_model": "cohere.command-r-plus",
        }
    )

    assert [params["key"] for _, params in connection.cursor_instance.executions] == [
        "genai.inference_url",
        "genai.model",
    ]
    assert connection.commits == 1


def test_complete_setup_marks_wizard_done_and_regenerates_runtime_config(tmp_path: Path) -> None:
    config_file = tmp_path / "keys" / "config"
    key_file = tmp_path / "api.pem"
    key_file.write_text("PRIVATE KEY", encoding="utf-8")
    update_connection = FakeConnection()
    config_connection = FakeConnection(
        [
            ("oci.user", "ocid1.user"),
            ("oci.fingerprint", "aa:bb"),
            ("oci.tenancy", "ocid1.tenancy"),
            ("oci.region", "us-ashburn-1"),
            ("oci.key_file", str(key_file)),
            ("oci.compartment_id", "ocid1.compartment"),
        ]
    )
    service = FakeBootstrapOciService(DbManager(config_file), [update_connection, config_connection])

    assert service.complete_setup()

    assert "wizard.completed" in update_connection.cursor_instance.executions[0][0]
    assert update_connection.commits == 1
    assert config_file.exists()
    assert "key_file=" + str(key_file) in config_file.read_text(encoding="utf-8")


def test_object_storage_validation_reports_missing_saved_api_key_values(tmp_path: Path) -> None:
    service = FakeBootstrapOciService(DbManager(tmp_path / "config"), [])
    service._load_saved_oci_config_values = lambda: {"user": "ocid1.user"}  # type: ignore[method-assign]

    result = service.test_object_storage("namespace", "bucket")

    assert result["success"] is False
    assert result["message"] == (
        "Please save API Key configuration first. "
        "Missing: fingerprint, tenancy, region, key_file, compartment_id"
    )


def test_generative_ai_validation_requires_endpoint_before_network(tmp_path: Path) -> None:
    service = FakeBootstrapOciService(DbManager(tmp_path / "config"), [])

    result = service.test_generative_ai("   ", "cohere.command")

    assert result == {"success": False, "message": "Inference URL is required"}


def test_generative_ai_validation_normalizes_url_and_allows_http_status_errors(
    tmp_path: Path,
    monkeypatch,
) -> None:
    requested: dict[str, object] = {}
    service = FakeBootstrapOciService(DbManager(tmp_path / "config"), [])

    def fake_urlopen(url: str, timeout: int):
        requested["url"] = url
        requested["timeout"] = timeout
        raise HTTPError(url, 404, "Not Found", hdrs=None, fp=None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = service.test_generative_ai("inference.example.com/20231130/actions/chat", "cohere.command")

    assert result["success"] is True
    assert requested == {"url": "https://inference.example.com/", "timeout": 10}


def test_generative_ai_validation_reports_unreachable_endpoint(tmp_path: Path, monkeypatch) -> None:
    service = FakeBootstrapOciService(DbManager(tmp_path / "config"), [])

    def fake_urlopen(url: str, timeout: int):
        raise URLError("offline")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = service.test_generative_ai("https://inference.example.com", "cohere.command")

    assert result["success"] is False
    assert result["message"] == "Inference endpoint unreachable: <urlopen error offline>"
