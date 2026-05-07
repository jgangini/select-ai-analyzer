from __future__ import annotations

import json
from pathlib import Path
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from apps.backend.app.api.setup_guard import require_setup_completed
from apps.backend.app.core.config import get_settings
from apps.backend.app.core.security import get_current_user
from apps.backend.app.core.session import get_db_manager
from apps.backend.app.select_ai.source_metadata import parse_metadata_payload
from apps.backend.app.select_ai.service import SelectAIAnalyticsService


router = APIRouter(
    prefix="/data-sources",
    tags=["data-sources"],
    dependencies=[Depends(require_setup_completed)],
)


class ColumnMetadataRequest(BaseModel):
    column_name: str = Field(min_length=1)
    comment: str | None = None
    ui_display: str | None = None
    classification: str | None = None
    primary_key: bool = False


class ExistingTableRequest(BaseModel):
    owner: str = Field(min_length=1)
    table_name: str = Field(min_length=1)
    display_name: str | None = None
    table_comment: str | None = None
    columns: list[ColumnMetadataRequest] = Field(default_factory=list)
    access_scope: str = "all"


class CreateSchemaRequest(BaseModel):
    schema_name: str = Field(min_length=1)


def _service() -> SelectAIAnalyticsService:
    return SelectAIAnalyticsService(get_db_manager())


@router.get("")
def list_data_sources(current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    return {"items": _service().list_data_sources()}


@router.get("/schemas")
def list_schemas(current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    try:
        return {"items": _service().list_schemas()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/catalog/owners")
def list_catalog_owners(current_user: dict = Depends(get_current_user)) -> dict:
    del current_user
    try:
        return {"items": _service().list_catalog_owners()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/catalog/tables")
def list_catalog_tables(
    owner: str = Query(min_length=1),
    current_user: dict = Depends(get_current_user),
) -> dict:
    del current_user
    try:
        return {"items": _service().list_catalog_tables(owner)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/catalog/table")
def describe_catalog_table(
    owner: str = Query(min_length=1),
    table_name: str = Query(min_length=1),
    current_user: dict = Depends(get_current_user),
) -> dict:
    del current_user
    try:
        return _service().describe_catalog_table(owner=owner, table_name=table_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/schemas")
def create_schema(
    request: CreateSchemaRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    del current_user
    try:
        return _service().create_data_schema(request.schema_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{data_source_id}/rows")
def preview_data_source_rows(
    data_source_id: str,
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
) -> dict:
    del current_user
    try:
        return _service().preview_data_source_rows(data_source_id, limit=limit, offset=offset)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{data_source_id}")
def delete_data_source(
    data_source_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().delete_data_source(
            data_source_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/table-access")
def register_existing_table(
    request: ExistingTableRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().register_existing_table(
            owner=request.owner,
            table_name=request.table_name,
            display_name=request.display_name,
            table_comment=request.table_comment,
            column_metadata=[column.model_dump() for column in request.columns],
            access_scope=request.access_scope,
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/csv")
def upload_csv(
    file: UploadFile = File(...),
    table_name: str | None = Form(default=None),
    table_comment: str | None = Form(default=None),
    columns_metadata_json: str | None = Form(default=None),
    target_schema: str | None = Form(default=None),
    create_schema: bool = Form(default=False),
    access_scope: str = Form(default="all"),
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    settings = get_settings()
    upload_dir = settings.upload_path / "csv"
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_path = upload_dir / f"{uuid.uuid4().hex}_{Path(file.filename or 'upload.csv').name}"
    try:
        column_metadata: list[dict] = []
        if columns_metadata_json:
            parsed_table_comment, column_metadata = parse_metadata_payload(json.loads(columns_metadata_json))
            table_comment = table_comment or parsed_table_comment
        with upload_path.open("wb") as handle:
            shutil.copyfileobj(file.file, handle)
        return _service().create_table_from_csv(
            csv_path=upload_path,
            original_filename=file.filename or upload_path.name,
            table_name=table_name,
            table_comment=table_comment,
            column_metadata=column_metadata,
            target_schema=target_schema,
            create_schema=create_schema,
            access_scope=access_scope,
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
