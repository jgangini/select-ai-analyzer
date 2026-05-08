from __future__ import annotations

import hashlib
import json
from typing import Any

from apps.backend.app.select_ai.constants import APP_SCHEMA, SCOPED_PROFILE_LIMIT
from apps.backend.app.select_ai.source_intents import (
    _expanded_question_tokens,
    _is_drcr_amount_intent,
    preferred_source_object_names,
)
from apps.backend.app.select_ai.source_scoring import _is_transaction_fact_candidate, _score_source_match
from apps.backend.app.select_ai.scoped_profile_store import (
    _drop_select_ai_profile,
    _select_profile_config,
    _select_registered_source_objects,
)
from apps.backend.app.select_ai.value_serialization import _read_lob


def _source_object_ref(item: dict[str, Any]) -> dict[str, str]:
    return {"owner": str(item["owner"]), "name": str(item["name"])}


def _objects_named(objects: list[dict[str, Any]], *name_parts: str) -> list[dict[str, str]]:
    normalized_parts = [part.upper() for part in name_parts]
    matches: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for part in normalized_parts:
        for item in objects:
            name = str(item["name"]).upper()
            if name != part and part not in name:
                continue
            key = (str(item["owner"]).upper(), name)
            if key in seen:
                continue
            seen.add(key)
            matches.append(_source_object_ref(item))
    return matches


class SelectAIScopedProfileMixin:
    def _registered_source_objects(self) -> list[dict[str, Any]]:
        with self._cursor() as (_, cursor):
            _select_registered_source_objects(cursor, app_schema=APP_SCHEMA)
            grouped: dict[tuple[str, str], list[str]] = {}
            for owner_name, table_name, column_name in cursor.fetchall():
                key = (str(owner_name).upper(), str(table_name).upper())
                grouped.setdefault(key, [])
                if column_name:
                    grouped[key].append(str(column_name).upper())
            return [
                {"owner": owner, "name": table, "columns": columns}
                for (owner, table), columns in grouped.items()
            ]

    def resolve_scoped_objects(self, question: str, *, limit: int = SCOPED_PROFILE_LIMIT) -> list[dict[str, str]]:
        objects = self._registered_source_objects()
        if not objects:
            raise ValueError("No active data sources are registered for Select AI.")
        question_upper = str(question or "").upper()
        question_tokens = _expanded_question_tokens(question)
        exact_matches = [
            _source_object_ref(item)
            for item in objects
            if item["name"] in question_upper
        ]
        if exact_matches:
            return exact_matches[:limit]

        preferred_names = preferred_source_object_names(question, question_tokens)
        preferred_objects = _objects_named(objects, *preferred_names) if preferred_names else []
        if preferred_objects:
            return preferred_objects[:limit]

        candidate_objects = objects
        scoped_limit = limit
        if _is_drcr_amount_intent(question):
            transaction_candidates = [
                item
                for item in objects
                if _is_transaction_fact_candidate(str(item["name"]), list(item.get("columns") or []))
            ]
            if transaction_candidates:
                candidate_objects = transaction_candidates
                scoped_limit = 1

        scored = [
            (
                _score_source_match(question, str(item["name"]), list(item.get("columns") or [])),
                item,
            )
            for item in candidate_objects
        ]
        matches = [
            {"owner": item["owner"], "name": item["name"]}
            for score, item in sorted(
                scored,
                key=lambda pair: (
                    -pair[0],
                    0 if "TRANSACTIONS" in str(pair[1]["name"]).upper() else 1,
                    pair[1]["name"],
                ),
            )
            if score > 0
        ]
        if not matches:
            raise ValueError(
                "No registered table matched the question. Mention a table, column, or banking domain term."
            )
        return matches[:scoped_limit]

    def _profile_config(self, cursor) -> dict[str, str]:
        _select_profile_config(cursor)
        values = {
            "genai.model": "google.gemini-2.5-flash",
            "select_ai.credential_name": "APP_AGENT_OCI_CRED",
            "oci.region": "",
            "oci.compartment_id": "",
        }
        for key, value in cursor.fetchall():
            normalized = _read_lob(value)
            values[str(key)] = str(normalized or "").strip()
        return values

    def _drop_profile(self, cursor, profile_name: str) -> None:
        try:
            _drop_select_ai_profile(cursor, profile_name)
        except Exception as exc:
            message = str(exc).lower()
            if "not exist" not in message and "does not exist" not in message and "ora-20000" not in message:
                raise

    def create_scoped_profile(self, question: str) -> tuple[str, list[dict[str, str]]]:
        objects = self.resolve_scoped_objects(question)
        digest = hashlib.sha1(
            json.dumps(objects, sort_keys=True, ensure_ascii=True).encode("utf-8")
        ).hexdigest()[:16].upper()
        profile_name = f"{self._profile_name()}_Q_{digest}"
        with self._cursor() as (conn, cursor):
            config = self._profile_config(cursor)
            attributes = {
                "provider": "oci",
                "credential_name": config["select_ai.credential_name"],
                "model": config["genai.model"],
                "temperature": 0.2,
                "comments": "true",
                "annotations": "true",
                "constraints": "true",
                "conversation": "true",
                "object_list": objects,
                "enforce_object_list": "true",
                "region": config["oci.region"],
                "oci_compartment_id": config["oci.compartment_id"],
                "max_tokens": 2048,
            }
            self._drop_profile(cursor, profile_name)
            cursor.callproc("DBMS_CLOUD_AI.CREATE_PROFILE", [profile_name, json.dumps(attributes)])
            conn.commit()
            return profile_name, objects

    def drop_scoped_profile(self, profile_name: str) -> None:
        if not profile_name.startswith(f"{self._profile_name()}_Q_"):
            return
        with self._cursor() as (conn, cursor):
            self._drop_profile(cursor, profile_name)
            conn.commit()
