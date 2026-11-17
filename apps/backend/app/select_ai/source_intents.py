from __future__ import annotations

import re
import unicodedata

QUESTION_SYNONYM_GROUPS = (
    (("ATM",), {"ATM"}),
    (("TELLER",), {"TELLER", "TL"}),
    (("MONEDA",), {"CCY", "CURRENCY", "CURRENCIES"}),
    (("SALDO",), {"BAL", "BALANCE", "ACY", "LCY", "FCY"}),
    (("ACTUAL", "ACTUALES"), {"CURRENT", "CURR"}),
    (("BLOQUEADO", "BLOQUEADA", "BLOQUEADOS", "BLOQUEADAS"), {"BLOCKED", "ACY_BLOCKED_AMOUNT"}),
    (("PROMEDIO", "PROMEDIOS"), {"AVERAGE", "AVG"}),
    (("SUCURSAL",), {"BRANCH", "BRANCHES", "BRN"}),
    (("CLIENTE", "CLIENTES"), {"CUSTOMER", "CUSTOMERS", "CUST"}),
    (("CUENTA",), {"ACCOUNT", "ACCOUNTS", "ACC", "AC"}),
    (("TRANSACCION", "TRANSACCIONES", "MOVIMIENTO", "MOVIMIENTOS"), {"TRANSACTION", "TRANSACTIONS", "MOVEMENT", "MOVEMENTS", "TRANS", "TXN", "TRN"}),
    (("OPERACION", "OPERACIONES"), {"OPERATION", "TRANSACTION", "TXN", "TRN"}),
    (("DEBITO", "DEBITOS"), {"DEBIT", "DEBITS", "DR"}),
    (("CREDITO", "CREDITOS"), {"CREDIT", "CREDITS", "CR"}),
    (("EVOLUCION", "TENDENCIA"), {"TREND"}),
    (("DIARIO", "DIARIA"), {"DAILY"}),
    (("PORCENTAJE",), {"PERCENT", "RATIO", "COUNT"}),
    (("MONTO", "MONTOS"), {"AMOUNT", "AMT"}),
    (("INSTRUMENTO", "INSTRUMENTOS"), {"INSTRUMENT"}),
    (("CLEARING",), {"CLEARING", "CLG"}),
    (("CONCILIACION",), {"CLEARING", "CLG", "MATCH"}),
    (("CHEQUE", "CHEQUES"), {"CHECK", "CHECKS", "CHEQUE", "INSTRUMENT"}),
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
    (("AUTORIZO", "AUTORIZARON"), {"AUTH", "AUTH_ID", "AUTHORIZED", "AUTHORIZER", "AUTHORIZERS", "USER", "USERS"}),
    (("AUTORIZADO", "AUTORIZADAS"), {"AUTH", "AUTH_STAT", "AUTHORIZED"}),
    (("TRAZABILIDAD", "AUDITORIA"), {"LOG", "TRACE", "DAILY_LOG"}),
    (("CONTABLE", "CONTABLES"), {"ACCOUNTING", "DAILY_LOG", "LOG"}),
    (("INACTIVO", "INACTIVOS"), {"INACTIVE", "DORMANT", "DORMANCY"}),
    (("PRODUCTO", "PRODUCTOS"), {"PRODUCT", "PRODUCTS", "PROD"}),
    (("COMISION", "COMISIONES"), {"FEE", "CHARGE", "COMMISSION"}),
    (("VOLUMEN",), {"VOLUME", "AMOUNT", "COUNT"}),
    (("AUMENTO", "AUMENTARON", "CRECIERON", "CRECIMIENTO"), {"INCREASE", "GROWTH"}),
    (("MES",), {"MONTH"}),
    (("CANAL", "CANALES"), {"CHANNEL", "CHANNELS", "SOURCE", "ATM"}),
    (("CAJERO", "CAJEROS"), {"ATM", "TERM", "TERMINAL"}),
    (("RETIRO", "RETIROS"), {"WITHDRAWAL", "WITHDRAWALS", "WDR", "TRANS_AMOUNT"}),
    (("TARJETA", "TARJETAS"), {"CARD", "CARDS", "CARD_NO"}),
    (("FALLIDA", "FALLIDAS"), {"FAILED", "STATUS"}),
    (("HORA", "HORAS"), {"HOUR", "TIME"}),
    (("HISTORICO", "HISTORICA"), {"HISTORICAL", "REAL_DT_TIME"}),
    (("SEMANA",), {"WEEK"}),
    (("PASADA",), {"PREVIOUS"}),
    (("CONTRATO", "CONTRATOS"), {"CONTRACT", "CONTRACTS", "REFERENCE", "REF"}),
    (("DEPOSITO", "DEPOSITOS"), {"DEPOSIT", "DEPOSITS", "TD"}),
    (("VENCER", "VENCE", "VENCEN", "VENCIMIENTO"), {"MATURITY", "MATURE", "MATURES", "LIQD_DATE", "DUE"}),
    (("PRESTAMO", "PRESTAMOS"), {"LOAN", "LOANS", "AMOUNT_FINANCED", "AMOUNT_DISBURSED", "EMI"}),
    (("DEUDA", "DEUDAS"), {"LOAN", "LOANS", "DEBT", "DEBTS", "AMOUNT_FINANCED", "AMOUNT_DISBURSED", "EMI"}),
)
QUESTION_SYNONYMS: dict[str, set[str]] = {}
for tokens, synonyms in QUESTION_SYNONYM_GROUPS:
    canonical_tokens = set(tokens)
    expanded_synonyms = set(synonyms)
    for token in canonical_tokens:
        QUESTION_SYNONYMS.setdefault(token, set()).update(expanded_synonyms)
    for synonym in expanded_synonyms:
        QUESTION_SYNONYMS.setdefault(synonym, set()).update(canonical_tokens)

