from pathlib import Path

from apps.backend.app.select_ai.source_parser import build_create_table_sql, parse_source_tables


FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "decoupling_tables_structures.sql"


def test_source_parser_skips_missing_objects_and_deduplicates() -> None:
    tables = parse_source_tables(FIXTURE_PATH.read_text(encoding="utf-8", errors="ignore"))

    names = [table.qualified_name for table in tables]
    assert "FLEXCUBE.TDTM_RATE_DETAIL" not in names
    assert len(names) == len(set(names))
    assert "FLEXCUBE.FLEX_EXT_ACCOUNT_TRANSACTIONS" in names


def test_build_create_table_sql_targets_data_schema() -> None:
    table = next(
        table for table in parse_source_tables(FIXTURE_PATH.read_text(encoding="utf-8", errors="ignore"))
        if table.name == "FLEX_ACTB_ACCBAL_HISTORY"
    )

    ddl = build_create_table_sql(table)

    assert ddl.startswith("CREATE TABLE APP_AGENT_DATA.FLEX_ACTB_ACCBAL_HISTORY")
    assert "BRANCH_CODE VARCHAR2(3) NOT NULL" in ddl
    assert "ACY_CLOSING_BAL NUMBER(24,3)" in ddl
