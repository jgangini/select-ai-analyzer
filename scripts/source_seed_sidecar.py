from __future__ import annotations

from pathlib import Path
import json
import re
from typing import Any

from apps.backend.app.select_ai.metadata_payload import parse_metadata_payload
from scripts.source_seed_parser import SourceColumn, SourceTable


def display_label(value: str) -> str:
    words = re.sub(r"[_-]+", " ", str(value or "").strip()).split()
    return " ".join(word[:1].upper() + word[1:].lower() for word in words)


def _name_has_any(upper_name: str, *tokens: str) -> bool:
    return any(token in upper_name for token in tokens)


SPECIFIC_COLUMN_COMMENTS: dict[tuple[str, str], str] = {
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

CLASSIFICATION_COMMENT_TEMPLATES: dict[str, str] = {
    "amount": "Monetary amount used by {table_label}.",
    "currency": "Currency code used by {table_label}.",
    "account": "Account identifier used by {table_label}.",
    "customer": "Customer identifier used by {table_label}.",
    "branch": "Branch identifier used by {table_label}.",
    "date": "Business date or timestamp used by {table_label}.",
    "status": "Status, flag, or indicator used by {table_label}.",
    "reference": "Transaction or reference identifier used by {table_label}.",
    "product": "Product identifier used by {table_label}.",
    "rate": "Rate or percentage value used by {table_label}.",
    "code": "Business code used by {table_label}.",
    "audit": "Audit or authorization user information used by {table_label}.",
}

TABLE_COMMENTS: dict[str, str] = {
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


def infer_classification(column: SourceColumn | str, data_type: str | None = None) -> str:
    name = column.name if isinstance(column, SourceColumn) else str(column or "")
    upper_name = name.upper()
    upper_type = (column.data_type if isinstance(column, SourceColumn) else data_type or "").upper()
    if _name_has_any(upper_name, "AMT", "AMOUNT", "BAL", "BALANCE", "LIMIT", "TURNOVER"):
        return "amount"
    if _name_has_any(upper_name, "CCY", "CURRENCY"):
        return "currency"
    if _name_has_any(upper_name, "ACC", "ACCOUNT", "AC_NO", "CUST_AC"):
        return "account"
    if _name_has_any(upper_name, "CUSTOMER", "CUST_NO", "CIF"):
        return "customer"
    if "BRANCH" in upper_name:
        return "branch"
    if _name_has_any(upper_name, "DATE", "_DT", "TIME", "TIMESTAMP") or upper_type.startswith(("DATE", "TIMESTAMP")):
        return "date"
    if _name_has_any(upper_name, "STATUS", "STAT", "FLAG", "IND"):
        return "status"
    if _name_has_any(upper_name, "REF", "REFERENCE", "TXN_ID", "TRN_REF", "XREF"):
        return "reference"
    if "PRODUCT" in upper_name:
        return "product"
    if _name_has_any(upper_name, "RATE", "PERCENT", "PCT"):
        return "rate"
    if upper_name.endswith("_CODE") or upper_name == "CODE":
        return "code"
    if _name_has_any(upper_name, "USER", "AUTH", "MAKER", "CHECKER"):
        return "audit"
    return ""


def _comment_for_column(table: SourceTable, column: SourceColumn, classification: str) -> str:
    label = display_label(column.name)
    table_label = display_label(table.name)
    table_name = table.name.upper()
    column_name = column.name.upper()
    if (table_name, column_name) in SPECIFIC_COLUMN_COMMENTS:
        return SPECIFIC_COLUMN_COMMENTS[(table_name, column_name)]
    template = CLASSIFICATION_COMMENT_TEMPLATES.get(classification)
    return template.format(table_label=table_label) if template else f"{label} attribute for {table_label}."


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
    return {
        "owner_name": owner_name,
        "table_name": table.name,
        "source_file_name": f"{table.name}.csv",
        "table_comment": TABLE_COMMENTS.get(
            table.name.upper(),
            f"{display_label(table.name)} source data generated from .source.",
        ),
        "columns": columns,
    }


def read_metadata_sidecar(path: Path) -> tuple[str | None, list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return parse_metadata_payload(payload)


def write_metadata_sidecar(table: SourceTable, destination: Path, *, owner_name: str = "APP_AGENT_DATA") -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = build_source_table_metadata(table, owner_name=owner_name)
    destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return destination
