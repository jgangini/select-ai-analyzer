from datetime import date, datetime, timedelta
from decimal import Decimal
import random

import pytest

from apps.backend.app.select_ai.source_parser import SourceColumn
from apps.backend.app.select_ai.source_parser import SourceTable
from apps.backend.app.select_ai.service import (
    _is_velocity_window_intent,
    _score_source_match,
    _sql_generation_hints,
    _uses_current_clock,
    _uses_current_clock_for_velocity_sql,
)
from apps.backend.app.select_ai.synthetic_data import (
    CURRENCIES,
    DOC_EXAMPLE_ACCOUNT,
    MIN_ROWS_PER_TABLE,
    TEST_TODAY,
    _row_count_for_table,
    generate_rows,
    value_for_column,
)
from scripts.load_source_seed import convert_csv_value


def test_convert_csv_value_uses_oracle_column_type() -> None:
    assert convert_csv_value("2025-01-02", "DATE") == date(2025, 1, 2)
    assert convert_csv_value("2025-01-02 13:45:00", "TIMESTAMP(6)") == datetime(2025, 1, 2, 13, 45)
    assert convert_csv_value("11724.000", "NUMBER(24,3)") == Decimal("11724.000")
    assert convert_csv_value("", "NUMBER") is None
    assert convert_csv_value("PEN", "VARCHAR2(3)") == "PEN"


def test_convert_csv_value_rejects_bad_dates_and_numbers() -> None:
    with pytest.raises(ValueError):
        convert_csv_value("not-a-date", "DATE")
    with pytest.raises(ValueError):
        convert_csv_value("12x", "NUMBER")


def test_synthetic_currency_columns_do_not_get_account_numbers() -> None:
    column = SourceColumn(name="ACC_CCY", data_type="VARCHAR2(3)", nullable=False)

    assert value_for_column(column, 0, random.Random(1)) in CURRENCIES


def test_synthetic_date_and_timestamp_columns_are_deterministic() -> None:
    date_column = SourceColumn(name="TRN_DT", data_type="DATE", nullable=True)
    timestamp_column = SourceColumn(name="REAL_DT_TIME", data_type="TIMESTAMP(6)", nullable=True)

    assert value_for_column(date_column, 0, random.Random(1)) == "2026-01-01"
    assert value_for_column(date_column, 364, random.Random(1)) == "2026-12-31"
    assert value_for_column(date_column, 365, random.Random(1)) == "2026-01-01"
    assert value_for_column(timestamp_column, 1, random.Random(1)) == "2026-01-02 01:07:00"


def test_synthetic_row_counts_cover_every_2026_day() -> None:
    assert _row_count_for_table("FLEX_STTM_BRANCH", default_rows=100, fact_rows=2000) == MIN_ROWS_PER_TABLE
    assert _row_count_for_table("FLEX_EXT_ACCOUNT_TRANSACTIONS", default_rows=100, fact_rows=2000) == 2000
    assert _row_count_for_table("FLEX_CLTB_LIQ", default_rows=10, fact_rows=20) == MIN_ROWS_PER_TABLE


def test_synthetic_examples_keep_full_2026_date_coverage() -> None:
    expected_dates = {date(2026, 1, 1) + timedelta(days=offset) for offset in range(365)}
    table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_STTM_CUST_ACCOUNT",
        columns=(
            SourceColumn(name="CUST_AC_NO", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="DATE_LAST_CR_ACTIVITY", data_type="DATE", nullable=True),
            SourceColumn(name="DATE_LAST_DR_ACTIVITY", data_type="DATE", nullable=True),
        ),
    )

    rows = list(generate_rows(table, MIN_ROWS_PER_TABLE, seed=1))

    assert {date.fromisoformat(str(row["DATE_LAST_CR_ACTIVITY"])) for row in rows} == expected_dates
    assert {date.fromisoformat(str(row["DATE_LAST_DR_ACTIVITY"])) for row in rows} == expected_dates


