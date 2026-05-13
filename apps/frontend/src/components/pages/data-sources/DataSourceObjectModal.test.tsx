import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataSourceObjectModal, DataSourceSchemaCreationConfirmModal } from './DataSourceObjectModal';
import type { DataSourceCsvUploadDraft, DataSourceObjectMode } from './dataSourceUtils';

type ModalProps = Parameters<typeof DataSourceObjectModal>[0];

function modalProps(overrides: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    objectMode: 'csv' as DataSourceObjectMode,
    csvUploadDrafts: [],
    activeCsvUploadId: null,
    csvUploadIssues: [],
    csvSchemaName: 'APP_AGENT_DATA',
    normalizedCsvSchema: 'APP_AGENT_DATA',
    schemaNeedsCreation: false,
    schemaOptions: [],
    tableOwner: '',
    tableName: '',
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
    onCsvUploadFilesChange: vi.fn(),
    onActiveCsvUploadIdChange: vi.fn(),
    onCsvUploadDraftRemove: vi.fn(),
    onCsvSchemaNameChange: vi.fn(),
    onTableOwnerChange: vi.fn(),
    onTableNameChange: vi.fn(),
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
    expect(screen.queryByText('Load a CSV into a data schema.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Target schema')).toBeInTheDocument();
    expect(screen.getByLabelText(/add files/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /table comment/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/use an existing schema or type a new one/i)).not.toBeInTheDocument();
    expect(screen.getByText(/reserved for application tables/i)).toBeInTheDocument();
  });

  it('omits optional display name for existing tables', () => {
    render(<DataSourceObjectModal {...modalProps({ objectMode: 'existing_table' })} />);

    expect(screen.getByRole('combobox', { name: /object source/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /owner/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /table/i })).toBeInTheDocument();
    expect(screen.queryByText(/register a table that app_agent can read/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /optional display name/i })).not.toBeInTheDocument();
  });

  it('renders selected CSV batches and editable data dictionary for the active file', () => {
    const activeDraft: DataSourceCsvUploadDraft = {
      id: 'accounts',
      baseName: 'accounts',
      csvFile: new File(['ACCOUNT_ID,AMOUNT\n1,25'], 'accounts.csv', { type: 'text/csv' }),
      metadataJsonFile: new File(['{}'], 'accounts.json', { type: 'application/json' }),
      tableName: 'ACCOUNTS',
      tableComment: '',
      columnMetadata: [{ column_name: 'ACCOUNT_ID', comment: 'Account key' }],
      error: null,
    };

    render(
      <DataSourceObjectModal
        {...modalProps({
          csvUploadDrafts: [activeDraft],
          activeCsvUploadId: activeDraft.id,
        })}
      />
    );

    expect(screen.getAllByText('ACCOUNTS')).toHaveLength(2);
    expect(screen.getByText('accounts.csv - 1 KB')).toBeInTheDocument();
    expect(screen.getAllByText('accounts.json')).toHaveLength(1);
    expect(screen.getByText('1/1 ready')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment for account_id/i })).toHaveValue('Account key');
  });

  it('switches object mode through the source selector', () => {
    const onObjectModeChange = vi.fn();

    render(<DataSourceObjectModal {...modalProps({ onObjectModeChange })} />);

    fireEvent.change(screen.getByRole('combobox', { name: /object source/i }), {
      target: { value: 'existing_table' },
    });

    expect(onObjectModeChange).toHaveBeenCalledWith('existing_table');
  });

  it('places schema creation confirmation above the object modal', () => {
    render(
      <>
        <DataSourceObjectModal {...modalProps({ schemaNeedsCreation: true })} />
        <DataSourceSchemaCreationConfirmModal
          schemaName="APP_AGENT_DATA"
          isPending={false}
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </>
    );

    const heading = screen.getByRole('heading', { name: /create schema/i });
    let overlay = heading.parentElement;
    while (overlay && !String(overlay.className).includes('fixed')) {
      overlay = overlay.parentElement;
    }

    expect(String(overlay?.className)).toContain('z-[400]');
  });
});
