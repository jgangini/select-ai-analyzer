from __future__ import annotations

import re
import unicodedata

QUESTION_SYNONYM_GROUPS = (
    (("ATM",), {"ATM"}),
    (("TELLER",), {"TELLER", "TL"}),
    (("MONEDA",), {"CCY", "CURRENCY"}),
    (("SALDO",), {"BAL", "BALANCE", "ACY", "LCY", "FCY"}),
    (("ACTUAL", "ACTUALES"), {"CURRENT", "CURR"}),
    (("BLOQUEADO", "BLOQUEADA", "BLOQUEADOS", "BLOQUEADAS"), {"BLOCKED", "ACY_BLOCKED_AMOUNT"}),
    (("PROMEDIO", "PROMEDIOS"), {"AVERAGE", "AVG"}),
    (("SUCURSAL",), {"BRANCH", "BRN"}),
    (("CLIENTE", "CLIENTES"), {"CUSTOMER", "CUST"}),
    (("CUENTA",), {"ACCOUNT", "ACC", "AC"}),
    (("TRANSACCION", "TRANSACCIONES", "MOVIMIENTO", "MOVIMIENTOS"), {"TRANSACTION", "TRANS", "TXN", "TRN"}),
    (("OPERACION", "OPERACIONES"), {"OPERATION", "TRANSACTION", "TXN", "TRN"}),
    (("DEBITO", "DEBITOS"), {"DEBIT", "DR"}),
    (("CREDITO", "CREDITOS"), {"CREDIT", "CR"}),
    (("EVOLUCION", "TENDENCIA"), {"TREND"}),
    (("DIARIO", "DIARIA"), {"DAILY"}),
    (("PORCENTAJE",), {"PERCENT", "RATIO", "COUNT"}),
    (("MONTO", "MONTOS"), {"AMOUNT", "AMT"}),
    (("INSTRUMENTO", "INSTRUMENTOS"), {"INSTRUMENT"}),
    (("CLEARING",), {"CLEARING", "CLG"}),
    (("CONCILIACION",), {"CLEARING", "CLG", "MATCH"}),
    (("CHEQUE", "CHEQUES"), {"CHECK", "CHEQUE", "INSTRUMENT"}),
    (("RECHAZADO", "RECHAZADOS"), {"REJECT", "REJECTED", "STATUS"}),
    (("PENDIENTE", "PENDIENTES"), {"PENDING", "STATUS", "AUTH"}),
    (("INTERES", "INTERESES"), {"INTEREST", "INT", "RATE"}),
    (("LIQUIDACION",), {"LIQ", "LIQUIDATION"}),
    (("CALCULO",), {"CALC", "CALCULATION"}),
    (("PROGRAMADO",), {"SCHEDULED", "NEXT"}),
    (("PROXIMO", "PROXIMA", "PROXIMOS", "PROXIMAS"), {"NEXT"}),
    (("FECHA", "FECHAS"), {"DATE", "DT"}),
    (("DIA", "DIAS"), {"DAY", "DAYS"}),
    (("HABIL",), {"WORKING", "BUSINESS", "NEXT", "PREV"}),
    (("FRAUDE", "ANOMALIA", "ANOMALIAS"), {"FAILED", "STATUS", "REVERSAL", "HIDE"}),
    (("OCULTA", "OCULTAS", "OCULTO", "OCULTOS"), {"HIDE", "HIDDEN", "TXN"}),
    (("REVERTIDA", "REVERTIDAS"), {"REVERSAL", "REVERSED", "REV"}),
    (("AUTORIZO", "AUTORIZARON"), {"AUTH", "AUTH_ID", "USER"}),
    (("AUTORIZADO", "AUTORIZADAS"), {"AUTH", "AUTH_STAT"}),
    (("TRAZABILIDAD", "AUDITORIA"), {"LOG", "TRACE", "DAILY_LOG"}),
    (("CONTABLE", "CONTABLES"), {"ACCOUNTING", "DAILY_LOG", "LOG"}),
    (("INACTIVO", "INACTIVOS"), {"INACTIVE", "DORMANT", "DORMANCY"}),
    (("PRODUCTO", "PRODUCTOS"), {"PRODUCT", "PROD"}),
    (("COMISION", "COMISIONES"), {"FEE", "CHARGE", "COMMISSION"}),
    (("VOLUMEN",), {"VOLUME", "AMOUNT", "COUNT"}),
    (("AUMENTO", "AUMENTARON", "CRECIERON", "CRECIMIENTO"), {"INCREASE", "GROWTH"}),
    (("MES",), {"MONTH"}),
    (("CANAL", "CANALES"), {"CHANNEL", "SOURCE", "ATM"}),
    (("CAJERO", "CAJEROS"), {"ATM", "TERM", "TERMINAL"}),
    (("RETIRO", "RETIROS"), {"WITHDRAWAL", "WDR", "TRANS_AMOUNT"}),
    (("TARJETA", "TARJETAS"), {"CARD", "CARD_NO"}),
    (("FALLIDA", "FALLIDAS"), {"FAILED", "STATUS"}),
    (("HORA", "HORAS"), {"HOUR", "TIME"}),
    (("HISTORICO", "HISTORICA"), {"HISTORICAL", "REAL_DT_TIME"}),
    (("SEMANA",), {"WEEK"}),
    (("PASADA",), {"PREVIOUS"}),
    (("CONTRATO", "CONTRATOS"), {"CONTRACT", "REFERENCE", "REF"}),
    (("DEPOSITO", "DEPOSITOS"), {"DEPOSIT", "TD"}),
    (("VENCER", "VENCE", "VENCEN", "VENCIMIENTO"), {"MATURITY", "LIQD_DATE", "DUE"}),
    (("PRESTAMO", "PRESTAMOS"), {"LOAN", "AMOUNT_FINANCED", "AMOUNT_DISBURSED", "EMI"}),
    (("DEUDA", "DEUDAS"), {"LOAN", "DEBT", "AMOUNT_FINANCED", "AMOUNT_DISBURSED", "EMI"}),
)
QUESTION_SYNONYMS = {
    token: synonyms
    for tokens, synonyms in QUESTION_SYNONYM_GROUPS
    for token in tokens
}

