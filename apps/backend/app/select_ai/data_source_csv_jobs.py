from __future__ import annotations

from pathlib import Path


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
