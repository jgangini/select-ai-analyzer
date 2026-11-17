from __future__ import annotations

import hashlib
import re
import secrets
import string
from typing import Any


def _safe_identifier(value: str, *, max_len: int = 128) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned:
        raise ValueError("Identifier is required.")
    if not cleaned[0].isalpha():
        cleaned = f"T_{cleaned}"
    return cleaned[:max_len]


def _qualified_name(owner: str, table_name: str) -> str:
    return f"{_safe_identifier(owner)}.{_safe_identifier(table_name)}"


def _safe_constraint_name(value: str) -> str:
    digest = hashlib.sha1(str(value or "").encode("utf-8")).hexdigest()[:8].upper()
    base = _safe_identifier(value, max_len=21)
    return f"{base}_{digest}"[:30]


def _sql_string_literal(value: str) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def _clean_optional_text(value: Any, *, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _safe_password_literal(value: str) -> str:
    return '"' + str(value).replace('"', '""') + '"'


def _generated_schema_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Ag" + "".join(secrets.choice(alphabet) for _ in range(28))
