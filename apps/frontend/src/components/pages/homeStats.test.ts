import { describe, expect, it } from 'vitest';

import { buildHomeStatCards, formatNumber, type HomeStatsSource } from './homeStats';

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
    expect(cards[1]?.caption).toBe('Fields available for analysis');
    expect(formatNumber(1250)).toBe('1,250');
  });
});
