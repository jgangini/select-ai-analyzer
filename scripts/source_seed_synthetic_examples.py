from __future__ import annotations

from scripts.source_seed_synthetic_example_values import (
    TEST_ACCOUNT,
    TEST_AUDIT_ACCOUNT,
    TEST_AUDIT_TRN,
    TEST_AUDIT_USER,
    TEST_CUSTOMER,
    TEST_INACTIVE_CUSTOMER,
    _set_if_present,
)


def _apply_balance_history_example(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name == "FLEX_ACTB_ACCBAL_HISTORY" and row_index == 0:
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


def _apply_customer_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name != "FLEX_STTM_CUSTOMER":
        return
    if row_index == 0:
        _set_if_present(row, {"CUSTOMER_NO": TEST_CUSTOMER, "CUSTOMER_NAME1": "Nadia Test Customer"})
    elif row_index == 1:
        _set_if_present(row, {"CUSTOMER_NO": TEST_INACTIVE_CUSTOMER, "CUSTOMER_NAME1": "Inactive Test Customer"})


def _apply_customer_account_row(
    row: dict[str, object],
    *,
    branch: str,
    account: str,
    customer: str,
    ccy: str,
    last_activity: str,
    dormancy_days: str,
    inactive_flag: str,
    balance: str | None = None,
    include_redirection_account: bool = True,
) -> None:
    values = {
        "BRANCH_CODE": branch,
        "CUST_AC_NO": account,
        "MASTER_ACCOUNT_NO": account,
        "STATEMENT_ACCOUNT": account,
        "CUST_NO": customer,
        "CCY": ccy,
        "DATE_LAST_CR_ACTIVITY": last_activity,
        "DATE_LAST_DR_ACTIVITY": last_activity,
        "DORMANCY_DAYS": dormancy_days,
        "AC_STAT_DORMANT": inactive_flag,
        "INACTIVE": inactive_flag,
    }
    if include_redirection_account:
        values["REDIRECTION_ACCOUNT"] = account
    if balance:
        values.update({"ACY_CURR_BALANCE": balance, "LCY_CURR_BALANCE": balance, "ACY_AVL_BAL": balance})
    _set_if_present(row, values)


def _apply_customer_account_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name != "FLEX_STTM_CUST_ACCOUNT":
        return
    if row_index == 0:
        _apply_customer_account_row(
            row,
            branch="001",
            account=TEST_ACCOUNT,
            customer=TEST_CUSTOMER,
            ccy="USD",
            last_activity="2026-05-03",
            dormancy_days="0",
            inactive_flag="N",
            balance="45200.000",
        )
    elif row_index == 1:
        _apply_customer_account_row(
            row,
            branch="009",
            account="009990000001",
            customer=TEST_INACTIVE_CUSTOMER,
            ccy="USD",
            last_activity="2026-01-01",
            dormancy_days="120",
            inactive_flag="Y",
            include_redirection_account=False,
        )


def _apply_daily_log_row(row: dict[str, object], *, reference: str, event: str, include_amounts: bool = False) -> None:
    values = {
        "TRN_REF_NO": reference,
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
    }
    if include_amounts:
        values.update({"AMOUNT_TAG": "PRINCIPAL", "LCY_AMOUNT": "6200.000", "FCY_AMOUNT": "6200.000"})
    _set_if_present(row, values)


def _apply_daily_log_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name not in {"FLEX_ACTB_DAILY_LOG_1", "FLEX_ACTB_DAILY_LOG_2"}:
        return
    if row_index == 0:
        _apply_daily_log_row(row, reference=TEST_AUDIT_TRN, event="AUTH", include_amounts=True)
    elif row_index in {1, 2}:
        event = "DRP" if row_index == 1 else "CRP"
        _apply_daily_log_row(row, reference=f"TRN_AUDIT_EVT_{row_index}", event=event)


def apply_core_doc_example_overrides(table_name: str, row: dict[str, object], row_index: int) -> dict[str, object]:
    upper_table = table_name.upper()
    _apply_balance_history_example(upper_table, row, row_index)
    _apply_customer_examples(upper_table, row, row_index)
    _apply_customer_account_examples(upper_table, row, row_index)
    _apply_daily_log_examples(upper_table, row, row_index)
    return row
