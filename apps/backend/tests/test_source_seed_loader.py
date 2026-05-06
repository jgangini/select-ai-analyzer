from datetime import date, datetime
from decimal import Decimal

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
from apps.backend.app.select_ai.synthetic_data import CURRENCIES, DOC_EXAMPLE_ACCOUNT, generate_rows, value_for_column
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

    assert value_for_column(column, 0, __import__("random").Random(1)) in CURRENCIES


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
