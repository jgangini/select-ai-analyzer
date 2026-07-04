from __future__ import annotations

import re


APP_SCHEMA = "APP_AGENT"
APP_SCHEMA_PATTERN = re.compile(r"^APP_AGENT(?:_\d+)?$")
DEFAULT_DATA_SCHEMA = "APP_AGENT_DATA"
DEFAULT_PROFILE = "APP_AGENT_ANALYTICS"
SCOPED_PROFILE_LIMIT = 6


def is_app_schema_name(value: str | None) -> bool:
    return bool(APP_SCHEMA_PATTERN.fullmatch(str(value or "").upper()))
