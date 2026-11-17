from pathlib import Path

from apps.backend.app.services.bootstrap_script_service import (
    no_setup_scripts_result,
    schema_guard_result,
)


def test_no_setup_scripts_result_includes_discovered_files_and_directory() -> None:
    result = no_setup_scripts_result(Path("db/bootstrap/sql"), ["01.sql"])

    assert result == {
        "success": False,
        "discovered": ["01.sql"],
        "executed": [],
        "errors": [{"file": "db\\bootstrap\\sql", "error": "No SQL setup scripts found."}],
        "message": "No setup scripts found in db\\bootstrap\\sql",
    }


def test_schema_guard_result_reports_connected_user() -> None:
    result = schema_guard_result(["01.sql", "02.sql"], "HR")

    assert result["success"] is False
    assert result["discovered"] == ["01.sql", "02.sql"]
    assert result["executed"] == []
    assert result["errors"] == [
        {
            "file": "schema_guard",
            "error": "Expected APP_AGENT database user or numbered deployment schema, connected as HR.",
        }
    ]
    assert result["message"] == "Installation stopped because the connected schema is not APP_AGENT or a numbered deployment schema."
