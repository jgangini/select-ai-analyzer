from __future__ import annotations

from pathlib import Path
import json
import re
from typing import Any

from apps.backend.app.select_ai.source_parser import SourceColumn, SourceTable


def normalize_identifier(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_$#]", "_", str(value or "").strip().upper())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    if not cleaned:
        raise ValueError("Column name is required.")
    if not cleaned[0].isalpha():
        cleaned = f"T_{cleaned}"
    return cleaned[:128]


def display_label(value: str) -> str:
    words = re.sub(r"[_-]+", " ", str(value or "").strip()).split()
    return " ".join(word[:1].upper() + word[1:].lower() for word in words)


def _text(value: Any, *, limit: int | None = None) -> str:
    result = str(value or "").strip()
    return result[:limit] if limit else result


def _pick(raw: dict[str, Any], *keys: str) -> Any:
    lowered = {str(key).strip().lower(): value for key, value in raw.items()}
    for key in keys:
        normalized = key.strip().lower()
        if normalized in lowered:
            return lowered[normalized]
    return None


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in {"1", "true", "t", "yes", "y", "si", "s"}


def infer_classification(column: SourceColumn | str, data_type: str | None = None) -> str:
    name = column.name if isinstance(column, SourceColumn) else str(column or "")
    upper_name = name.upper()
    upper_type = (column.data_type if isinstance(column, SourceColumn) else data_type or "").upper()
    if any(token in upper_name for token in ("AMT", "AMOUNT", "BAL", "BALANCE", "LIMIT", "TURNOVER")):
        return "amount"
    if any(token in upper_name for token in ("CCY", "CURRENCY")):
        return "currency"
    if any(token in upper_name for token in ("ACC", "ACCOUNT", "AC_NO", "CUST_AC")):
        return "account"
    if any(token in upper_name for token in ("CUSTOMER", "CUST_NO", "CIF")):
        return "customer"
    if "BRANCH" in upper_name:
        return "branch"
    if any(token in upper_name for token in ("DATE", "_DT", "TIME", "TIMESTAMP")) or upper_type.startswith(("DATE", "TIMESTAMP")):
        return "date"
    if any(token in upper_name for token in ("STATUS", "STAT", "FLAG", "IND")):
        return "status"
    if any(token in upper_name for token in ("REF", "REFERENCE", "TXN_ID", "TRN_REF", "XREF")):
        return "reference"
    if "PRODUCT" in upper_name:
        return "product"
    if any(token in upper_name for token in ("RATE", "PERCENT", "PCT")):
        return "rate"
    if upper_name.endswith("_CODE") or upper_name == "CODE":
        return "code"
    if any(token in upper_name for token in ("USER", "AUTH", "MAKER", "CHECKER")):
        return "audit"
    return ""


def _comment_for_column(table: SourceTable, column: SourceColumn, classification: str) -> str:
    label = display_label(column.name)
    table_label = display_label(table.name)
    table_name = table.name.upper()
    column_name = column.name.upper()
    specific_comments = {
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "DRCR_IND"): "Debit/credit indicator. D means debit and C means credit.",
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "TRN_DT"): "Transaction date used for monthly account movement filters.",
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "REAL_DT_TIME"): "Exact transaction timestamp used for velocity and one-hour window anomaly analysis.",
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "ACCOUNT_NO"): "External account number used to filter customer transactions.",
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "RELATED_CUSTOMER"): "Customer id related to the external account transaction.",
        ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "PRODUCT_CODE"): "Product code used to group transaction volume by product.",
        ("FLEX_EXT_ACCOUNT_STATEMENT", "HIDE_TXN_IN_STMT"): "Hidden statement flag. Y means the transaction is hidden from the statement.",
        ("FLEX_EXT_ACCOUNT_STATEMENT", "AMOUNT"): "Statement transaction amount used for threshold filters.",
        ("FLEX_CSTB_CLEARING_MASTER", "STATUS"): "Clearing status. PEND means pending, REJ means rejected.",
        ("FLEX_CSTB_CLEARING_MASTER", "AUTH_STAT"): "Authorization status. U means unauthorised or pending approval.",
        ("FLEX_CSTB_CLEARING_MASTER", "REFERENCE_NO"): "Clearing transaction reference number.",
        ("FLEX_CSTB_CLEARING_MASTER", "TXN_DATE"): "Clearing transaction business date.",
        ("FLEX_CSTB_CLEARING_MASTER", "ACC_CCY_AMT"): "Account-currency amount used in clearing amount comparisons.",
        ("FLEX_CSTB_CLEARING_MASTER", "INSTRUMENT_AMT"): "Instrument amount used in clearing amount comparisons.",
        ("FLEX_ACTB_DAILY_LOG_1", "AUTH_ID"): "User id that authorized the accounting transaction.",
        ("FLEX_ACTB_DAILY_LOG_2", "AUTH_ID"): "User id that authorized the accounting transaction.",
        ("FLEX_DETB_RTL_TELLER_1", "AUTH_STAT"): "Teller authorization status. U means pending authorization.",
        ("FLEX_DETB_RTL_TELLER_2", "AUTH_STAT"): "Teller authorization status. U means pending authorization.",
        ("FLEX_DETB_RTL_TELLER_1", "MODULE"): "Teller module code. TL identifies teller transactions.",
        ("FLEX_DETB_RTL_TELLER_2", "MODULE"): "Teller module code. TL identifies teller transactions.",
        ("FLEX_DETB_RTL_TELLER_1", "TRN_REF_NO"): "Teller transaction reference number.",
        ("FLEX_DETB_RTL_TELLER_2", "TRN_REF_NO"): "Teller transaction reference number.",
        ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_STATUS"): "ATM transaction status. F means failed and A means approved.",
        ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_DATE"): "ATM transaction date used for today filters.",
        ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_CODE"): "ATM transaction code. WDR means withdrawal.",
        ("FLEX_ICTM_TD_DETAILS", "LIQD_DATE"): "Term deposit maturity or liquidation date used to find the next contract to mature.",
        ("FLEX_ICTW_TD_DETAILS", "LIQD_DATE"): "Term deposit maturity or liquidation date used to find the next contract to mature.",
        ("FLEX_ICTM_TD_DETAILS_ARCHIVE", "LIQD_DATE"): "Historical term deposit maturity or liquidation date.",
        ("FLEX_ICTW_TD_DETAILS_ARCHIVE", "LIQD_DATE"): "Historical term deposit maturity or liquidation date.",
        ("FLEX_ICTM_TD_DETAILS", "REFERENCE_NO"): "Term deposit contract reference number.",
        ("FLEX_ICTW_TD_DETAILS", "REFERENCE_NO"): "Term deposit contract reference number.",
        ("FLEX_ICTM_TD_DETAILS", "TD_AMOUNT"): "Original term deposit principal amount.",
        ("FLEX_ICTW_TD_DETAILS", "TD_AMOUNT"): "Original term deposit principal amount.",
        ("FLEX_ICTM_TD_DETAILS", "TD_MATURITY_AMT"): "Term deposit maturity amount including interest.",
        ("FLEX_ICTW_TD_DETAILS", "TD_MATURITY_AMT"): "Term deposit maturity amount including interest.",
    }
    if (table_name, column_name) in specific_comments:
        return specific_comments[(table_name, column_name)]
    comments = {
        "amount": f"Monetary amount used by {table_label}.",
        "currency": f"Currency code used by {table_label}.",
        "account": f"Account identifier used by {table_label}.",
        "customer": f"Customer identifier used by {table_label}.",
        "branch": f"Branch identifier used by {table_label}.",
        "date": f"Business date or timestamp used by {table_label}.",
        "status": f"Status, flag, or indicator used by {table_label}.",
        "reference": f"Transaction or reference identifier used by {table_label}.",
        "product": f"Product identifier used by {table_label}.",
        "rate": f"Rate or percentage value used by {table_label}.",
        "code": f"Business code used by {table_label}.",
        "audit": f"Audit or authorization user information used by {table_label}.",
    }
    return comments.get(classification, f"{label} attribute for {table_label}.")


