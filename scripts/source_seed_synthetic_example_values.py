from __future__ import annotations

from datetime import date, timedelta

DATA_YEAR = 2026
START_DATE = date(DATA_YEAR, 1, 1)
YEAR_DAYS = (date(DATA_YEAR + 1, 1, 1) - START_DATE).days
EXAMPLE_ROW_HEADROOM = 2
MIN_ROWS_PER_TABLE = YEAR_DAYS + EXAMPLE_ROW_HEADROOM
DOC_EXAMPLE_ACCOUNT = "9988776655"
DOC_EXAMPLE_MARCH = date(2026, 3, 1)
TEST_ACCOUNT = "001234567890"
TEST_CUSTOMER = "CUST000123"
TEST_AUDIT_ACCOUNT = "0011223344"
TEST_AUDIT_TRN = "TRN123456789"
TEST_AUDIT_USER = "USER_A01"
TEST_FRAUD_ACCOUNT = "4455667788"
TEST_INACTIVE_CUSTOMER = "CUST00999"
# The Oracle test database runs one calendar day ahead of the local desktop timezone during this demo.
# Keep date-sensitive questions such as "hoy" aligned with the database clock used by SYSDATE.
TEST_TODAY = date.today() + timedelta(days=1)


def _set_if_present(row: dict[str, object], values: dict[str, object]) -> None:
    for column_name, value in values.items():
        if column_name in row:
            row[column_name] = value
