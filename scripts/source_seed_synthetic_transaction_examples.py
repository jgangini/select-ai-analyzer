from __future__ import annotations

from datetime import date, timedelta

from scripts.source_seed_synthetic_example_values import (
    DOC_EXAMPLE_ACCOUNT,
    DOC_EXAMPLE_MARCH,
    TEST_ACCOUNT,
    TEST_CUSTOMER,
    TEST_FRAUD_ACCOUNT,
    _set_if_present,
)


def _apply_transaction_row(
    row: dict[str, object],
    *,
    reference: str,
    transaction_date: date,
    transaction_time: str,
    account: str,
    amount: str,
    debit: bool,
    txn_id: str,
    related_customer: str | None = None,
    transaction_code: str | None = None,
    auth_stat: str = "A",
    hide_in_statement: str = "N",
    include_real_time: bool = False,
) -> None:
    transaction_day = transaction_date.isoformat()
    values = {
        "TRN_REF_NO": reference,
        "TRN_DT": transaction_day,
        "VALUE_DATE": transaction_day,
        "TXN_INIT_DATE": transaction_time,
        "EXTRACTION_DATE": transaction_day,
        "ACCOUNT_NO": account,
        "RELATED_ACCOUNT": account,
        "DRCR_IND": "D" if debit else "C",
        "AMOUNT": amount,
        "LCY_AMOUNT": amount,
        "AC_CCY": "USD",
        "AUTH_STAT": auth_stat,
        "HIDE_TXN_IN_STMT": hide_in_statement,
        "TXN_ID": txn_id,
    }
    if include_real_time:
        values["REAL_DT_TIME"] = transaction_time
    if related_customer:
        values["RELATED_CUSTOMER"] = related_customer
    if transaction_code:
        values["TRN_CODE"] = transaction_code
        values["TRN_CODE_TRANS"] = transaction_code
    _set_if_present(row, values)


def _apply_transaction_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name.upper() not in {"FLEX_EXT_ACCOUNT_TRANSACTIONS", "FLEX_EXT_ACCOUNT_STATEMENT"}:
        return

    if row_index < 16:
        transaction_date = DOC_EXAMPLE_MARCH + timedelta(days=row_index)
        transaction_time = f"{transaction_date.isoformat()} 10:{row_index % 60:02d}:00"
        is_debit = row_index % 2 == 0
        amount = "15000.000" if is_debit else "11875.000"
        _apply_transaction_row(
            row,
            reference=f"TRN_DOC_MAR_{row_index + 1:04d}",
            transaction_date=transaction_date,
            transaction_time=transaction_time,
            account=DOC_EXAMPLE_ACCOUNT,
            amount=amount,
            debit=is_debit,
            txn_id=f"TXN_DOC_MAR_{row_index + 1:04d}",
            include_real_time=True,
        )
        return

    if 20 <= row_index < 38:
        local_index = row_index - 20
        transaction_date = date(2026, 4, 27) + timedelta(days=local_index % 7)
        amount = "12000.000" if local_index == 0 else "11000.000" if local_index == 1 else "1387.500"
        is_debit = local_index in {0, 1} or local_index % 3 == 0
        transaction_code = "WDR" if is_debit else "DEP"
        _apply_transaction_row(
            row,
            reference=f"TRN_CUST123_{local_index + 1:04d}",
            transaction_date=transaction_date,
            transaction_time=f"{transaction_date.isoformat()} 09:{(local_index * 3) % 60:02d}:00",
            account=TEST_ACCOUNT,
            amount=amount,
            debit=is_debit,
            txn_id=f"TXN_CUST123_{local_index + 1:04d}",
            related_customer=TEST_CUSTOMER,
            transaction_code=transaction_code,
        )
        return

    if 40 <= row_index < 52:
        local_index = row_index - 40
        transaction_date = date(2026, 4, 18)
        transaction_time = f"{transaction_date.isoformat()} 14:{local_index * 2:02d}:00"
        transaction_code = "REV" if local_index % 4 == 0 else "PAY"
        amount = "8500.000" if local_index < 4 else "6500.000"
        _apply_transaction_row(
            row,
            reference=f"TRN_FRAUD_{local_index + 1:04d}",
            transaction_date=transaction_date,
            transaction_time=transaction_time,
            account=TEST_FRAUD_ACCOUNT,
            amount=amount,
            debit=True,
            txn_id=f"TXN_FRAUD_{local_index + 1:04d}",
            related_customer="CUST000445",
            transaction_code=transaction_code,
            auth_stat="U" if local_index == 0 else "A",
            hide_in_statement="Y" if local_index < 4 else "N",
            include_real_time=True,
        )
