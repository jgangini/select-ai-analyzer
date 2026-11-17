from __future__ import annotations

from pathlib import Path
import json
import re
from typing import Any

from apps.backend.app.select_ai.metadata_payload import parse_metadata_payload
from scripts.source_seed_parser import SourceColumn, SourceTable


def display_label(value: str) -> str:
    words = re.sub(r"[_-]+", " ", str(value or "").strip()).split()
    return " ".join(word[:1].upper() + word[1:].lower() for word in words)


def _name_has_any(upper_name: str, *tokens: str) -> bool:
    return any(token in upper_name for token in tokens)


SPECIFIC_COLUMN_COMMENTS: dict[tuple[str, str], str] = {
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "DRCR_IND"): "Indicador de débito/crédito. D significa débito y C significa crédito.",
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "TRN_DT"): "Fecha de la transacción usada para filtros mensuales de movimientos de cuenta.",
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "REAL_DT_TIME"): "Marca de tiempo exacta de la transacción usada para análisis de velocidad y anomalías en ventanas de una hora.",
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "ACCOUNT_NO"): "Número de cuenta externa usado para filtrar transacciones de clientes.",
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "RELATED_CUSTOMER"): "Identificador del cliente relacionado con la transacción de cuenta externa.",
    ("FLEX_EXT_ACCOUNT_TRANSACTIONS", "PRODUCT_CODE"): "Código de producto usado para agrupar volumen de transacciones por producto.",
    ("FLEX_EXT_ACCOUNT_STATEMENT", "HIDE_TXN_IN_STMT"): "Indicador de transacción oculta en estado de cuenta. Y significa que la transacción está oculta.",
    ("FLEX_EXT_ACCOUNT_STATEMENT", "AMOUNT"): "Monto de la transacción del estado de cuenta usado para filtros por umbral.",
    ("FLEX_CSTB_CLEARING_MASTER", "STATUS"): "Estado de clearing. PEND significa pendiente y REJ significa rechazado.",
    ("FLEX_CSTB_CLEARING_MASTER", "AUTH_STAT"): "Estado de autorización. U significa no autorizado o pendiente de aprobación.",
    ("FLEX_CSTB_CLEARING_MASTER", "REFERENCE_NO"): "Número de referencia de la transacción de clearing.",
    ("FLEX_CSTB_CLEARING_MASTER", "TXN_DATE"): "Fecha operativa de la transacción de clearing.",
    ("FLEX_CSTB_CLEARING_MASTER", "ACC_CCY_AMT"): "Monto en moneda de la cuenta usado para comparar diferencias de clearing.",
    ("FLEX_CSTB_CLEARING_MASTER", "INSTRUMENT_AMT"): "Monto del instrumento usado para comparar diferencias de clearing.",
    ("FLEX_ACTB_DAILY_LOG_1", "AUTH_ID"): "Identificador del usuario que autorizó la transacción contable.",
    ("FLEX_ACTB_DAILY_LOG_2", "AUTH_ID"): "Identificador del usuario que autorizó la transacción contable.",
    ("FLEX_DETB_RTL_TELLER_1", "AUTH_STAT"): "Estado de autorización de operaciones en ventanilla. U significa pendiente de autorización.",
    ("FLEX_DETB_RTL_TELLER_2", "AUTH_STAT"): "Estado de autorización de operaciones en ventanilla. U significa pendiente de autorización.",
    ("FLEX_DETB_RTL_TELLER_1", "MODULE"): "Código de módulo de ventanilla. TL identifica transacciones de ventanilla.",
    ("FLEX_DETB_RTL_TELLER_2", "MODULE"): "Código de módulo de ventanilla. TL identifica transacciones de ventanilla.",
    ("FLEX_DETB_RTL_TELLER_1", "TRN_REF_NO"): "Número de referencia de la transacción de ventanilla.",
    ("FLEX_DETB_RTL_TELLER_2", "TRN_REF_NO"): "Número de referencia de la transacción de ventanilla.",
    ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_STATUS"): "Estado de la transacción ATM. F significa fallida y A significa aprobada.",
    ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_DATE"): "Fecha de la transacción ATM usada para filtros del día.",
    ("FLEX_IFTB_ATM_TRANS_LOG", "TRANS_CODE"): "Código de transacción ATM. WDR significa retiro.",
    ("FLEX_ICTM_TD_DETAILS", "LIQD_DATE"): "Fecha de vencimiento o liquidación del depósito a plazo usada para encontrar el próximo contrato por vencer.",
    ("FLEX_ICTW_TD_DETAILS", "LIQD_DATE"): "Fecha de vencimiento o liquidación del depósito a plazo usada para encontrar el próximo contrato por vencer.",
    ("FLEX_ICTM_TD_DETAILS_ARCHIVE", "LIQD_DATE"): "Fecha histórica de vencimiento o liquidación del depósito a plazo.",
    ("FLEX_ICTW_TD_DETAILS_ARCHIVE", "LIQD_DATE"): "Fecha histórica de vencimiento o liquidación del depósito a plazo.",
    ("FLEX_ICTM_TD_DETAILS", "REFERENCE_NO"): "Número de referencia del contrato de depósito a plazo.",
    ("FLEX_ICTW_TD_DETAILS", "REFERENCE_NO"): "Número de referencia del contrato de depósito a plazo.",
    ("FLEX_ICTM_TD_DETAILS", "TD_AMOUNT"): "Monto principal original del depósito a plazo.",
    ("FLEX_ICTW_TD_DETAILS", "TD_AMOUNT"): "Monto principal original del depósito a plazo.",
    ("FLEX_ICTM_TD_DETAILS", "TD_MATURITY_AMT"): "Monto de vencimiento del depósito a plazo, incluyendo intereses.",
    ("FLEX_ICTW_TD_DETAILS", "TD_MATURITY_AMT"): "Monto de vencimiento del depósito a plazo, incluyendo intereses.",
}

