from __future__ import annotations

from datetime import timedelta

from scripts.source_seed_synthetic_example_values import (
    START_DATE,
    TEST_ACCOUNT,
    TEST_CUSTOMER,
    TEST_TODAY,
    _set_if_present,
)


def _apply_term_deposit_row(
    row: dict[str, object],
    *,
    branch: str,
    account: str,
    ccy: str,
    amount: str,
    reference: str,
    maturity_date: str,
    depositor: str,
    depositor_name: str,
    txn_id: str,
    maturity_amount: str,
    operation_key: str,
    extra_values: dict[str, object] | None = None,
) -> None:
    values = {
        "BRN": branch,
        "ACC": account,
        "CCY": ccy,
        "TD_AMOUNT": amount,
        "REFERENCE_NO": reference,
        "LIQD_DATE": maturity_date,
        "TD_DEPOSITER": depositor,
        "TD_DEPOSITER_NAME": depositor_name,
        "TXN_ID": txn_id,
        "TD_MATURITY_AMT": maturity_amount,
        "DCV_CUSTOMER_NO": depositor,
        "OPERATION_KEY": operation_key,
        "DCV_DEPOSIT": "Y",
    }
    if extra_values:
        values.update(extra_values)
    _set_if_present(row, values)


def _apply_term_deposit_examples(table_name: str, row: dict[str, object], row_index: int) -> None:
    if table_name not in {
        "FLEX_ICTM_TD_DETAILS",
        "FLEX_ICTW_TD_DETAILS",
        "FLEX_ICTM_TD_DETAILS_ARCHIVE",
        "FLEX_ICTW_TD_DETAILS_ARCHIVE",
    }:
        return
    if row_index == 0:
        maturity_date = TEST_TODAY
        start_date = max(START_DATE, maturity_date - timedelta(days=179))
        tenor_days = (maturity_date - start_date).days + 1
        _apply_term_deposit_row(
            row,
            branch="001",
            account="TD0000000001",
            ccy="USD",
            amount="25000.000",
            reference="TD_NEXT_001",
            maturity_date=maturity_date.isoformat(),
            depositor=TEST_CUSTOMER,
            depositor_name="Nadia Test Customer",
            txn_id="TD_TXN_NEXT_001",
            maturity_amount="25725.000",
            operation_key="TD_NEXT_001",
            extra_values={
                "TD_OFFSET_ACC": TEST_ACCOUNT,
                "TENOR": str(tenor_days),
                "PAYIN_DT": start_date.isoformat(),
                "PAYIN_ACC": TEST_ACCOUNT,
                "PAYIN_CCY": "USD",
                "CREATION_DT": start_date.isoformat(),
                "AC_STAT": "A",
                "NEXT_RATE_CHANGE_DT": maturity_date.isoformat(),
                "TD_INT_AMT": "725.000",
                "ORIGINAL_TD_AMT": "25000.000",
                "ORIGINAL_TENOR": str(tenor_days),
                "CUSTOMER_SECOND_NAME": "Nadia Test Customer",
                "AUTH_RATE": "A",
                "RATE_VALUE": "4.50000",
            },
        )
    elif row_index == 1:
        maturity_date = TEST_TODAY + timedelta(days=4)
        _apply_term_deposit_row(
            row,
            branch="002",
            account="TD0000000002",
            ccy="PEN",
            amount="18000.000",
            reference="TD_NEXT_002",
            maturity_date=maturity_date.isoformat(),
            depositor="CUST000124",
            depositor_name="Second Test Customer",
            txn_id="TD_TXN_NEXT_002",
            maturity_amount="18480.000",
            operation_key="TD_NEXT_002",
        )
