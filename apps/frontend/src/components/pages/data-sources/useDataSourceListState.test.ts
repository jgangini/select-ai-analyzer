import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDataSourceListState } from './useDataSourceListState';

type Source = Parameters<typeof useDataSourceListState>[0][number];

function source(id: string, status = 'active'): Source {
  return {
    data_source_id: id,
    source_name: id,
    source_type: 'csv',
    owner_name: 'APP_AGENT_DATA',
    table_name: id.toUpperCase(),
    access_scope: 'all',
    row_count: 10,
    column_count: 2,
    status,
    created_at: '2026-01-01',
  };
}

function helpers() {
  return {
    pageSize: 2,
    filterDataSources: vi.fn((sources: Source[], searchTerm: string, statusFilter: string) =>
      sources.filter(
        (item) =>
          (!searchTerm || item.source_name.includes(searchTerm)) &&
          (!statusFilter || item.status === statusFilter)
      )
    ),
    summarizeDataSources: vi.fn((sources: Source[]) => ({
      active: sources.filter((item) => item.status === 'active').length,
      csv: sources.filter((item) => item.source_type === 'csv').length,
      tables: sources.length,
      rows: sources.reduce((sum, item) => sum + item.row_count, 0),
    })),
  };
}

describe('useDataSourceListState', () => {
  it('filters, paginates, and toggles current page selection', () => {
    const listHelpers = helpers();
    const { result } = renderHook(() =>
      useDataSourceListState([source('one'), source('two'), source('three', 'failed')], listHelpers)
    );

    expect(result.current.paginatedSources.map((item) => item.data_source_id)).toEqual(['one', 'two']);
    expect(result.current.stats).toEqual({ active: 2, csv: 3, tables: 3, rows: 30 });

    act(() => result.current.toggleAllVisibleSources(true));
    expect(result.current.selectedDataSourceIds).toEqual(['one', 'two']);
    expect(result.current.allCurrentPageSourcesSelected).toBe(true);

    act(() => result.current.toggleDataSourceSelection('one', false));
    expect(result.current.selectedDataSourceIds).toEqual(['two']);
    expect(result.current.allCurrentPageSourcesSelected).toBe(false);
  });

  it('resets page and prunes selected ids when the source list changes', () => {
    const listHelpers = helpers();
    const { rerender, result } = renderHook(
      ({ sources }) => useDataSourceListState(sources, listHelpers),
      { initialProps: { sources: [source('one'), source('two'), source('three')] } }
    );

    act(() => {
      result.current.setPage(1);
      result.current.setSelectedDataSourceIds(['one', 'removed']);
      result.current.setSearchTerm('one');
    });
    expect(result.current.page).toBe(0);

    rerender({ sources: [source('one')] });

    expect(result.current.selectedDataSourceIds).toEqual(['one']);
  });
});