CLASSIFICATION_COMMENT_TEMPLATES: dict[str, str] = {
    "amount": "Monto monetario usado por la tabla {table_label}.",
    "currency": "Código de moneda usado por la tabla {table_label}.",
    "account": "Identificador de cuenta usado por la tabla {table_label}.",
    "customer": "Identificador de cliente usado por la tabla {table_label}.",
    "branch": "Identificador de sucursal usado por la tabla {table_label}.",
    "date": "Fecha operativa o marca de tiempo usada por la tabla {table_label}.",
    "status": "Estado, bandera o indicador usado por la tabla {table_label}.",
    "reference": "Identificador de transacción o referencia usado por la tabla {table_label}.",
    "product": "Identificador de producto usado por la tabla {table_label}.",
    "rate": "Tasa o valor porcentual usado por la tabla {table_label}.",
    "code": "Código de negocio usado por la tabla {table_label}.",
    "audit": "Información de usuario para auditoría o autorización usada por la tabla {table_label}.",
}

TABLE_COMMENTS: dict[str, str] = {
    "FLEX_EXT_ACCOUNT_TRANSACTIONS": "Tabla de hechos de transacciones de cuentas externas para preguntas sobre débitos, créditos, movimientos de cuenta, volumen por producto, actividad de clientes y anomalías por velocidad.",
    "FLEX_EXT_ACCOUNT_STATEMENT": "Tabla de transacciones de estados de cuenta externos con indicadores de transacciones ocultas y montos de estado de cuenta.",
    "FLEX_CSTB_CLEARING_MASTER": "Tabla maestra de transacciones de clearing. Usa STATUS='PEND' para clearing pendiente y STATUS='REJ' para clearing rechazado.",
    "FLEX_DETB_RTL_TELLER_1": "Tabla de transacciones de ventanilla. Usa AUTH_STAT='U' y MODULE='TL' para encontrar operaciones pendientes de autorización.",
    "FLEX_DETB_RTL_TELLER_2": "Tabla de transacciones de ventanilla. Usa AUTH_STAT='U' y MODULE='TL' para encontrar operaciones pendientes de autorización.",
    "FLEX_ICTM_TD_DETAILS": "Tabla de detalle de contratos de depósito a plazo. LIQD_DATE es la fecha de vencimiento o liquidación usada para encontrar el próximo contrato por vencer.",
    "FLEX_ICTW_TD_DETAILS": "Tabla de detalle de contratos de depósito a plazo. LIQD_DATE es la fecha de vencimiento o liquidación usada para encontrar el próximo contrato por vencer.",
    "FLEX_IFTB_ATM_TRANS_LOG": "Bitácora de transacciones ATM. Usa TRANS_STATUS='F' para transacciones ATM fallidas y TRANS_DATE para filtros del día.",
    "FLEX_ACTB_ACCBAL_HISTORY": "Tabla histórica de saldos de cuenta para saldo de cierre y saldo promedio por sucursal y moneda.",
    "FLEX_ACTB_DAILY_LOG_1": "Bitácora contable diaria con campos de auditoría de autorización como AUTH_ID y TRN_REF_NO.",
    "FLEX_ACTB_DAILY_LOG_2": "Bitácora contable diaria con campos de auditoría de autorización como AUTH_ID y TRN_REF_NO.",
    "FLEX_STTM_DATES": "Tabla de fechas operativas por sucursal. NEXT_WORKING_DAY almacena el próximo día hábil de una sucursal.",
    "FLEX_ICTB_ACC_PR": "Tabla de procesamiento de intereses por cuenta. LAST_LIQ_DT almacena la última fecha de liquidación de intereses.",
}