def build_source_table_metadata(table: SourceTable, *, owner_name: str = "APP_AGENT_DATA") -> dict[str, Any]:
    columns = []
    for index, column in enumerate(table.columns, start=1):
        classification = infer_classification(column)
        columns.append(
            {
                "column_name": column.name,
                "data_type": column.data_type,
                "nullable": "Y" if column.nullable else "N",
                "ordinal_position": index,
                "comment": _comment_for_column(table, column, classification),
                "ui_display": display_label(column.name),
                "classification": classification,
                "primary_key": False,
            }
        )
    table_comments = {
        "FLEX_EXT_ACCOUNT_TRANSACTIONS": "External account transaction fact table for debits, credits, account movement, product volume, customer activity, and velocity anomaly questions.",
        "FLEX_EXT_ACCOUNT_STATEMENT": "External account statement transaction table with hidden-statement flags and statement amounts.",
        "FLEX_CSTB_CLEARING_MASTER": "Clearing master transaction table. Use STATUS='PEND' for pending clearing and STATUS='REJ' for rejected clearing.",
        "FLEX_DETB_RTL_TELLER_1": "Retail teller transaction table. Use AUTH_STAT='U' and MODULE='TL' to find teller transactions pending authorization.",
        "FLEX_DETB_RTL_TELLER_2": "Retail teller transaction table. Use AUTH_STAT='U' and MODULE='TL' to find teller transactions pending authorization.",
        "FLEX_ICTM_TD_DETAILS": "Term deposit contract detail table. LIQD_DATE is the maturity/liquidation date used to find the next deposit contract to mature.",
        "FLEX_ICTW_TD_DETAILS": "Term deposit contract detail table. LIQD_DATE is the maturity/liquidation date used to find the next deposit contract to mature.",
        "FLEX_IFTB_ATM_TRANS_LOG": "ATM transaction log. Use TRANS_STATUS='F' for failed ATM transactions and TRANS_DATE for today filters.",
        "FLEX_ACTB_ACCBAL_HISTORY": "Account balance history table for closing balance and average balance by branch and currency.",
        "FLEX_ACTB_DAILY_LOG_1": "Accounting daily log table with authorization audit fields such as AUTH_ID and TRN_REF_NO.",
        "FLEX_ACTB_DAILY_LOG_2": "Accounting daily log table with authorization audit fields such as AUTH_ID and TRN_REF_NO.",
        "FLEX_STTM_DATES": "Branch operating date table. NEXT_WORKING_DAY stores the next business day for a branch.",
        "FLEX_ICTB_ACC_PR": "Account interest processing table. LAST_LIQ_DT stores the last interest liquidation date.",
    }
    return {
        "owner_name": owner_name,
        "table_name": table.name,
        "source_file_name": f"{table.name}.csv",
        "table_comment": table_comments.get(
            table.name.upper(),
            f"{display_label(table.name)} source data generated from .source.",
        ),
        "columns": columns,
    }


