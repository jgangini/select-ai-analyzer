import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataSourceObjectModal } from './DataSourceObjectModal';
import type { DataSourceObjectMode } from './dataSourceUtils';

type ModalProps = Parameters<typeof DataSourceObjectModal>[0];

function modalProps(overrides: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    objectMode: 'csv' as DataSourceObjectMode,
    csvFile: null,
    metadataJsonFile: null,
    csvSchemaName: 'APP_AGENT_DATA',
    csvTableName: '',
    normalizedCsvSchema: 'APP_AGENT_DATA',
    schemaNeedsCreation: false,
    schemaOptions: [],
    tableOwner: '',
    tableName: '',
    displayName: '',
    tableComment: '',
    columnMetadata: [],
    ownerOptions: [],
    tableOptions: [],
    isUploadPending: false,
    isRegisterPending: false,
    isSchemasLoading: false,
    isCatalogOwnersLoading: false,
    isCatalogTablesLoading: false,
    isCatalogTableFetching: false,
    onClose: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    onObjectModeChange: vi.fn(),
    onCsvFileChange: vi.fn(),
    onMetadataJsonFileChange: vi.fn(),
    onCsvSchemaNameChange: vi.fn(),
    onCsvTableNameChange: vi.fn(),
    onTableOwnerChange: vi.fn(),
    onTableNameChange: vi.fn(),
    onDisplayNameChange: vi.fn(),
    onTableCommentChange: vi.fn(),
    onColumnMetadataChange: vi.fn(),
    ...overrides,
  };
}

describe('DataSourceObjectModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders CSV upload controls and surfaces reserved schema feedback', () => {
    render(<DataSourceObjectModal {...modalProps({ normalizedCsvSchema: 'APP_AGENT' })} />);

    expect(screen.getByRole('heading', { name: /add object/i })).toBeInTheDocument();
    expect(screen.getByText('Load a CSV into a data schema.')).toBeInTheDocument();
    expect(screen.getByLabelText('CSV file')).toBeInTheDocument();
    expect(screen.getByLabelText('Metadata JSON')).toBeInTheDocument();
    expect(screen.getByText(/reserved for application tables/i)).toBeInTheDocument();
  });

  it('switches object mode through the source selector', () => {
    const onObjectModeChange = vi.fn();

    render(<DataSourceObjectModal {...modalProps({ onObjectModeChange })} />);

    fireEvent.change(screen.getByRole('combobox', { name: /object source/i }), {
      target: { value: 'existing_table' },
    });

    expect(onObjectModeChange).toHaveBeenCalledWith('existing_table');
  });
});
