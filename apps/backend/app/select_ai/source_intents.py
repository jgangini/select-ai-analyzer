from __future__ import annotations

import re
import unicodedata

QUESTION_SYNONYM_GROUPS = (
    (("ATM",), {"ATM"}),
    (("TELLER",), {"TELLER", "TL"}),
    (("MONEDA",), {"CCY", "CURRENCY"}),
    (("SALDO",), {"BAL", "BALANCE", "ACY", "LCY", "FCY"}),
    (("PROMEDIO", "PROMEDIOS"), {"AVERAGE", "AVG"}),
    (("SUCURSAL",), {"BRANCH", "BRN"}),
    (("CLIENTE",), {"CUSTOMER", "CUST"}),
    (("CUENTA",), {"ACCOUNT", "ACC", "AC"}),
    (("TRANSACCION", "TRANSACCIONES", "MOVIMIENTO", "MOVIMIENTOS"), {"TRANSACTION", "TRANS", "TXN", "TRN"}),
    (("OPERACION", "OPERACIONES"), {"OPERATION", "TRANSACTION", "TXN", "TRN"}),
    (("DEBITO", "DEBITOS"), {"DEBIT", "DR"}),
    (("CREDITO", "CREDITOS"), {"CREDIT", "CR"}),
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
    (("PROXIMO", "PROXIMA"), {"NEXT"}),
    (("FECHA", "FECHAS"), {"DATE", "DT"}),
    (("HABIL",), {"WORKING", "BUSINESS", "NEXT", "PREV"}),
    (("FRAUDE", "ANOMALIA", "ANOMALIAS"), {"FAILED", "STATUS", "REVERSAL", "HIDE"}),
    (("OCULTA", "OCULTAS"), {"HIDE", "HIDDEN", "TXN"}),
    (("REVERTIDA", "REVERTIDAS"), {"REVERSAL", "REVERSED", "REV"}),
    (("AUTORIZO",), {"AUTH", "AUTH_ID", "USER"}),
    (("AUTORIZADO", "AUTORIZADAS"), {"AUTH", "AUTH_STAT"}),
    (("TRAZABILIDAD", "AUDITORIA"), {"LOG", "TRACE", "DAILY_LOG"}),
    (("INACTIVO", "INACTIVOS"), {"INACTIVE", "DORMANT", "DORMANCY"}),
    (("PRODUCTO", "PRODUCTOS"), {"PRODUCT", "PROD"}),
    (("COMISION", "COMISIONES"), {"FEE", "CHARGE", "COMMISSION"}),
    (("VOLUMEN",), {"VOLUME", "AMOUNT", "COUNT"}),
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
    (("VENCER", "VENCE", "VENCIMIENTO"), {"MATURITY", "LIQD_DATE", "DUE"}),
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


def _is_atm_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "ATM", "CAJERO", "CAJEROS", "TARJETA", "TARJETAS", "RETIRO", "RETIROS")


def _is_balance_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "SALDO", "BAL", "BALANCE")


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


def _is_previous_week_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "SEMANA", "WEEK") and _question_has_any(
        question_tokens, "PASADA", "PREVIOUS"
    )


def _is_operating_date_hint_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "HABIL", "WORKING", "BUSINESS")


def _is_customer_intent(question_tokens: set[str]) -> bool:
    return _question_has_any(question_tokens, "CLIENTE", "CUSTOMER", "CUST")


def preferred_source_object_names(question: str, question_tokens: set[str]) -> tuple[str, ...]:
    rules: tuple[tuple[bool, tuple[str, ...]], ...] = (
        (_is_teller_intent(question_tokens), ("FLEX_DETB_RTL_TELLER_1", "FLEX_DETB_RTL_TELLER_2")),
        (_is_term_deposit_maturity_intent(question_tokens), ("FLEX_ICTM_TD_DETAILS", "FLEX_ICTW_TD_DETAILS")),
        (_is_atm_intent(question_tokens), ("FLEX_IFTB_ATM_TRANS_LOG",)),
        (_is_clearing_intent(question_tokens), ("FLEX_CSTB_CLEARING_MASTER",)),
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
