from __future__ import annotations

from typing import Any
import uuid

from apps.backend.app.select_ai.sql_names import (
    _clean_optional_text,
    _qualified_name,
    _safe_constraint_name,
    _safe_identifier,
    _sql_string_literal,
)


class SelectAIDataSourceMetadataMixin:
    @staticmethod
    def _metadata_by_column(column_metadata: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        metadata: dict[str, dict[str, Any]] = {}
        for raw_item in column_metadata:
            if not isinstance(raw_item, dict):
                continue
            raw_name = raw_item.get("column_name") or raw_item.get("name")
            if not raw_name:
                continue
            metadata[_safe_identifier(str(raw_name))] = raw_item
        return metadata

    @staticmethod
    def _metadata_annotation_clause(annotation_name: str, annotation_value: str) -> str:
        safe_name = _safe_identifier(annotation_name)
        if annotation_value:
            return f"{safe_name} {_sql_string_literal(annotation_value)}"
        return safe_name

    @staticmethod
    def _execute_metadata_statement(cursor, statement: str, warnings: list[str], label: str) -> None:
        try:
            cursor.execute(statement)
        except Exception as exc:
            warnings.append(f"{label}: {str(exc)[:240]}")

    @staticmethod
    def _primary_key_exists(cursor, *, owner_name: str, table_name: str) -> bool:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM all_constraints
            WHERE owner = :owner_name
              AND table_name = :table_name
              AND constraint_type = 'P'
            """,
            owner_name=owner_name,
            table_name=table_name,
        )
        row = cursor.fetchone()
        return bool(row and int(row[0] or 0) > 0)

    def _apply_select_ai_metadata(
        self,
        cursor,
        *,
        owner_name: str,
        table_name: str,
        table_comment: str | None,
        column_metadata: list[dict[str, Any]],
    ) -> list[str]:
        warnings: list[str] = []
        qualified_table = _qualified_name(owner_name, table_name)
        clean_table_comment = _clean_optional_text(table_comment, limit=1000)
        if clean_table_comment:
            self._execute_metadata_statement(
                cursor,
                f"COMMENT ON TABLE {qualified_table} IS {_sql_string_literal(clean_table_comment)}",
                warnings,
                "Table comment was not applied",
            )
            self._execute_metadata_statement(
                cursor,
                "ALTER TABLE "
                f"{qualified_table} ANNOTATIONS "
                f"(ADD {self._metadata_annotation_clause('UI_Display', clean_table_comment)})",
                warnings,
                "Table annotation was not applied",
            )

        metadata_by_column = self._metadata_by_column(column_metadata)
        primary_key_columns: list[str] = []
        for column_name, raw_item in metadata_by_column.items():
            comment = _clean_optional_text(raw_item.get("comment"), limit=1000)
            if comment:
                self._execute_metadata_statement(
                    cursor,
                    f"COMMENT ON COLUMN {qualified_table}.{column_name} IS {_sql_string_literal(comment)}",
                    warnings,
                    f"Comment for {column_name} was not applied",
                )

            ui_display = _clean_optional_text(raw_item.get("ui_display"), limit=255)
            if ui_display:
                self._execute_metadata_statement(
                    cursor,
                    "ALTER TABLE "
                    f"{qualified_table} MODIFY ({column_name} ANNOTATIONS "
                    f"(ADD {self._metadata_annotation_clause('UI_Display', ui_display)}))",
                    warnings,
                    f"UI display annotation for {column_name} was not applied",
                )

            classification = _clean_optional_text(raw_item.get("classification"), limit=100)
            if classification:
                self._execute_metadata_statement(
                    cursor,
                    "ALTER TABLE "
                    f"{qualified_table} MODIFY ({column_name} ANNOTATIONS "
                    f"(ADD {self._metadata_annotation_clause('Classification', classification)}))",
                    warnings,
                    f"Classification annotation for {column_name} was not applied",
                )

            if bool(raw_item.get("primary_key")):
                primary_key_columns.append(column_name)

        if primary_key_columns and not self._primary_key_exists(
            cursor,
            owner_name=owner_name,
            table_name=table_name,
        ):
            constraint_name = _safe_constraint_name(f"PK_{table_name}")
            columns_sql = ", ".join(primary_key_columns)
            self._execute_metadata_statement(
                cursor,
                f"ALTER TABLE {qualified_table} ADD CONSTRAINT {constraint_name} PRIMARY KEY ({columns_sql})",
                warnings,
                "Primary key constraint was not applied",
            )
        return warnings

    @staticmethod
    def _replace_source_columns(
        cursor,
        data_source_id: str,
        columns: list[tuple[Any, ...]],
        column_metadata: list[dict[str, Any]] | None = None,
    ) -> None:
        metadata_by_column = SelectAIDataSourceMetadataMixin._metadata_by_column(column_metadata or [])
        cursor.execute("DELETE FROM source_columns WHERE data_source_id = :id", id=data_source_id)
        for row in columns:
            column_name, data_type, data_length, nullable, column_id = row[:5]
            normalized_column = str(column_name).upper()
            metadata = metadata_by_column.get(normalized_column, {})
            cursor.execute(
                """
                INSERT INTO source_columns (
                    source_column_id, data_source_id, column_name, data_type,
                    data_length, nullable_flag, ordinal_position, business_comment, classification
                ) VALUES (
                    :source_column_id, :data_source_id, :column_name, :data_type,
                    :data_length, :nullable_flag, :ordinal_position, :business_comment, :classification
                )
                """,
                source_column_id=uuid.uuid4().hex,
                data_source_id=data_source_id,
                column_name=normalized_column,
                data_type=str(data_type).upper(),
                data_length=int(data_length or 0),
                nullable_flag=str(nullable or "Y")[:1],
                ordinal_position=int(column_id or 0),
                business_comment=_clean_optional_text(metadata.get("comment"), limit=1000) or None,
                classification=_clean_optional_text(metadata.get("classification"), limit=100) or None,
            )
