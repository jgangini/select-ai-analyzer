import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LineAreaChart, type ChartRendererTools } from './AnalyticsChartRenderers';

const rendererTools: ChartRendererTools = {
  AddVisualizationButton: () => <button type="button">Add visualization</button>,
  buildYAxisTicks: (maxValue) => [maxValue, maxValue / 2, 0],
  ChartControls: () => null,
  ChartScrollFrame: ({ children }) => <div>{children}</div>,
  donutSlicePath: () => '',
  formatAxisValue: (value) => `${value}`,
  formatCellValue: (value) => `${value}`,
  formatMetricLabel: () => 'Value',
};

afterEach(() => {
  cleanup();
});

describe('LineAreaChart', () => {
  it('renders axis ticks, x labels, and visible point values', () => {
    render(
      <LineAreaChart
        spec={{ type: 'line', title: 'Daily debits vs credits' }}
        points={[
          { label: '2026-03-01T00:00:00', value: 120 },
          { label: '2026-03-02T00:00:00', value: 80 },
          { label: '2026-03-03T00:00:00', value: 160 },
        ]}
        allPoints={[
          { label: '2026-03-01T00:00:00', value: 120 },
          { label: '2026-03-02T00:00:00', value: 80 },
          { label: '2026-03-03T00:00:00', value: 160 },
        ]}
        maxValue={160}
        search=""
        sortMode="original"
        onSearchChange={vi.fn()}
        onSortModeChange={vi.fn()}
        tools={rendererTools}
      />
    );

    expect(screen.getByRole('img', { name: 'Daily debits vs credits' })).toBeInTheDocument();
    expect(screen.getByText('Mar 01')).toBeInTheDocument();
    expect(screen.getByText('Mar 02')).toBeInTheDocument();
    expect(screen.getByText('Mar 03')).toBeInTheDocument();
    expect(screen.getAllByText('160').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('80').length).toBeGreaterThanOrEqual(2);
  });
});
