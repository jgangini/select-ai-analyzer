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
