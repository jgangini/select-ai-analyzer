import { describe, expect, it } from 'vitest';

import {
  buildYAxisTicks,
  donutSlicePath,
  formatAxisValue,
  formatMetricLabel,
  measureChartScrollbar,
  resolveChartPreviewModel,
  selectChartPreviewRenderer,
  visibleChartPoints,
  type AnalyticsChartSpec,
  type ChartPoint,
} from './analyticsChartUtils';

describe('analytics chart model', () => {
  it('renders a table when there are no rows', () => {
    const model = resolveChartPreviewModel({
      spec: { type: 'bar', x: 'name', y: 'amount' },
      columns: ['name', 'amount'],
      rows: [],
      search: '',
      sortMode: 'original',
    });

    expect(model.renderer).toBe('table');
    expect(model.points).toEqual([]);
    expect(model.maxValue).toBe(1);
  });

  it('builds comparison points for a single row with multiple numeric columns', () => {
    const model = resolveChartPreviewModel({
      spec: { type: 'bar' },
      columns: ['checking_balance', 'savings_balance', 'label'],
      rows: [{ checking_balance: '1,200.50', savings_balance: 850, label: 'Totals' }],
      search: '',
      sortMode: 'value-desc',
    });

    expect(model.singleRowNumericComparison).toBe(true);
    expect(model.renderer).toBe('bar');
    expect(model.points.map((point) => [point.label, point.value])).toEqual([
      ['checking_balance', 1200.5],
      ['savings_balance', 850],
    ]);
  });

  it('filters and sorts points without mutating the original order', () => {
    const points: ChartPoint[] = [
      { label: 'Savings', value: 100, index: 0 },
      { label: 'Checking', value: 300, index: 1 },
      { label: 'Loans', value: 200, index: 2 },
    ];

    const filtered = visibleChartPoints(points, 'ing', 'value-desc');

    expect(filtered.map((point) => point.label)).toEqual(['Checking', 'Savings']);
    expect(points.map((point) => point.label)).toEqual(['Savings', 'Checking', 'Loans']);
  });

  it('selects the empty chart state after filtering all values out', () => {
    const spec: AnalyticsChartSpec = { type: 'pie', x: 'name', y: 'amount' };
    const renderer = selectChartPreviewRenderer({
      spec,
      rows: [{ name: 'Checking', amount: 300 }],
      x: 'name',
      y: 'amount',
      singleRowNumericComparison: false,
      allPoints: [{ label: 'Checking', value: 300, index: 0 }],
      points: [],
    });

    expect(renderer).toBe('empty');
  });

  it('measures chart scrollbars only when content overflows', () => {
    expect(measureChartScrollbar(null)).toEqual({ show: false, width: 48, left: 0 });
    expect(measureChartScrollbar({ clientWidth: 300, scrollWidth: 301, scrollLeft: 0 })).toEqual({
      show: false,
      width: 48,
      left: 0,
    });

    expect(measureChartScrollbar({ clientWidth: 300, scrollWidth: 900, scrollLeft: 300 })).toEqual({
      show: true,
      width: 100,
      left: 100,
    });
  });

  it('formats axis and metric labels for compact chart displays', () => {
    expect(formatAxisValue(1_250_000)).toBe('1.3M');
    expect(formatAxisValue(12_345)).toBe('12,345');
    expect(formatAxisValue(12.345)).toBe('12.3');
    expect(formatMetricLabel([100, 'total_balance'])).toBe('total balance');
    expect(formatMetricLabel([100, ''])).toBe('Value');
    expect(buildYAxisTicks(80)).toEqual([80, 60, 40, 20, 0]);
  });

  it('builds stable donut slice paths', () => {
    expect(donutSlicePath(50, 50, 40, 20, 0, Math.PI / 2)).toBe(
      'M 90 50 A 40 40 0 0 1 50 90 L 50 70 A 20 20 0 0 0 70 50 Z'
    );
  });
});