TRANSACTION_INTENT_TOKENS = {
    "TRANSACCION",
    "TRANSACCIONES",
    "MOVIMIENTO",
    "MOVIMIENTOS",
    "TRANSACTION",
    "TRANSACTIONS",
    "MOVEMENT",
    "MOVEMENTS",
    "DEBITO",
    "DEBITOS",
    "DEBIT",
    "DEBITS",
    "CREDITO",
    "CREDITOS",
    "CREDIT",
    "CREDITS",
    "DR",
    "CR",
    "DRCR",
}
DRCR_INTENT_TOKENS = {"DEBITO", "DEBITOS", "DEBIT", "DEBITS", "CREDITO", "CREDITOS", "CREDIT", "CREDITS", "DR", "CR", "DRCR"}


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
        and _question_has_any(question_tokens, "AUMENTO", "AUMENTARON", "CRECIERON", "CRECIMIENTO", "INCREASE", "GROWTH")
    )


def _is_customer_transaction_volume_intent(question_tokens: set[str]) -> bool:
    return (
        _is_customer_intent(question_tokens)
        and _question_has_any(question_tokens, "TRANSACCION", "TRANSACCIONES", "TXN", "TRN")
        and _question_has_any(question_tokens, "VOLUMEN", "VOLUME", "COUNT")
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
    "For current-month requests, filter BKG_DATE from TRUNC(SYSDATE,'MM') inclusive to ADD_MONTHS(TRUNC(SYSDATE,'MM'),1) exclusive; do not filter by account opening dates.",
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
    "For previous-week requests, use the previous ISO calendar week: TRN_DT >= TRUNC(SYSDATE,'IW') - 7 and TRN_DT < TRUNC(SYSDATE,'IW').",
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
CUSTOMER_VOLUME_HINTS = (
    "For customer transaction volume this month, aggregate FLEX_EXT_ACCOUNT_TRANSACTIONS by RELATED_CUSTOMER "
    "between TRUNC(SYSDATE,'MM') and ADD_MONTHS(TRUNC(SYSDATE,'MM'),1), then rank by COUNT(TXN_ID) and SUM(LCY_AMOUNT).",
)
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
        (_is_customer_transaction_volume_intent(question_tokens), CUSTOMER_VOLUME_HINTS),
        (_is_product_transaction_volume_intent(question_tokens), PRODUCT_VOLUME_HINTS),
        (_is_loan_debt_intent(question_tokens), LOAN_DEBT_HINTS),
    )
    for matches, messages in hint_rules:
        if matches:
            hints.extend(messages)
    return " ".join(hints)
