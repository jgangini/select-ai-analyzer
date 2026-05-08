import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataSources } from './DataSources';

const dataSourcesControllerMock = vi.hoisted(() => ({
  openObjectModal: vi.fn(),
}));

vi.mock('./data-sources/useDataSourcesController', () => ({
  useDataSourcesController: () => ({
    openObjectModal: dataSourcesControllerMock.openObjectModal,
    overviewProps: {
      stats: { active: 2, csv: 1, tables: 1, rows: 1200 },
      searchTerm: '',
      statusFilter: '',
      isRefreshDisabled: false,
      onSearchTermChange: vi.fn(),
      onStatusFilterChange: vi.fn(),
      onRefresh: vi.fn(),
    },
    tableProps: {},
    objectModalProps: {},
    previewModalProps: {},
    deleteConfirmProps: {},
    schemaConfirmProps: {},
  }),
}));

vi.mock('./data-sources/DataSourcesTable', () => ({
  DataSourcesTable: () => <div data-testid="data-sources-table" />,
}));

vi.mock('./data-sources/DataSourceObjectModal', () => ({
  DataSourceDeleteConfirmModal: () => <div data-testid="delete-modal" />,
  DataSourceObjectModal: () => <div data-testid="object-modal" />,
  DataSourceSchemaCreationConfirmModal: () => <div data-testid="schema-modal" />,
}));

vi.mock('./data-sources/DataSourcePreviewModal', () => ({
  DataSourcePreviewModal: () => <div data-testid="preview-modal" />,
}));

describe('DataSources', () => {
  it('renders the page controls and opens the object modal from the header action', () => {
    dataSourcesControllerMock.openObjectModal.mockClear();

    render(<DataSources showToast={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /data source/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search data sources/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filter data sources by status/i })).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByTestId('data-sources-table')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /object/i }));

    expect(dataSourcesControllerMock.openObjectModal).toHaveBeenCalledTimes(1);
  });
});
