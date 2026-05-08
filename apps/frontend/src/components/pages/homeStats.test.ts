import { describe, expect, it } from 'vitest';

import { buildHomeStatCards, buildReadinessSummary, formatNumber, type HomeStatsSource } from './homeStats';

function source(overrides: Partial<HomeStatsSource>): HomeStatsSource {
  return {
    row_count: 0,
    column_count: 0,
    status: 'active',
    ...overrides,
  };
}

describe('homeStats', () => {
  it('builds stat cards from registered data sources', () => {
    const cards = buildHomeStatCards([
      source({ row_count: 1000, column_count: 4 }),
      source({ row_count: 250, column_count: 6 }),
    ]);

    expect(cards.map((card) => [card.label, card.value])).toEqual([
      ['Objects', 2],
      ['Columns', 10],
      ['Rows', 1250],
    ]);
    expect(formatNumber(1250)).toBe('1,250');
  });

  it('summarizes active data readiness and loading state', () => {
    const sources = [
      source({ status: 'ACTIVE' }),
      source({ status: 'failed' }),
      source({ status: 'inactive' }),
    ];

    expect(buildReadinessSummary(sources, false)).toEqual({
      readinessRate: 33,
      readinessSummary: '1 of 3 objects active',
    });
    expect(buildReadinessSummary(sources, true).readinessSummary).toBe('Loading registered objects');
  });
});
