from __future__ import annotations

import json
from pathlib import Path
from typing import Any
import uuid

from apps.backend.app.select_ai.constants import APP_SCHEMA, DEFAULT_DATA_SCHEMA
from apps.backend.app.select_ai.csv_upload import (
    _create_csv_table,
    _insert_csv_rows,
    _read_csv_upload,
    save_csv_upload as _save_csv_upload,
)
from apps.backend.app.select_ai.data_source_csv_jobs import (
    _assert_csv_table_selectable,
    _complete_load_job,
    _insert_load_job,
    _mark_load_job_failed,
    _register_csv_data_source,
)
from apps.backend.app.select_ai.metadata_payload import parse_metadata_payload
from apps.backend.app.select_ai.sql_names import _qualified_name, _safe_identifier


class SelectAIDataSourceCsvMixin:
    def _ensure_csv_target_schema(self, owner_name: str, create_schema: bool) -> str | None:
        if self.schema_exists(owner_name):
            return None
        if not create_schema:
            raise ValueError(f"Schema {owner_name} does not exist. Confirm schema creation before uploading.")
        schema_result = self.create_data_schema(owner_name, include_password=True)
        return str(schema_result.get("password") or "") or None

    def _load_csv_table_as_app_agent(
        self,
        cursor,
        *,
        owner_name: str,
        table_name: str,
        qualified_table: str,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
    ) -> None:
        try:
            self._drop_table_if_exists(cursor, table_name, owner_name=owner_name)
            _create_csv_table(cursor, qualified_table, fieldnames)
            _insert_csv_rows(cursor, qualified_table, fieldnames, rows)
        except Exception as exc:
            if "ORA-01031" in str(exc) or "insufficient privileges" in str(exc).lower():
                raise ValueError(
                    f"APP_AGENT cannot create or load tables in existing schema {owner_name}. "
                    "Grant the required cross-schema privileges or create a new data schema from this upload."
            ) from exc
            raise

    @staticmethod
    def save_csv_upload(original_filename: str, source_stream) -> Path:
        return _save_csv_upload(original_filename, source_stream)

    @staticmethod
    def resolve_csv_metadata(
        columns_metadata_json: str | None,
        table_comment: str | None,
    ) -> tuple[str | None, list[dict[str, Any]]]:
        if not columns_metadata_json:
            return table_comment, []
        parsed_table_comment, column_metadata = parse_metadata_payload(json.loads(columns_metadata_json))
        return table_comment or parsed_table_comment, column_metadata

    def create_table_from_csv(
        self,
        *,
        csv_path: Path,
        original_filename: str,
        table_name: str | None,
        table_comment: str | None = None,
        column_metadata: list[dict[str, Any]] | None = None,
        target_schema: str | None = DEFAULT_DATA_SCHEMA,
        create_schema: bool = False,
        access_scope: str = "all",
        user_id: int = 0,
    ) -> dict[str, Any]:
        if not csv_path.exists():
            raise ValueError("CSV upload was not saved.")
        owner_name = self._assert_data_schema(target_schema or DEFAULT_DATA_SCHEMA)
        target_password = self._ensure_csv_target_schema(owner_name, create_schema)
        target_table = _safe_identifier(table_name or Path(original_filename).stem)
        qualified_table = _qualified_name(owner_name, target_table)
        upload = _read_csv_upload(csv_path)

        conn = self._connection()
        cursor = conn.cursor()
        load_job_id = uuid.uuid4().hex
        data_source_id = uuid.uuid4().hex
        metadata_warnings: list[str] = []
        try:
            _insert_load_job(cursor, load_job_id, original_filename, qualified_table)
            if target_password:
                metadata_warnings = self._load_csv_table_as_owner(
                    owner_name=owner_name,
                    password=target_password,
                    table_name=target_table,
                    fieldnames=upload.fieldnames,
                    rows=upload.rows,
                    table_comment=table_comment,
                    column_metadata=column_metadata or [],
                )
            else:
                self._load_csv_table_as_app_agent(
                    cursor,
                    owner_name=owner_name,
                    table_name=target_table,
                    qualified_table=qualified_table,
                    fieldnames=upload.fieldnames,
                    rows=upload.rows,
                )
            _assert_csv_table_selectable(cursor, qualified_table)
            if not target_password:
                metadata_warnings = self._apply_select_ai_metadata(
                    cursor,
                    owner_name=owner_name,
                    table_name=target_table,
                    table_comment=table_comment,
                    column_metadata=column_metadata or [],
                )
            _register_csv_data_source(
                cursor,
                data_source_id=data_source_id,
                original_filename=original_filename,
                owner_name=owner_name,
                table_name=target_table,
                access_scope=access_scope,
                row_count=len(upload.rows),
                user_id=user_id,
            )
            column_rows = [(name, "VARCHAR2", 4000, "Y", index + 1) for index, name in enumerate(upload.fieldnames)]
            self._replace_source_columns(cursor, data_source_id, column_rows, column_metadata or [])
            _complete_load_job(cursor, load_job_id, len(upload.rows))
            conn.commit()
        except Exception as exc:
            _mark_load_job_failed(conn, cursor, load_job_id, exc)
            raise
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {
            "data_source_id": data_source_id,
            "load_job_id": load_job_id,
            "owner_name": owner_name,
            "table_name": target_table,
            "row_count": len(upload.rows),
            "metadata_warnings": metadata_warnings,
        }

    def _load_csv_table_as_owner(
        self,
        *,
        owner_name: str,
        password: str,
        table_name: str,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
        table_comment: str | None = None,
        column_metadata: list[dict[str, Any]] | None = None,
    ) -> list[str]:
        conn = self._connect_as(user=owner_name, password=password)
        cursor = conn.cursor()
        try:
            self._drop_table_if_exists(cursor, table_name)
            safe_table = _safe_identifier(table_name)
            _create_csv_table(cursor, safe_table, fieldnames)
            _insert_csv_rows(cursor, safe_table, fieldnames, rows)
            metadata_warnings = self._apply_select_ai_metadata(
                cursor,
                owner_name=owner_name,
                table_name=table_name,
                table_comment=table_comment,
                column_metadata=column_metadata or [],
            )
            cursor.execute(f"GRANT SELECT ON {_safe_identifier(table_name)} TO {APP_SCHEMA}")
            conn.commit()
            return metadata_warnings
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _drop_table_if_exists(cursor, table_name: str, *, owner_name: str | None = None) -> None:
        qualified_table = _qualified_name(owner_name, table_name) if owner_name else _safe_identifier(table_name)
        try:
            cursor.execute(f"DROP TABLE {qualified_table} PURGE")
        except Exception as exc:
            if "ORA-00942" not in str(exc):
                raise