TRANSACTION_INTENT_TOKENS = {
    "TRANSACCION",
    "TRANSACCIONES",
    "MOVIMIENTO",
    "MOVIMIENTOS",
    "DEBITO",
    "DEBITOS",
    "CREDITO",
    "CREDITOS",
    "DR",
    "CR",
    "DRCR",
}
DRCR_INTENT_TOKENS = {"DEBITO", "DEBITOS", "CREDITO", "CREDITOS", "DR", "CR", "DRCR"}


def _question_has_any(question_tokens: set[str], *tokens: str) -> bool:
    return bool(question_tokens & {token.upper() for token in tokens})


def _is_clearing_intent(question_tokens: set[str]) -> bool:
    if _question_has_any(question_tokens, "CLEARING", "CONCILIACION", "CHEQUE", "CHEQUES"):
        return True
    return (
        _question_has_any(question_tokens, "INSTRUMENTO", "INSTRUMENTOS", "INSTRUMENT")
        and _question_has_any(question_tokens, "MONTO", "MONTOS", "AMOUNT", "AMT")
        and _question_has_any(question_tokens, "CUENTA", "ACCOUNT", "ACC")
    )


def _tokenize_for_match(value: str) -> set[str]:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return {token for token in re.split(r"[^A-Z0-9]+", ascii_text.upper()) if token}


def _expanded_question_tokens(question: str) -> set[str]:
    tokens = _tokenize_for_match(question)
    expanded = set(tokens)
    for token in tokens:
        expanded.update(QUESTION_SYNONYMS.get(token, set()))
    return expanded


def _is_debit_credit_intent(question_tokens: set[str]) -> bool:
    return bool(question_tokens & DRCR_INTENT_TOKENS)


def _is_drcr_amount_intent(question: str) -> bool:
    return _is_debit_credit_intent(_expanded_question_tokens(question))


def _is_velocity_window_intent(question: str) -> bool:
    question_tokens = _expanded_question_tokens(question)
    return _question_has_any(question_tokens, "HORA", "HORAS", "HOUR") and _question_has_any(
        question_tokens, "TRANSACCION", "TRANSACCIONES", "MOVIMIENTO", "MOVIMIENTOS", "TXN", "TRN"
    )


def _is_teller_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "TELLER", "TL")


def _is_term_deposit_maturity_intent(question_tokens: set[str]) -> bool:
    has_deposit_or_contract = _question_has_any(
        question_tokens,
        "DEPOSITO",
        "DEPOSITOS",
        "DEPOSIT",
        "TD",
        "CONTRATO",
        "CONTRATOS",
        "CONTRACT",
    )
    has_maturity_or_next = _question_has_any(
        question_tokens,
        "VENCER",
        "VENCE",
        "VENCIMIENTO",
        "MATURITY",
        "LIQD_DATE",
        "DUE",
        "PROXIMO",
        "PROXIMA",
        "NEXT",
    )
    return has_deposit_or_contract and has_maturity_or_next