@pytest.mark.parametrize(
    ("column_name", "expected"),
    [
        ("BRANCH_CODE", "001"),
        ("CUSTOMER_NO", "CUST000001"),
        ("ACC_CCY", "USD"),
        ("ACCOUNT_NO", "100000000001"),
        ("PRODUCT_CODE", "SAV1"),
        ("TRN_CODE", "ATM"),
        ("DRCR_IND", "D"),
        ("AUTH_STAT", "U"),
        ("RECORD_STAT", "O"),
        ("HIDE_TXN_IN_STMT", "Y"),
        ("TRANS_STATUS", "FAILED"),
        ("TRN_REF_NO", "TRN000000000001"),
        ("TXN_ID", "TXN0000000000000001"),
        ("SOME_FLAG", "Y"),
    ],
)
def test_synthetic_named_text_columns_use_domain_values(column_name: str, expected: str) -> None:
    column = SourceColumn(name=column_name, data_type="VARCHAR2(50)", nullable=True)

    assert value_for_column(column, 0, random.Random(1)) == expected


def test_synthetic_numbers_fit_declared_precision_and_scale() -> None:
    table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_STTM_ACCOUNT_CLASS",
        columns=(
            SourceColumn(name="MOD_NO", data_type="NUMBER(4)", nullable=True),
            SourceColumn(name="STATEMENT_DAY", data_type="NUMBER(2)", nullable=True),
            SourceColumn(name="INPUT_TAX_RATE", data_type="NUMBER(10,8)", nullable=True),
        ),
    )

    row = next(generate_rows(table, 1, seed=1))

    assert 0 <= int(row["MOD_NO"]) <= 9999
    assert 0 <= int(row["STATEMENT_DAY"]) <= 99
    assert Decimal(row["INPUT_TAX_RATE"]) < Decimal("100")


def test_source_match_scores_explicit_table_and_spanish_business_terms() -> None:
    columns = ["ACC_CCY", "ACY_CLOSING_BAL", "BKG_DATE"]

    explicit = _score_source_match(
        "saldo promedio por moneda en FLEX_ACTB_ACCBAL_HISTORY",
        "FLEX_ACTB_ACCBAL_HISTORY",
        columns,
    )
    lexical = _score_source_match("saldo promedio por moneda", "FLEX_ACTB_ACCBAL_HISTORY", columns)

    assert explicit > lexical
    assert lexical > 0


def test_average_balance_hint_targets_history_dates() -> None:
    hints = _sql_generation_hints("Cual fue el saldo promedio por sucursal y moneda este mes?")

    assert "FLEX_ACTB_ACCBAL_HISTORY" in hints
    assert "BKG_DATE" in hints
    assert "account opening dates" in hints


def test_velocity_window_guard_detects_current_clock_sql() -> None:
    assert _is_velocity_window_intent("Detecta cuentas con mas de 10 transacciones en menos de 1 hora")
    assert _uses_current_clock("SELECT * FROM T WHERE REAL_DT_TIME > SYSTIMESTAMP - INTERVAL '1' HOUR")
    assert _uses_current_clock_for_velocity_sql("SELECT * FROM T WHERE REAL_DT_TIME > SYSTIMESTAMP - INTERVAL '1' HOUR")
    assert not _uses_current_clock_for_velocity_sql("SELECT * FROM ATM WHERE TRANS_DATE = TRUNC(SYSDATE)")
    assert not _uses_current_clock(
        "SELECT ACCOUNT_NO, COUNT(*) FROM T GROUP BY ACCOUNT_NO, TRUNC(REAL_DT_TIME, 'HH') HAVING COUNT(*) > 10"
    )


def test_operational_hints_cover_teller_and_term_deposit_questions() -> None:
    teller_hints = _sql_generation_hints("Que transacciones estan pendientes de autorizacion en teller?")
    deposit_hints = _sql_generation_hints("Cual es el proximo contrato de deposito a vencer?")

    assert "FLEX_DETB_RTL_TELLER" in teller_hints
    assert "AUTH_STAT='U'" in teller_hints
    assert "FLEX_ICTM_TD_DETAILS" in deposit_hints
    assert "LIQD_DATE" in deposit_hints


