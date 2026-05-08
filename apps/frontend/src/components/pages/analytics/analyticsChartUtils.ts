export const PAGE_SIZE = 10;

export type ChartSortMode = 'original' | 'value-desc' | 'value-asc' | 'label-asc' | 'label-desc';
export type TableSortMode = 'original' | 'column-asc' | 'column-desc';

export type AnalyticsChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

export type ChartPoint = {
  label: string;
  value: number;
  index: number;
};

export type ChartScrollbarState = {
  show: boolean;
  width: number;
  left: number;
};

export type ChartPreviewRenderer = 'table' | 'metric' | 'empty' | 'line-area' | 'pie' | 'bar';

export type ChartPreviewModel = {
  numericColumns: string[];
  singleRowNumericComparison: boolean;
  x: string;
  y: string;
  allPoints: ChartPoint[];
  points: ChartPoint[];
  maxValue: number;
  renderer: ChartPreviewRenderer;
};

export function valueAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

export function measureChartScrollbar(
  element: { scrollWidth: number; clientWidth: number; scrollLeft: number } | null,
  minThumbWidth = 48
): ChartScrollbarState {
  if (!element || element.scrollWidth <= element.clientWidth + 1) {
    return { show: false, width: minThumbWidth, left: 0 };
  }

  const thumbWidth = Math.max(
    minThumbWidth,
    Math.round((element.clientWidth / element.scrollWidth) * element.clientWidth)
  );
  const maxScrollLeft = element.scrollWidth - element.clientWidth;
  const maxThumbLeft = element.clientWidth - thumbWidth;
  const thumbLeft = Math.round((element.scrollLeft / maxScrollLeft) * maxThumbLeft);

  return { show: true, width: thumbWidth, left: thumbLeft };
}

export function isNumericLabel(value: unknown): boolean {
  const text = String(value ?? '').replace(/,/g, '').trim();
  return text.length > 0 && Number.isFinite(Number(text));
}

export function formatMetricLabel(candidates: Array<unknown>, fallback = 'Value'): string {
  const candidate = candidates.find((value) => {
    const text = String(value ?? '').trim();
    return text.length > 0 && !isNumericLabel(text);
  });
  const text = String(candidate || fallback).replace(/_/g, ' ').trim();
  return text || fallback;
}

export function pointOnCircle(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = pointOnCircle(cx, cy, outerRadius, startAngle);
  const outerEnd = pointOnCircle(cx, cy, outerRadius, endAngle);
  const innerEnd = pointOnCircle(cx, cy, innerRadius, endAngle);
  const innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function formatAxisValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  if (absolute >= 10_000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

export function buildYAxisTicks(maxValue: number): number[] {
  const safeMax = Math.max(1, maxValue);
  return [safeMax, safeMax * 0.75, safeMax * 0.5, safeMax * 0.25, 0];
}

export function findNumericColumns(columns: string[], rows: Array<Record<string, unknown>>): string[] {
  return columns.filter((column) => rows.some((row) => valueAsNumber(row[column]) !== null));
}

export function resolveChartFields(spec: AnalyticsChartSpec, columns: string[], rows: Array<Record<string, unknown>>) {
  const numericColumns = findNumericColumns(columns, rows);
  const dimensionColumns = columns.filter((column) => !numericColumns.includes(column));
  return {
    x: spec.x && columns.includes(spec.x) ? spec.x : dimensionColumns[0] || columns[0],
    y: spec.y && columns.includes(spec.y) ? spec.y : numericColumns[0] || columns[1] || columns[0],
  };
}

export function buildChartPoints({
  numericColumns,
  rows,
  singleRowNumericComparison,
  x,
  y,
}: {
  numericColumns: string[];
  rows: Array<Record<string, unknown>>;
  singleRowNumericComparison: boolean;
  x: string;
  y: string;
}): ChartPoint[] {
  if (singleRowNumericComparison) {
    return numericColumns.map((column, index) => ({
      label: column,
      value: valueAsNumber(rows[0][column]) ?? 0,
      index,
    }));
  }

  return rows
    .map((row, index) => ({
      label: formatCellValue(row[x]),
      value: valueAsNumber(row[y]) ?? 0,
      index,
    }))
    .filter((point) => Number.isFinite(point.value));
}

export function visibleChartPoints(points: ChartPoint[], search: string, sortMode: ChartSortMode): ChartPoint[] {
  const normalizedSearch = normalizeChartSearch(search);
  const filteredPoints = normalizedSearch
    ? points.filter((point) => normalizeChartSearch(point.label).includes(normalizedSearch))
    : points;

  return filteredPoints.slice().sort((left, right) => {
    if (sortMode === 'value-desc') return right.value - left.value;
    if (sortMode === 'value-asc') return left.value - right.value;
    if (sortMode === 'label-asc') return left.label.localeCompare(right.label);
    if (sortMode === 'label-desc') return right.label.localeCompare(left.label);
    return left.index - right.index;
  });
}

export function selectChartPreviewRenderer({
  spec,
  rows,
  x,
  y,
  singleRowNumericComparison,
  allPoints,
  points,
}: {
  spec: AnalyticsChartSpec;
  rows: Array<Record<string, unknown>>;
  x: string;
  y: string;
  singleRowNumericComparison: boolean;
  allPoints: ChartPoint[];
  points: ChartPoint[];
}): ChartPreviewRenderer {
  if (!rows.length || spec.type === 'table' || (!singleRowNumericComparison && (!x || !y)) || allPoints.length === 0) {
    return 'table';
  }
  if (spec.type === 'metric') return 'metric';
  if (!points.length) return 'empty';
  if (spec.type === 'line' || spec.type === 'area') return 'line-area';
  if (spec.type === 'pie') return 'pie';
  return 'bar';
}

export function resolveChartPreviewModel({
  spec,
  columns,
  rows,
  search,
  sortMode,
}: {
  spec: AnalyticsChartSpec;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  search: string;
  sortMode: ChartSortMode;
}): ChartPreviewModel {
  const numericColumns = findNumericColumns(columns, rows);
  const singleRowNumericComparison = rows.length === 1 && numericColumns.length >= 2 && spec.type !== 'metric';
  const { x, y } = resolveChartFields(spec, columns, rows);
  const allPoints = buildChartPoints({ numericColumns, rows, singleRowNumericComparison, x, y });
  const points = visibleChartPoints(allPoints, search, sortMode);
  const maxValue = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const renderer = selectChartPreviewRenderer({
    spec,
    rows,
    x,
    y,
    singleRowNumericComparison,
    allPoints,
    points,
  });

  return {
    numericColumns,
    singleRowNumericComparison,
    x,
    y,
    allPoints,
    points,
    maxValue,
    renderer,
  };
}

export function normalizeChartSearch(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase();
}

export function compareTableCellValues(leftValue: unknown, rightValue: unknown): number {
  const leftNumber = valueAsNumber(leftValue);
  const rightNumber = valueAsNumber(rightValue);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }
  return formatCellValue(leftValue).localeCompare(formatCellValue(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
