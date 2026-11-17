import type { ReactNode } from 'react';

const CHART_COLORS = ['#c74634', '#234967', '#2f7d7e', '#d48a2c', '#7a5a86', '#2f6b4f', '#8c4d39', '#687789'];
const BAR_CHART_HEIGHT_PX = 268;
const BAR_CHART_TOP_PADDING_PX = 34;
const BAR_CHART_BOTTOM_PADDING_PX = 38;
const BAR_CHART_MAX_BAR_HEIGHT_PX = 176;
const LINE_CHART_HEIGHT_PX = 270;
const LINE_CHART_PLOT_TOP_PX = 34;
const LINE_CHART_PLOT_RIGHT_PX = 32;
const LINE_CHART_PLOT_BOTTOM_PX = 212;
const LINE_CHART_PLOT_LEFT_PX = 64;
const CHART_SURFACE_CLASS = 'rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm';
const CHART_SURFACE_RELAXED_CLASS = 'relative rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-5 shadow-sm';
const PIE_CHART_GEOMETRY = {
  cx: 110,
  cy: 110,
  outerRadius: 82,
  innerRadius: 42,
};

type AnalyticsChartSpec = {
  type?: string;
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

type ChartSortMode = 'original' | 'value-desc' | 'value-asc' | 'label-asc' | 'label-desc';

export type ChartRendererTools = {
  AddVisualizationButton: (props: {
    visibleCount: number;
    totalCount: number;
    isVisualizationAdded?: boolean;
    onAddVisualization: () => void;
  }) => JSX.Element;
  buildYAxisTicks: (maxValue: number) => number[];
  ChartControls: (props: {
    search: string;
    sortMode: ChartSortMode;
    visibleCount: number;
    totalCount: number;
    isVisualizationAdded?: boolean;
    onSearchChange: (value: string) => void;
    onSortModeChange: (value: ChartSortMode) => void;
    onAddVisualization?: () => void;
  }) => JSX.Element | null;
  ChartScrollFrame: ({ children }: { children: ReactNode }) => JSX.Element;
  donutSlicePath: (
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number
  ) => string;
  formatAxisValue: (value: number) => string;
  formatCellValue: (value: unknown) => string;
  formatMetricLabel: (candidates: Array<string | undefined | null>) => string;
};

type ChartInteractionProps = {
  search: string;
  sortMode: ChartSortMode;
  isVisualizationAdded?: boolean;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: ChartSortMode) => void;
  onAddVisualization?: () => void;
};

type ChartRendererProps = ChartInteractionProps & {
  spec: AnalyticsChartSpec;
  points: ChartPoint[];
  allPoints: ChartPoint[];
  maxValue: number;
  tools: ChartRendererTools;
};

type PieSlice = {
  label: string;
  value: number;
  share: number;
  color: string;
  isFullRing: boolean;
  path: string;
};

function chartControlProps({
  search,
  sortMode,
  points,
  allPoints,
  isVisualizationAdded,
  onSearchChange,
  onSortModeChange,
  onAddVisualization,
}: ChartRendererProps) {
  return {
    search,
    sortMode,
    visibleCount: points.length,
    totalCount: allPoints.length,
    isVisualizationAdded,
    onSearchChange,
    onSortModeChange,
    onAddVisualization,
  };
}

export function buildPieSlices(
  points: ChartPoint[],
  donutSlicePath: ChartRendererTools['donutSlicePath'],
  colors = CHART_COLORS
): PieSlice[] {
  const total = points.reduce((sum, point) => sum + Math.max(point.value, 0), 0) || 1;
  const { cx, cy, outerRadius, innerRadius } = PIE_CHART_GEOMETRY;
  const gapRadians = points.length > 1 ? 0.012 : 0;
  let currentAngle = -Math.PI / 2;

  return points.map((point, index) => {
    const share = Math.max(point.value, 0) / total;
    const rawEndAngle = currentAngle + share * Math.PI * 2;
    const startAngle = currentAngle + gapRadians;
    const endAngle = rawEndAngle - gapRadians;
    currentAngle = rawEndAngle;
    return {
      label: point.label,
      value: point.value,
      share,
      color: colors[index % colors.length],
      isFullRing: share >= 0.999,
      path: donutSlicePath(cx, cy, outerRadius, innerRadius, startAngle, Math.max(startAngle, endAngle)),
    };
  });
}

