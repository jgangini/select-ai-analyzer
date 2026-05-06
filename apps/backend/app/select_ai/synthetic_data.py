from __future__ import annotations

import csv
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from pathlib import Path
import random
import re
from typing import Iterable

from apps.backend.app.select_ai.source_parser import SourceColumn, SourceTable, parse_source_tables


BRANCHES = [f"{i:03d}" for i in range(1, 26)]
CUSTOMERS = [f"CUST{i:06d}" for i in range(1, 801)]
ACCOUNTS = [f"{i:012d}" for i in range(100000000001, 100000001801)]
CURRENCIES = ["USD", "PEN", "EUR", "BRL"]
PRODUCTS = ["SAV1", "CURR", "LOAN", "TD01", "CARD", "CLRG"]
TRN_CODES = ["ATM", "DEP", "WDR", "TRF", "FEE", "INT", "REV", "PAY"]
START_DATE = date(2025, 1, 1)
DOC_EXAMPLE_ACCOUNT = "9988776655"
DOC_EXAMPLE_MARCH = date(2026, 3, 1)
TEST_ACCOUNT = "001234567890"
TEST_CUSTOMER = "CUST000123"
TEST_AUDIT_ACCOUNT = "0011223344"
TEST_AUDIT_TRN = "TRN123456789"
TEST_AUDIT_USER = "USER_A01"
TEST_FRAUD_ACCOUNT = "4455667788"
TEST_INACTIVE_CUSTOMER = "CUST00999"
TEST_ATM_CARD = "5432-XXXX-XXXX-1234"
TEST_TODAY = date(2026, 5, 5)


