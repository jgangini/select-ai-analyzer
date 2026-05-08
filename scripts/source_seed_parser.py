from __future__ import annotations

from dataclasses import dataclass
import re


_DESC_SPLIT_RE = re.compile(r"(?=^SQL>\s+desc\s+)", flags=re.IGNORECASE | re.MULTILINE)
_DESC_NAME_RE = re.compile(r"^SQL>\s+desc\s+([A-Za-z0-9_.$#]+)", flags=re.IGNORECASE | re.MULTILINE)
_COLUMN_RE = re.compile(
    r"^\s+([A-Za-z][A-Za-z0-9_$#]*)\s+(NOT NULL\s+)?([A-Za-z][A-Za-z0-9_]*(?:\([^\r\n]+?\))?)\s*$",
    flags=re.IGNORECASE | re.MULTILINE,
)


@dataclass(frozen=True, slots=True)
class SourceColumn:
    name: str
    data_type: str
    nullable: bool


@dataclass(frozen=True, slots=True)
class SourceTable:
    owner: str
    name: str
    columns: tuple[SourceColumn, ...]

    @property
    def qualified_name(self) -> str:
        return f"{self.owner}.{self.name}" if self.owner else self.name


def _normalize_identifier(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    if not cleaned or not cleaned[0].isalpha():
        raise ValueError(f"Invalid Oracle identifier: {value!r}")
    return cleaned[:128]


def parse_source_tables(raw_sqlplus_desc: str) -> list[SourceTable]:
    """Parse SQL*Plus DESC output from .source into table metadata.

    Blocks with SQL errors are skipped; duplicate DESC blocks keep the first valid
    definition so repeated source snippets do not duplicate generated DDL/CSV.
    """
    tables: list[SourceTable] = []
    seen: set[str] = set()
    for block in _DESC_SPLIT_RE.split(raw_sqlplus_desc or ""):
        if not block.strip():
            continue
        name_match = _DESC_NAME_RE.search(block)
        if not name_match:
            continue
        qualified = name_match.group(1).strip().upper()
        if "ERROR:" in block.upper():
            continue
        if qualified in seen:
            continue
        seen.add(qualified)
        parts = qualified.split(".", 1)
        owner, table_name = (parts[0], parts[1]) if len(parts) == 2 else ("", parts[0])
        columns: list[SourceColumn] = []
        for column_match in _COLUMN_RE.finditer(block):
            col_name = _normalize_identifier(column_match.group(1))
            data_type = column_match.group(3).strip().upper()
            columns.append(
                SourceColumn(
                    name=col_name,
                    data_type=data_type,
                    nullable=column_match.group(2) is None,
                )
            )
        if columns:
            tables.append(
                SourceTable(
                    owner=_normalize_identifier(owner) if owner else "",
                    name=_normalize_identifier(table_name),
                    columns=tuple(columns),
                )
            )
    return tables


def oracle_type_for_ddl(data_type: str) -> str:
    normalized = str(data_type or "").strip().upper()
    if not normalized:
        return "VARCHAR2(4000)"
    if normalized.startswith(("VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2")):
        return normalized
    if normalized.startswith(("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE")):
        return normalized
    if normalized.startswith(("DATE", "TIMESTAMP")):
        return normalized
    if normalized in {"CLOB", "BLOB"}:
        return normalized
    return "VARCHAR2(4000)"


def build_create_table_sql(table: SourceTable, *, target_owner: str = "APP_AGENT_DATA") -> str:
    owner = _normalize_identifier(target_owner)
    column_lines = []
    for column in table.columns:
        null_clause = "" if column.nullable else " NOT NULL"
        column_lines.append(f"    {column.name} {oracle_type_for_ddl(column.data_type)}{null_clause}")
    return f"CREATE TABLE {owner}.{table.name} (\n" + ",\n".join(column_lines) + "\n);"