def parse_metadata_payload(raw_payload: Any) -> tuple[str | None, list[dict[str, Any]]]:
    table_comment: str | None = None
    raw_columns: Any = raw_payload
    if isinstance(raw_payload, dict):
        table_comment = _text(
            _pick(raw_payload, "table_comment", "tableComment", "table comment", "description", "table_description"),
            limit=1000,
        ) or None
        raw_columns = _pick(raw_payload, "columns", "data_dictionary", "dataDictionary", "fields", "items")
        if raw_columns is None and _pick(raw_payload, "column_name", "Column Name", "name", "column"):
            raw_columns = [raw_payload]
    if not isinstance(raw_columns, list):
        raise ValueError("Metadata JSON must be an object with columns or an array of columns.")

    columns: list[dict[str, Any]] = []
    for index, raw_column in enumerate(raw_columns, start=1):
        if not isinstance(raw_column, dict):
            continue
        raw_name = _pick(raw_column, "column_name", "columnName", "Column Name", "name", "column", "field")
        if not raw_name:
            continue
        column_name = normalize_identifier(str(raw_name))
        ordinal_position = _pick(raw_column, "ordinal_position", "ordinalPosition", "position", "order")
        data_length = _pick(raw_column, "data_length", "dataLength", "length")
        column = {
            "column_name": column_name,
            "data_type": _text(_pick(raw_column, "data_type", "dataType", "Type"), limit=128) or None,
            "data_length": int(data_length or 0) if str(data_length or "").strip().isdigit() else None,
            "nullable": _text(_pick(raw_column, "nullable", "nullable_flag", "nullableFlag"), limit=1) or None,
            "ordinal_position": int(ordinal_position or index)
            if str(ordinal_position or index).strip().isdigit()
            else index,
            "comment": _text(_pick(raw_column, "comment", "Comment", "description"), limit=1000),
            "ui_display": _text(_pick(raw_column, "ui_display", "uiDisplay", "UI_Display", "UI Display"), limit=255),
            "classification": _text(_pick(raw_column, "classification", "Classification", "data_class"), limit=100),
            "primary_key": _boolish(_pick(raw_column, "primary_key", "primaryKey", "Primary Key", "PK", "pk")),
        }
        columns.append({key: value for key, value in column.items() if value is not None})
    return table_comment, columns


def read_metadata_sidecar(path: Path) -> tuple[str | None, list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return parse_metadata_payload(payload)


def write_metadata_sidecar(table: SourceTable, destination: Path, *, owner_name: str = "APP_AGENT_DATA") -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = build_source_table_metadata(table, owner_name=owner_name)
    destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return destination
