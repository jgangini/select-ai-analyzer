from __future__ import annotations

from typing import Any
import hashlib


def safe_constraint_name(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "_$#" else "_" for ch in str(value or "").upper())
    cleaned = cleaned.strip("_") or "PK_SOURCE"
    digest = hashlib.sha1(cleaned.encode("utf-8")).hexdigest()[:8].upper()
    return f"{cleaned[:21]}_{digest}"[:30]


def sql_string_literal(value: str) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def metadata_by_column(column_metadata: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("column_name") or "").upper(): item
        for item in column_metadata
        if isinstance(item, dict) and item.get("column_name")
    }


def annotation_clause(name: str, value: str) -> str:
    return f"{name} {sql_string_literal(value)}" if value else name


def execute_metadata_statement(cursor, statement: str, warnings: list[str], label: str) -> None:
    try:
        cursor.execute(statement)
    except Exception as exc:
        warnings.append(f"{label}: {str(exc)[:240]}")


def primary_key_exists(cursor, table_name: str, data_schema: str) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM all_constraints
        WHERE owner = :owner_name
          AND table_name = :table_name
          AND constraint_type = 'P'
        """,
        owner_name=data_schema,
        table_name=table_name,
    )
    row = cursor.fetchone()
    return bool(row and int(row[0] or 0) > 0)


def apply_metadata(
    cursor,
    table_name: str,
    *,
    data_schema: str,
    table_comment: str | None,
    column_metadata: list[dict[str, Any]],
) -> list[str]:
    warnings: list[str] = []
    qualified_table = f"{data_schema}.{table_name}"
    clean_table_comment = str(table_comment or "").strip()[:1000]
    if clean_table_comment:
        execute_metadata_statement(
            cursor,
            f"COMMENT ON TABLE {qualified_table} IS {sql_string_literal(clean_table_comment)}",
            warnings,
            f"Table comment for {table_name} was not applied",
        )
        execute_metadata_statement(
            cursor,
            f"ALTER TABLE {qualified_table} ANNOTATIONS (ADD {annotation_clause('UI_Display', clean_table_comment)})",
            warnings,
            f"Table annotation for {table_name} was not applied",
        )

    primary_key_columns: list[str] = []
    for column_name, metadata in metadata_by_column(column_metadata).items():
        comment = str(metadata.get("comment") or "").strip()[:1000]
        if comment:
            execute_metadata_statement(
                cursor,
                f"COMMENT ON COLUMN {qualified_table}.{column_name} IS {sql_string_literal(comment)}",
                warnings,
                f"Comment for {table_name}.{column_name} was not applied",
            )
        ui_display = str(metadata.get("ui_display") or "").strip()[:255]
        if ui_display:
            execute_metadata_statement(
                cursor,
                f"ALTER TABLE {qualified_table} MODIFY ({column_name} ANNOTATIONS "
                f"(ADD {annotation_clause('UI_Display', ui_display)}))",
                warnings,
                f"UI display for {table_name}.{column_name} was not applied",
            )
        classification = str(metadata.get("classification") or "").strip()[:100]
        if classification:
            execute_metadata_statement(
                cursor,
                f"ALTER TABLE {qualified_table} MODIFY ({column_name} ANNOTATIONS "
                f"(ADD {annotation_clause('Classification', classification)}))",
                warnings,
                f"Classification for {table_name}.{column_name} was not applied",
            )
        if bool(metadata.get("primary_key")):
            primary_key_columns.append(column_name)

    if primary_key_columns and not primary_key_exists(cursor, table_name, data_schema):
        columns_sql = ", ".join(primary_key_columns)
        constraint_name = safe_constraint_name(f"PK_{table_name}")
        execute_metadata_statement(
            cursor,
            f"ALTER TABLE {qualified_table} ADD CONSTRAINT {constraint_name} PRIMARY KEY ({columns_sql})",
            warnings,
            f"Primary key for {table_name} was not applied",
        )
    return warnings
