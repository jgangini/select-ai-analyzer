from apps.backend.app.select_ai.agent_builder import build_attributes, build_dbms_block


def test_build_tool_attributes_for_select_ai_profile() -> None:
    attrs = build_attributes(
        "TOOL",
        {"tool_type": "SQL", "profile_name": "APP_AGENT_ANALYTICS", "description": "SQL analytics"},
    )

    assert attrs["tool_type"] == "SQL"
    assert attrs["tool_params"] == {"profile_name": "APP_AGENT_ANALYTICS"}


def test_build_team_script_uses_dbms_cloud_ai_agent() -> None:
    attrs = build_attributes(
        "TEAM",
        {"agents": [{"name": "APP_AGENT_ANALYTICS_AGENT", "task": "APP_AGENT_ANALYTICS_TASK"}]},
    )
    script = build_dbms_block("TEAM", "APP_AGENT_ANALYTICS_TEAM", attrs)

    assert "DBMS_CLOUD_AI_AGENT.CREATE_TEAM" in script
    assert "APP_AGENT_ANALYTICS_TEAM" in script
    assert '"process": "sequential"' in script

