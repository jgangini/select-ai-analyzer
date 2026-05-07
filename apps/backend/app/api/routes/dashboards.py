from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from apps.backend.app.api.setup_guard import require_setup_completed
from apps.backend.app.core.security import get_current_user
from apps.backend.app.core.session import get_db_manager
from apps.backend.app.select_ai.dashboards import DashboardService


router = APIRouter(
    prefix="/dashboards",
    tags=["dashboards"],
    dependencies=[Depends(require_setup_completed)],
)


class DashboardItemRequest(BaseModel):
    run_id: str | None = None
    title: str = Field(min_length=1, max_length=500)
    question: str = Field(min_length=1)
    sql: str = Field(min_length=1)
    chart_spec: dict[str, Any] = Field(default_factory=dict)
    layout: dict[str, Any] = Field(default_factory=dict)


class DashboardCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    visibility: str = Field(default="private", pattern="^(private|shared)$")
    items: list[DashboardItemRequest] = Field(min_length=1)


class DashboardItemsCreateRequest(BaseModel):
    items: list[DashboardItemRequest] = Field(min_length=1)


class DashboardUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    visibility: str | None = Field(default=None, pattern="^(private|shared)$")


class DashboardItemUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    layout: dict[str, Any] | None = None


class DashboardReorderRequest(BaseModel):
    item_ids: list[str] = Field(min_length=1)


def _service() -> DashboardService:
    return DashboardService(get_db_manager())


@router.get("")
def list_dashboards(
    limit: int = Query(default=50, ge=1, le=100),
    owner_only: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return {
            "items": _service().list_dashboards(
                user_id=int(current_user.get("user_id") or 0),
                limit=limit,
                owner_only=owner_only,
            )
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("")
def create_dashboard(
    request: DashboardCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().create_dashboard(
            name=request.name,
            description=request.description,
            visibility=request.visibility,
            items=[item.model_dump() for item in request.items],
            user_id=int(current_user.get("user_id") or 0),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{dashboard_id}")
def update_dashboard(
    dashboard_id: str,
    request: DashboardUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().update_dashboard(
            dashboard_id=dashboard_id,
            name=request.name,
            description=request.description,
            visibility=request.visibility,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().delete_dashboard(
            dashboard_id=dashboard_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{dashboard_id}/items")
def add_dashboard_items(
    dashboard_id: str,
    request: DashboardItemsCreateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().add_dashboard_items(
            dashboard_id=dashboard_id,
            items=[item.model_dump() for item in request.items],
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        status_code = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{dashboard_id}/items/{dashboard_item_id}")
def update_dashboard_item(
    dashboard_id: str,
    dashboard_item_id: str,
    request: DashboardItemUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().update_dashboard_item(
            dashboard_id=dashboard_id,
            dashboard_item_id=dashboard_item_id,
            title=request.title,
            layout=request.layout,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{dashboard_id}/items/{dashboard_item_id}")
def delete_dashboard_item(
    dashboard_id: str,
    dashboard_item_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().delete_dashboard_item(
            dashboard_id=dashboard_id,
            dashboard_item_id=dashboard_item_id,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{dashboard_id}/items/reorder")
def reorder_dashboard_items(
    dashboard_id: str,
    request: DashboardReorderRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().reorder_dashboard_items(
            dashboard_id=dashboard_id,
            dashboard_item_ids=request.item_ids,
            user_id=int(current_user.get("user_id") or 0),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: str,
    max_rows: int = Query(default=500, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        return _service().get_dashboard(
            dashboard_id=dashboard_id,
            user_id=int(current_user.get("user_id") or 0),
            max_rows=max_rows,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
