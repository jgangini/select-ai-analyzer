import { describe, expect, it } from 'vitest';

import { buildPieSlices, getBarChartLayout, getBarHeight, type ChartPoint } from './AnalyticsChartRenderers';

const pathForAngles = (
  _cx: number,
  _cy: number,
  _outerRadius: number,
  _innerRadius: number,
  startAngle: number,
  endAngle: number
) => `${startAngle.toFixed(3)}:${endAngle.toFixed(3)}`;

describe('analytics chart renderer helpers', () => {
  it('builds proportional pie slices and keeps negative values out of the total', () => {
    const points: ChartPoint[] = [
      { label: 'Checking', value: 30 },
      { label: 'Savings', value: 10 },
      { label: 'Fees', value: -5 },
    ];

    const slices = buildPieSlices(points, pathForAngles, ['red', 'blue']);

    expect(slices.map((slice) => [slice.label, slice.share, slice.color, slice.isFullRing])).toEqual([
      ['Checking', 0.75, 'red', false],
      ['Savings', 0.25, 'blue', false],
      ['Fees', 0, 'red', false],
    ]);
    expect(slices[0].path).toMatch(/^-1\.559:/);
  });

  it('marks a single full-value slice as a complete ring', () => {
    const slices = buildPieSlices([{ label: 'Total', value: 100 }], pathForAngles);

    expect(slices[0]).toMatchObject({
      label: 'Total',
      share: 1,
      isFullRing: true,
    });
  });

  it('calculates stable bar dimensions for compact and scrollable charts', () => {
    expect(getBarChartLayout(4)).toEqual({ compact: true, width: 448 });
    expect(getBarChartLayout(8)).toEqual({ compact: false, width: 896 });
    expect(getBarHeight(0, 100)).toBe(8);
    expect(getBarHeight(-50, 100)).toBe(88);
  });
});