def test_source_match_prioritizes_transaction_table_for_debit_credit_question() -> None:
    question = "Cual es el total de debitos vs creditos de la cuenta 9988776655 en marzo?"
    transaction_score = _score_source_match(
        question,
        "FLEX_EXT_ACCOUNT_TRANSACTIONS",
        ["TRN_DT", "ACCOUNT_NO", "AMOUNT", "LCY_AMOUNT", "DRCR_IND"],
    )
    account_score = _score_source_match(
        question,
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "ACY_MTD_TOVER_DR", "ACY_MTD_TOVER_CR", "DATE_LAST_DR", "DATE_LAST_CR"],
    )

    assert transaction_score > account_score


def test_synthetic_transactions_include_doc_example_account_in_march() -> None:
    table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_EXT_ACCOUNT_TRANSACTIONS",
        columns=(
            SourceColumn(name="TRN_DT", data_type="DATE", nullable=True),
            SourceColumn(name="ACCOUNT_NO", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="AMOUNT", data_type="NUMBER(24,3)", nullable=True),
            SourceColumn(name="LCY_AMOUNT", data_type="NUMBER(24,3)", nullable=True),
            SourceColumn(name="DRCR_IND", data_type="CHAR(1)", nullable=True),
            SourceColumn(name="AC_CCY", data_type="VARCHAR2(3)", nullable=True),
        ),
    )

    rows = list(generate_rows(table, 16, seed=1))

    assert {row["ACCOUNT_NO"] for row in rows} == {DOC_EXAMPLE_ACCOUNT}
    assert {row["AC_CCY"] for row in rows} == {"USD"}
    assert rows[0]["TRN_DT"] == "2026-03-01"
    assert rows[-1]["TRN_DT"] == "2026-03-16"
    assert sum(Decimal(str(row["AMOUNT"])) for row in rows if row["DRCR_IND"] == "D") == Decimal("120000.000")
    assert sum(Decimal(str(row["AMOUNT"])) for row in rows if row["DRCR_IND"] == "C") == Decimal("95000.000")


def test_synthetic_daily_log_includes_authorization_example() -> None:
    table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_ACTB_DAILY_LOG_1",
        columns=(
            SourceColumn(name="TRN_REF_NO", data_type="VARCHAR2(16)", nullable=True),
            SourceColumn(name="TRN_DT", data_type="DATE", nullable=True),
            SourceColumn(name="AC_NO", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="RELATED_CUSTOMER", data_type="VARCHAR2(12)", nullable=True),
            SourceColumn(name="EVENT", data_type="VARCHAR2(4)", nullable=True),
            SourceColumn(name="AUTH_ID", data_type="VARCHAR2(12)", nullable=True),
            SourceColumn(name="LCY_AMOUNT", data_type="NUMBER(22,3)", nullable=True),
        ),
    )

    rows = list(generate_rows(table, 3, seed=1))

    assert rows[0]["TRN_REF_NO"] == "TRN123456789"
    assert rows[0]["AUTH_ID"] == "USER_A01"
    assert rows[1]["EVENT"] == "DRP"
    assert rows[2]["EVENT"] == "CRP"


