from apps.backend.app.select_ai.service import SelectAIAnalyticsService, _score_source_match


class FakeAnalyticsService(SelectAIAnalyticsService):
    def __init__(self) -> None:
        pass

    def _registered_source_objects(self) -> list[dict[str, object]]:
        return [
            {"owner": "APP_AGENT_DATA", "name": "FLEX_STTM_CUST_ACCOUNT", "columns": ["CUST_AC_NO"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_IFTB_ATM_TRANS_LOG", "columns": ["CARD_NO", "TRANS_STATUS"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_DETB_RTL_TELLER_1", "columns": ["TRN_REF_NO", "AUTH_STAT"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_ICTM_TD_DETAILS", "columns": ["REFERENCE_NO", "LIQD_DATE"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_CSTB_CLEARING_MASTER", "columns": ["REFERENCE_NO", "STATUS"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_STTM_DATES", "columns": ["BRANCH_CODE", "TODAY"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_ICTB_ACC_PR", "columns": ["ACCOUNT", "INT_RATE"]},
            {
                "owner": "APP_AGENT_DATA",
                "name": "FLEX_CLTC_ACCOUNT_MASTER",
                "columns": ["ACCOUNT_NUMBER", "CUSTOMER_ID", "AMOUNT_FINANCED", "AMOUNT_DISBURSED", "EMI_AMOUNT"],
            },
            {"owner": "APP_AGENT_DATA", "name": "FLEX_ACTB_DAILY_LOG_1", "columns": ["TRN_REF_NO", "AUTH_ID", "LCY_AMOUNT"]},
            {"owner": "APP_AGENT_DATA", "name": "FLEX_EXT_ACCOUNT_STATEMENT", "columns": ["ACCOUNT_NO", "HIDE_TXN_IN_STMT"]},
            {
                "owner": "APP_AGENT_DATA",
                "name": "FLEX_EXT_ACCOUNT_TRANSACTIONS",
                "columns": ["ACCOUNT_NO", "TRN_DT", "LCY_AMOUNT", "DRCR_IND", "PRODUCT_CODE"],
            },
        ]


def test_score_source_match_prioritizes_explicit_table_name() -> None:
    explicit = _score_source_match(
        "muestra FLEX_ACTB_ACCBAL_HISTORY",
        "FLEX_ACTB_ACCBAL_HISTORY",
        ["ACCOUNT", "ACC_CCY", "ACY_CLOSING_BAL"],
    )
    related = _score_source_match(
        "muestra FLEX_ACTB_ACCBAL_HISTORY",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "ACY_CURR_BALANCE", "CCY"],
    )

    assert explicit > related


def test_score_source_match_prioritizes_average_balance_history() -> None:
    balance_history = _score_source_match(
        "saldo promedio por moneda",
        "FLEX_ACTB_ACCBAL_HISTORY",
        ["ACCOUNT", "ACC_CCY", "ACY_CLOSING_BAL", "BKG_DATE"],
    )
    account_master = _score_source_match(
        "saldo promedio por moneda",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "CCY", "ACY_CURR_BALANCE"],
    )

    assert balance_history > account_master


def test_score_source_match_prioritizes_transaction_fact_for_debit_credit_questions() -> None:
    transaction_score = _score_source_match(
        "total de debitos vs creditos por cuenta",
        "FLEX_EXT_ACCOUNT_TRANSACTIONS",
        ["TRN_DT", "ACCOUNT_NO", "AMOUNT", "LCY_AMOUNT", "DRCR_IND"],
    )
    account_score = _score_source_match(
        "total de debitos vs creditos por cuenta",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "ACY_MTD_TOVER_DR", "ACY_MTD_TOVER_CR"],
    )

    assert transaction_score > account_score