def _row_count_for_table(table_name: str, default_rows: int, fact_rows: int) -> int:
    upper = table_name.upper()
    if any(token in upper for token in ("DAILY_LOG", "TRANSACTIONS", "STATEMENT", "ATM_TRANS", "CLEARING")):
        return fact_rows
    if any(token in upper for token in ("HISTORY", "LIQ", "EVENT", "TD_DETAILS", "ACC_PR")):
        return max(default_rows * 5, fact_rows // 2)
    return default_rows


def _is_number(column: SourceColumn) -> bool:
    return column.data_type.upper().startswith(("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE"))


def _is_date(column: SourceColumn) -> bool:
    return column.data_type.upper().startswith(("DATE", "TIMESTAMP"))


def _varchar_limit(data_type: str) -> int:
    match = re.search(r"\((\d+)", data_type)
    if not match:
        return 80
    return max(1, min(4000, int(match.group(1))))


def _number_precision_scale(data_type: str) -> tuple[int | None, int]:
    match = re.search(r"NUMBER\s*\(\s*(\d+)(?:\s*,\s*(\d+))?", data_type, flags=re.IGNORECASE)
    if not match:
        return None, 0
    return int(match.group(1)), int(match.group(2) or 0)


def _fit_number(value: object, data_type: str) -> str:
    text = "" if value is None else str(value).strip()
    if not text:
        return text
    precision, scale = _number_precision_scale(data_type)
    if precision is None:
        return text
    try:
        number = abs(Decimal(text))
    except InvalidOperation:
        return "0"
    if scale > 0:
        factor = Decimal(10) ** scale
        max_scaled = (10**precision) - 1
        scaled = int((number * factor).to_integral_value(rounding=ROUND_DOWN)) % (max_scaled + 1)
        bounded = Decimal(scaled) / factor
        return f"{bounded:.{scale}f}"
    max_integer = (10**precision) - 1
    return str(int(number.to_integral_value(rounding=ROUND_DOWN)) % (max_integer + 1))


def _fit(value: object, column: SourceColumn) -> str:
    text = "" if value is None else str(value)
    if _is_number(column):
        return _fit_number(value, column.data_type)
    if _is_date(column):
        return text
    return text[: _varchar_limit(column.data_type)]


def _amount(rng: random.Random, row_index: int) -> Decimal:
    base = Decimal(rng.randint(50, 250000)) / Decimal("10")
    if row_index % 37 == 0:
        base *= Decimal("8")
    return base.quantize(Decimal("0.001"))


def value_for_column(column: SourceColumn, row_index: int, rng: random.Random) -> object:
    name = column.name.upper()
    if _is_date(column):
        day = START_DATE + timedelta(days=row_index % 730)
        if "TIME" in name or column.data_type.upper().startswith("TIMESTAMP"):
            return f"{day.isoformat()} {row_index % 24:02d}:{(row_index * 7) % 60:02d}:00"
        return day.isoformat()
    if _is_number(column):
        if name.endswith("_KEY") or name.endswith("_ID") or name in {"DD_ID", "ESN", "JOB_NO"}:
            return row_index + 1
        if "RATE" in name:
            return str((Decimal(rng.randint(80, 450)) / Decimal("100")).quantize(Decimal("0.0001")))
        if "COUNT" in name or "NO_OF" in name or "DAYS" in name:
            return rng.randint(0, 36)
        if "AMOUNT" in name or "BAL" in name or "LIMIT" in name or "AMT" in name:
            return str(_amount(rng, row_index))
        return rng.randint(1, 999999)

    if name in {"BRANCH_CODE", "AC_BRANCH", "TXN_BRANCH", "FC_AC_BRANCH", "BRN"} or "BRANCH" in name:
        return BRANCHES[row_index % len(BRANCHES)]
    if name in {"CUSTOMER_NO", "RELATED_CUSTOMER", "CUST_NO", "REL_CUSTOMER", "CR_CUST_NO"} or "CUSTOMER" in name:
        return CUSTOMERS[row_index % len(CUSTOMERS)]
    if name in {"CCY", "ACC_CCY", "AC_CCY", "TXN_CCY", "CURRENCY"} or name.endswith("_CCY"):
        return CURRENCIES[row_index % len(CURRENCIES)]
    if name in {"CUST_AC_NO", "ACCOUNT", "ACCOUNT_NO", "AC_NO", "TXN_ACC", "RELATED_ACCOUNT"} or (
        "ACC" in name and "CLASS" not in name and "CCY" not in name
    ):
        return ACCOUNTS[row_index % len(ACCOUNTS)]
    if "PRODUCT" in name:
        return PRODUCTS[row_index % len(PRODUCTS)]
    if "TRN_CODE" in name or name == "TXN_CODE":
        return TRN_CODES[row_index % len(TRN_CODES)]
    if name == "DRCR_IND" or "DRCR" in name:
        return "D" if row_index % 2 == 0 else "C"
    if name in {"AUTH_STAT", "AUTH_STATUS"}:
        return "U" if row_index % 23 == 0 else "A"
    if name in {"RECORD_STAT", "ONCE_AUTH", "DELETE_STAT"}:
        return "O" if name == "RECORD_STAT" else "Y"
    if "HIDE_TXN_IN_STMT" in name or "REVERSAL_IND" in name or "REVERSED" in name:
        return "Y" if row_index % 19 == 0 else "N"
    if name in {"TRANS_STATUS", "TRANS_MATCH_STATUS"}:
        return "FAILED" if row_index % 17 == 0 else "APPROVED"
    if name == "TRN_REF_NO" or name.endswith("REFERENCE_NO"):
        return f"TRN{row_index + 1:012d}"
    if name == "TXN_ID":
        return f"TXN{row_index + 1:016d}"
    if "NAME" in name:
        return f"{name.title().replace('_', ' ')} {row_index + 1}"
    if "DESC" in name or "NARRATIVE" in name:
        return f"Synthetic banking {name.lower()} row {row_index + 1}"
    if name.endswith("_FLAG") or name.endswith("_IND"):
        return "Y" if row_index % 5 == 0 else "N"
    return f"{name}_{row_index + 1}"


def _set_if_present(row: dict[str, object], values: dict[str, object]) -> None:
    for column_name, value in values.items():
        if column_name in row:
            row[column_name] = value


def _apply_transaction_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name.upper() not in {"FLEX_EXT_ACCOUNT_TRANSACTIONS", "FLEX_EXT_ACCOUNT_STATEMENT"}:
        return

    if row_index < 16:
        transaction_date = DOC_EXAMPLE_MARCH + timedelta(days=row_index)
        is_debit = row_index % 2 == 0
        amount = "15000.000" if is_debit else "11875.000"
        _set_if_present(
            row,
            {
                "TRN_REF_NO": f"TRN_DOC_MAR_{row_index + 1:04d}",
                "TRN_DT": transaction_date.isoformat(),
                "VALUE_DATE": transaction_date.isoformat(),
                "TXN_INIT_DATE": f"{transaction_date.isoformat()} 10:{row_index % 60:02d}:00",
                "EXTRACTION_DATE": transaction_date.isoformat(),
                "ACCOUNT_NO": DOC_EXAMPLE_ACCOUNT,
                "RELATED_ACCOUNT": DOC_EXAMPLE_ACCOUNT,
                "DRCR_IND": "D" if is_debit else "C",
                "AMOUNT": amount,
                "LCY_AMOUNT": amount,
                "AC_CCY": "USD",
                "AUTH_STAT": "A",
                "HIDE_TXN_IN_STMT": "N",
                "TXN_ID": f"TXN_DOC_MAR_{row_index + 1:04d}",
            },
        )
        return

    if 20 <= row_index < 38:
        local_index = row_index - 20
        transaction_date = date(2026, 4, 27) + timedelta(days=local_index % 7)
        amount = "12000.000" if local_index == 0 else "11000.000" if local_index == 1 else "1387.500"
        is_debit = local_index in {0, 1} or local_index % 3 == 0
        _set_if_present(
            row,
            {
                "TRN_REF_NO": f"TRN_CUST123_{local_index + 1:04d}",
                "TRN_DT": transaction_date.isoformat(),
                "VALUE_DATE": transaction_date.isoformat(),
                "TXN_INIT_DATE": f"{transaction_date.isoformat()} 09:{(local_index * 3) % 60:02d}:00",
                "EXTRACTION_DATE": transaction_date.isoformat(),
                "ACCOUNT_NO": TEST_ACCOUNT,
                "RELATED_ACCOUNT": TEST_ACCOUNT,
                "RELATED_CUSTOMER": TEST_CUSTOMER,
                "DRCR_IND": "D" if is_debit else "C",
                "AMOUNT": amount,
                "LCY_AMOUNT": amount,
                "AC_CCY": "USD",
                "TRN_CODE": "WDR" if is_debit else "DEP",
                "TRN_CODE_TRANS": "WDR" if is_debit else "DEP",
                "AUTH_STAT": "A",
                "HIDE_TXN_IN_STMT": "N",
                "TXN_ID": f"TXN_CUST123_{local_index + 1:04d}",
            },
        )
        return

    if 40 <= row_index < 52:
        local_index = row_index - 40
        transaction_date = date(2026, 4, 18)
        _set_if_present(
            row,
            {
                "TRN_REF_NO": f"TRN_FRAUD_{local_index + 1:04d}",
                "TRN_DT": transaction_date.isoformat(),
                "VALUE_DATE": transaction_date.isoformat(),
                "TXN_INIT_DATE": f"{transaction_date.isoformat()} 14:{local_index * 2:02d}:00",
                "REAL_DT_TIME": f"{transaction_date.isoformat()} 14:{local_index * 2:02d}:00",
                "EXTRACTION_DATE": transaction_date.isoformat(),
                "ACCOUNT_NO": TEST_FRAUD_ACCOUNT,
                "RELATED_ACCOUNT": TEST_FRAUD_ACCOUNT,
                "RELATED_CUSTOMER": "CUST000445",
                "DRCR_IND": "D",
                "AMOUNT": "8500.000" if local_index < 4 else "6500.000",
                "LCY_AMOUNT": "8500.000" if local_index < 4 else "6500.000",
                "AC_CCY": "USD",
                "TRN_CODE": "REV" if local_index % 4 == 0 else "PAY",
                "TRN_CODE_TRANS": "REV" if local_index % 4 == 0 else "PAY",
                "AUTH_STAT": "U" if local_index == 0 else "A",
                "HIDE_TXN_IN_STMT": "Y" if local_index < 4 else "N",
                "TXN_ID": f"TXN_FRAUD_{local_index + 1:04d}",
            },
        )


def _apply_doc_example_overrides(table_name: str, row: dict[str, object], row_index: int) -> dict[str, object]:
    upper_table = table_name.upper()
    _apply_transaction_examples(upper_table, row, row_index)

    if upper_table == "FLEX_ACTB_ACCBAL_HISTORY" and row_index == 0:
        _set_if_present(
            row,
            {
                "BRANCH_CODE": "001",
                "ACCOUNT": TEST_ACCOUNT,
                "BKG_DATE": "2026-03-15",
                "ACC_CCY": "USD",
                "ACY_CLOSING_BAL": "45200.000",
                "LAST_UPD": "2026-03-15",
            },
        )

    if upper_table == "FLEX_STTM_CUSTOMER":
        if row_index == 0:
            _set_if_present(row, {"CUSTOMER_NO": TEST_CUSTOMER, "CUSTOMER_NAME1": "Nadia Test Customer"})
        elif row_index == 1:
            _set_if_present(row, {"CUSTOMER_NO": TEST_INACTIVE_CUSTOMER, "CUSTOMER_NAME1": "Inactive Test Customer"})

    if upper_table == "FLEX_STTM_CUST_ACCOUNT":
        if row_index == 0:
            _set_if_present(
                row,
                {
                    "BRANCH_CODE": "001",
                    "CUST_AC_NO": TEST_ACCOUNT,
                    "MASTER_ACCOUNT_NO": TEST_ACCOUNT,
                    "STATEMENT_ACCOUNT": TEST_ACCOUNT,
                    "REDIRECTION_ACCOUNT": TEST_ACCOUNT,
                    "CUST_NO": TEST_CUSTOMER,
                    "CCY": "USD",
                    "ACY_CURR_BALANCE": "45200.000",
                    "LCY_CURR_BALANCE": "45200.000",
                    "ACY_AVL_BAL": "45200.000",
                    "DATE_LAST_CR_ACTIVITY": "2026-05-03",
                    "DATE_LAST_DR_ACTIVITY": "2026-05-03",
                    "DORMANCY_DAYS": "0",
                    "AC_STAT_DORMANT": "N",
                    "INACTIVE": "N",
                },
            )
        elif row_index == 1:
            _set_if_present(
                row,
                {
                    "BRANCH_CODE": "009",
                    "CUST_AC_NO": "009990000001",
                    "MASTER_ACCOUNT_NO": "009990000001",
                    "STATEMENT_ACCOUNT": "009990000001",
                    "CUST_NO": TEST_INACTIVE_CUSTOMER,
                    "CCY": "USD",
                    "DATE_LAST_CR_ACTIVITY": "2025-12-01",
                    "DATE_LAST_DR_ACTIVITY": "2025-12-01",
                    "DORMANCY_DAYS": "120",
                    "AC_STAT_DORMANT": "Y",
                    "INACTIVE": "Y",
                },
            )

    if upper_table in {"FLEX_ACTB_DAILY_LOG_1", "FLEX_ACTB_DAILY_LOG_2"}:
        if row_index == 0:
            _set_if_present(
                row,
                {
                    "TRN_REF_NO": TEST_AUDIT_TRN,
                    "TRN_DT": "2026-04-10",
                    "VALUE_DT": "2026-04-10",
                    "TXN_INIT_DATE": "2026-04-10",
                    "AC_NO": TEST_AUDIT_ACCOUNT,
                    "RELATED_ACCOUNT": TEST_AUDIT_ACCOUNT,
                    "RELATED_CUSTOMER": TEST_CUSTOMER,
                    "EVENT": "AUTH",
                    "AUTH_ID": TEST_AUDIT_USER,
                    "USER_ID": TEST_AUDIT_USER,
                    "AUTH_STAT": "A",
                    "AMOUNT_TAG": "PRINCIPAL",
                    "LCY_AMOUNT": "6200.000",
                    "FCY_AMOUNT": "6200.000",
                },
            )
        elif row_index in {1, 2}:
            event = "DRP" if row_index == 1 else "CRP"
            _set_if_present(
                row,
                {
                    "TRN_REF_NO": f"TRN_AUDIT_EVT_{row_index}",
                    "TRN_DT": "2026-04-10",
                    "VALUE_DT": "2026-04-10",
                    "TXN_INIT_DATE": "2026-04-10",
                    "AC_NO": TEST_AUDIT_ACCOUNT,
                    "RELATED_ACCOUNT": TEST_AUDIT_ACCOUNT,
                    "RELATED_CUSTOMER": TEST_CUSTOMER,
                    "EVENT": event,
                    "AUTH_ID": TEST_AUDIT_USER,
                    "USER_ID": TEST_AUDIT_USER,
                    "AUTH_STAT": "A",
                },
            )

    if upper_table == "FLEX_IFTB_ATM_TRANS_LOG" and row_index < 7:
        _set_if_present(
            row,
            {
                "TXN_ID": f"ATM_TEST_{row_index + 1:04d}",
                "TRANS_DATE": TEST_TODAY.isoformat(),
                "PROCESSED_DATE": TEST_TODAY.isoformat(),
                "SCR_BUSN_DATE": TEST_TODAY.isoformat(),
                "HOST_BUSN_DATE": TEST_TODAY.isoformat(),
                "TRANS_CODE": "WDR",
                "TRANS_STATUS": "F" if row_index < 2 else "A",
                "TRANS_MATCH_STATUS": "F" if row_index < 2 else "A",
                "TRANS_AC_NO": TEST_FRAUD_ACCOUNT,
                "PAY_ACC": TEST_FRAUD_ACCOUNT,
                "CARD_NO": "5432XXXXXXXX1234",
                "SCR_BRANCH_NO": "004",
                "SCR_TERM_NO": "SAOPAULO",
                "TRANS_AMOUNT": "700.000",
                "TRANS_CCY": "BRL",
                "TRN_REF_NO": f"ATMTRN{row_index + 1:06d}",
            },
        )

    if upper_table == "FLEX_CSTB_CLEARING_MASTER":
        if row_index == 0:
            _set_if_present(
                row,
                {
                    "REFERENCE_NO": "CLG_PENDING_001",
                    "STATUS": "PEND",
                    "TXN_DATE": TEST_TODAY.isoformat(),
                    "INSTRUMENT_DATE": TEST_TODAY.isoformat(),
                    "REM_ACCOUNT": TEST_ACCOUNT,
                    "BEN_ACCOUNT": TEST_ACCOUNT,
                    "ACC_CCY_AMT": "12000.000",
                    "INSTRUMENT_AMT": "12500.000",
                    "AUTH_STAT": "U",
                },
            )
        elif row_index == 1:
            _set_if_present(
                row,
                {
                    "REFERENCE_NO": "CLG_REJECT_001",
                    "STATUS": "REJ",
                    "TXN_DATE": TEST_TODAY.isoformat(),
                    "REJECT_REASON": "INSUFFICIENT_FUNDS",
                    "REM_ACCOUNT": TEST_ACCOUNT,
                    "BEN_ACCOUNT": TEST_ACCOUNT,
                    "ACC_CCY_AMT": "4200.000",
                    "INSTRUMENT_AMT": "4200.000",
                },
            )

    if upper_table == "FLEX_ICTB_ACC_PR" and row_index == 0:
        _set_if_present(
            row,
            {
                "BRN": "001",
                "ACC": "112233",
                "PROD": "SAV1",
                "LAST_LIQ_DT": "2026-04-30",
                "NEXT_CALC_DT": "2026-05-31",
                "NEXT_SCHD_LIQ_DT": "2026-05-31",
                "HAS_PROBLEMS": "Y",
                "IMAT_PROBLEMS": "Y",
                "CCY": "USD",
            },
        )

    if upper_table == "FLEX_STTM_DATES" and row_index == 0:
        _set_if_present(
            row,
            {
                "BRANCH_CODE": "001",
                "TODAY": TEST_TODAY.isoformat(),
                "PREV_WORKING_DAY": "2026-05-04",
                "NEXT_WORKING_DAY": "2026-05-06",
                "AUTH_STAT": "A",
            },
        )
    elif upper_table == "FLEX_STTM_DATES" and row.get("BRANCH_CODE") == "001":
        _set_if_present(row, {"BRANCH_CODE": "099"})

    return row


def generate_rows(table: SourceTable, row_count: int, *, seed: int = 2605) -> Iterable[dict[str, object]]:
    rng = random.Random(seed + sum(ord(ch) for ch in table.name))
    for row_index in range(row_count):
        row = {
            column.name: _fit(value_for_column(column, row_index, rng), column)
            for column in table.columns
        }
        yield _apply_doc_example_overrides(table.name, row, row_index)


def write_csv_for_table(table: SourceTable, destination: Path, *, row_count: int, seed: int = 2605) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    csv_path = destination / f"{table.name}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[column.name for column in table.columns])
        writer.writeheader()
        writer.writerows(generate_rows(table, row_count, seed=seed))
    return csv_path


def write_seed_csvs(source_file: Path, destination: Path, *, default_rows: int = 100, fact_rows: int = 2000) -> list[Path]:
    tables = parse_source_tables(source_file.read_text(encoding="utf-8", errors="ignore"))
    paths: list[Path] = []
    for table in tables:
        rows = _row_count_for_table(table.name, default_rows=default_rows, fact_rows=fact_rows)
        paths.append(write_csv_for_table(table, destination, row_count=rows))
    return paths
