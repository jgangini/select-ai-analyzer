from pathlib import Path
from zipfile import ZipFile

from fastapi import HTTPException


def safe_upload_name(file_name: str | None, expected_suffix: str, error_message: str) -> str:
    safe_name = Path(file_name or "").name
    if Path(safe_name).suffix.lower() != expected_suffix.lower():
        raise HTTPException(400, error_message)
    return safe_name


def extract_zip_safely(zip_path: Path, destination: Path) -> None:
    destination_root = destination.resolve()
    with ZipFile(zip_path, "r") as zip_ref:
        for member in zip_ref.infolist():
            target_path = (destination_root / member.filename).resolve()
            if target_path != destination_root and not target_path.is_relative_to(destination_root):
                raise HTTPException(400, "ZIP archive contains an unsafe path")
        zip_ref.extractall(destination_root)
