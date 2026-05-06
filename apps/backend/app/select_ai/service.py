from __future__ import annotations

import csv
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import secrets
import string
import unicodedata
import uuid
from typing import Any

import oracledb

from apps.backend.app.core.database import DatabaseManager
from apps.backend.app.select_ai.charting import infer_chart_spec, validate_chart_spec
from apps.backend.app.select_ai.conversations import ensure_conversation, normalize_conversation_id
from apps.backend.app.select_ai.sql_validation import validate_read_only_select
from apps.backend.app.services.runtime_config_service import ConfigService


APP_SCHEMA = "APP_AGENT"
DEFAULT_DATA_SCHEMA = "APP_AGENT_DATA"
DEFAULT_PROFILE = "APP_AGENT_ANALYTICS"
SCOPED_PROFILE_LIMIT = 6

QUESTION_SYNONYMS = {
    "ATM": {"ATM"},
    "MONEDA": {"CCY", "CURRENCY"},
    "SALDO": {"BAL", "BALANCE", "ACY", "LCY", "FCY"},
    "PROMEDIO": {"AVERAGE", "AVG"},
    "PROMEDIOS": {"AVERAGE", "AVG"},
    "SUCURSAL": {"BRANCH", "BRN"},
    "CLIENTE": {"CUSTOMER", "CUST"},
    "CUENTA": {"ACCOUNT", "ACC", "AC"},
    "TRANSACCION": {"TRANSACTION", "TRANS", "TXN", "TRN"},
    "TRANSACCIONES": {"TRANSACTION", "TRANS", "TXN", "TRN"},
    "MOVIMIENTO": {"TRANSACTION", "TRANS", "TXN", "TRN"},
    "MOVIMIENTOS": {"TRANSACTION", "TRANS", "TXN", "TRN"},
    "OPERACION": {"OPERATION", "TRANSACTION", "TXN", "TRN"},
    "OPERACIONES": {"OPERATION", "TRANSACTION", "TXN", "TRN"},
    "DEBITO": {"DEBIT", "DR"},
    "DEBITOS": {"DEBIT", "DR"},
    "CREDITO": {"CREDIT", "CR"},
    "CREDITOS": {"CREDIT", "CR"},
    "PORCENTAJE": {"PERCENT", "RATIO", "COUNT"},
    "MONTO": {"AMOUNT", "AMT"},
    "MONTOS": {"AMOUNT", "AMT"},
    "INSTRUMENTO": {"INSTRUMENT"},
    "INSTRUMENTOS": {"INSTRUMENT"},
    "CLEARING": {"CLEARING", "CLG"},
    "CONCILIACION": {"CLEARING", "CLG", "MATCH"},
    "CHEQUE": {"CHECK", "CHEQUE", "INSTRUMENT"},
    "CHEQUES": {"CHECK", "CHEQUE", "INSTRUMENT"},
    "RECHAZADO": {"REJECT", "REJECTED", "STATUS"},
    "RECHAZADOS": {"REJECT", "REJECTED", "STATUS"},
    "PENDIENTE": {"PENDING", "STATUS", "AUTH"},
    "PENDIENTES": {"PENDING", "STATUS", "AUTH"},
    "INTERES": {"INTEREST", "INT", "RATE"},
    "INTERESES": {"INTEREST", "INT", "RATE"},
    "LIQUIDACION": {"LIQ", "LIQUIDATION"},
    "CALCULO": {"CALC", "CALCULATION"},
    "PROGRAMADO": {"SCHEDULED", "NEXT"},
    "FECHA": {"DATE", "DT"},
    "FECHAS": {"DATE", "DT"},
    "HABIL": {"WORKING", "BUSINESS", "NEXT", "PREV"},
    "FRAUDE": {"FAILED", "STATUS", "REVERSAL", "HIDE"},
    "ANOMALIA": {"FAILED", "STATUS", "REVERSAL", "HIDE"},
    "ANOMALIAS": {"FAILED", "STATUS", "REVERSAL", "HIDE"},
    "OCULTA": {"HIDE", "HIDDEN", "TXN"},
    "OCULTAS": {"HIDE", "HIDDEN", "TXN"},
    "REVERTIDA": {"REVERSAL", "REVERSED", "REV"},
    "REVERTIDAS": {"REVERSAL", "REVERSED", "REV"},
    "AUTORIZO": {"AUTH", "AUTH_ID", "USER"},
    "AUTORIZADO": {"AUTH", "AUTH_STAT"},
    "AUTORIZADAS": {"AUTH", "AUTH_STAT"},
    "TRAZABILIDAD": {"LOG", "TRACE", "DAILY_LOG"},
    "AUDITORIA": {"LOG", "TRACE", "DAILY_LOG"},
    "INACTIVO": {"INACTIVE", "DORMANT", "DORMANCY"},
    "INACTIVOS": {"INACTIVE", "DORMANT", "DORMANCY"},
    "PRODUCTO": {"PRODUCT", "PROD"},
    "PRODUCTOS": {"PRODUCT", "PROD"},
    "COMISION": {"FEE", "CHARGE", "COMMISSION"},
    "COMISIONES": {"FEE", "CHARGE", "COMMISSION"},
    "VOLUMEN": {"VOLUME", "AMOUNT", "COUNT"},
    "CANAL": {"CHANNEL", "SOURCE", "ATM"},
    "CANALES": {"CHANNEL", "SOURCE", "ATM"},
    "CAJERO": {"ATM", "TERM", "TERMINAL"},
    "CAJEROS": {"ATM", "TERM", "TERMINAL"},
    "RETIRO": {"WITHDRAWAL", "WDR", "TRANS_AMOUNT"},
    "RETIROS": {"WITHDRAWAL", "WDR", "TRANS_AMOUNT"},
    "TARJETA": {"CARD", "CARD_NO"},
    "TARJETAS": {"CARD", "CARD_NO"},
    "FALLIDA": {"FAILED", "STATUS"},
    "FALLIDAS": {"FAILED", "STATUS"},
    "HORA": {"HOUR", "TIME"},
    "HORAS": {"HOUR", "TIME"},
    "HISTORICO": {"HISTORICAL", "REAL_DT_TIME"},
    "HISTORICA": {"HISTORICAL", "REAL_DT_TIME"},
    "SEMANA": {"WEEK"},
    "PASADA": {"PREVIOUS"},
}

TRANSACTION_INTENT_TOKENS = {
    "TRANSACCION",
    "TRANSACCIONES",
    "MOVIMIENTO",
    "MOVIMIENTOS",
    "DEBITO",
    "DEBITOS",
    "CREDITO",
    "CREDITOS",
    "DR",
    "CR",
    "DRCR",
}
DRCR_INTENT_TOKENS = {"DEBITO", "DEBITOS", "CREDITO", "CREDITOS", "DR", "CR", "DRCR"}

