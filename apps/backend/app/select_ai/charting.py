from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any


ALLOWED_CHART_TYPES = {"bar", "line", "area", "pie", "table", "metric"}


@dataclass(frozen=True, slots=True)
class ChartSpec:
    chart_type: str
    title: str
    x: str | None = None
    y: str | None = None
    series: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"type": self.chart_type, "title": self.title}
        if self.x:
            payload["x"] = self.x
        if self.y:
            payload["y"] = self.y
        if self.series:
            payload["series"] = self.series
        return payload


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def infer_chart_spec(rows: list[dict[str, Any]], columns: list[str], *, title: str = "Resultado analitico") -> dict[str, Any]:
    if not rows or not columns:
        return ChartSpec(chart_type="table", title=title).as_dict()
    if len(rows) == 1 and len(columns) == 1 and _is_number(rows[0].get(columns[0])):
        return ChartSpec(chart_type="metric", title=title, y=columns[0]).as_dict()

    numeric_columns = [
        column for column in columns
        if any(_is_number(row.get(column)) for row in rows[:25])
    ]
    if len(rows) == 1 and len(numeric_columns) >= 2:
        return ChartSpec(chart_type="bar", title=title).as_dict()
    categorical_columns = [column for column in columns if column not in numeric_columns]
    if categorical_columns and numeric_columns:
        x_column = categorical_columns[0]
        y_column = numeric_columns[0]
        if len(rows) <= 8:
            chart_type = "pie"
        elif any(token in x_column.upper() for token in ("DATE", "DAY", "MONTH", "YEAR")):
            chart_type = "line"
        else:
            chart_type = "bar"
        return ChartSpec(chart_type=chart_type, title=title, x=x_column, y=y_column).as_dict()
    return ChartSpec(chart_type="table", title=title).as_dict()


def validate_chart_spec(spec: dict[str, Any], columns: list[str]) -> dict[str, Any]:
    if not isinstance(spec, dict):
        raise ValueError("Chart spec must be a JSON object.")
    chart_type = str(spec.get("type") or "").strip().lower()
    if chart_type not in ALLOWED_CHART_TYPES:
        raise ValueError(f"Unsupported chart type: {chart_type}")
    for key in ("x", "y", "series"):
        value = spec.get(key)
        if value is not None and str(value) not in columns:
            raise ValueError(f"Chart field '{key}' references unknown column '{value}'.")
    return {
        key: value
        for key, value in spec.items()
        if key in {"type", "title", "x", "y", "series"}
    }
