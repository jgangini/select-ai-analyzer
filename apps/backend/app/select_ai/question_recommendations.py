from __future__ import annotations

import re
from typing import Any


def normalize_question_text(question: Any) -> str:
    text = str(question or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ?¿!¡.")


def compact_questions(values: list[Any] | tuple[Any, ...]) -> list[str]:
    seen: set[str] = set()
    questions: list[str] = []
    for value in values:
        question = str(value or "").strip()
        normalized = normalize_question_text(question)
        if not question or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        questions.append(question)
    return questions


def _read_usage_value(row: dict[str, Any], key: str, default_value: Any = None) -> Any:
    return row.get(key) if key in row else row.get(key.upper(), default_value)


def build_question_recommendations(
    *,
    catalog_questions: list[str],
    usage_rows: list[dict[str, Any]],
    limit: int = 12,
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 12), 50))
    catalog = compact_questions(catalog_questions)
    usage_by_key: dict[str, dict[str, Any]] = {}

    for row in usage_rows:
        question = str(_read_usage_value(row, "question_text", "") or "").strip()
        normalized = normalize_question_text(question)
        if not normalized:
            continue
        usage_count = int(_read_usage_value(row, "usage_count", 0) or 0)
        last_used_at = _read_usage_value(row, "last_used_at")
        current = usage_by_key.setdefault(
            normalized,
            {
                "question": question,
                "usage_count": 0,
                "last_used_at": last_used_at,
                "source": "history",
            },
        )
        current["usage_count"] = int(current["usage_count"] or 0) + usage_count
        if last_used_at and str(last_used_at) > str(current.get("last_used_at") or ""):
            current["last_used_at"] = last_used_at

    catalog_items: list[dict[str, Any]] = []
    catalog_keys = {normalize_question_text(question) for question in catalog}
    for index, question in enumerate(catalog):
        normalized = normalize_question_text(question)
        usage = usage_by_key.get(normalized, {})
        catalog_items.append(
            {
                "question": question,
                "usage_count": int(usage.get("usage_count") or 0),
                "last_used_at": usage.get("last_used_at"),
                "source": "starter",
                "rank": index,
            }
        )

    unused_catalog = [item for item in catalog_items if int(item["usage_count"] or 0) == 0]
    used_catalog = sorted(
        [item for item in catalog_items if int(item["usage_count"] or 0) > 0],
        key=lambda item: (int(item["usage_count"] or 0), str(item.get("last_used_at") or ""), int(item["rank"])),
    )
    new_chat = [
        {key: value for key, value in item.items() if key != "rank"}
        for item in (unused_catalog + used_catalog)[:safe_limit]
    ]

    frequent = sorted(usage_by_key.values(), key=lambda item: item["question"])
    frequent = sorted(frequent, key=lambda item: str(item.get("last_used_at") or ""), reverse=True)
    frequent = sorted(frequent, key=lambda item: -int(item.get("usage_count") or 0))
    frequent = [
        {
            **item,
            "source": "starter" if normalize_question_text(item["question"]) in catalog_keys else "history",
        }
        for item in frequent[:safe_limit]
    ]

    return {
        "new_chat": new_chat,
        "frequent": frequent,
        "catalog_size": len(catalog),
    }
