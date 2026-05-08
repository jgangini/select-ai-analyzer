from __future__ import annotations

import hashlib
import json
from typing import Any

from apps.backend.app.select_ai.constants import APP_SCHEMA, SCOPED_PROFILE_LIMIT
from apps.backend.app.select_ai.source_intents import (
    TRANSACTION_INTENT_TOKENS,
    _expanded_question_tokens,
    _is_atm_intent,
    _is_authorization_audit_intent,
    _is_average_balance_intent,
    _is_balance_intent,
    _is_clearing_intent,
    _is_drcr_amount_intent,
    _is_hidden_transaction_intent,
    _is_interest_intent,
    _is_operating_date_hint_intent,
    _is_product_or_volume_intent,
    _is_teller_intent,
    _is_term_deposit_maturity_intent,
    _tokenize_for_match,
    preferred_source_object_names,
)
from apps.backend.app.select_ai.scoped_profile_store import (
    _drop_select_ai_profile,
    _select_profile_config,
    _select_registered_source_objects,
)
from apps.backend.app.select_ai.value_serialization import _read_lob

ACCOUNT_COLUMNS = {"ACCOUNT", "ACCOUNT_NO", "AC_NO", "CUST_AC_NO", "TXN_ACC", "RELATED_ACCOUNT"}
AMOUNT_COLUMNS = {"AMOUNT", "LCY_AMOUNT", "FCY_AMOUNT", "TXN_AMOUNT", "TRANS_AMOUNT", "ACC_CCY_AMT", "INSTRUMENT_AMT"}
DATE_COLUMNS = {"TRN_DT", "VALUE_DATE", "TXN_INIT_DATE", "TRANS_DATE", "BKG_DATE", "BOOK_DATE"}


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


def _require_profile_config_value(config: dict[str, str], key: str, label: str) -> str:
    value = str(config.get(key) or "").strip()
    if not value:
        raise ValueError(
            f"{label} is not configured. "
            "Save Generative AI configuration before creating Select AI profiles."
    )
    return value


def _transaction_source_signals(table_upper: str, column_set: set[str]) -> tuple[bool, bool, bool, bool, bool]:
    has_drcr = "DRCR_IND" in column_set or any("DRCR" in column for column in column_set)
    has_amount = bool(column_set & AMOUNT_COLUMNS) or any(
        token in column for column in column_set for token in ("AMOUNT", "AMT")
    )
    has_account = bool(column_set & ACCOUNT_COLUMNS)
    has_date = bool(column_set & DATE_COLUMNS) or any(
        column.endswith("_DT") or "DATE" in column for column in column_set
    )
    is_fact_like = any(token in table_upper for token in ("TRANSACTION", "DAILY_LOG", "STATEMENT", "TELLER", "ATM_TRANS"))
    return has_drcr, has_amount, has_account, has_date, is_fact_like


def _is_transaction_fact_candidate(table_name: str, columns: list[str]) -> bool:
    column_set = {column.upper() for column in columns}
    has_drcr, has_amount, has_account, has_date, is_fact_like = _transaction_source_signals(
        table_name.upper(), column_set
    )
    return has_drcr and has_amount and has_account and has_date and is_fact_like


def _is_interest_processing_table(table_upper: str) -> bool:
    return table_upper in {"FLEX_ICTB_ACC_PR", "FLEX_ICTM_PR_INT"} or "ICTB_ACC_PR" in table_upper


def _is_balance_history_source(table_upper: str, column_set: set[str]) -> bool:
    return "ACCBAL_HISTORY" in table_upper or "ACY_CLOSING_BAL" in column_set


def _is_hidden_statement_source(table_upper: str, column_set: set[str]) -> bool:
    return "HIDE_TXN_IN_STMT" in column_set or "ACCOUNT_STATEMENT" in table_upper


def _is_branch_dates_source(table_upper: str) -> bool:
    return "STTM_DATES" in table_upper


def _is_external_transactions_source(table_upper: str) -> bool:
    return "EXT_ACCOUNT_TRANSACTIONS" in table_upper


def _is_external_statement_source(table_upper: str) -> bool:
    return "EXT_ACCOUNT_STATEMENT" in table_upper


def _is_teller_source(table_upper: str) -> bool:
    return "TELLER" in table_upper


