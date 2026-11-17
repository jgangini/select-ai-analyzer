from __future__ import annotations

from datetime import timedelta

from scripts.source_seed_synthetic_example_values import (
    TEST_ACCOUNT,
    TEST_CUSTOMER,
    TEST_FRAUD_ACCOUNT,
    TEST_TODAY,
    _set_if_present,
)

TELLER_EXAMPLE_ROWS: tuple[dict[str, str], ...] = (
    {
        "suffix": "001",
        "product_code": "SAV1",
        "branch": "001",
        "account": TEST_ACCOUNT,
        "amount": "12500.000",
        "trn_code": "WDR",
        "customer": TEST_CUSTOMER,
        "maker": "TELLER_M01",
        "narrative": "Pending teller withdrawal awaiting authorization",
        "time_received": "09:15:00",
    },
    {
        "suffix": "002",
        "product_code": "CURR",
        "branch": "002",
        "account": "001234567891",
        "amount": "7800.000",
        "trn_code": "DEP",
        "customer": "CUST000124",
        "maker": "TELLER_M02",
        "narrative": "Pending teller deposit awaiting authorization",
        "time_received": "10:20:00",
    },
)


def _apply_teller_row(row: dict[str, object], example: dict[str, str]) -> None:
    today = TEST_TODAY.isoformat()
    reference = f"TL_PENDING_{example['suffix']}"
    _set_if_present(
        row,
        {
            "XREF": reference,
            "PRODUCT_CODE": example["product_code"],
            "BRANCH_CODE": example["branch"],
            "TRN_REF_NO": reference,
            "TXN_ACC": example["account"],
            "TXN_CCY": "USD",
            "TXN_AMOUNT": example["amount"],
            "TXN_BRANCH": example["branch"],
            "TXN_TRN_CODE": example["trn_code"],
            "OFS_ACC": example["account"],
            "OFS_CCY": "USD",
            "OFS_AMOUNT": example["amount"],
            "OFS_BRANCH": example["branch"],
            "OFS_TRN_CODE": example["trn_code"],
            "LCY_AMOUNT": example["amount"],
            "TRN_DT": today,
            "VALUE_DT": today,
            "REL_CUSTOMER": example["customer"],
            "AUTH_STAT": "U",
            "MAKER_ID": example["maker"],
            "CHECKER_ID": "",
            "NARRATIVE": example["narrative"],
            "MODULE": "TL",
            "TXN_ID": f"TL_TXN_PENDING_{example['suffix']}",
            "TIME_RECEIVED": f"{today} {example['time_received']}",
        },
    )


def _apply_teller_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name not in {"FLEX_DETB_RTL_TELLER_1", "FLEX_DETB_RTL_TELLER_2"}:
        return
    if row_index < len(TELLER_EXAMPLE_ROWS):
        _apply_teller_row(row, TELLER_EXAMPLE_ROWS[row_index])


def _apply_atm_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name == "FLEX_IFTB_ATM_TRANS_LOG" and row_index < 7:
        today = TEST_TODAY.isoformat()
        transaction_status = "F" if row_index < 2 else "A"
        _set_if_present(
            row,
            {
                "TXN_ID": f"ATM_TEST_{row_index + 1:04d}",
                "TRANS_DATE": today,
                "PROCESSED_DATE": today,
                "SCR_BUSN_DATE": today,
                "HOST_BUSN_DATE": today,
                "TRANS_CODE": "WDR",
                "TRANS_STATUS": transaction_status,
                "TRANS_MATCH_STATUS": transaction_status,
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


def _apply_clearing_row(
    row: dict[str, object],
    *,
    reference: str,
    status: str,
    transaction_date: str,
    account_amount: str,
    instrument_amount: str,
    auth_stat: str | None = None,
    instrument_date: str | None = None,
    reject_reason: str | None = None,
) -> None:
    values = {
        "REFERENCE_NO": reference,
        "STATUS": status,
        "TXN_DATE": transaction_date,
        "REM_ACCOUNT": TEST_ACCOUNT,
        "BEN_ACCOUNT": TEST_ACCOUNT,
        "ACC_CCY_AMT": account_amount,
        "INSTRUMENT_AMT": instrument_amount,
    }
    if auth_stat:
        values["AUTH_STAT"] = auth_stat
    if instrument_date:
        values["INSTRUMENT_DATE"] = instrument_date
    if reject_reason:
        values["REJECT_REASON"] = reject_reason
    _set_if_present(row, values)


def _apply_clearing_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name != "FLEX_CSTB_CLEARING_MASTER":
        return
    today = TEST_TODAY.isoformat()
    if row_index == 0:
        _apply_clearing_row(
            row,
            reference="CLG_PENDING_001",
            status="PEND",
            transaction_date=today,
            instrument_date=today,
            account_amount="12000.000",
            instrument_amount="12500.000",
            auth_stat="U",
        )
    elif row_index == 1:
        _apply_clearing_row(
            row,
            reference="CLG_REJECT_001",
            status="REJ",
            transaction_date=today,
            account_amount="4200.000",
            instrument_amount="4200.000",
            reject_reason="INSUFFICIENT_FUNDS",
        )


def _apply_interest_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name == "FLEX_ICTB_ACC_PR" and row_index == 0:
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


def _apply_operating_date_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name == "FLEX_STTM_DATES" and row_index == 0:
        today = TEST_TODAY.isoformat()
        _set_if_present(
            row,
            {
                "BRANCH_CODE": "001",
                "TODAY": today,
                "PREV_WORKING_DAY": (TEST_TODAY - timedelta(days=1)).isoformat(),
                "NEXT_WORKING_DAY": (TEST_TODAY + timedelta(days=1)).isoformat(),
                "AUTH_STAT": "A",
            },
        )
    elif table_name == "FLEX_STTM_DATES" and row.get("BRANCH_CODE") == "001":
        _set_if_present(row, {"BRANCH_CODE": "099"})
