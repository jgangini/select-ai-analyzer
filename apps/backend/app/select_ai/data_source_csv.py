from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Any
import uuid

from apps.backend.app.core.config import get_settings
from apps.backend.app.select_ai.constants import DEFAULT_DATA_SCHEMA
from apps.backend.app.select_ai.metadata_payload import parse_metadata_payload
from apps.backend.app.select_ai.sql_names import _qualified_name, _safe_identifier


@dataclass(frozen=True, slots=True)
class CsvUploadRows:
    fieldnames: list[str]
    rows: list[dict[str, Any]]


def _read_csv_upload(csv_path: Path) -> CsvUploadRows:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = [_safe_identifier(field or "") for field in (reader.fieldnames or [])]
        if not fieldnames:
            raise ValueError("CSV must include a header row.")
        rows = [{fieldnames[index]: value for index, value in enumerate(raw.values())} for raw in reader]
    if not rows:
        raise ValueError("CSV must include at least one data row.")
    return CsvUploadRows(fieldnames=fieldnames, rows=rows)


def _create_csv_table(cursor, table_ref: str, fieldnames: list[str]) -> None:
    ddl_columns = ", ".join(f"{column} VARCHAR2(4000)" for column in fieldnames)
    cursor.execute(f"CREATE TABLE {table_ref} ({ddl_columns})")


def _insert_csv_rows(cursor, table_ref: str, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    bind_columns = ", ".join(fieldnames)
    bind_values = ", ".join(f":{column}" for column in fieldnames)
    cursor.executemany(f"INSERT INTO {table_ref} ({bind_columns}) VALUES ({bind_values})", rows)


def save_csv_upload(original_filename: str, source_stream) -> Path:
    upload_dir = get_settings().upload_path / "csv"
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(original_filename or "upload.csv").name
    upload_path = upload_dir / f"{uuid.uuid4().hex}_{safe_name}"
    with upload_path.open("wb") as handle:
        shutil.copyfileobj(source_stream, handle)
    return upload_path


def _insert_load_job(cursor, load_job_id: str, original_filename: str, qualified_table: str) -> None:
    cursor.execute(
        """
        INSERT INTO load_jobs (load_job_id, source_file_name, target_table_name, status)
        VALUES (:id, :source_file_name, :target_table_name, 'running')
        """,
        id=load_job_id,
        source_file_name=original_filename,
        target_table_name=qualified_table,
    )


def _assert_csv_table_selectable(cursor, qualified_table: str) -> None:
    try:
        cursor.execute(f"SELECT * FROM {qualified_table} WHERE 1 = 0")
    except Exception as exc:
        raise ValueError(
            f"APP_AGENT cannot SELECT from {qualified_table}. Grant SELECT on this table before registering it."
        ) from exc


def _complete_load_job(cursor, load_job_id: str, row_count: int) -> None:
    cursor.execute(
        "UPDATE load_jobs SET status = 'completed', row_count = :row_count WHERE load_job_id = :id",
        row_count=row_count,
        id=load_job_id,
    )


def _mark_load_job_failed(conn, cursor, load_job_id: str, exc: Exception) -> None:
    conn.rollback()
    try:
        cursor.execute(
            "UPDATE load_jobs SET status = 'failed', error_message = :message WHERE load_job_id = :id",
            message=str(exc)[:4000],
            id=load_job_id,
        )
        conn.commit()
    except Exception:
        conn.rollback()


def _register_csv_data_source(
    cursor,
    *,
    data_source_id: str,
    original_filename: str,
    owner_name: str,
    table_name: str,
    access_scope: str,
    row_count: int,
    user_id: int,
) -> None:
    cursor.execute(
        "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
        owner_name=owner_name,
        table_name=table_name,
    )
    cursor.execute(
        """
        INSERT INTO data_sources (
            data_source_id, source_name, source_type, owner_name, table_name,
            source_file_name, access_scope, row_count, status, created_by_user_id
        ) VALUES (
            :id, :name, 'csv', :owner_name, :table_name,
            :source_file_name, :scope, :row_count, 'active', :user_id
        )
        """,
        id=data_source_id,
        name=Path(original_filename).stem,
        owner_name=owner_name,
        table_name=table_name,
        source_file_name=original_filename,
        scope=access_scope,
        row_count=row_count,
        user_id=user_id,
    )


class SelectAIDataSourceCsvMixin:
    def _ensure_csv_target_schema(self, owner_name: str, create_schema: bool) -> None:
        if self.schema_exists(owner_name):
            return
        if not create_schema:
            raise ValueError(f"Schema {owner_name} does not exist. Confirm schema creation before uploading.")
        self.create_data_schema(owner_name)

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
        return save_csv_upload(original_filename, source_stream)

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
        self._ensure_csv_target_schema(owner_name, create_schema)
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
            self._load_csv_table_as_app_agent(
                cursor,
                owner_name=owner_name,
                table_name=target_table,
                qualified_table=qualified_table,
                fieldnames=upload.fieldnames,
                rows=upload.rows,
            )
            _assert_csv_table_selectable(cursor, qualified_table)
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

    @staticmethod
    def _drop_table_if_exists(cursor, table_name: str, *, owner_name: str | None = None) -> None:
        qualified_table = _qualified_name(owner_name, table_name) if owner_name else _safe_identifier(table_name)
        try:
            cursor.execute(f"DROP TABLE {qualified_table} PURGE")
        except Exception as exc:
            if "ORA-00942" not in str(exc):
                raise