export function getBarChartLayout(pointCount: number) {
  return {
    compact: pointCount <= 4,
    width: Math.max(420, pointCount * 112),
  };
}

export function getBarHeight(value: number, maxValue: number): number {
  return Math.max(8, (Math.abs(value) / maxValue) * BAR_CHART_MAX_BAR_HEIGHT_PX);
}

function linePointX(index: number, pointCount: number, chartWidth: number): number {
  const plotWidth = chartWidth - LINE_CHART_PLOT_LEFT_PX - LINE_CHART_PLOT_RIGHT_PX;
  if (pointCount <= 1) return LINE_CHART_PLOT_LEFT_PX + plotWidth / 2;
  return LINE_CHART_PLOT_LEFT_PX + index * (plotWidth / (pointCount - 1));
}

function linePointY(value: number, maxValue: number): number {
  const plotHeight = LINE_CHART_PLOT_BOTTOM_PX - LINE_CHART_PLOT_TOP_PX;
  return LINE_CHART_PLOT_BOTTOM_PX - (Math.max(value, 0) / maxValue) * plotHeight;
}

function compactXAxisLabel(label: string): string {
  const value = String(label || '').trim();
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (dateMatch) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = Number(dateMatch[2]) - 1;
    const day = dateMatch[3];
    if (monthIndex >= 0 && monthIndex < monthNames.length) return `${monthNames[monthIndex]} ${day}`;
  }
  if (value.length <= 12) return value;
  return `${value.slice(0, 11)}...`;
}

export function EmptyChartState(props: ChartRendererProps) {
  const ChartControls = props.tools.ChartControls;

  return (
    <div className={CHART_SURFACE_CLASS}>
      <ChartControls {...chartControlProps(props)} visibleCount={0} />
      <p className="text-sm text-oracle-medium-gray">No chart values match the current filter.</p>
    </div>
  );
}

export function MetricChart({
  columns,
  isVisualizationAdded,
  onAddVisualization,
  points,
  rows,
  spec,
  tools,
  y,
}: {
  columns: string[];
  isVisualizationAdded?: boolean;
  onAddVisualization?: () => void;
  points: ChartPoint[];
  rows: Array<Record<string, unknown>>;
  spec: AnalyticsChartSpec;
  tools: ChartRendererTools;
  y: string;
}) {
  const metric = points[0];
  const AddVisualizationButton = tools.AddVisualizationButton;
  const metricLabel = tools.formatMetricLabel([metric?.label, y, spec.y, columns[0]]);

  return (
    <div className={CHART_SURFACE_RELAXED_CLASS}>
      {onAddVisualization ? (
        <div className="absolute right-4 top-4">
          <AddVisualizationButton
            visibleCount={1}
            totalCount={1}
            isVisualizationAdded={isVisualizationAdded}
            onAddVisualization={onAddVisualization}
          />
        </div>
      ) : null}
      <p className="pr-12 text-xs font-semibold uppercase tracking-[0.14em] text-oracle-light-gray">{metricLabel}</p>
      <p className="mt-2 text-4xl font-semibold text-oracle-dark-gray">
        {tools.formatCellValue(metric?.value ?? rows.length)}
      </p>
    </div>
  );
}

