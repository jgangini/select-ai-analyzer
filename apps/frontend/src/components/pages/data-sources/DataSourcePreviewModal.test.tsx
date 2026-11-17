import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataSourcePreviewModal } from './DataSourcePreviewModal';
import type { DataSourceRowsResponse, DataSourceSummary } from './dataSourceUtils';

type PreviewProps = Parameters<typeof DataSourcePreviewModal>[0];

const source: DataSourceSummary = {
  data_source_id: 'preview-source',
  source_name: 'Account Balance',
  source_type: 'existing_table',
  owner_name: 'CORE',
  table_name: 'ACCOUNT_BALANCE',
  access_scope: 'all',
  row_count: 11,
  column_count: 2,
  status: 'ACTIVE',
  created_at: '2026-01-02T03:04:05Z',
};

const response: DataSourceRowsResponse = {
  data_source: source,
  columns: ['ACCOUNT_ID', 'BALANCE'],
  column_details: [
    {
      column_name: 'ACCOUNT_ID',
      data_type: 'VARCHAR2',
      data_length: 30,
      comment: 'Account key',
      ui_display: 'Account',
      classification: 'identifier',
      primary_key: true,
      nullable: 'N',
    },
    {
      column_name: 'BALANCE',
      data_type: 'NUMBER',
      comment: 'Current balance',
      nullable: 'Y',
    },
  ],
  rows: [{ ACCOUNT_ID: 'A-100', BALANCE: null }],
  row_count: 11,
  limit: 10,
  offset: 0,
};

function previewProps(overrides: Partial<PreviewProps> = {}): PreviewProps {
  return {
    source,
    response,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    page: 0,
    onPageChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('DataSourcePreviewModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders metadata, rows, and pagination actions for a source preview', () => {
    const onPageChange = vi.fn();
    const onClose = vi.fn();

    render(<DataSourcePreviewModal {...previewProps({ onPageChange, onClose })} />);

    expect(screen.getByRole('heading', { name: 'CORE.ACCOUNT_BALANCE' })).toBeInTheDocument();
    expect(screen.getByText('11 rows')).toBeInTheDocument();
    expect(screen.getByText('Account key')).toBeInTheDocument();
    expect(screen.getByText('A-100')).toBeInTheDocument();
    expect(screen.getByText('NULL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    const nextPage = onPageChange.mock.calls[0][0];
    expect(nextPage(0)).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /close rows preview/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading and error states', () => {
    const { rerender } = render(
      <DataSourcePreviewModal {...previewProps({ response: undefined, isLoading: true })} />
    );

    expect(screen.getByText('Loading rows...')).toBeInTheDocument();

    rerender(
      <DataSourcePreviewModal
        {...previewProps({
          response: undefined,
          isLoading: false,
          isError: true,
          error: { message: 'Rows failed to load' },
        })}
      />
    );

    expect(screen.getByText('Rows failed to load')).toBeInTheDocument();
  });
});
