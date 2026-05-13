from __future__ import annotations

import json

import pytest

from apps.backend.app.select_ai.base_service import SelectAIBaseService
from apps.backend.app.select_ai.scoped_profile_operations import SelectAIScopedProfileMixin


class FakeLob:
    def __init__(self, value: str) -> None:
        self.value = value

    def read(self) -> str:
        return self.value


class ScopedProfileCursor:
    def __init__(self, config_rows: list[tuple[str, object]]) -> None:
        self.config_rows = config_rows
        self.executed: list[tuple[str, dict]] = []
        self.calls: list[tuple[str, list]] = []
        self.closed = False

    def execute(self, statement: str, **params) -> None:
        self.executed.append((statement, params))

    def fetchall(self) -> list[tuple[str, object]]:
        return self.config_rows

    def callproc(self, name: str, args: list) -> None:
        self.calls.append((name, args))

    def close(self) -> None:
        self.closed = True


class ScopedProfileConnection:
    def __init__(self, cursor: ScopedProfileCursor) -> None:
        self.cursor_instance = cursor
        self.committed = False
        self.closed = False

    def cursor(self) -> ScopedProfileCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def close(self) -> None:
        self.closed = True


class ScopedProfileService(SelectAIScopedProfileMixin, SelectAIBaseService):
    def __init__(self, connection: ScopedProfileConnection) -> None:
        self.connection = connection

    def _connection(self) -> ScopedProfileConnection:
        return self.connection

    def _profile_name(self) -> str:
        return "APP_AGENT_ANALYTICS"

    def _registered_source_objects(self) -> list[dict[str, object]]:
        return [
            {
                "owner": "APP_AGENT_DATA",
                "name": "ACCOUNTS",
                "columns": ["ACCOUNT_ID", "BALANCE"],
            }
        ]


def _created_profile_attributes(cursor: ScopedProfileCursor) -> dict:
    create_calls = [
        args
        for name, args in cursor.calls
        if name == "DBMS_CLOUD_AI.CREATE_PROFILE"
    ]
    assert len(create_calls) == 1
    return json.loads(create_calls[0][1])


def test_create_scoped_profile_uses_configured_genai_model() -> None:
    cursor = ScopedProfileCursor(
        [
            ("genai.model", FakeLob("  meta.llama-4-maverick  ")),
            ("select_ai.credential_name", "APP_AGENT_OCI_CRED"),
            ("oci.region", "us-chicago-1"),
            ("oci.compartment_id", "ocid1.compartment"),
        ]
    )
    connection = ScopedProfileConnection(cursor)
    service = ScopedProfileService(connection)

    profile_name, objects = service.create_scoped_profile("show accounts")

    attributes = _created_profile_attributes(cursor)
    assert profile_name.startswith("APP_AGENT_ANALYTICS_Q_")
    assert objects == [{"owner": "APP_AGENT_DATA", "name": "ACCOUNTS"}]
    assert set(attributes) == {
        "provider",
        "credential_name",
        "model",
        "temperature",
        "comments",
        "annotations",
        "constraints",
        "conversation",
        "object_list",
        "enforce_object_list",
        "region",
        "oci_compartment_id",
        "max_tokens",
    }
    assert attributes["model"] == "meta.llama-4-maverick"
    assert attributes["credential_name"] == "APP_AGENT_OCI_CRED"
    assert connection.committed is True
    assert cursor.closed is True
    assert connection.closed is True


def test_create_scoped_profile_rejects_missing_genai_model() -> None:
    cursor = ScopedProfileCursor(
        [
            ("select_ai.credential_name", "APP_AGENT_OCI_CRED"),
            ("oci.region", "us-chicago-1"),
            ("oci.compartment_id", "ocid1.compartment"),
        ]
    )
    connection = ScopedProfileConnection(cursor)
    service = ScopedProfileService(connection)

    with pytest.raises(ValueError, match="Generative AI model is not configured"):
        service.create_scoped_profile("show accounts")

    assert cursor.calls == []
    assert connection.committed is False
    assert cursor.closed is True
    assert connection.closed is True
