from __future__ import annotations

import csv
from collections.abc import Iterable
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from pathlib import Path
import random
import re

from apps.backend.app.select_ai.source_metadata import write_metadata_sidecar
from apps.backend.app.select_ai.source_parser import SourceColumn, SourceTable, parse_source_tables
from apps.backend.app.select_ai.synthetic_examples import (
    DATA_YEAR,
    DOC_EXAMPLE_ACCOUNT,
    MIN_ROWS_PER_TABLE,
    START_DATE,
    TEST_TODAY,
    YEAR_DAYS,
    apply_doc_example_overrides,
)
from apps.backend.app.select_ai.synthetic_value_rules import CURRENCIES, text_value_for_column


FACT_TABLE_TOKENS = ("DAILY_LOG", "TRANSACTIONS", "STATEMENT", "ATM_TRANS", "CLEARING")
HISTORY_TABLE_TOKENS = ("HISTORY", "LIQ", "EVENT", "TD_DETAILS", "ACC_PR")


def _row_count_for_table(table_name: str, default_rows: int, fact_rows: int) -> int:
    upper = table_name.upper()
    baseline_rows = max(default_rows, MIN_ROWS_PER_TABLE)
    if any(token in upper for token in FACT_TABLE_TOKENS):
        return max(fact_rows, MIN_ROWS_PER_TABLE)
    if any(token in upper for token in HISTORY_TABLE_TOKENS):
        return max(default_rows * 5, fact_rows // 2, MIN_ROWS_PER_TABLE)
    return baseline_rows


def _is_number(column: SourceColumn) -> bool:
    return column.data_type.upper().startswith(("NUMBER", "FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE"))


def _is_date(column: SourceColumn) -> bool:
    return column.data_type.upper().startswith(("DATE", "TIMESTAMP"))


def _varchar_limit(data_type: str) -> int:
    match = re.search(r"\((\d+)", data_type)
    if not match:
        return 80
    return max(1, min(4000, int(match.group(1))))


def _number_precision_scale(data_type: str) -> tuple[int | None, int]:
    match = re.search(r"NUMBER\s*\(\s*(\d+)(?:\s*,\s*(\d+))?", data_type, flags=re.IGNORECASE)
    if not match:
        return None, 0
    return int(match.group(1)), int(match.group(2) or 0)


def _fit_number(value: object, data_type: str) -> str:
    text = "" if value is None else str(value).strip()
    if not text:
        return text
    precision, scale = _number_precision_scale(data_type)
    if precision is None:
        return text
    try:
        number = abs(Decimal(text))
    except InvalidOperation:
        return "0"
    if scale > 0:
        factor = Decimal(10) ** scale
        max_scaled = (10**precision) - 1
        scaled = int((number * factor).to_integral_value(rounding=ROUND_DOWN)) % (max_scaled + 1)
        bounded = Decimal(scaled) / factor
        return f"{bounded:.{scale}f}"
    max_integer = (10**precision) - 1
    return str(int(number.to_integral_value(rounding=ROUND_DOWN)) % (max_integer + 1))


def _fit(value: object, column: SourceColumn) -> str:
    text = "" if value is None else str(value)
    if _is_number(column):
        return _fit_number(value, column.data_type)
    if _is_date(column):
        return text
    return text[: _varchar_limit(column.data_type)]


def _amount(rng: random.Random, row_index: int) -> Decimal:
    base = Decimal(rng.randint(50, 250000)) / Decimal("10")
    if row_index % 37 == 0:
        base *= Decimal("8")
    return base.quantize(Decimal("0.001"))


def _date_value_for_column(name: str, data_type: str, row_index: int) -> str:
    day = START_DATE + timedelta(days=row_index % YEAR_DAYS)
    if "TIME" in name or data_type.upper().startswith("TIMESTAMP"):
        return f"{day.isoformat()} {row_index % 24:02d}:{(row_index * 7) % 60:02d}:00"
    return day.isoformat()


def _number_value_for_column(name: str, row_index: int, rng: random.Random) -> object:
    if name.endswith("_KEY") or name.endswith("_ID") or name in {"DD_ID", "ESN", "JOB_NO"}:
        return row_index + 1
    if "RATE" in name:
        return str((Decimal(rng.randint(80, 450)) / Decimal("100")).quantize(Decimal("0.0001")))
    if "COUNT" in name or "NO_OF" in name or "DAYS" in name:
        return rng.randint(0, 36)
    if "AMOUNT" in name or "BAL" in name or "LIMIT" in name or "AMT" in name:
        return str(_amount(rng, row_index))
    return rng.randint(1, 999999)


def value_for_column(column: SourceColumn, row_index: int, rng: random.Random) -> object:
    name = column.name.upper()
    if _is_date(column):
        return _date_value_for_column(name, column.data_type, row_index)
    if _is_number(column):
        return _number_value_for_column(name, row_index, rng)
    return text_value_for_column(name, row_index)


def generate_rows(table: SourceTable, row_count: int, *, seed: int = 2605) -> Iterable[dict[str, object]]:
    rng = random.Random(seed + sum(ord(ch) for ch in table.name))
    for row_index in range(row_count):
        row = {
            column.name: _fit(value_for_column(column, row_index, rng), column)
            for column in table.columns
        }
        yield apply_doc_example_overrides(table.name, row, row_index)


def write_csv_for_table(table: SourceTable, destination: Path, *, row_count: int, seed: int = 2605) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    csv_path = destination / f"{table.name}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[column.name for column in table.columns])
        writer.writeheader()
        writer.writerows(generate_rows(table, row_count, seed=seed))
    return csv_path


def write_seed_files(
    source_file: Path,
    destination: Path,
    *,
    default_rows: int = YEAR_DAYS,
    fact_rows: int = 2000,
) -> list[Path]:
    tables = parse_source_tables(source_file.read_text(encoding="utf-8", errors="ignore"))
    paths: list[Path] = []
    for table in tables:
        rows = _row_count_for_table(table.name, default_rows=default_rows, fact_rows=fact_rows)
        paths.append(write_csv_for_table(table, destination, row_count=rows))
        paths.append(write_metadata_sidecar(table, destination / f"{table.name}.json"))
    return paths


def write_seed_csvs(
    source_file: Path,
    destination: Path,
    *,
    default_rows: int = YEAR_DAYS,
    fact_rows: int = 2000,
) -> list[Path]:
    return [
        path
        for path in write_seed_files(
            source_file,
            destination,
            default_rows=default_rows,
            fact_rows=fact_rows,
        )
        if path.suffix.lower() == ".csv"
    ]