def _is_term_deposit_maturity_window_intent(question_tokens: set[str]) -> bool:
    return _is_term_deposit_maturity_intent(question_tokens) and _question_has_any(
        question_tokens, "DIA", "DIAS", "DAY", "DAYS", "30"
    )


def _is_atm_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "ATM", "CAJERO", "CAJEROS", "TARJETA", "TARJETAS", "RETIRO", "RETIROS")


def _is_balance_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE")


def _is_current_balance_intent(question_tokens: set[str]) -> bool:
    return _is_balance_intent(question_tokens) and _question_has_any(
        question_tokens, "ACTUAL", "ACTUALES", "CURRENT", "CURR"
    )


def _is_blocked_balance_intent(question_tokens: set[str]) -> bool:
    return _is_balance_intent(question_tokens) and _question_has_any(
        question_tokens, "BLOQUEADO", "BLOQUEADA", "BLOQUEADOS", "BLOQUEADAS", "BLOCKED", "ACY_BLOCKED_AMOUNT"
    )


def _is_average_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "PROMEDIO", "PROMEDIOS", "AVERAGE", "AVG")


def _is_average_balance_intent(question_tokens: set[str]) -> bool:
    return _is_balance_intent(question_tokens) and _is_average_intent(question_tokens)


def _is_business_date_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS") and _question_has_any(
        question_tokens,
        "FECHA",
        "FECHAS",
        "DATE",
        "DT",
        "SUCURSAL",
        "BRANCH",
    )


def _is_interest_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "INTERES", "INTERESES", "LIQUIDACION", "CALCULO")


def _is_authorization_audit_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "AUTORIZO", "AUDITORIA", "TRAZABILIDAD", "AUTH")


def _is_authorization_preference_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "AUTORIZO", "AUTORIZ", "AUTH", "AUDITORIA", "TRAZABILIDAD")


def _is_closing_or_average_balance_intent(question: str, question_tokens: set[str]) -> bool:
    question_upper = str(question or "").upper()
    return _is_balance_intent(question_tokens) and (
        "CIERRE" in question_upper or "CLOSING" in question_upper or _is_average_balance_intent(question_tokens)
    )


def _is_hidden_transaction_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "OCULTA", "OCULTAS", "HIDE", "HIDDEN")


def _is_general_transaction_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(
        question_tokens,
        "TRANSACCION",
        "TRANSACCIONES",
        "MOVIMIENTO",
        "MOVIMIENTOS",
        "DEBITO",
        "DEBITOS",
        "CREDITO",
        "CREDITOS",
        "PRODUCTO",
        "PRODUCTOS",
        "VOLUMEN",
        "FRAUDE",
        "ANOMALIA",
        "ANOMALIAS",
        "INUSUAL",
    )


def _is_product_or_volume_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "PRODUCTO", "PRODUCTOS", "PRODUCT", "PROD", "VOLUMEN")


def _is_product_transaction_volume_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "PRODUCTO", "PRODUCTOS", "PRODUCT", "PROD") and _question_has_any(
        question_tokens, "VOLUMEN", "TRANSACCION", "TRANSACCIONES", "TXN"
    )


def _is_daily_debit_credit_trend_intent(question_tokens: set[str]) -> bool:
    return _is_debit_credit_intent(question_tokens) and _question_has_any(
        question_tokens, "EVOLUCION", "TENDENCIA", "TREND", "DIARIO", "DIARIA", "DAILY"
    )


def _is_loan_debt_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(
        question_tokens,
        "PRESTAMO",
        "PRESTAMOS",
        "LOAN",
        "DEUDA",
        "DEUDAS",
        "DEBT",
        "AMOUNT_FINANCED",
        "AMOUNT_DISBURSED",
        "EMI",
    )


def _is_previous_week_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "SEMANA", "WEEK") and _question_has_any(
        question_tokens, "PASADA", "PREVIOUS"
    )


def _is_operating_date_hint_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS")


def _is_customer_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "CLIENTE", "CUSTOMER", "CUST")


def _is_customer_transaction_growth_intent(question_tokens: set[str]) -> bool:
    return (
        _is_customer_intent(question_tokens)
        and _question_has_any(question_tokens, "TRANSACCION", "TRANSACCIONES", "TXN", "TRN")
        and _question_has_any(question_tokens, "VOLUMEN", "VOLUME", "COUNT", "AUMENTO", "INCREASE", "GROWTH")
    )


