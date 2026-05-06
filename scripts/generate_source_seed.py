from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.backend.app.select_ai.source_parser import build_create_table_sql, parse_source_tables
from apps.backend.app.select_ai.synthetic_data import write_seed_csvs


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate APP_AGENT_DATA DDL and synthetic CSVs from .source structures.")
    parser.add_argument("--source", type=Path, default=ROOT / ".source" / "decoupling_tables_structures.sql")
    parser.add_argument("--out", type=Path, default=ROOT / "apps" / "backend" / "data" / "source_seed")
    parser.add_argument("--default-rows", type=int, default=100)
    parser.add_argument("--fact-rows", type=int, default=2000)
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    args.out.mkdir(parents=True, exist_ok=True)
    ddl_dir = args.out / "ddl"
    csv_dir = args.out / "csv"
    ddl_dir.mkdir(parents=True, exist_ok=True)

    raw = args.source.read_text(encoding="utf-8", errors="ignore")
    tables = parse_source_tables(raw)
    ddl_path = ddl_dir / "app_agent_data_source_tables.sql"
    ddl_path.write_text(
        "\n--\n".join(build_create_table_sql(table) for table in tables) + "\n",
        encoding="utf-8",
    )
    csv_paths = write_seed_csvs(
        args.source,
        csv_dir,
        default_rows=args.default_rows,
        fact_rows=args.fact_rows,
    )
    print(f"tables={len(tables)}")
    print(f"ddl={ddl_path}")
    print(f"csv_files={len(csv_paths)}")
    print(f"csv_dir={csv_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