def infer_classification(column: SourceColumn | str, data_type: str | None = None) -> str:
    name = column.name if isinstance(column, SourceColumn) else str(column or "")
    upper_name = name.upper()
    upper_type = (column.data_type if isinstance(column, SourceColumn) else data_type or "").upper()
    if _name_has_any(upper_name, "AMT", "AMOUNT", "BAL", "BALANCE", "LIMIT", "TURNOVER"):
        return "amount"
    if _name_has_any(upper_name, "CCY", "CURRENCY"):
        return "currency"
    if _name_has_any(upper_name, "ACC", "ACCOUNT", "AC_NO", "CUST_AC"):
        return "account"
    if _name_has_any(upper_name, "CUSTOMER", "CUST_NO", "CIF"):
        return "customer"
    if "BRANCH" in upper_name:
        return "branch"
    if _name_has_any(upper_name, "DATE", "_DT", "TIME", "TIMESTAMP") or upper_type.startswith(("DATE", "TIMESTAMP")):
        return "date"
    if _name_has_any(upper_name, "STATUS", "STAT", "FLAG", "IND"):
        return "status"
    if _name_has_any(upper_name, "REF", "REFERENCE", "TXN_ID", "TRN_REF", "XREF"):
        return "reference"
    if "PRODUCT" in upper_name:
        return "product"
    if _name_has_any(upper_name, "RATE", "PERCENT", "PCT"):
        return "rate"
    if upper_name.endswith("_CODE") or upper_name == "CODE":
        return "code"
    if _name_has_any(upper_name, "USER", "AUTH", "MAKER", "CHECKER"):
        return "audit"
    return ""


def _comment_for_column(table: SourceTable, column: SourceColumn, classification: str) -> str:
    table_name = table.name.upper()
    column_name = column.name.upper()
    if (table_name, column_name) in SPECIFIC_COLUMN_COMMENTS:
        return SPECIFIC_COLUMN_COMMENTS[(table_name, column_name)]
    template = CLASSIFICATION_COMMENT_TEMPLATES.get(classification)
    return template.format(table_label=table_name) if template else f"Atributo {column_name} de la tabla {table_name}."


def build_source_table_metadata(table: SourceTable, *, owner_name: str = "APP_AGENT_DATA") -> dict[str, Any]:
    columns = []
    for index, column in enumerate(table.columns, start=1):
        classification = infer_classification(column)
        columns.append(
            {
                "column_name": column.name,
                "data_type": column.data_type,
                "nullable": "Y" if column.nullable else "N",
                "ordinal_position": index,
                "comment": _comment_for_column(table, column, classification),
                "ui_display": display_label(column.name),
                "classification": classification,
                "primary_key": False,
            }
        )
    return {
        "owner_name": owner_name,
        "table_name": table.name,
        "source_file_name": f"{table.name}.csv",
        "table_comment": TABLE_COMMENTS.get(
            table.name.upper(),
            f"Datos fuente de la tabla {table.name.upper()} generados desde .source.",
        ),
        "columns": columns,
    }


def read_metadata_sidecar(path: Path) -> tuple[str | None, list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return parse_metadata_payload(payload)


def write_metadata_sidecar(table: SourceTable, destination: Path, *, owner_name: str = "APP_AGENT_DATA") -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = build_source_table_metadata(table, owner_name=owner_name)
    destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return destination
