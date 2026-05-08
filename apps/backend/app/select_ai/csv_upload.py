from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Any
import uuid

from apps.backend.app.core.config import get_settings
from apps.backend.app.select_ai.sql_names import _safe_identifier


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