def test_synthetic_operational_examples_cover_atm_clearing_interest_and_dates() -> None:
    atm_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_IFTB_ATM_TRANS_LOG",
        columns=(
            SourceColumn(name="TXN_ID", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="TRANS_STATUS", data_type="VARCHAR2(1)", nullable=True),
            SourceColumn(name="CARD_NO", data_type="VARCHAR2(19)", nullable=True),
            SourceColumn(name="TRANS_CCY", data_type="VARCHAR2(3)", nullable=True),
        ),
    )
    clearing_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_CSTB_CLEARING_MASTER",
        columns=(
            SourceColumn(name="REFERENCE_NO", data_type="VARCHAR2(35)", nullable=True),
            SourceColumn(name="STATUS", data_type="VARCHAR2(4)", nullable=True),
            SourceColumn(name="ACC_CCY_AMT", data_type="NUMBER(24,3)", nullable=True),
            SourceColumn(name="INSTRUMENT_AMT", data_type="NUMBER(24,3)", nullable=True),
        ),
    )
    interest_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_ICTB_ACC_PR",
        columns=(
            SourceColumn(name="ACC", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="LAST_LIQ_DT", data_type="DATE", nullable=True),
            SourceColumn(name="HAS_PROBLEMS", data_type="VARCHAR2(1)", nullable=True),
        ),
    )
    dates_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_STTM_DATES",
        columns=(
            SourceColumn(name="BRANCH_CODE", data_type="VARCHAR2(3)", nullable=True),
            SourceColumn(name="TODAY", data_type="DATE", nullable=True),
            SourceColumn(name="NEXT_WORKING_DAY", data_type="DATE", nullable=True),
            SourceColumn(name="AUTH_STAT", data_type="VARCHAR2(1)", nullable=True),
        ),
    )

    atm_rows = list(generate_rows(atm_table, 3, seed=1))
    clearing_rows = list(generate_rows(clearing_table, 2, seed=1))
    interest_row = next(generate_rows(interest_table, 1, seed=1))
    dates_rows = list(generate_rows(dates_table, 2, seed=1))

    assert atm_rows[0]["TRANS_STATUS"] == "F"
    assert atm_rows[2]["TRANS_STATUS"] == "A"
    assert atm_rows[0]["CARD_NO"] == "5432XXXXXXXX1234"
    assert clearing_rows[0]["STATUS"] == "PEND"
    assert clearing_rows[1]["STATUS"] == "REJ"
    assert interest_row["LAST_LIQ_DT"] == "2026-04-30"
    assert interest_row["HAS_PROBLEMS"] == "Y"
    assert dates_rows[0]["NEXT_WORKING_DAY"] == (TEST_TODAY + timedelta(days=1)).isoformat()
    assert dates_rows[1]["BRANCH_CODE"] != "001"


def test_synthetic_operational_examples_cover_teller_and_term_deposits() -> None:
    teller_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_DETB_RTL_TELLER_2",
        columns=(
            SourceColumn(name="TRN_REF_NO", data_type="VARCHAR2(16)", nullable=True),
            SourceColumn(name="TXN_ACC", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="TXN_AMOUNT", data_type="NUMBER(22,3)", nullable=True),
            SourceColumn(name="AUTH_STAT", data_type="VARCHAR2(1)", nullable=True),
            SourceColumn(name="MODULE", data_type="VARCHAR2(2)", nullable=True),
            SourceColumn(name="TRN_DT", data_type="DATE", nullable=True),
        ),
    )
    deposit_table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_ICTM_TD_DETAILS",
        columns=(
            SourceColumn(name="REFERENCE_NO", data_type="VARCHAR2(16)", nullable=True),
            SourceColumn(name="ACC", data_type="VARCHAR2(20)", nullable=True),
            SourceColumn(name="LIQD_DATE", data_type="DATE", nullable=True),
            SourceColumn(name="TD_AMOUNT", data_type="NUMBER(22,3)", nullable=True),
            SourceColumn(name="TD_MATURITY_AMT", data_type="NUMBER(22,3)", nullable=True),
        ),
    )

    teller_rows = list(generate_rows(teller_table, 2, seed=1))
    deposit_rows = list(generate_rows(deposit_table, 2, seed=1))

    assert teller_rows[0]["TRN_REF_NO"] == "TL_PENDING_001"
    assert {row["AUTH_STAT"] for row in teller_rows} == {"U"}
    assert {row["MODULE"] for row in teller_rows} == {"TL"}
    assert teller_rows[0]["TRN_DT"] == TEST_TODAY.isoformat()
    assert deposit_rows[0]["REFERENCE_NO"] == "TD_NEXT_001"
    assert deposit_rows[0]["LIQD_DATE"] == TEST_TODAY.isoformat()
