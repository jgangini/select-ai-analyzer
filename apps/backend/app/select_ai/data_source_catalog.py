from __future__ import annotations

from typing import Any

from apps.backend.app.select_ai.constants import APP_SCHEMA
from apps.backend.app.select_ai.data_source_catalog_store import (
    _assert_catalog_table_selectable,
    _select_catalog_columns,
    _select_catalog_owners,
    _select_catalog_table_comment,
    _select_catalog_tables,
    _select_data_sources,
)
from apps.backend.app.select_ai.sql_names import _qualified_name, _safe_identifier
from apps.backend.app.select_ai.value_serialization import _json_safe, _read_lob


class SelectAIDataSourceCatalogMixin:
    def list_data_sources(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_data_sources(cursor, app_schema=APP_SCHEMA)
            columns = [desc[0].lower() for desc in cursor.description or []]
            return [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def list_catalog_owners(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_catalog_owners(cursor, app_schema=APP_SCHEMA)
            return [
                {"owner_name": str(owner_name).upper(), "table_count": int(table_count or 0)}
                for owner_name, table_count in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def list_catalog_tables(self, owner: str) -> list[dict[str, Any]]:
        owner_name = self._assert_data_schema(owner)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _select_catalog_tables(cursor, owner_name=owner_name)
            return [
                {
                    "owner_name": str(owner).upper(),
                    "table_name": str(table_name).upper(),
                    "row_count": int(row_count or 0),
                    "column_count": int(column_count or 0),
                    "table_comment": str(_read_lob(table_comment) or ""),
                }
                for owner, table_name, row_count, column_count, table_comment in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def describe_catalog_table(self, *, owner: str, table_name: str) -> dict[str, Any]:
        owner_name = self._assert_data_schema(owner)
        table = _safe_identifier(table_name)
        qualified = _qualified_name(owner_name, table)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            _assert_catalog_table_selectable(cursor, qualified_table=qualified)
            _select_catalog_table_comment(cursor, owner_name=owner_name, table_name=table)
            table_comment_row = cursor.fetchone()
            table_comment = str(_read_lob(table_comment_row[0]) or "") if table_comment_row else ""
            _select_catalog_columns(cursor, owner_name=owner_name, table_name=table)
            columns = [
                {
                    "column_name": str(column_name).upper(),
                    "data_type": str(data_type).upper(),
                    "data_length": int(data_length or 0),
                    "nullable": str(nullable or "Y")[:1],
                    "ordinal_position": int(column_id or 0),
                    "comment": str(_read_lob(comment) or ""),
                    "ui_display": "",
                    "classification": "",
                    "primary_key": str(primary_key_flag or "N") == "Y",
                }
                for column_name, data_type, data_length, nullable, column_id, comment, primary_key_flag
                in cursor.fetchall()
            ]
            if not columns:
                raise ValueError(f"Table {qualified} was not found or has no visible columns.")
            return {
                "owner_name": owner_name,
                "table_name": table,
                "table_comment": table_comment,
                "columns": columns,
            }
        finally:
            cursor.close()
            conn.close()
