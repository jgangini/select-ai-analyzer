import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataSourcesTable } from './DataSourcesTable';
import type { DataSourceSummary } from './dataSourceUtils';

type TableProps = Parameters<typeof DataSourcesTable>[0];

const csvSource: DataSourceSummary = {
  data_source_id: 'csv-source',
  source_name: 'Card Activity',
  source_type: 'csv',
  owner_name: 'APP_AGENT_DATA',
  table_name: 'CARD_ACTIVITY',
  access_scope: 'all',
  row_count: 1250,
  column_count: 12,
  status: 'ACTIVE',
  created_at: '2026-01-02T03:04:05Z',
};

function tableProps(overrides: Partial<TableProps> = {}): TableProps {
  return {
    sources: [csvSource],
    totalItems: 12,
    page: 0,
    selectedSourceIds: new Set<string>(),
    selectAllRef: createRef<HTMLInputElement>(),
    allCurrentPageSourcesSelected: false,
    isLoading: false,
    isError: false,
    error: null,
    isDeletePending: false,
    onSelectSource: vi.fn(),
    onSelectCurrentPage: vi.fn(),
    onPreview: vi.fn(),
    onDelete: vi.fn(),
    onPageChange: vi.fn(),
    ...overrides,
  };
}

describe('DataSourcesTable', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders source rows and wires selection, preview, delete, and pagination actions', () => {
    const onSelectSource = vi.fn();
    const onSelectCurrentPage = vi.fn();
    const onPreview = vi.fn();
    const onDelete = vi.fn();
    const onPageChange = vi.fn();

    render(
      <DataSourcesTable
        {...tableProps({
          onSelectSource,
          onSelectCurrentPage,
          onPreview,
          onDelete,
          onPageChange,
        })}
      />
    );

    expect(screen.getByText('APP_AGENT_DATA')).toBeInTheDocument();
    expect(screen.getByText('CARD_ACTIVITY')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /select all data sources/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /select app_agent_data\.card_activity/i }));
    fireEvent.click(screen.getByRole('button', { name: /view rows for app_agent_data\.card_activity/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete app_agent_data\.card_activity/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onSelectCurrentPage).toHaveBeenCalledWith(true);
    expect(onSelectSource).toHaveBeenCalledWith('csv-source', true);
    expect(onPreview).toHaveBeenCalledWith(csvSource);
    expect(onDelete).toHaveBeenCalledWith(csvSource);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('shows empty and error states without row actions', () => {
    const { rerender } = render(<DataSourcesTable {...tableProps({ sources: [], totalItems: 0 })} />);

    expect(screen.getByText('No data sources found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view rows/i })).not.toBeInTheDocument();

    rerender(
      <DataSourcesTable
        {...tableProps({
          sources: [],
          totalItems: 0,
          isError: true,
          error: { message: 'Unable to load sources' },
        })}
      />
    );

    expect(screen.getByText('Unable to load sources')).toBeInTheDocument();
  });
});