ACCOUNT_COLUMNS = {"ACCOUNT", "ACCOUNT_NO", "AC_NO", "CUST_AC_NO", "TXN_ACC", "RELATED_ACCOUNT"}
AMOUNT_COLUMNS = {"AMOUNT", "LCY_AMOUNT", "FCY_AMOUNT", "TXN_AMOUNT", "TRANS_AMOUNT", "ACC_CCY_AMT", "INSTRUMENT_AMT"}
DATE_COLUMNS = {"TRN_DT", "VALUE_DATE", "TXN_INIT_DATE", "TRANS_DATE", "BKG_DATE", "BOOK_DATE"}


def _question_has_any(question_tokens: set[str], *tokens: str) -> bool:
    return bool(question_tokens & {token.upper() for token in tokens})


def _is_clearing_intent(question_tokens: set[str]) -> bool:
    if _question_has_any(question_tokens, "CLEARING", "CONCILIACION", "CHEQUE", "CHEQUES"):
        return True
    return (
        _question_has_any(question_tokens, "INSTRUMENTO", "INSTRUMENTOS", "INSTRUMENT")
        and _question_has_any(question_tokens, "MONTO", "MONTOS", "AMOUNT", "AMT")
        and _question_has_any(question_tokens, "CUENTA", "ACCOUNT", "ACC")
    )


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


def _read_lob(value: Any) -> Any:
    return value.read() if hasattr(value, "read") else value


def _json_safe(value: Any) -> Any:
    value = _read_lob(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def _safe_identifier(value: str, *, max_len: int = 128) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned:
        raise ValueError("Identifier is required.")
    if not cleaned[0].isalpha():
        cleaned = f"T_{cleaned}"
    return cleaned[:max_len]


def _qualified_name(owner: str, table_name: str) -> str:
    return f"{_safe_identifier(owner)}.{_safe_identifier(table_name)}"


def _safe_password_literal(value: str) -> str:
    return '"' + str(value).replace('"', '""') + '"'


def _generated_schema_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Ag" + "".join(secrets.choice(alphabet) for _ in range(28))


def _tokenize_for_match(value: str) -> set[str]:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return {token for token in re.split(r"[^A-Z0-9]+", ascii_text.upper()) if token}


def _expanded_question_tokens(question: str) -> set[str]:
    tokens = _tokenize_for_match(question)
    expanded = set(tokens)
    for token in tokens:
        expanded.update(QUESTION_SYNONYMS.get(token, set()))
    return expanded


def _is_transaction_intent(question: str) -> bool:
    return bool(_expanded_question_tokens(question) & TRANSACTION_INTENT_TOKENS)


def _is_drcr_amount_intent(question: str) -> bool:
    return bool(_expanded_question_tokens(question) & DRCR_INTENT_TOKENS)


def _is_velocity_window_intent(question: str) -> bool:
    question_tokens = _expanded_question_tokens(question)
    return _question_has_any(question_tokens, "HORA", "HORAS", "HOUR") and _question_has_any(
        question_tokens, "TRANSACCION", "TRANSACCIONES", "MOVIMIENTO", "MOVIMIENTOS", "TXN", "TRN"
    )


def _uses_current_clock(sql: str) -> bool:
    return bool(re.search(r"\b(SYSTIMESTAMP|SYSDATE|CURRENT_DATE|CURRENT_TIMESTAMP)\b", str(sql or ""), re.IGNORECASE))


def _uses_current_clock_for_velocity_sql(sql: str) -> bool:
    value = str(sql or "")
    return _uses_current_clock(value) and bool(re.search(r"\b(REAL_DT_TIME|TXN_INIT_DATE)\b", value, re.IGNORECASE))


def _is_transaction_fact_candidate(table_name: str, columns: list[str]) -> bool:
    column_set = {column.upper() for column in columns}
    has_drcr = "DRCR_IND" in column_set or any("DRCR" in column for column in column_set)
    has_amount = bool(column_set & AMOUNT_COLUMNS) or any(
        token in column for column in column_set for token in ("AMOUNT", "AMT")
    )
    has_account = bool(column_set & ACCOUNT_COLUMNS)
    has_date = bool(column_set & DATE_COLUMNS) or any(column.endswith("_DT") or "DATE" in column for column in column_set)
    is_fact_like = any(token in table_name.upper() for token in ("TRANSACTION", "DAILY_LOG", "STATEMENT", "TELLER", "ATM_TRANS"))
    return has_drcr and has_amount and has_account and has_date and is_fact_like


def _sql_generation_hints(question: str) -> str:
    question_tokens = _expanded_question_tokens(question)
    hints: list[str] = []
    if _question_has_any(question_tokens, "DEBITO", "DEBITOS", "CREDITO", "CREDITOS", "DR", "CR"):
        hints.append("For debit and credit movement analysis, DRCR_IND='D' means debit and DRCR_IND='C' means credit.")
    if _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE") and _question_has_any(
        question_tokens, "PROMEDIO", "PROMEDIOS", "AVERAGE", "AVG"
    ):
        hints.append(
            "For average balance by branch and currency, use FLEX_ACTB_ACCBAL_HISTORY with BRANCH_CODE, ACC_CCY, ACY_CLOSING_BAL, and BKG_DATE. "
            "For 'este mes' or current month, filter BKG_DATE from TRUNC(SYSDATE,'MM') inclusive to ADD_MONTHS(TRUNC(SYSDATE,'MM'),1) exclusive; do not filter by account opening dates."
        )
    if _question_has_any(question_tokens, "OCULTA", "OCULTAS", "HIDE", "HIDDEN"):
        hints.append("Hidden statement transactions are identified by HIDE_TXN_IN_STMT='Y'.")
    if _is_velocity_window_intent(question):
        hints.append(
            "For velocity anomalies such as more than N transactions in less than one hour, scan the historical dataset by account using REAL_DT_TIME or TXN_INIT_DATE; never filter relative to SYSTIMESTAMP or SYSDATE. "
            "Use a grouped historical window shape: GROUP BY ACCOUNT_NO, TRUNC(REAL_DT_TIME) HAVING COUNT(*) > N AND (MAX(REAL_DT_TIME) - MIN(REAL_DT_TIME)) * 24 < 1."
        )
    if _question_has_any(question_tokens, "SEMANA", "WEEK") and _question_has_any(question_tokens, "PASADA", "PREVIOUS"):
        hints.append(
            "For 'semana pasada', use the previous ISO calendar week: TRN_DT >= TRUNC(SYSDATE,'IW') - 7 and TRN_DT < TRUNC(SYSDATE,'IW')."
        )
    if _question_has_any(question_tokens, "AUTORIZO", "AUTORIZ", "AUTH", "AUDITORIA", "TRAZABILIDAD"):
        hints.append("In accounting daily logs, AUTH_ID is the authorizer and TRN_REF_NO is the transaction reference.")
    if _question_has_any(question_tokens, "ATM", "CAJERO", "CAJEROS", "TARJETA", "TARJETAS", "RETIRO", "RETIROS"):
        hints.append("In ATM logs, TRANS_STATUS='F' means failed, TRANS_CODE='WDR' means withdrawal, and CARD_NO stores the card number.")
    if _is_clearing_intent(question_tokens):
        hints.append("In clearing tables, STATUS='PEND' means pending and STATUS='REJ' means rejected.")
        hints.append("For clearing amount differences, compare ACC_CCY_AMT with INSTRUMENT_AMT.")
    if _question_has_any(question_tokens, "INTERES", "INTERESES", "LIQUIDACION", "CALCULO"):
        hints.append("For account interest processing, FLEX_ICTB_ACC_PR.ACC is the account and LAST_LIQ_DT is the last liquidation date.")
    if _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS"):
        hints.append("For operating dates, FLEX_STTM_DATES.NEXT_WORKING_DAY is the next business day.")
    if _question_has_any(question_tokens, "CLIENTE", "CUSTOMER", "CUST"):
        hints.append("For external account transactions, RELATED_CUSTOMER stores the customer id.")
    if _question_has_any(question_tokens, "PRODUCTO", "PRODUCTOS", "PRODUCT", "PROD") and _question_has_any(
        question_tokens, "VOLUMEN", "TRANSACCION", "TRANSACCIONES", "TXN"
    ):
        hints.append(
            "For product transaction volume, rank PRODUCT_CODE by COUNT(TXN_ID) from FLEX_EXT_ACCOUNT_TRANSACTIONS unless the user explicitly asks for monetary amount."
        )
    return " ".join(hints)