def _is_customer_account_source(table_upper: str) -> bool:
    return "CUST_ACCOUNT" in table_upper


def _is_daily_log_source(table_upper: str) -> bool:
    return "DAILY_LOG" in table_upper


def _score_required_table_intent(
    intent_matches: bool, table_upper: str, table_token: str, match_score: int, miss_score: int = -250
) -> int:
    if not intent_matches:
        return 0
    return match_score if table_token in table_upper else miss_score


def _score_domain_intents(question_tokens: set[str], table_upper: str, column_set: set[str]) -> int:
    score = 0
    balance_intent = _is_balance_intent(question_tokens)
    score += sum(
        _score_required_table_intent(intent_matches, table_upper, table_token, match_score)
        for intent_matches, table_token, match_score in (
            (_is_teller_intent(question_tokens), "RTL_TELLER", 3600),
            (_is_term_deposit_maturity_intent(question_tokens), "TD_DETAILS", 3600),
            (_is_atm_intent(question_tokens), "ATM_TRANS_LOG", 3200),
            (_is_clearing_intent(question_tokens), "CLEARING", 3200),
        )
    )
    score += sum(
        weight
        for present, weight in (
            (_is_interest_intent(question_tokens) and _is_interest_processing_table(table_upper), 3200),
            (_is_operating_date_hint_intent(question_tokens) and _is_branch_dates_source(table_upper), 3600),
            (balance_intent and _is_balance_history_source(table_upper, column_set), 3400),
            (_is_authorization_audit_intent(question_tokens) and _is_daily_log_source(table_upper), 3200),
            (_is_hidden_transaction_intent(question_tokens) and _is_hidden_statement_source(table_upper, column_set), 3200),
            (_is_product_or_volume_intent(question_tokens) and _is_external_transactions_source(table_upper), 1800),
        )
        if present
    )
    score += _score_required_table_intent(
        _is_average_balance_intent(question_tokens), table_upper, "ACCBAL_HISTORY", 2400, -300
    )
    return score


def _score_lexical_match(question_upper: str, question_tokens: set[str], table_name: str, columns: list[str]) -> int:
    score = 0
    table_tokens = _tokenize_for_match(table_name)
    score += 25 * len(question_tokens & table_tokens)
    for column_name in columns:
        upper_column = column_name.upper()
        if upper_column in question_upper:
            score += 80
        score += 8 * len(question_tokens & _tokenize_for_match(upper_column))
    return score


def _score_transaction_intent(question_tokens: set[str], table_upper: str, column_set: set[str]) -> int:
    if not question_tokens & TRANSACTION_INTENT_TOKENS:
        return 0

    score = 0
    has_drcr, has_amount, has_account, has_date, is_fact_like = _transaction_source_signals(table_upper, column_set)

    score += sum(
        weight
        for present, weight in (
            (has_drcr, 420),
            (has_amount, 260),
            (has_account, 180),
            (has_date, 140),
            (is_fact_like, 280),
        )
        if present
    )
    if has_drcr and has_amount and has_account and has_date:
        score += 320
    score += sum(
        weight
        for present, weight in (
            (_is_external_transactions_source(table_upper), 1500),
            (_is_external_statement_source(table_upper), 700),
            (_is_teller_source(table_upper) and "TELLER" not in question_tokens, -750),
            (not has_drcr and {"DEBITO", "DEBITOS", "CREDITO", "CREDITOS"} & question_tokens, -260),
            (_is_customer_account_source(table_upper) and not has_drcr, -220),
        )
        if present
    )
    return score


def _score_source_match(question: str, table_name: str, columns: list[str]) -> int:
    question_upper = str(question or "").upper()
    question_tokens = _expanded_question_tokens(question)
    column_set = {column.upper() for column in columns}
    table_upper = table_name.upper()
    score = 1000 if table_upper in question_upper else 0
    score += _score_domain_intents(question_tokens, table_upper, column_set)
    score += _score_lexical_match(question_upper, question_tokens, table_name, columns)
    score += _score_transaction_intent(question_tokens, table_upper, column_set)
    return score


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
            "genai.model": "",
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
            model_name = _require_profile_config_value(config, "genai.model", "Generative AI model")
            attributes = {
                "provider": "oci",
                "credential_name": config["select_ai.credential_name"],
                "model": model_name,
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