def preferred_source_object_names(question: str, question_tokens: set[str]) -> tuple[str, ...]:
    rules: tuple[tuple[bool, tuple[str, ...]], ...] = (
        (_is_teller_intent(question_tokens), ("FLEX_DETB_RTL_TELLER_1", "FLEX_DETB_RTL_TELLER_2")),
        (_is_term_deposit_maturity_intent(question_tokens), ("FLEX_ICTM_TD_DETAILS", "FLEX_ICTW_TD_DETAILS")),
        (_is_atm_intent(question_tokens), ("FLEX_IFTB_ATM_TRANS_LOG",)),
        (_is_clearing_intent(question_tokens), ("FLEX_CSTB_CLEARING_MASTER",)),
        (_is_loan_debt_intent(question_tokens), ("FLEX_CLTC_ACCOUNT_MASTER", "FLEX_CLTB_ACCOUNT_APPS_MASTER")),
        (
            _is_current_balance_intent(question_tokens) or _is_blocked_balance_intent(question_tokens),
            ("FLEX_STTM_CUST_ACCOUNT", "FLEX_STTW_CUST_ACCOUNT"),
        ),
        (_is_business_date_intent(question_tokens), ("FLEX_STTM_DATES",)),
        (
            _is_interest_intent(question_tokens) and _question_has_any(question_tokens, "CUENTA", "ACCOUNT", "ACC"),
            ("FLEX_ICTB_ACC_PR",),
        ),
        (_is_interest_intent(question_tokens), ("FLEX_ICTB_ACC_PR", "FLEX_ICTM_PR_INT")),
        (_is_authorization_preference_intent(question_tokens), ("FLEX_ACTB_DAILY_LOG_1", "FLEX_ACTB_DAILY_LOG_2")),
        (_is_closing_or_average_balance_intent(question, question_tokens), ("FLEX_ACTB_ACCBAL_HISTORY",)),
        (_is_hidden_transaction_intent(question_tokens), ("FLEX_EXT_ACCOUNT_STATEMENT", "FLEX_EXT_ACCOUNT_TRANSACTIONS")),
        (_is_general_transaction_intent(question_tokens), ("FLEX_EXT_ACCOUNT_TRANSACTIONS",)),
    )
    for matches, names in rules:
        if matches:
            return names
    return ()


def _uses_current_clock(sql: str) -> bool:
    return bool(re.search(r"\b(SYSTIMESTAMP|SYSDATE|CURRENT_DATE|CURRENT_TIMESTAMP)\b", str(sql or ""), re.IGNORECASE))


def _uses_current_clock_for_velocity_sql(sql: str) -> bool:
    value = str(sql or "")
    return _uses_current_clock(value) and bool(re.search(r"\b(REAL_DT_TIME|TXN_INIT_DATE)\b", value, re.IGNORECASE))


