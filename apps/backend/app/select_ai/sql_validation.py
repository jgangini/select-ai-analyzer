from __future__ import annotations

import re


_FORBIDDEN = re.compile(
    r"\b(ALTER|ANALYZE|BEGIN|CALL|COMMENT|CREATE|DELETE|DROP|EXEC|EXECUTE|GRANT|INSERT|MERGE|"
    r"REVOKE|TRUNCATE|UPDATE|UPSERT|DBMS_|UTL_|COMMIT|ROLLBACK|SAVEPOINT)\b",
    flags=re.IGNORECASE,
)


def strip_sql_comments(sql: str) -> str:
    without_block = re.sub(r"/\*.*?\*/", " ", sql or "", flags=re.DOTALL)
    return re.sub(r"--[^\r\n]*", " ", without_block)


def extract_sql_statement(sql: str) -> str:
    text = str(sql or "").strip()
    if not text:
        return ""
    if re.search(r"\b(exception encountered|could not be generated|unable to generate|unfortunately)\b", text, re.IGNORECASE):
        return text
    fenced = re.fullmatch(r"```(?:sql)?\s*(.*?)\s*```", text, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        return fenced.group(1).strip()
    return text


def validate_read_only_select(sql: str) -> str:
    cleaned = strip_sql_comments(extract_sql_statement(sql)).strip()
    if not cleaned:
        raise ValueError("Select AI did not return SQL.")
    while cleaned.endswith(";"):
        cleaned = cleaned[:-1].strip()
    if ";" in cleaned:
        raise ValueError("Only one SQL statement is allowed.")
    if not re.match(r"^(SELECT|WITH)\b", cleaned, flags=re.IGNORECASE):
        raise ValueError("Only SELECT statements are allowed.")
    forbidden = _FORBIDDEN.search(cleaned)
    if forbidden:
        raise ValueError(f"SQL contains forbidden token: {forbidden.group(1).upper()}")
    return cleaned
