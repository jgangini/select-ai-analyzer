from scripts.source_seed_sidecar import (
    build_source_table_metadata,
    infer_classification,
    parse_metadata_payload,
)
from scripts.source_seed_parser import SourceColumn, SourceTable


def test_build_source_table_metadata_creates_json_sidecar_shape() -> None:
    table = SourceTable(
        owner="FLEXCUBE",
        name="FLEX_EXT_ACCOUNT_TRANSACTIONS",
        columns=(
            SourceColumn(name="ACCOUNT_NO", data_type="VARCHAR2(20)", nullable=False),
            SourceColumn(name="AMOUNT", data_type="NUMBER(24,3)", nullable=True),
            SourceColumn(name="TRN_DT", data_type="DATE", nullable=True),
        ),
    )

    payload = build_source_table_metadata(table)

    assert payload["table_name"] == "FLEX_EXT_ACCOUNT_TRANSACTIONS"
    assert payload["source_file_name"] == "FLEX_EXT_ACCOUNT_TRANSACTIONS.csv"
    assert payload["columns"][0]["column_name"] == "ACCOUNT_NO"
    assert payload["columns"][0]["ui_display"] == "Account No"
    assert payload["columns"][0]["classification"] == "account"
    assert payload["columns"][1]["classification"] == "amount"
    assert payload["columns"][2]["classification"] == "date"


def test_parse_metadata_payload_accepts_legacy_data_dictionary_labels() -> None:
    table_comment, columns = parse_metadata_payload(
        {
            "table comment": "Operational transfers",
            "columns": [
                {
                    "Column Name": "Account No",
                    "Comment": "Customer account",
                    "UI_Display": "Account",
                    "Classification": "identifier",
                    "Primary Key": "true",
                }
            ],
        }
    )

    assert table_comment == "Operational transfers"
    assert columns == [
        {
            "column_name": "ACCOUNT_NO",
            "ordinal_position": 1,
            "comment": "Customer account",
            "ui_display": "Account",
            "classification": "identifier",
            "primary_key": True,
        }
    ]


def test_infer_classification_uses_column_domain_terms() -> None:
    assert infer_classification("TXN_AMOUNT") == "amount"
    assert infer_classification("ACC_CCY") == "currency"
    assert infer_classification("BRANCH_CODE") == "branch"