DEBIT_CREDIT_HINTS = (
    "For debit and credit movement analysis, DRCR_IND='D' means debit and DRCR_IND='C' means credit.",
    "For account debit vs credit totals by month, use FLEX_EXT_ACCOUNT_TRANSACTIONS with ACCOUNT_NO, TRN_DT, LCY_AMOUNT, and DRCR_IND. "
    "For March in this demo data, use TRN_DT >= DATE '2026-03-01' and TRN_DT < DATE '2026-04-01'.",
)
AVERAGE_BALANCE_HINTS = (
    "For average balance by branch and currency, use FLEX_ACTB_ACCBAL_HISTORY with BRANCH_CODE, ACC_CCY, ACY_CLOSING_BAL, and BKG_DATE. "
    "For 'este mes' or current month, filter BKG_DATE from TRUNC(SYSDATE,'MM') inclusive to ADD_MONTHS(TRUNC(SYSDATE,'MM'),1) exclusive; do not filter by account opening dates.",
)
CURRENT_BALANCE_HINTS = (
    "For current balance by branch and currency, use FLEX_STTM_CUST_ACCOUNT with BRANCH_CODE, CCY, CUST_AC_NO, LCY_CURR_BALANCE, and ACY_CURR_BALANCE.",
)
BLOCKED_BALANCE_HINTS = (
    "For blocked balances, use FLEX_STTM_CUST_ACCOUNT with CUST_AC_NO, CUST_NO, BRANCH_CODE, CCY, ACY_BLOCKED_AMOUNT, and LCY_CURR_BALANCE.",
)
HIDDEN_TRANSACTION_HINTS = ("Hidden statement transactions are identified by HIDE_TXN_IN_STMT='Y'.",)
DAILY_DEBIT_CREDIT_TREND_HINTS = (
    "For daily debit and credit trends, aggregate FLEX_EXT_ACCOUNT_TRANSACTIONS by TRUNC(TRN_DT) and split LCY_AMOUNT with DRCR_IND='D' for debits and DRCR_IND='C' for credits.",
)
VELOCITY_WINDOW_HINTS = (
    "For velocity anomalies such as more than N transactions in less than one hour, scan the historical dataset by account using REAL_DT_TIME or TXN_INIT_DATE; never filter relative to SYSTIMESTAMP or SYSDATE. "
    "Use a grouped historical window shape: GROUP BY ACCOUNT_NO, TRUNC(REAL_DT_TIME) HAVING COUNT(*) > N AND (MAX(REAL_DT_TIME) - MIN(REAL_DT_TIME)) * 24 < 1.",
)
PREVIOUS_WEEK_HINTS = (
    "For 'semana pasada', use the previous ISO calendar week: TRN_DT >= TRUNC(SYSDATE,'IW') - 7 and TRN_DT < TRUNC(SYSDATE,'IW').",
)
AUTHORIZATION_AUDIT_HINTS = ("In accounting daily logs, AUTH_ID is the authorizer and TRN_REF_NO is the transaction reference.",)
ATM_HINTS = ("In ATM logs, TRANS_STATUS='F' means failed, TRANS_CODE='WDR' means withdrawal, and CARD_NO stores the card number.",)
CLEARING_HINTS = (
    "For pending clearing transactions, use FLEX_CSTB_CLEARING_MASTER and return a SELECT statement only. "
    "STATUS='PEND' means pending and STATUS='REJ' means rejected.",
    "For clearing amount differences, compare ACC_CCY_AMT with INSTRUMENT_AMT.",
)
TELLER_HINTS = (
    "For teller authorization questions, use FLEX_DETB_RTL_TELLER_1 or FLEX_DETB_RTL_TELLER_2. "
    "AUTH_STAT='U' means pending authorization and MODULE='TL' identifies teller activity.",
)
TERM_DEPOSIT_MATURITY_HINTS = (
    "For the next deposit contract to mature, use FLEX_ICTM_TD_DETAILS. "
    "LIQD_DATE is the maturity or liquidation date, REFERENCE_NO is the contract reference, TD_AMOUNT is principal, and TD_MATURITY_AMT is the maturity amount. "
    "Return the row where LIQD_DATE >= TRUNC(SYSDATE), ordered by LIQD_DATE, FETCH FIRST 1 ROW ONLY.",
)
INTEREST_HINTS = ("For account interest processing, FLEX_ICTB_ACC_PR.ACC is the account and LAST_LIQ_DT is the last liquidation date.",)
OPERATING_DATE_HINTS = ("For operating dates, FLEX_STTM_DATES.NEXT_WORKING_DAY is the next business day.",)
CUSTOMER_HINTS = ("For external account transactions, RELATED_CUSTOMER stores the customer id.",)
CUSTOMER_GROWTH_HINTS = (
    "For customers whose transaction volume increased more than 50% this month, compare COUNT(TXN_ID) by RELATED_CUSTOMER "
    "between TRUNC(SYSDATE,'MM') and ADD_MONTHS(TRUNC(SYSDATE,'MM'), -1) in FLEX_EXT_ACCOUNT_TRANSACTIONS.",
)
PRODUCT_VOLUME_HINTS = (
    "For product transaction volume, rank PRODUCT_CODE by COUNT(TXN_ID) from FLEX_EXT_ACCOUNT_TRANSACTIONS unless the user explicitly asks for monetary amount.",
)
LOAN_DEBT_HINTS = (
    "For loan or debt exposure, use FLEX_CLTC_ACCOUNT_MASTER with ACCOUNT_NUMBER, CUSTOMER_ID, PRODUCT_CODE, CURRENCY, AMOUNT_FINANCED, AMOUNT_DISBURSED, EMI_AMOUNT, and MATURITY_DATE. "
    "If the user asks pending debt, calculate NVL(AMOUNT_FINANCED,0) - NVL(AMOUNT_DISBURSED,0) as ESTIMATED_PENDING_DEBT.",
)

