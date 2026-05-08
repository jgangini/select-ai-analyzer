from __future__ import annotations

import re

from apps.backend.app.select_ai.source_intents import (
    _expanded_question_tokens,
    _is_atm_intent,
    _is_authorization_audit_intent,
    _is_average_balance_intent,
    _is_clearing_intent,
    _is_customer_intent,
    _is_debit_credit_intent,
    _is_hidden_transaction_intent,
    _is_interest_intent,
    _is_operating_date_hint_intent,
    _is_previous_week_intent,
    _is_product_transaction_volume_intent,
    _is_teller_intent,
    _is_term_deposit_maturity_intent,
    _is_velocity_window_intent,
)


def _uses_current_clock(sql: str) -> bool:
    return bool(re.search(r"\b(SYSTIMESTAMP|SYSDATE|CURRENT_DATE|CURRENT_TIMESTAMP)\b", str(sql or ""), re.IGNORECASE))


def _uses_current_clock_for_velocity_sql(sql: str) -> bool:
    value = str(sql or "")
    return _uses_current_clock(value) and bool(re.search(r"\b(REAL_DT_TIME|TXN_INIT_DATE)\b", value, re.IGNORECASE))


def _sql_generation_hints(question: str) -> str:
    question_tokens = _expanded_question_tokens(question)
    hints: list[str] = []
    hint_rules: tuple[tuple[bool, tuple[str, ...]], ...] = (
        (
            _is_debit_credit_intent(question_tokens),
            (
                "For debit and credit movement analysis, DRCR_IND='D' means debit and DRCR_IND='C' means credit.",
                "For account debit vs credit totals by month, use FLEX_EXT_ACCOUNT_TRANSACTIONS with ACCOUNT_NO, TRN_DT, LCY_AMOUNT, and DRCR_IND. "
                "For March in this demo data, use TRN_DT >= DATE '2026-03-01' and TRN_DT < DATE '2026-04-01'.",
            ),
        ),
        (
            _is_average_balance_intent(question_tokens),
            (
                "For average balance by branch and currency, use FLEX_ACTB_ACCBAL_HISTORY with BRANCH_CODE, ACC_CCY, ACY_CLOSING_BAL, and BKG_DATE. "
                "For 'este mes' or current month, filter BKG_DATE from TRUNC(SYSDATE,'MM') inclusive to ADD_MONTHS(TRUNC(SYSDATE,'MM'),1) exclusive; do not filter by account opening dates.",
            ),
        ),
        (
            _is_hidden_transaction_intent(question_tokens),
            ("Hidden statement transactions are identified by HIDE_TXN_IN_STMT='Y'.",),
        ),
        (
            _is_velocity_window_intent(question),
            (
                "For velocity anomalies such as more than N transactions in less than one hour, scan the historical dataset by account using REAL_DT_TIME or TXN_INIT_DATE; never filter relative to SYSTIMESTAMP or SYSDATE. "
                "Use a grouped historical window shape: GROUP BY ACCOUNT_NO, TRUNC(REAL_DT_TIME) HAVING COUNT(*) > N AND (MAX(REAL_DT_TIME) - MIN(REAL_DT_TIME)) * 24 < 1.",
            ),
        ),
        (
            _is_previous_week_intent(question_tokens),
            (
                "For 'semana pasada', use the previous ISO calendar week: TRN_DT >= TRUNC(SYSDATE,'IW') - 7 and TRN_DT < TRUNC(SYSDATE,'IW').",
            ),
        ),
        (
            _is_authorization_audit_intent(question_tokens),
            ("In accounting daily logs, AUTH_ID is the authorizer and TRN_REF_NO is the transaction reference.",),
        ),
        (
            _is_atm_intent(question_tokens),
            ("In ATM logs, TRANS_STATUS='F' means failed, TRANS_CODE='WDR' means withdrawal, and CARD_NO stores the card number.",),
        ),
        (
            _is_clearing_intent(question_tokens),
            (
                "For pending clearing transactions, use FLEX_CSTB_CLEARING_MASTER and return a SELECT statement only. "
                "STATUS='PEND' means pending and STATUS='REJ' means rejected.",
                "For clearing amount differences, compare ACC_CCY_AMT with INSTRUMENT_AMT.",
            ),
        ),
        (
            _is_teller_intent(question_tokens),
            (
                "For teller authorization questions, use FLEX_DETB_RTL_TELLER_1 or FLEX_DETB_RTL_TELLER_2. "
                "AUTH_STAT='U' means pending authorization and MODULE='TL' identifies teller activity.",
            ),
        ),
        (
            _is_term_deposit_maturity_intent(question_tokens),
            (
                "For the next deposit contract to mature, use FLEX_ICTM_TD_DETAILS. "
                "LIQD_DATE is the maturity or liquidation date, REFERENCE_NO is the contract reference, TD_AMOUNT is principal, and TD_MATURITY_AMT is the maturity amount. "
                "Return the row where LIQD_DATE >= TRUNC(SYSDATE), ordered by LIQD_DATE, FETCH FIRST 1 ROW ONLY.",
            ),
        ),
        (
            _is_interest_intent(question_tokens),
            (
                "For account interest processing, FLEX_ICTB_ACC_PR.ACC is the account and LAST_LIQ_DT is the last liquidation date.",
            ),
        ),
        (
            _is_operating_date_hint_intent(question_tokens),
            ("For operating dates, FLEX_STTM_DATES.NEXT_WORKING_DAY is the next business day.",),
        ),
        (
            _is_customer_intent(question_tokens),
            ("For external account transactions, RELATED_CUSTOMER stores the customer id.",),
        ),
        (
            _is_product_transaction_volume_intent(question_tokens),
            (
                "For product transaction volume, rank PRODUCT_CODE by COUNT(TXN_ID) from FLEX_EXT_ACCOUNT_TRANSACTIONS unless the user explicitly asks for monetary amount.",
            ),
        ),
    )
    for matches, messages in hint_rules:
        if matches:
            hints.extend(messages)
    return " ".join(hints)