def _score_source_match(question: str, table_name: str, columns: list[str]) -> int:
    question_upper = str(question or "").upper()
    question_tokens = _expanded_question_tokens(question)
    column_set = {column.upper() for column in columns}
    table_upper = table_name.upper()
    score = 0
    if table_upper in question_upper:
        score += 1000
    if _question_has_any(question_tokens, "ATM", "CAJERO", "CAJEROS", "TARJETA", "TARJETAS", "RETIRO", "RETIROS"):
        score += 3200 if "ATM_TRANS_LOG" in table_upper else -250
    if _is_clearing_intent(question_tokens):
        score += 3200 if "CLEARING" in table_upper else -250
    if _question_has_any(question_tokens, "INTERES", "INTERESES", "LIQUIDACION", "CALCULO"):
        if table_upper in {"FLEX_ICTB_ACC_PR", "FLEX_ICTM_PR_INT"} or "ICTB_ACC_PR" in table_upper:
            score += 3200
    if _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS") and "STTM_DATES" in table_upper:
        score += 3600
    if _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE") and (
        "ACCBAL_HISTORY" in table_upper or "ACY_CLOSING_BAL" in column_set
    ):
        score += 3400
    if _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE") and _question_has_any(
        question_tokens, "PROMEDIO", "PROMEDIOS", "AVERAGE", "AVG"
    ):
        score += 2400 if "ACCBAL_HISTORY" in table_upper else -300
    if _question_has_any(question_tokens, "AUTORIZO", "AUDITORIA", "TRAZABILIDAD", "AUTH") and "DAILY_LOG" in table_upper:
        score += 3200
    if _question_has_any(question_tokens, "OCULTA", "OCULTAS", "HIDE", "HIDDEN") and (
        "HIDE_TXN_IN_STMT" in column_set or "ACCOUNT_STATEMENT" in table_upper
    ):
        score += 3200
    if _question_has_any(question_tokens, "PRODUCTO", "PRODUCTOS", "PRODUCT", "PROD", "VOLUMEN") and "EXT_ACCOUNT_TRANSACTIONS" in table_upper:
        score += 1800
    table_tokens = _tokenize_for_match(table_name)
    score += 25 * len(question_tokens & table_tokens)
    for column_name in columns:
        upper_column = column_name.upper()
        if upper_column in question_upper:
            score += 80
        score += 8 * len(question_tokens & _tokenize_for_match(upper_column))

    is_transaction_question = bool(question_tokens & TRANSACTION_INTENT_TOKENS)
    if is_transaction_question:
        has_drcr = "DRCR_IND" in column_set or any("DRCR" in column for column in column_set)
        has_amount = bool(column_set & AMOUNT_COLUMNS) or any(token in column for column in column_set for token in ("AMOUNT", "AMT"))
        has_account = bool(column_set & ACCOUNT_COLUMNS)
        has_date = bool(column_set & DATE_COLUMNS) or any(column.endswith("_DT") or "DATE" in column for column in column_set)
        is_fact_like = any(token in table_upper for token in ("TRANSACTION", "DAILY_LOG", "STATEMENT", "TELLER", "ATM_TRANS"))

        if has_drcr:
            score += 420
        if has_amount:
            score += 260
        if has_account:
            score += 180
        if has_date:
            score += 140
        if is_fact_like:
            score += 280
        if has_drcr and has_amount and has_account and has_date:
            score += 320
        if "EXT_ACCOUNT_TRANSACTIONS" in table_upper:
            score += 1500
        if "EXT_ACCOUNT_STATEMENT" in table_upper:
            score += 700
        if "TELLER" in table_upper and "TELLER" not in question_tokens:
            score -= 750
        if not has_drcr and {"DEBITO", "DEBITOS", "CREDITO", "CREDITOS"} & question_tokens:
            score -= 260
        if "CUST_ACCOUNT" in table_upper and not has_drcr:
            score -= 220
    return score