CURRENT_BALANCE_FALLBACK_SQL = """
    SELECT
        BRANCH_CODE,
        CCY,
        COUNT(CUST_AC_NO) AS ACCOUNT_COUNT,
        SUM(NVL(LCY_CURR_BALANCE, 0)) AS TOTAL_LCY_BALANCE,
        SUM(NVL(ACY_CURR_BALANCE, 0)) AS TOTAL_ACY_BALANCE
    FROM APP_AGENT_DATA.FLEX_STTM_CUST_ACCOUNT
    GROUP BY BRANCH_CODE, CCY
    ORDER BY TOTAL_LCY_BALANCE DESC, ACCOUNT_COUNT DESC
    FETCH FIRST 50 ROWS ONLY
"""
BLOCKED_BALANCE_FALLBACK_SQL = """
    SELECT
        CUST_AC_NO,
        CUST_NO,
        BRANCH_CODE,
        CCY,
        ACY_BLOCKED_AMOUNT,
        LCY_CURR_BALANCE
    FROM APP_AGENT_DATA.FLEX_STTM_CUST_ACCOUNT
    WHERE NVL(ACY_BLOCKED_AMOUNT, 0) > 0
    ORDER BY ACY_BLOCKED_AMOUNT DESC, LCY_CURR_BALANCE DESC
    FETCH FIRST 50 ROWS ONLY
"""
PRODUCT_VOLUME_FALLBACK_SQL = """
    SELECT
        PRODUCT_CODE,
        COUNT(TXN_ID) AS TRANSACTION_COUNT,
        SUM(NVL(LCY_AMOUNT, 0)) AS TOTAL_LCY_AMOUNT,
        COUNT(DISTINCT ACCOUNT_NO) AS ACCOUNT_COUNT
    FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS
    WHERE TRN_DT >= TRUNC(SYSDATE, 'MM')
      AND TRN_DT < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
    GROUP BY PRODUCT_CODE
    ORDER BY TRANSACTION_COUNT DESC, TOTAL_LCY_AMOUNT DESC
    FETCH FIRST 50 ROWS ONLY
"""
DAILY_DEBIT_CREDIT_TREND_FALLBACK_SQL = """
    SELECT
        TRUNC(TRN_DT) AS TRANSACTION_DATE,
        SUM(CASE WHEN DRCR_IND = 'D' THEN NVL(LCY_AMOUNT, 0) ELSE 0 END) AS DEBIT_LCY_AMOUNT,
        SUM(CASE WHEN DRCR_IND = 'C' THEN NVL(LCY_AMOUNT, 0) ELSE 0 END) AS CREDIT_LCY_AMOUNT,
        COUNT(TXN_ID) AS TRANSACTION_COUNT
    FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS
    WHERE TRN_DT >= DATE '2026-03-01'
      AND TRN_DT < DATE '2026-04-01'
    GROUP BY TRUNC(TRN_DT)
    ORDER BY TRANSACTION_DATE
    FETCH FIRST 50 ROWS ONLY
"""
CUSTOMER_GROWTH_FALLBACK_SQL = """
    WITH monthly_volume AS (
        SELECT
            RELATED_CUSTOMER,
            TRUNC(TRN_DT, 'MM') AS MONTH_START,
            COUNT(TXN_ID) AS TRANSACTION_COUNT,
            SUM(NVL(LCY_AMOUNT, 0)) AS TOTAL_LCY_AMOUNT
        FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS
        WHERE RELATED_CUSTOMER IS NOT NULL
          AND TRN_DT >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)
          AND TRN_DT < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
        GROUP BY RELATED_CUSTOMER, TRUNC(TRN_DT, 'MM')
    )
    SELECT
        current_month.RELATED_CUSTOMER,
        previous_month.TRANSACTION_COUNT AS PREVIOUS_TRANSACTION_COUNT,
        current_month.TRANSACTION_COUNT AS CURRENT_TRANSACTION_COUNT,
        ROUND(
            ((current_month.TRANSACTION_COUNT - previous_month.TRANSACTION_COUNT) /
            NULLIF(previous_month.TRANSACTION_COUNT, 0)) * 100,
            2
        ) AS TRANSACTION_GROWTH_PCT,
        previous_month.TOTAL_LCY_AMOUNT AS PREVIOUS_LCY_AMOUNT,
        current_month.TOTAL_LCY_AMOUNT AS CURRENT_LCY_AMOUNT
    FROM monthly_volume current_month
    JOIN monthly_volume previous_month
      ON previous_month.RELATED_CUSTOMER = current_month.RELATED_CUSTOMER
    WHERE current_month.MONTH_START = TRUNC(SYSDATE, 'MM')
      AND previous_month.MONTH_START = ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)
      AND previous_month.TRANSACTION_COUNT > 0
      AND current_month.TRANSACTION_COUNT > previous_month.TRANSACTION_COUNT * 1.5
    ORDER BY TRANSACTION_GROWTH_PCT DESC, current_month.TRANSACTION_COUNT DESC
    FETCH FIRST 50 ROWS ONLY
"""
ATM_WITHDRAWAL_FALLBACK_SQL = """
    SELECT
        TRANS_AC_NO,
        TRANS_CCY,
        COUNT(TXN_ID) AS WITHDRAWAL_COUNT,
        SUM(NVL(TRANS_AMOUNT, 0)) AS TOTAL_WITHDRAWAL_AMOUNT,
        MAX(TRANS_DATE) AS LAST_WITHDRAWAL_DATE
    FROM APP_AGENT_DATA.FLEX_IFTB_ATM_TRANS_LOG
    WHERE UPPER(TRANS_CODE) = 'WDR'
    GROUP BY TRANS_AC_NO, TRANS_CCY
    ORDER BY TOTAL_WITHDRAWAL_AMOUNT DESC, WITHDRAWAL_COUNT DESC
    FETCH FIRST 50 ROWS ONLY
"""
LOAN_DEBT_FALLBACK_SQL = """
    SELECT
        ACCOUNT_NUMBER,
        CUSTOMER_ID,
        PRODUCT_CODE,
        CURRENCY,
        AMOUNT_FINANCED,
        AMOUNT_DISBURSED,
        EMI_AMOUNT,
        MATURITY_DATE,
        NVL(AMOUNT_FINANCED, 0) - NVL(AMOUNT_DISBURSED, 0) AS ESTIMATED_PENDING_DEBT
    FROM APP_AGENT_DATA.FLEX_CLTC_ACCOUNT_MASTER
    ORDER BY ESTIMATED_PENDING_DEBT DESC, AMOUNT_FINANCED DESC
    FETCH FIRST 50 ROWS ONLY
"""
TELLER_FALLBACK_SQL = """
    SELECT TRN_REF_NO, TXN_ACC, TXN_CCY, TXN_AMOUNT, TRN_DT, MAKER_ID, AUTH_STAT
    FROM APP_AGENT_DATA.FLEX_DETB_RTL_TELLER_2
    WHERE UPPER(AUTH_STAT) = 'U'
    ORDER BY TRN_DT DESC, TRN_REF_NO
    FETCH FIRST 50 ROWS ONLY
"""
TERM_DEPOSIT_WINDOW_FALLBACK_SQL = """
    SELECT REFERENCE_NO, ACC, BRN, CCY, LIQD_DATE, TD_AMOUNT, TD_MATURITY_AMT
    FROM APP_AGENT_DATA.FLEX_ICTM_TD_DETAILS
    WHERE LIQD_DATE >= TRUNC(SYSDATE)
      AND LIQD_DATE < TRUNC(SYSDATE) + 31
    ORDER BY LIQD_DATE, REFERENCE_NO
    FETCH FIRST 50 ROWS ONLY
"""
TERM_DEPOSIT_NEXT_FALLBACK_SQL = """
    SELECT REFERENCE_NO, ACC, BRN, CCY, LIQD_DATE, TD_AMOUNT, TD_MATURITY_AMT
    FROM APP_AGENT_DATA.FLEX_ICTM_TD_DETAILS
    WHERE LIQD_DATE >= TRUNC(SYSDATE)
    ORDER BY LIQD_DATE, REFERENCE_NO
    FETCH FIRST 1 ROW ONLY
"""
CLEARING_FALLBACK_SQL = """
    SELECT REFERENCE_NO, STATUS, AUTH_STAT, TXN_DATE, REM_ACCOUNT, BEN_ACCOUNT, ACC_CCY_AMT, INSTRUMENT_AMT
    FROM APP_AGENT_DATA.FLEX_CSTB_CLEARING_MASTER
    WHERE UPPER(STATUS) = 'PEND' OR UPPER(AUTH_STAT) = 'U'
    ORDER BY TXN_DATE DESC, REFERENCE_NO
    FETCH FIRST 50 ROWS ONLY
"""
HIDDEN_TRANSACTION_FALLBACK_SQL = """
    SELECT
        ACCOUNT_NO,
        TRN_REF_NO,
        TRN_DT,
        DRCR_IND,
        LCY_AMOUNT,
        HIDE_TXN_IN_STMT
    FROM APP_AGENT_DATA.FLEX_EXT_ACCOUNT_TRANSACTIONS
    WHERE UPPER(HIDE_TXN_IN_STMT) = 'Y'
    ORDER BY TRN_DT DESC, TRN_REF_NO
    FETCH FIRST 50 ROWS ONLY
"""
AUTHORIZATION_AUDIT_FALLBACK_SQL = """
    SELECT
        AUTH_ID,
        COUNT(TRN_REF_NO) AS AUTHORIZED_MOVEMENT_COUNT,
        SUM(NVL(LCY_AMOUNT, 0)) AS TOTAL_LCY_AMOUNT
    FROM APP_AGENT_DATA.FLEX_ACTB_DAILY_LOG_1
    WHERE AUTH_ID IS NOT NULL
    GROUP BY AUTH_ID
    ORDER BY AUTHORIZED_MOVEMENT_COUNT DESC, TOTAL_LCY_AMOUNT DESC
    FETCH FIRST 50 ROWS ONLY
"""


