from __future__ import annotations

import argparse
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from apps.backend.app.services.metadata_normalization_service import (  # noqa: E402
    MetadataWorkbookNormalizationError,
    normalize_metadata_workbook_to_csv,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Normalize XLS/XLSX metadata into canonical CSV keyed by `file`.")
    parser.add_argument("source", type=Path, help="Path to the source metadata workbook (.xlsx or .xls).")
    parser.add_argument("output", type=Path, help="Path to the output canonical CSV.")
    parser.add_argument(
        "--sheet",
        dest="sheet_name",
        default=None,
        help="Optional worksheet name. Defaults to the first sheet.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        result = normalize_metadata_workbook_to_csv(
            source_path=args.source,
            output_path=args.output,
            sheet_name=args.sheet_name,
        )
    except MetadataWorkbookNormalizationError as exc:
        print(f"Normalization failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"Normalized {result.total_rows} rows from sheet '{result.sheet_name}' into {result.output_path}",
        file=sys.stdout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
