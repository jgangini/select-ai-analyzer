import { useMemo, useState } from 'react';

import {
  buildYAxisTicks,
  donutSlicePath,
  formatAxisValue,
  formatCellValue,
  formatMetricLabel,
  resolveChartPreviewModel,
  type AnalyticsChartSpec,
  type ChartSortMode,
} from './analyticsChartUtils';
import { AddVisualizationButton, ChartControls, ChartScrollFrame } from './AnalyticsChartChrome';
import {
  BarChart,
  EmptyChartState,
  LineAreaChart,
  MetricChart,
  PieChart,
  type ChartRendererTools,
} from './AnalyticsChartRenderers';
import { ResultTable } from './AnalyticsResultTable';

const chartRendererTools: ChartRendererTools = {
  AddVisualizationButton,
  buildYAxisTicks,
  ChartControls,
  ChartScrollFrame,
  donutSlicePath,
  formatAxisValue,
  formatCellValue,
  formatMetricLabel,
};

export function ChartPreview({
  spec,
  columns,
  rows,
  onAddVisualization,
  isVisualizationAdded = false,
}: {
  spec: AnalyticsChartSpec;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  onAddVisualization?: () => void;
  isVisualizationAdded?: boolean;
}) {
  const [chartSearch, setChartSearch] = useState('');
  const [chartSortMode, setChartSortMode] = useState<ChartSortMode>('original');
  const chartModel = useMemo(
    () =>
      resolveChartPreviewModel({
        spec,
        columns,
        rows,
        search: chartSearch,
        sortMode: chartSortMode,
      }),
    [columns, rows, spec, chartSearch, chartSortMode]
  );
  const { allPoints, maxValue, points, renderer, y } = chartModel;

  if (renderer === 'table') {
    return (
      <ResultTable
        columns={columns}
        rows={rows}
        isVisualizationAdded={isVisualizationAdded}
        onAddVisualization={onAddVisualization}
      />
    );
  }

  if (renderer === 'metric') {
    return (
      <MetricChart
        columns={columns}
        points={points}
        rows={rows}
        spec={spec}
        tools={chartRendererTools}
        y={y}
        isVisualizationAdded={isVisualizationAdded}
        onAddVisualization={onAddVisualization}
      />
    );
  }

  const rendererProps = {
    spec,
    points,
    allPoints,
    maxValue,
    search: chartSearch,
    sortMode: chartSortMode,
    isVisualizationAdded,
    onSearchChange: setChartSearch,
    onSortModeChange: setChartSortMode,
    onAddVisualization,
    tools: chartRendererTools,
  };

  if (renderer === 'empty') return <EmptyChartState {...rendererProps} />;
  if (renderer === 'line-area') return <LineAreaChart {...rendererProps} />;
  if (renderer === 'pie') return <PieChart {...rendererProps} />;
  return <BarChart {...rendererProps} />;
}

export { ResultTable } from './AnalyticsResultTable';