def _sql_generation_hints(question: str) -> str:
    question_tokens = _expanded_question_tokens(question)
    hints: list[str] = []
    hint_rules: tuple[tuple[bool, tuple[str, ...]], ...] = (
        (_is_debit_credit_intent(question_tokens), DEBIT_CREDIT_HINTS),
        (_is_average_balance_intent(question_tokens), AVERAGE_BALANCE_HINTS),
        (_is_current_balance_intent(question_tokens), CURRENT_BALANCE_HINTS),
        (_is_blocked_balance_intent(question_tokens), BLOCKED_BALANCE_HINTS),
        (_is_hidden_transaction_intent(question_tokens), HIDDEN_TRANSACTION_HINTS),
        (_is_daily_debit_credit_trend_intent(question_tokens), DAILY_DEBIT_CREDIT_TREND_HINTS),
        (_is_velocity_window_intent(question), VELOCITY_WINDOW_HINTS),
        (_is_previous_week_intent(question_tokens), PREVIOUS_WEEK_HINTS),
        (_is_authorization_audit_intent(question_tokens), AUTHORIZATION_AUDIT_HINTS),
        (_is_atm_intent(question_tokens), ATM_HINTS),
        (_is_clearing_intent(question_tokens), CLEARING_HINTS),
        (_is_teller_intent(question_tokens), TELLER_HINTS),
        (_is_term_deposit_maturity_intent(question_tokens), TERM_DEPOSIT_MATURITY_HINTS),
        (_is_interest_intent(question_tokens), INTEREST_HINTS),
        (_is_operating_date_hint_intent(question_tokens), OPERATING_DATE_HINTS),
        (_is_customer_intent(question_tokens), CUSTOMER_HINTS),
        (_is_customer_transaction_growth_intent(question_tokens), CUSTOMER_GROWTH_HINTS),
        (_is_product_transaction_volume_intent(question_tokens), PRODUCT_VOLUME_HINTS),
        (_is_loan_debt_intent(question_tokens), LOAN_DEBT_HINTS),
    )
    for matches, messages in hint_rules:
        if matches:
            hints.extend(messages)
    return " ".join(hints)


