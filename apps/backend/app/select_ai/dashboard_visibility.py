from __future__ import annotations


def _normalize_visibility(value: str | None) -> str:
    visibility = str(value or "private").strip().lower()
    if visibility not in {"private", "shared"}:
        raise ValueError("Dashboard visibility must be private or shared.")
    return visibility