def _fallback_sql_for_question(question: str) -> str | None:
    question_tokens = _expanded_question_tokens(question)
    fallback_rules: tuple[tuple[bool, str], ...] = (
        (
            _is_teller_intent(question_tokens),
            """
            SELECT TRN_REF_NO, TXN_ACC, TXN_CCY, TXN_AMOUNT, TRN_DT, MAKER_ID, AUTH_STAT
            FROM APP_AGENT_DATA.FLEX_DETB_RTL_TELLER_2
            WHERE UPPER(AUTH_STAT) = 'U'
            ORDER BY TRN_DT DESC, TRN_REF_NO
            FETCH FIRST 50 ROWS ONLY
        """,
        ),
        (
            _is_term_deposit_maturity_intent(question_tokens),
            """
            SELECT REFERENCE_NO, ACC, BRN, CCY, LIQD_DATE, TD_AMOUNT, TD_MATURITY_AMT
            FROM APP_AGENT_DATA.FLEX_ICTM_TD_DETAILS
            WHERE LIQD_DATE >= TRUNC(SYSDATE)
            ORDER BY LIQD_DATE, REFERENCE_NO
            FETCH FIRST 1 ROW ONLY
        """,
        ),
        (
            _is_clearing_intent(question_tokens),
            """
            SELECT REFERENCE_NO, STATUS, AUTH_STAT, TXN_DATE, REM_ACCOUNT, BEN_ACCOUNT, ACC_CCY_AMT, INSTRUMENT_AMT
            FROM APP_AGENT_DATA.FLEX_CSTB_CLEARING_MASTER
            WHERE UPPER(STATUS) = 'PEND' OR UPPER(AUTH_STAT) = 'U'
            ORDER BY TXN_DATE DESC, REFERENCE_NO
            FETCH FIRST 50 ROWS ONLY
        """,
        ),
    )
    for matches, sql in fallback_rules:
        if matches:
            return sql
    return None