def _fallback_sql_for_question(question: str) -> str | None:
    question_tokens = _expanded_question_tokens(question)
    fallback_rules: tuple[tuple[bool, str], ...] = (
        (_is_current_balance_intent(question_tokens), CURRENT_BALANCE_FALLBACK_SQL),
        (_is_blocked_balance_intent(question_tokens), BLOCKED_BALANCE_FALLBACK_SQL),
        (_is_product_transaction_volume_intent(question_tokens), PRODUCT_VOLUME_FALLBACK_SQL),
        (_is_daily_debit_credit_trend_intent(question_tokens), DAILY_DEBIT_CREDIT_TREND_FALLBACK_SQL),
        (_is_customer_transaction_growth_intent(question_tokens), CUSTOMER_GROWTH_FALLBACK_SQL),
        (_is_atm_intent(question_tokens), ATM_WITHDRAWAL_FALLBACK_SQL),
        (_is_loan_debt_intent(question_tokens), LOAN_DEBT_FALLBACK_SQL),
        (_is_teller_intent(question_tokens), TELLER_FALLBACK_SQL),
        (_is_term_deposit_maturity_window_intent(question_tokens), TERM_DEPOSIT_WINDOW_FALLBACK_SQL),
        (_is_term_deposit_maturity_intent(question_tokens), TERM_DEPOSIT_NEXT_FALLBACK_SQL),
        (_is_clearing_intent(question_tokens), CLEARING_FALLBACK_SQL),
        (_is_hidden_transaction_intent(question_tokens), HIDDEN_TRANSACTION_FALLBACK_SQL),
        (_is_authorization_audit_intent(question_tokens), AUTHORIZATION_AUDIT_FALLBACK_SQL),
    )
    for matches, sql in fallback_rules:
        if matches:
            return sql
    return None