export function LineAreaChart(props: ChartRendererProps) {
  const { maxValue, points, spec, tools } = props;
  const ChartControls = tools.ChartControls;
  const ChartScrollFrame = tools.ChartScrollFrame;
  const chartWidth = Math.max(620, points.length * 92);
  const yAxisTicks = tools.buildYAxisTicks(maxValue);
  const path = points
    .map((point, index) => {
      const px = linePointX(index, points.length, chartWidth);
      const py = linePointY(point.value, maxValue);
      return `${index === 0 ? 'M' : 'L'} ${px} ${py}`;
    })
    .join(' ');
  const lastPointX = linePointX(points.length - 1, points.length, chartWidth);
  const firstPointX = linePointX(0, points.length, chartWidth);
  const areaPath = `${path} L ${lastPointX} ${LINE_CHART_PLOT_BOTTOM_PX} L ${firstPointX} ${LINE_CHART_PLOT_BOTTOM_PX} Z`;

  return (
    <div className={CHART_SURFACE_CLASS}>
      <ChartControls {...chartControlProps(props)} />
      <ChartScrollFrame>
        <svg
          viewBox={`0 0 ${chartWidth} ${LINE_CHART_HEIGHT_PX}`}
          className="h-64 max-w-none"
          style={{ width: `${chartWidth}px` }}
          role="img"
          aria-label={spec.title || 'Line chart'}
        >
          {yAxisTicks.map((tick, index) => {
            const y = linePointY(tick, maxValue);
            return (
              <g key={`${tick}-${index}`}>
                <line
                  x1={LINE_CHART_PLOT_LEFT_PX}
                  y1={y}
                  x2={chartWidth - LINE_CHART_PLOT_RIGHT_PX}
                  y2={y}
                  stroke={index === yAxisTicks.length - 1 ? '#c9c0b8' : '#eee6df'}
                />
                <text
                  x={LINE_CHART_PLOT_LEFT_PX - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="600"
                  fill="#8b8178"
                >
                  {tools.formatAxisValue(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={LINE_CHART_PLOT_LEFT_PX}
            y1={LINE_CHART_PLOT_BOTTOM_PX}
            x2={chartWidth - LINE_CHART_PLOT_RIGHT_PX}
            y2={LINE_CHART_PLOT_BOTTOM_PX}
            stroke="#c9c0b8"
          />
          <line
            x1={LINE_CHART_PLOT_LEFT_PX}
            y1={LINE_CHART_PLOT_TOP_PX}
            x2={LINE_CHART_PLOT_LEFT_PX}
            y2={LINE_CHART_PLOT_BOTTOM_PX}
            stroke="#c9c0b8"
          />
          {spec.type === 'area' && <path d={areaPath} fill="rgba(199,70,52,0.12)" />}
          <path d={path} fill="none" stroke="#c74634" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => {
            const px = linePointX(index, points.length, chartWidth);
            const py = linePointY(point.value, maxValue);
            return (
              <g key={`${point.label}-${index}`}>
                <text
                  x={px}
                  y={Math.max(16, py - 12)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#4f4640"
                >
                  {tools.formatAxisValue(point.value)}
                </text>
                <circle cx={px} cy={py} r="4.5" fill={CHART_COLORS[index % CHART_COLORS.length]}>
                  <title>{`${point.label}: ${tools.formatCellValue(point.value)}`}</title>
                </circle>
                <text
                  x={px}
                  y={LINE_CHART_PLOT_BOTTOM_PX + 24}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#8b8178"
                >
                  {compactXAxisLabel(point.label)}
                </text>
              </g>
            );
          })}
        </svg>
      </ChartScrollFrame>
    </div>
  );
}

export function PieChart(props: ChartRendererProps) {
  const { points, spec, tools } = props;
  const ChartControls = tools.ChartControls;
  const { cx, cy, outerRadius, innerRadius } = PIE_CHART_GEOMETRY;
  const slices = buildPieSlices(points, tools.donutSlicePath);
  const ringRadius = (outerRadius + innerRadius) / 2;
  const ringStrokeWidth = outerRadius - innerRadius;

  return (
    <div className={`grid min-w-0 gap-4 lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] ${CHART_SURFACE_CLASS}`}>
      <div className="lg:col-span-2">
        <ChartControls {...chartControlProps(props)} />
      </div>
      <svg viewBox="0 0 220 220" className="mx-auto h-56 w-full max-w-56" role="img" aria-label={spec.title || 'Pie chart'}>
        <circle cx={cx} cy={cy} r={outerRadius} fill="#f7f4f1" />
        {slices.map((slice, index) =>
          slice.isFullRing ? (
            <circle
              key={`${slice.label}-${index}`}
              cx={cx}
              cy={cy}
              r={ringRadius}
              fill="none"
              stroke={slice.color}
              strokeWidth={ringStrokeWidth}
            />
          ) : (
            <path
              key={`${slice.label}-${index}`}
              d={slice.path}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )
        )}
        <circle cx={cx} cy={cy} r={innerRadius - 1} fill="#ffffff" />
      </svg>
      <div className="min-w-0 space-y-2 self-center justify-self-start">
        {slices.slice(0, 8).map((point) => (
          <div key={point.label} className="flex w-fit max-w-full items-center gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: point.color }}
              />
              <span className="truncate text-oracle-medium-gray">{point.label}</span>
            </span>
            <span className="shrink-0 font-semibold text-oracle-dark-gray">
              {tools.formatCellValue(point.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart(props: ChartRendererProps) {
  const { maxValue, points, tools } = props;
  const ChartControls = tools.ChartControls;
  const ChartScrollFrame = tools.ChartScrollFrame;
  const barChartLayout = getBarChartLayout(points.length);
  const yAxisTicks = tools.buildYAxisTicks(maxValue);

  return (
    <div className={CHART_SURFACE_CLASS}>
      <ChartControls {...chartControlProps(props)} />
      <div className="grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between pr-2 text-right text-[10px] font-medium tabular-nums text-oracle-light-gray"
          style={{
            height: `${BAR_CHART_HEIGHT_PX}px`,
            paddingTop: `${BAR_CHART_TOP_PADDING_PX}px`,
            paddingBottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
          }}
        >
          {yAxisTicks.map((tick, index) => (
            <span key={`${tick}-${index}`}>{tools.formatAxisValue(tick)}</span>
          ))}
        </div>
        <ChartScrollFrame>
          <div
            className={`relative ${barChartLayout.compact ? 'min-w-full' : ''}`}
            style={
              barChartLayout.compact
                ? { height: `${BAR_CHART_HEIGHT_PX}px` }
                : { minWidth: `${barChartLayout.width}px`, height: `${BAR_CHART_HEIGHT_PX}px` }
            }
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 flex flex-col justify-between border-l border-[#c9c0b8]"
              style={{
                top: `${BAR_CHART_TOP_PADDING_PX}px`,
                bottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
              }}
            >
              {yAxisTicks.map((tick, index) => (
                <span
                  key={`${tick}-${index}`}
                  className={`border-t ${index === yAxisTicks.length - 1 ? 'border-[#c9c0b8]' : 'border-[#eee6df]'}`}
                />
              ))}
            </div>
            <div className={`relative z-10 flex h-full gap-4 ${barChartLayout.compact ? 'justify-center' : ''}`}>
              {points.map((point, index) => {
                const height = getBarHeight(point.value, maxValue);
                return (
                  <div key={`${point.label}-${index}`} className="relative h-full w-24 shrink-0">
                    <div
                      className="absolute left-0 right-0 flex flex-col items-center justify-end"
                      style={{
                        top: `${BAR_CHART_TOP_PADDING_PX}px`,
                        bottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
                      }}
                    >
                      <div className="mb-2 max-w-full whitespace-nowrap text-center text-xs font-semibold tabular-nums text-oracle-medium-gray">
                        {tools.formatCellValue(point.value)}
                      </div>
                      <div
                        className="w-full rounded-t-md shadow-[0_8px_16px_rgba(49,45,42,0.12)]"
                        style={{ height: `${height}px`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        title={`${point.label}: ${tools.formatCellValue(point.value)}`}
                      />
                    </div>
                    <div
                      className="absolute bottom-0 left-0 right-0 flex items-start justify-center pt-2 text-center text-xs text-oracle-light-gray"
                      style={{ height: `${BAR_CHART_BOTTOM_PADDING_PX}px` }}
                      title={point.label}
                    >
                      <span className="w-full truncate">{point.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartScrollFrame>
      </div>
    </div>
  );
}