class SelectAIAnalyticsService:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.config_service = ConfigService(db_manager)

    def _profile_name(self) -> str:
        return self.config_service.get_value("select_ai.profile_name", DEFAULT_PROFILE).strip() or DEFAULT_PROFILE

    def _connection(self):
        return self.db_manager.get_connection()

    def _connect_as(self, *, user: str, password: str):
        config = self.db_manager.resolve_connection_config(user=user, password=password)
        kwargs: dict[str, Any] = {
            "user": config["user"],
            "password": config["password"],
            "dsn": config["dsn"],
        }
        if config.get("wallet_path"):
            kwargs["config_dir"] = config["wallet_path"]
            kwargs["wallet_location"] = config["wallet_path"]
        if config.get("wallet_password"):
            kwargs["wallet_password"] = config["wallet_password"]
        return oracledb.connect(**kwargs)

    @staticmethod
    def _assert_data_schema(schema_name: str) -> str:
        owner_name = _safe_identifier(schema_name)
        if owner_name == APP_SCHEMA:
            raise ValueError("APP_AGENT is reserved for application tables. Choose or create a separate data schema.")
        if owner_name.startswith(("SYS", "ORDS", "APEX_", "MDSYS", "CTXSYS", "XDB")):
            raise ValueError(f"{owner_name} is not an allowed data schema.")
        return owner_name

    def schema_exists(self, schema_name: str) -> bool:
        owner_name = _safe_identifier(schema_name)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM all_users WHERE username = :schema_name",
                schema_name=owner_name,
            )
            row = cursor.fetchone()
            return bool(row and int(row[0] or 0) > 0)
        finally:
            cursor.close()
            conn.close()

    def list_schemas(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            try:
                cursor.execute(
                    """
                    SELECT username
                    FROM all_users
                    WHERE oracle_maintained = 'N'
                    ORDER BY username
                    """
                )
            except Exception:
                cursor.execute(
                    """
                    SELECT username
                    FROM all_users
                    WHERE username NOT LIKE 'SYS%'
                      AND username NOT LIKE 'APEX\\_%' ESCAPE '\\'
                      AND username NOT IN ('XDB', 'ORDS_METADATA', 'ORDS_PUBLIC_USER', 'MDSYS', 'CTXSYS')
                    ORDER BY username
                    """
                )
            existing_schemas = [str(row[0]).upper() for row in cursor.fetchall()]
            schemas = list(existing_schemas)
            if DEFAULT_DATA_SCHEMA not in schemas:
                schemas.insert(0, DEFAULT_DATA_SCHEMA)
            source_counts: dict[str, int] = {}
            cursor.execute(
                """
                SELECT owner_name, COUNT(*)
                FROM data_sources
                GROUP BY owner_name
                """
            )
            for owner_name, count in cursor.fetchall():
                source_counts[str(owner_name).upper()] = int(count or 0)
            return [
                {
                    "schema_name": schema,
                    "exists": self._schema_name_exists_in_list(schema, existing_schemas),
                    "is_app_schema": schema == APP_SCHEMA,
                    "source_count": source_counts.get(schema, 0),
                }
                for schema in schemas
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _schema_name_exists_in_list(schema_name: str, schemas: list[str]) -> bool:
        return schema_name in {schema.upper() for schema in schemas}

    def create_data_schema(self, schema_name: str, *, include_password: bool = False) -> dict[str, Any]:
        owner_name = self._assert_data_schema(schema_name)
        if self.schema_exists(owner_name):
            return {"schema_name": owner_name, "created": False}
        password = _generated_schema_password()
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"CREATE USER {owner_name} IDENTIFIED BY {_safe_password_literal(password)} "
                "DEFAULT TABLESPACE USERS QUOTA UNLIMITED ON USERS"
            )
            cursor.execute(f"GRANT CREATE SESSION TO {owner_name}")
            cursor.execute(f"GRANT CREATE TABLE TO {owner_name}")
            conn.commit()
            result: dict[str, Any] = {"schema_name": owner_name, "created": True}
            if include_password:
                result["password"] = password
            return result
        except Exception as exc:
            conn.rollback()
            raise ValueError(
                f"Could not create schema {owner_name}. APP_AGENT needs CREATE USER privileges or the schema must be created by an administrator."
            ) from exc
        finally:
            cursor.close()
            conn.close()

    def _create_select_ai_conversation(self, *, title: str) -> str:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            output_var = cursor.var(oracledb.STRING)
            attributes = json.dumps(
                {
                    "title": str(title or "APP_AGENT Analytics")[:120],
                    "retention_days": 7,
                    "conversation_length": 10,
                },
                ensure_ascii=False,
            )
            cursor.execute(
                """
                BEGIN
                    :out_value := DBMS_CLOUD_AI.CREATE_CONVERSATION(
                        attributes => :attributes_json
                    );
                END;
                """,
                out_value=output_var,
                attributes_json=attributes,
            )
            return normalize_conversation_id(str(output_var.getvalue() or ""))
        finally:
            cursor.close()
            conn.close()

    def _generate(
        self,
        *,
        prompt: str,
        action: str,
        profile_name: str | None = None,
        conversation_id: str | None = None,
    ) -> str:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            output_var = cursor.var(oracledb.CLOB)
            params = json.dumps({"conversation_id": conversation_id}, ensure_ascii=False) if conversation_id else None
            cursor.execute(
                """
                BEGIN
                    :out_value := DBMS_CLOUD_AI.GENERATE(
                        prompt       => :prompt,
                        profile_name => :profile_name,
                        action       => :action,
                        params       => :params_json
                    );
                END;
                """,
                out_value=output_var,
                prompt=str(prompt or "").strip(),
                profile_name=profile_name or self._profile_name(),
                action=action,
                params_json=params,
            )
            return str(_read_lob(output_var.getvalue()) or "").strip()
        finally:
            cursor.close()
            conn.close()

    def generate_sql(
        self,
        question: str,
        *,
        conversation_id: str | None = None,
        profile_name: str | None = None,
    ) -> str:
        showsql_prompt = (
            "Return exactly one Oracle SQL SELECT statement for the user question. "
            "Do not include markdown fences, comments, explanations, DML, DDL, PL/SQL, or a trailing semicolon. "
            "Use only the tables and columns available in the Select AI profile object list. "
            f"{_sql_generation_hints(question)} "
            f"User question: {question}"
        )
        sql = self._generate(
            prompt=showsql_prompt,
            action="showsql",
            conversation_id=conversation_id,
            profile_name=profile_name,
        )
        safe_sql = validate_read_only_select(sql)
        if (
            _is_velocity_window_intent(question)
            and _uses_current_clock(safe_sql)
        ) or _uses_current_clock_for_velocity_sql(safe_sql):
            correction_prompt = (
                f"{showsql_prompt} "
                "The previous generated SQL was invalid because it filtered against the current system clock. "
                "Regenerate one SELECT statement only. Do not use SYSTIMESTAMP, SYSDATE, CURRENT_DATE, or CURRENT_TIMESTAMP. "
                "Find historical one-hour windows by grouping records from FLEX_EXT_ACCOUNT_TRANSACTIONS with REAL_DT_TIME."
            )
            safe_sql = validate_read_only_select(
                self._generate(
                    prompt=correction_prompt,
                    action="showsql",
                    conversation_id=conversation_id,
                    profile_name=profile_name,
                )
            )
            if _uses_current_clock_for_velocity_sql(safe_sql):
                raise ValueError(
                    "Select AI generated a current-time filter for a historical velocity question. "
                    "The SQL was rejected because it would hide seeded historical anomalies."
                )
        return safe_sql

    def narrate(
        self,
        question: str,
        *,
        conversation_id: str | None = None,
        profile_name: str | None = None,
    ) -> str:
        return self._generate(
            prompt=question,
            action="narrate",
            conversation_id=conversation_id,
            profile_name=profile_name,
        )

    def _registered_source_objects(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT ds.owner_name, ds.table_name, sc.column_name
                FROM data_sources ds
                LEFT JOIN source_columns sc
                    ON sc.data_source_id = ds.data_source_id
                WHERE ds.status = 'active'
                  AND ds.access_scope = 'all'
                  AND ds.owner_name <> :app_schema
                ORDER BY ds.owner_name, ds.table_name, sc.ordinal_position
                """,
                app_schema=APP_SCHEMA,
            )
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
        finally:
            cursor.close()
            conn.close()

    def resolve_scoped_objects(self, question: str, *, limit: int = SCOPED_PROFILE_LIMIT) -> list[dict[str, str]]:
        objects = self._registered_source_objects()
        if not objects:
            raise ValueError("No active data sources are registered for Select AI.")
        question_upper = str(question or "").upper()
        question_tokens = _expanded_question_tokens(question)
        exact_matches = [
            {"owner": item["owner"], "name": item["name"]}
            for item in objects
            if item["name"] in question_upper
        ]
        if exact_matches:
            return exact_matches[:limit]

        preferred_objects: list[dict[str, str]] = []
        if _question_has_any(question_tokens, "ATM", "CAJERO", "CAJEROS", "TARJETA", "TARJETAS", "RETIRO", "RETIROS"):
            preferred_objects = _objects_named(objects, "FLEX_IFTB_ATM_TRANS_LOG")
        elif _is_clearing_intent(question_tokens):
            preferred_objects = _objects_named(objects, "FLEX_CSTB_CLEARING_MASTER")
        elif _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS") and _question_has_any(
            question_tokens, "FECHA", "FECHAS", "DATE", "DT", "SUCURSAL", "BRANCH"
        ):
            preferred_objects = _objects_named(objects, "FLEX_STTM_DATES")
        elif _question_has_any(question_tokens, "INTERES", "INTERESES", "LIQUIDACION", "CALCULO"):
            if _question_has_any(question_tokens, "CUENTA", "ACCOUNT", "ACC"):
                preferred_objects = _objects_named(objects, "FLEX_ICTB_ACC_PR")
            else:
                preferred_objects = _objects_named(objects, "FLEX_ICTB_ACC_PR", "FLEX_ICTM_PR_INT")
        elif _question_has_any(question_tokens, "AUTORIZO", "AUDITORIA", "TRAZABILIDAD", "AUTH"):
            preferred_objects = _objects_named(objects, "FLEX_ACTB_DAILY_LOG_1", "FLEX_ACTB_DAILY_LOG_2")
        elif _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE") and (
            "CIERRE" in question_upper
            or "CLOSING" in question_upper
            or _question_has_any(question_tokens, "PROMEDIO", "PROMEDIOS", "AVERAGE", "AVG")
        ):
            preferred_objects = _objects_named(objects, "FLEX_ACTB_ACCBAL_HISTORY")
        elif _question_has_any(question_tokens, "OCULTA", "OCULTAS", "HIDE", "HIDDEN"):
            preferred_objects = _objects_named(objects, "FLEX_EXT_ACCOUNT_STATEMENT", "FLEX_EXT_ACCOUNT_TRANSACTIONS")
        elif _question_has_any(
            question_tokens,
            "TRANSACCION",
            "TRANSACCIONES",
            "MOVIMIENTO",
            "MOVIMIENTOS",
            "DEBITO",
            "DEBITOS",
            "CREDITO",
            "CREDITOS",
            "PRODUCTO",
            "PRODUCTOS",
            "VOLUMEN",
            "FRAUDE",
            "ANOMALIA",
            "ANOMALIAS",
            "INUSUAL",
        ):
            preferred_objects = _objects_named(objects, "FLEX_EXT_ACCOUNT_TRANSACTIONS")

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
        cursor.execute(
            """
            SELECT config_key, config_value
            FROM config
            WHERE config_key IN (
                'genai.model',
                'select_ai.credential_name',
                'oci.region',
                'oci.compartment_id'
            )
            """
        )
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
            cursor.callproc("DBMS_CLOUD_AI.DROP_PROFILE", [profile_name, True])
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
        conn = self._connection()
        cursor = conn.cursor()
        try:
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
        finally:
            cursor.close()
            conn.close()

    def drop_scoped_profile(self, profile_name: str) -> None:
        if not profile_name.startswith(f"{self._profile_name()}_Q_"):
            return
        conn = self._connection()
        cursor = conn.cursor()
        try:
            self._drop_profile(cursor, profile_name)
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def execute_select(self, sql: str, *, max_rows: int = 500) -> tuple[list[str], list[dict[str, Any]]]:
        safe_sql = validate_read_only_select(sql)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(safe_sql)
            columns = [str(desc[0]).upper() for desc in cursor.description or []]
            rows: list[dict[str, Any]] = []
            for raw_row in cursor.fetchmany(size=max_rows):
                rows.append({column: _json_safe(value) for column, value in zip(columns, raw_row)})
            return columns, rows
        finally:
            cursor.close()
            conn.close()

    def ask(
        self,
        *,
        question: str,
        max_rows: int = 500,
        conversation_id: str | None = None,
        user_id: int = 0,
    ) -> dict[str, Any]:
        if not str(question or "").strip():
            raise ValueError("Question is required.")
        resolved_conversation_id = (
            normalize_conversation_id(conversation_id)
            if conversation_id
            else self._create_select_ai_conversation(title=question)
        )
        scoped_profile_name, scoped_objects = self.create_scoped_profile(question)
        try:
            sql = self.generate_sql(
                question,
                conversation_id=resolved_conversation_id,
                profile_name=scoped_profile_name,
            )
            columns, rows = self.execute_select(sql, max_rows=max_rows)
            answer = self.narrate(
                question,
                conversation_id=resolved_conversation_id,
                profile_name=scoped_profile_name,
            )
            chart_spec = validate_chart_spec(
                infer_chart_spec(rows, columns, title=question[:120] or "Resultado analitico"),
                columns,
            )
            run_id = self.record_question_run(
                question=question,
                sql=sql,
                answer=answer,
                row_count=len(rows),
                chart_spec=chart_spec,
                conversation_id=resolved_conversation_id,
                user_id=user_id,
                profile_name=scoped_profile_name,
            )
        finally:
            self.drop_scoped_profile(scoped_profile_name)
        return {
            "run_id": run_id,
            "conversation_id": resolved_conversation_id,
            "answer": answer,
            "sql": sql,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "chart_spec": chart_spec,
            "agent_trace": [
                {
                    "stage": "select_ai.scope_profile",
                    "status": "completed",
                    "profile_name": scoped_profile_name,
                    "objects": scoped_objects,
                },
                {"stage": "select_ai.showsql", "status": "completed"},
                {"stage": "oracle.execute_select", "status": "completed", "rows": len(rows)},
                {"stage": "select_ai.narrate", "status": "completed"},
                {"stage": "chart_spec.infer", "status": "completed"},
            ],
        }

    def list_conversations(
        self,
        *,
        user_id: int = 0,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        normalized_search = str(search or "").strip().lower()
        search_filter = f"%{normalized_search}%" if normalized_search else None
        safe_limit = max(1, min(int(limit or 50), 100))
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT *
                FROM (
                    SELECT
                        c.conversation_id,
                        c.title,
                        c.created_at,
                        c.updated_at,
                        (
                            SELECT COUNT(*)
                            FROM question_runs qr
                            WHERE qr.conversation_id = c.conversation_id
                        ) AS turns,
                        (
                            SELECT DBMS_LOB.SUBSTR(qr.question_text, 240, 1)
                            FROM question_runs qr
                            WHERE qr.conversation_id = c.conversation_id
                            ORDER BY qr.created_at DESC
                            FETCH FIRST 1 ROW ONLY
                        ) AS last_message_preview
                    FROM analytics_conversations c
                    WHERE c.conversation_type = 'analytics'
                      AND (:user_id = 0 OR c.created_by_user_id IN (:user_id, 0))
                      AND (
                        :search_filter IS NULL
                        OR LOWER(c.title) LIKE :search_filter
                        OR EXISTS (
                            SELECT 1
                            FROM question_runs qr
                            WHERE qr.conversation_id = c.conversation_id
                              AND (
                                LOWER(DBMS_LOB.SUBSTR(qr.question_text, 1000, 1)) LIKE :search_filter
                                OR LOWER(DBMS_LOB.SUBSTR(qr.answer_text, 1000, 1)) LIKE :search_filter
                              )
                        )
                      )
                    ORDER BY c.updated_at DESC, c.created_at DESC
                )
                WHERE ROWNUM <= :limit_value
                """,
                user_id=int(user_id or 0),
                search_filter=search_filter,
                limit_value=safe_limit,
            )
            columns = [desc[0].lower() for desc in cursor.description or []]
            return [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    def get_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
        max_rows: int = 500,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT conversation_id, title, created_at, updated_at
                FROM analytics_conversations
                WHERE conversation_id = :conversation_id
                  AND conversation_type = 'analytics'
                  AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            )
            conversation = cursor.fetchone()
            if not conversation:
                raise ValueError("Conversation was not found.")

            cursor.execute(
                """
                SELECT
                    question_run_id,
                    profile_name,
                    question_text,
                    generated_sql,
                    answer_text,
                    row_count,
                    chart_spec_json,
                    status,
                    created_at
                FROM question_runs
                WHERE conversation_id = :conversation_id
                ORDER BY created_at ASC
                """,
                conversation_id=resolved_conversation_id,
            )
            run_columns = [desc[0].lower() for desc in cursor.description or []]
            runs = [
                {column: _json_safe(value) for column, value in zip(run_columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

        messages: list[dict[str, Any]] = []
        safe_max_rows = max(1, min(int(max_rows or 500), 5000))
        for run in runs:
            sql = validate_read_only_select(str(run.get("generated_sql") or ""))
            columns, rows = self.execute_select(sql, max_rows=safe_max_rows)
            raw_chart_spec = run.get("chart_spec_json")
            chart_spec = json.loads(str(raw_chart_spec or "{}"))
            chart_spec = validate_chart_spec(chart_spec, columns)
            messages.append(
                {
                    "run_id": str(run.get("question_run_id") or ""),
                    "question": str(run.get("question_text") or ""),
                    "created_at": run.get("created_at"),
                    "result": {
                        "run_id": str(run.get("question_run_id") or ""),
                        "conversation_id": resolved_conversation_id,
                        "answer": str(run.get("answer_text") or ""),
                        "sql": sql,
                        "columns": columns,
                        "rows": rows,
                        "row_count": len(rows),
                        "chart_spec": chart_spec,
                        "agent_trace": [
                            {
                                "stage": "history.restore_select",
                                "status": "completed",
                                "rows": len(rows),
                            }
                        ],
                    },
                }
            )

        return {
            "conversation_id": str(conversation[0] or resolved_conversation_id),
            "title": str(conversation[1] or "Analytics chat"),
            "created_at": _json_safe(conversation[2]),
            "updated_at": _json_safe(conversation[3]),
            "messages": messages,
        }

    def delete_conversation(
        self,
        *,
        conversation_id: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM analytics_conversations
                WHERE conversation_id = :conversation_id
                  AND conversation_type = 'analytics'
                  AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            )
            row = cursor.fetchone()
            if not row or int(row[0] or 0) != 1:
                raise ValueError("Conversation was not found.")
            cursor.execute(
                """
                DELETE FROM question_runs
                WHERE conversation_id = :conversation_id
                """,
                conversation_id=resolved_conversation_id,
            )
            deleted_runs = int(cursor.rowcount or 0)
            cursor.execute(
                """
                DELETE FROM analytics_conversations
                WHERE conversation_id = :conversation_id
                  AND conversation_type = 'analytics'
                """,
                conversation_id=resolved_conversation_id,
            )
            deleted_conversations = int(cursor.rowcount or 0)
            if deleted_conversations != 1:
                raise ValueError("Conversation was not deleted.")
            conn.commit()
            return {
                "conversation_id": resolved_conversation_id,
                "deleted": True,
                "deleted_runs": deleted_runs,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def rename_conversation(
        self,
        *,
        conversation_id: str,
        title: str,
        user_id: int = 0,
    ) -> dict[str, Any]:
        resolved_conversation_id = normalize_conversation_id(conversation_id)
        normalized_title = str(title or "").strip()[:500]
        if not normalized_title:
            raise ValueError("Conversation title is required.")
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE analytics_conversations
                   SET title = :title,
                       updated_at = SYSDATE
                 WHERE conversation_id = :conversation_id
                   AND conversation_type = 'analytics'
                   AND (:user_id = 0 OR created_by_user_id IN (:user_id, 0))
                """,
                title=normalized_title,
                conversation_id=resolved_conversation_id,
                user_id=int(user_id or 0),
            )
            if int(cursor.rowcount or 0) != 1:
                raise ValueError("Conversation was not found.")
            cursor.execute(
                """
                SELECT
                    c.conversation_id,
                    c.title,
                    c.created_at,
                    c.updated_at,
                    (
                        SELECT COUNT(*)
                        FROM question_runs qr
                        WHERE qr.conversation_id = c.conversation_id
                    ) AS turns,
                    (
                        SELECT DBMS_LOB.SUBSTR(qr.question_text, 240, 1)
                        FROM question_runs qr
                        WHERE qr.conversation_id = c.conversation_id
                        ORDER BY qr.created_at DESC
                        FETCH FIRST 1 ROW ONLY
                    ) AS last_message_preview
                FROM analytics_conversations c
                WHERE c.conversation_id = :conversation_id
                  AND c.conversation_type = 'analytics'
                """,
                conversation_id=resolved_conversation_id,
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Conversation was not found.")
            conn.commit()
            return {
                "conversation_id": str(row[0] or resolved_conversation_id),
                "title": str(row[1] or normalized_title),
                "created_at": _json_safe(row[2]),
                "updated_at": _json_safe(row[3]),
                "turns": int(row[4] or 0),
                "last_message_preview": str(row[5] or ""),
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def record_question_run(
        self,
        *,
        question: str,
        sql: str,
        answer: str,
        row_count: int,
        chart_spec: dict[str, Any],
        conversation_id: str,
        user_id: int = 0,
        profile_name: str | None = None,
    ) -> str:
        run_id = uuid.uuid4().hex
        conn = self._connection()
        cursor = conn.cursor()
        try:
            ensure_conversation(
                cursor,
                conversation_id=conversation_id,
                conversation_type="analytics",
                title=question,
                user_id=user_id,
            )
            # ADB can raise ORA-12860 when the parent conversation MERGE and child
            # question_runs insert are kept in the same transaction under FK checks.
            conn.commit()
            cursor.execute(
                """
                INSERT INTO question_runs (
                    question_run_id, conversation_id, profile_name, question_text, generated_sql,
                    answer_text, row_count, chart_spec_json, status
                ) VALUES (
                    :run_id, :conversation_id, :profile_name, :question, :sql,
                    :answer, :row_count, :chart_spec, 'completed'
                )
                """,
                run_id=run_id,
                conversation_id=conversation_id,
                profile_name=profile_name or self._profile_name(),
                question=question,
                sql=sql,
                answer=answer,
                row_count=row_count,
                chart_spec=json.dumps(chart_spec),
            )
            conn.commit()
            return run_id
        finally:
            cursor.close()
            conn.close()

    def refresh_profile(self, *, user_id: int = 0) -> None:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.callproc("SP_SEL_AI_PROFILE", [self._profile_name(), int(user_id)])
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def list_data_sources(self) -> list[dict[str, Any]]:
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT ds.data_source_id, ds.source_name, ds.source_type, ds.owner_name, ds.table_name,
                       ds.access_scope, ds.row_count, NVL(cc.column_count, 0) AS column_count,
                       ds.status, ds.created_at
                FROM data_sources ds
                LEFT JOIN (
                    SELECT data_source_id, COUNT(*) AS column_count
                    FROM source_columns
                    GROUP BY data_source_id
                ) cc
                    ON cc.data_source_id = ds.data_source_id
                WHERE NOT (ds.owner_name = :app_schema AND ds.source_type = 'csv')
                ORDER BY ds.created_at DESC
                """,
                app_schema=APP_SCHEMA,
            )
            columns = [desc[0].lower() for desc in cursor.description or []]
            return [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _data_source_from_cursor(cursor, data_source_id: str) -> dict[str, Any]:
        cursor.execute(
            """
            SELECT ds.data_source_id, ds.source_name, ds.source_type, ds.owner_name, ds.table_name,
                   ds.access_scope, ds.row_count, NVL(cc.column_count, 0) AS column_count,
                   ds.status, ds.created_at
            FROM data_sources ds
            LEFT JOIN (
                SELECT data_source_id, COUNT(*) AS column_count
                FROM source_columns
                GROUP BY data_source_id
            ) cc
                ON cc.data_source_id = ds.data_source_id
            WHERE ds.data_source_id = :data_source_id
            """,
            data_source_id=str(data_source_id or "").strip(),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("Data source was not found.")
        columns = [desc[0].lower() for desc in cursor.description or []]
        return {column: _json_safe(value) for column, value in zip(columns, row)}

    def preview_data_source_rows(
        self,
        data_source_id: str,
        *,
        limit: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(int(limit or 10), 100))
        safe_offset = max(0, int(offset or 0))
        conn = self._connection()
        cursor = conn.cursor()
        try:
            source = self._data_source_from_cursor(cursor, data_source_id)
            qualified_table = _qualified_name(str(source["owner_name"]), str(source["table_name"]))
            cursor.execute(f"SELECT COUNT(*) FROM {qualified_table}")
            total_row = cursor.fetchone()
            total_rows = int(total_row[0] or 0) if total_row else 0
            cursor.execute(
                f"SELECT * FROM {qualified_table} OFFSET :offset_value ROWS FETCH NEXT :limit_value ROWS ONLY",
                offset_value=safe_offset,
                limit_value=safe_limit,
            )
            columns = [str(desc[0]).upper() for desc in cursor.description or []]
            rows = [
                {column: _json_safe(value) for column, value in zip(columns, row)}
                for row in cursor.fetchall()
            ]
            return {
                "data_source": source,
                "columns": columns,
                "rows": rows,
                "row_count": total_rows,
                "limit": safe_limit,
                "offset": safe_offset,
            }
        except Exception as exc:
            if isinstance(exc, ValueError):
                raise
            raise ValueError(f"Could not preview data source rows: {exc}") from exc
        finally:
            cursor.close()
            conn.close()

    def delete_data_source(self, data_source_id: str, *, user_id: int = 0) -> dict[str, Any]:
        conn = self._connection()
        cursor = conn.cursor()
        dropped_table = False
        source: dict[str, Any] | None = None
        try:
            source = self._data_source_from_cursor(cursor, data_source_id)
            owner_name = str(source["owner_name"])
            table_name = str(source["table_name"])
            source_type = str(source["source_type"]).lower()
            if source_type == "csv":
                try:
                    self._drop_table_if_exists(cursor, table_name, owner_name=owner_name)
                    dropped_table = True
                except Exception as exc:
                    conn.rollback()
                    raise ValueError(
                        f"Could not drop managed CSV table {_qualified_name(owner_name, table_name)}. "
                        "Fix APP_AGENT table privileges or drop the table manually before deleting this source."
                    ) from exc
            cursor.execute(
                "DELETE FROM data_sources WHERE data_source_id = :data_source_id",
                data_source_id=str(data_source_id or "").strip(),
            )
            if int(cursor.rowcount or 0) != 1:
                raise ValueError("Data source was not deleted.")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {
            "data_source_id": str(data_source_id or "").strip(),
            "owner_name": source["owner_name"] if source else "",
            "table_name": source["table_name"] if source else "",
            "source_type": source["source_type"] if source else "",
            "dropped_table": dropped_table,
        }

    def register_existing_table(
        self,
        *,
        owner: str,
        table_name: str,
        display_name: str | None = None,
        access_scope: str = "all",
        user_id: int = 0,
    ) -> dict[str, Any]:
        owner_name = _safe_identifier(owner)
        self._assert_data_schema(owner_name)
        table = _safe_identifier(table_name)
        qualified = _qualified_name(owner_name, table)
        conn = self._connection()
        cursor = conn.cursor()
        try:
            cursor.execute(f"SELECT * FROM {qualified} WHERE 1 = 0")
            cursor.execute(
                """
                SELECT column_name, data_type, data_length, nullable, column_id
                FROM all_tab_columns
                WHERE owner = :owner_name AND table_name = :table_name
                ORDER BY column_id
                """,
                owner_name=owner_name,
                table_name=table,
            )
            columns = cursor.fetchall()
            if not columns:
                raise ValueError(f"Table {qualified} was not found or has no visible columns.")
            data_source_id = uuid.uuid4().hex
            cursor.execute(
                "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
                owner_name=owner_name,
                table_name=table,
            )
            cursor.execute(
                """
                INSERT INTO data_sources (
                    data_source_id, source_name, source_type, owner_name, table_name,
                    access_scope, status, created_by_user_id
                ) VALUES (
                    :id, :name, 'existing_table', :owner_name, :table_name,
                    :scope, 'active', :user_id
                )
                """,
                id=data_source_id,
                name=display_name or qualified,
                owner_name=owner_name,
                table_name=table,
                scope=access_scope,
                user_id=user_id,
            )
            self._replace_source_columns(cursor, data_source_id, columns)
            conn.commit()
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {"data_source_id": data_source_id, "owner_name": owner_name, "table_name": table}

    def create_table_from_csv(
        self,
        *,
        csv_path: Path,
        original_filename: str,
        table_name: str | None,
        target_schema: str | None = DEFAULT_DATA_SCHEMA,
        create_schema: bool = False,
        access_scope: str = "all",
        user_id: int = 0,
    ) -> dict[str, Any]:
        if not csv_path.exists():
            raise ValueError("CSV upload was not saved.")
        owner_name = self._assert_data_schema(target_schema or DEFAULT_DATA_SCHEMA)
        target_password: str | None = None
        if not self.schema_exists(owner_name):
            if not create_schema:
                raise ValueError(f"Schema {owner_name} does not exist. Confirm schema creation before uploading.")
            schema_result = self.create_data_schema(owner_name, include_password=True)
            target_password = str(schema_result.get("password") or "") or None
        target_table = _safe_identifier(table_name or Path(original_filename).stem)
        qualified_table = _qualified_name(owner_name, target_table)
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            fieldnames = [_safe_identifier(field or "") for field in (reader.fieldnames or [])]
            if not fieldnames:
                raise ValueError("CSV must include a header row.")
            rows = [{fieldnames[index]: value for index, value in enumerate(raw.values())} for raw in reader]
        if not rows:
            raise ValueError("CSV must include at least one data row.")

        conn = self._connection()
        cursor = conn.cursor()
        load_job_id = uuid.uuid4().hex
        data_source_id = uuid.uuid4().hex
        try:
            cursor.execute(
                """
                INSERT INTO load_jobs (load_job_id, source_file_name, target_table_name, status)
                VALUES (:id, :source_file_name, :target_table_name, 'running')
                """,
                id=load_job_id,
                source_file_name=original_filename,
                target_table_name=qualified_table,
            )
            if target_password:
                self._load_csv_table_as_owner(
                    owner_name=owner_name,
                    password=target_password,
                    table_name=target_table,
                    fieldnames=fieldnames,
                    rows=rows,
                )
            else:
                try:
                    self._drop_table_if_exists(cursor, target_table, owner_name=owner_name)
                    ddl_columns = ", ".join(f"{column} VARCHAR2(4000)" for column in fieldnames)
                    cursor.execute(f"CREATE TABLE {qualified_table} ({ddl_columns})")
                    bind_columns = ", ".join(fieldnames)
                    bind_values = ", ".join(f":{column}" for column in fieldnames)
                    cursor.executemany(
                        f"INSERT INTO {qualified_table} ({bind_columns}) VALUES ({bind_values})",
                        rows,
                    )
                except Exception as exc:
                    if "ORA-01031" in str(exc) or "insufficient privileges" in str(exc).lower():
                        raise ValueError(
                            f"APP_AGENT cannot create or load tables in existing schema {owner_name}. "
                            "Grant the required cross-schema privileges or create a new data schema from this upload."
                        ) from exc
                    raise
            try:
                cursor.execute(f"SELECT * FROM {qualified_table} WHERE 1 = 0")
            except Exception as exc:
                raise ValueError(
                    f"APP_AGENT cannot SELECT from {qualified_table}. Grant SELECT on this table before registering it."
                ) from exc
            cursor.execute(
                "DELETE FROM data_sources WHERE owner_name = :owner_name AND table_name = :table_name",
                owner_name=owner_name,
                table_name=target_table,
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
                table_name=target_table,
                source_file_name=original_filename,
                scope=access_scope,
                row_count=len(rows),
                user_id=user_id,
            )
            column_rows = [(name, "VARCHAR2", 4000, "Y", index + 1) for index, name in enumerate(fieldnames)]
            self._replace_source_columns(cursor, data_source_id, column_rows)
            cursor.execute(
                "UPDATE load_jobs SET status = 'completed', row_count = :row_count WHERE load_job_id = :id",
                row_count=len(rows),
                id=load_job_id,
            )
            conn.commit()
        except Exception as exc:
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
            raise
        finally:
            cursor.close()
            conn.close()
        self.refresh_profile(user_id=user_id)
        return {
            "data_source_id": data_source_id,
            "load_job_id": load_job_id,
            "owner_name": owner_name,
            "table_name": target_table,
            "row_count": len(rows),
        }

    def _load_csv_table_as_owner(
        self,
        *,
        owner_name: str,
        password: str,
        table_name: str,
        fieldnames: list[str],
        rows: list[dict[str, Any]],
    ) -> None:
        conn = self._connect_as(user=owner_name, password=password)
        cursor = conn.cursor()
        try:
            self._drop_table_if_exists(cursor, table_name)
            ddl_columns = ", ".join(f"{column} VARCHAR2(4000)" for column in fieldnames)
            cursor.execute(f"CREATE TABLE {_safe_identifier(table_name)} ({ddl_columns})")
            bind_columns = ", ".join(fieldnames)
            bind_values = ", ".join(f":{column}" for column in fieldnames)
            cursor.executemany(
                f"INSERT INTO {_safe_identifier(table_name)} ({bind_columns}) VALUES ({bind_values})",
                rows,
            )
            cursor.execute(f"GRANT SELECT ON {_safe_identifier(table_name)} TO {APP_SCHEMA}")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def _drop_table_if_exists(cursor, table_name: str, *, owner_name: str | None = None) -> None:
        qualified_table = _qualified_name(owner_name, table_name) if owner_name else _safe_identifier(table_name)
        try:
            cursor.execute(f"DROP TABLE {qualified_table} PURGE")
        except Exception as exc:
            if "ORA-00942" not in str(exc):
                raise

    @staticmethod
    def _replace_source_columns(cursor, data_source_id: str, columns: list[tuple[Any, ...]]) -> None:
        cursor.execute("DELETE FROM source_columns WHERE data_source_id = :id", id=data_source_id)
        for row in columns:
            column_name, data_type, data_length, nullable, column_id = row[:5]
            cursor.execute(
                """
                INSERT INTO source_columns (
                    source_column_id, data_source_id, column_name, data_type,
                    data_length, nullable_flag, ordinal_position
                ) VALUES (
                    :source_column_id, :data_source_id, :column_name, :data_type,
                    :data_length, :nullable_flag, :ordinal_position
                )
                """,
                source_column_id=uuid.uuid4().hex,
                data_source_id=data_source_id,
                column_name=str(column_name).upper(),
                data_type=str(data_type).upper(),
                data_length=int(data_length or 0),
                nullable_flag=str(nullable or "Y")[:1],
                ordinal_position=int(column_id or 0),
            )
