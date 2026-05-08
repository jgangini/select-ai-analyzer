from __future__ import annotations

import json
import uuid
from typing import Any


def _normalize_required_text(value: Any, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} is required.")
    return normalized


def _normalize_dashboard_items(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    normalized_items = list(items or [])
    if not normalized_items:
        raise ValueError("At least one visualization is required.")
    return normalized_items


def _normalize_dashboard_item_ids(dashboard_item_ids: list[str] | None) -> list[str]:
    normalized_item_ids = [
        str(item_id or "").strip()
        for item_id in dashboard_item_ids or []
        if str(item_id or "").strip()
    ]
    if not normalized_item_ids:
        raise ValueError("At least one dashboard_item_id is required.")
    if len(set(normalized_item_ids)) != len(normalized_item_ids):
        raise ValueError("Dashboard item order contains duplicate items.")
    return normalized_item_ids


def _json_object_literal(value: Any, field_name: str, *, empty_when_falsy: bool = True) -> str:
    payload = value or {} if empty_when_falsy else value
    if not isinstance(payload, dict):
        raise ValueError(f"{field_name} must be a JSON object.")
    return json.dumps(payload, ensure_ascii=False)


def _dashboard_item_insert_params(
    *,
    dashboard_id: str,
    item: dict[str, Any],
    item_order: int,
    generated_sql: str,
) -> dict[str, Any]:
    return {
        "dashboard_item_id": uuid.uuid4().hex,
        "dashboard_id": dashboard_id,
        "item_order": item_order,
        "question_run_id": str(item.get("run_id") or "")[:32] or None,
        "item_title": str(item.get("title") or item.get("question") or "Visualization")[:500],
        "question_text": str(item.get("question") or item.get("title") or ""),
        "generated_sql": generated_sql,
        "chart_spec_json": _json_object_literal(item.get("chart_spec"), "chart_spec"),
        "layout_json": json.dumps(item.get("layout") or {}, ensure_ascii=False),
    }


def _dashboard_item_update_fields(
    *,
    title: str | None = None,
    layout: dict[str, Any] | None = None,
) -> tuple[list[str], dict[str, Any]]:
    updates: list[str] = []
    params: dict[str, Any] = {}

    if title is not None:
        normalized_title = str(title or "").strip()[:500]
        if not normalized_title:
            raise ValueError("Visualization title is required.")
        updates.append("item_title = :item_title")
        params["item_title"] = normalized_title

    if layout is not None:
        updates.append("layout_json = :layout_json")
        params["layout_json"] = _json_object_literal(layout, "layout", empty_when_falsy=False)

    return updates, params
