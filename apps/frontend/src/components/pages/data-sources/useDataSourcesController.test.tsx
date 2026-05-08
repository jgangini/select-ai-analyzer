import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDataSourcesController } from './useDataSourcesController';

const sources = [
  {
    data_source_id: 'csv-1',
    source_name: 'Accounts CSV',
    source_type: 'csv' as const,
    owner_name: 'APP_AGENT_DATA',
    table_name: 'ACCOUNTS_CSV',
    access_scope: 'all' as const,
    row_count: 20,
    column_count: 3,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    data_source_id: 'table-1',
    source_name: 'Customer master',
    source_type: 'existing_table' as const,
    owner_name: 'APP_AGENT_DATA',
    table_name: 'CUSTOMERS',
    access_scope: 'private' as const,
    row_count: 8,
    column_count: 5,
    status: 'failed',
    created_at: '2026-01-02T00:00:00Z',
  },
];

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function HookWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function apiClient(overrides = {}) {
  return {
    list: vi.fn().mockResolvedValue({ data: { items: sources } }),
    schemas: vi.fn().mockResolvedValue({ data: { items: [] } }),
    catalogOwners: vi.fn().mockResolvedValue({ data: { items: [] } }),
    catalogTables: vi.fn().mockResolvedValue({ data: { items: [] } }),
    catalogTable: vi.fn().mockResolvedValue({ data: { columns: [] } }),
    rows: vi.fn().mockResolvedValue({ data: { columns: [], rows: [], row_count: 0 } }),
    uploadCsv: vi.fn(),
    registerTable: vi.fn(),
    deleteSource: vi.fn(),
    ...overrides,
  };
}

describe('useDataSourcesController', () => {
  it('loads sources and exposes filtered table props', async () => {
    const api = apiClient();
    const { result } = renderHook(
      () =>
        useDataSourcesController({
          apiClient: api,
          queryKeys: {
            list: ['data-sources', 'list'],
            schemas: ['data-sources', 'schemas'],
            rows: (dataSourceId: string | null, page: number) => ['data-sources', 'rows', dataSourceId, page],
          },
          showToast: vi.fn(),
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.tableProps.sources).toHaveLength(2));
    expect(result.current.overviewProps.stats).toMatchObject({ active: 1, csv: 1, tables: 1, rows: 28 });

    act(() => result.current.overviewProps.onStatusFilterChange('failed'));

    await waitFor(() => expect(result.current.tableProps.sources).toHaveLength(1));
    expect(result.current.tableProps.sources[0].data_source_id).toBe('table-1');
  });
});