def test_score_source_match_prioritizes_specialized_operational_tables() -> None:
    atm_score = _score_source_match(
        "retiros fallidos por tarjeta en cajero",
        "FLEX_IFTB_ATM_TRANS_LOG",
        ["TRANS_DATE", "TRANS_STATUS", "CARD_NO", "TRANS_AMOUNT"],
    )
    clearing_score = _score_source_match(
        "cheques rechazados en clearing",
        "FLEX_CSTB_CLEARING_MASTER",
        ["REFERENCE_NO", "STATUS", "INSTRUMENT_AMT"],
    )
    generic_atm_score = _score_source_match(
        "retiros fallidos por tarjeta en cajero",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "CCY"],
    )
    generic_clearing_score = _score_source_match(
        "cheques rechazados en clearing",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "CCY"],
    )

    assert atm_score > generic_atm_score
    assert clearing_score > generic_clearing_score


def test_score_source_match_prefers_transactions_for_product_volume() -> None:
    product_volume = _score_source_match(
        "volumen de transacciones por producto",
        "FLEX_EXT_ACCOUNT_TRANSACTIONS",
        ["PRODUCT_CODE", "TXN_ID", "ACCOUNT_NO"],
    )
    product_master = _score_source_match(
        "volumen de transacciones por producto",
        "FLEX_STTM_ACCOUNT_CLASS",
        ["ACCOUNT_CLASS", "PRODUCT_CODE"],
    )

    assert product_volume > product_master


def test_score_source_match_prioritizes_teller_authorization_table() -> None:
    teller_score = _score_source_match(
        "transacciones pendientes de autorizacion en teller",
        "FLEX_DETB_RTL_TELLER_2",
        ["TRN_REF_NO", "AUTH_STAT", "MODULE", "TXN_ACC", "TXN_AMOUNT"],
    )
    daily_log_score = _score_source_match(
        "transacciones pendientes de autorizacion en teller",
        "FLEX_ACTB_DAILY_LOG_1",
        ["TRN_REF_NO", "AUTH_STAT", "AUTH_ID", "MODULE"],
    )

    assert teller_score > daily_log_score


def test_score_source_match_prioritizes_term_deposit_maturity_table() -> None:
    td_score = _score_source_match(
        "proximo contrato de deposito a vencer",
        "FLEX_ICTM_TD_DETAILS",
        ["REFERENCE_NO", "ACC", "LIQD_DATE", "TD_AMOUNT", "TD_MATURITY_AMT"],
    )
    account_score = _score_source_match(
        "proximo contrato de deposito a vencer",
        "FLEX_STTM_CUST_ACCOUNT",
        ["CUST_AC_NO", "ACCOUNT_CLASS", "ACY_CURR_BALANCE"],
    )

    assert td_score > account_score


def test_resolve_scoped_objects_uses_domain_terms_without_name_error() -> None:
    matches = FakeAnalyticsService().resolve_scoped_objects("retiros fallidos en cajero")

    assert matches == [{"owner": "APP_AGENT_DATA", "name": "FLEX_IFTB_ATM_TRANS_LOG"}]


def test_resolve_scoped_objects_uses_preferred_domain_tables() -> None:
    service = FakeAnalyticsService()
    cases = [
        ("transacciones pendientes en teller", "FLEX_DETB_RTL_TELLER_1"),
        ("proximo contrato de deposito a vencer", "FLEX_ICTM_TD_DETAILS"),
        ("cheques rechazados en clearing", "FLEX_CSTB_CLEARING_MASTER"),
        ("fecha habil por sucursal", "FLEX_STTM_DATES"),
        ("interes por cuenta", "FLEX_ICTB_ACC_PR"),
        ("saldo actual por moneda y sucursal", "FLEX_STTM_CUST_ACCOUNT"),
        ("cuentas con mayor saldo bloqueado", "FLEX_STTM_CUST_ACCOUNT"),
        ("prestamos con mayor deuda pendiente", "FLEX_CLTC_ACCOUNT_MASTER"),
        ("transacciones ocultas en estado de cuenta", "FLEX_EXT_ACCOUNT_STATEMENT"),
        ("usuarios autorizaron movimientos contables", "FLEX_ACTB_DAILY_LOG_1"),
        ("volumen de transacciones por producto", "FLEX_EXT_ACCOUNT_TRANSACTIONS"),
    ]

    for question, expected_table in cases:
        matches = service.resolve_scoped_objects(question)

        assert matches[0] == {"owner": "APP_AGENT_DATA", "name": expected_table}
