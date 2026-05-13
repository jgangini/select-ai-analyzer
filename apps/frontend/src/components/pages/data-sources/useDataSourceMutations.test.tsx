import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FormEvent, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useDataSourceMutations } from './useDataSourceMutations';
import type { DataSourceCsvUploadDraft } from './dataSourceUtils';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function csvDraft(): DataSourceCsvUploadDraft {
  return {
    id: 'accounts',
    baseName: 'accounts',
    csvFile: new File(['ACCOUNT_ID\n1'], 'accounts.csv', { type: 'text/csv' }),
    metadataJsonFile: new File(['{}'], 'accounts.json', { type: 'application/json' }),
    tableName: 'ACCOUNTS',
    tableComment: 'Accounts loaded from CSV',
    columnMetadata: [{ column_name: 'ACCOUNT_ID', comment: 'Account key' }],
    error: null,
  };
}

function objectForm(drafts: DataSourceCsvUploadDraft[]) {
  return {
    csvUploadDrafts: drafts,
    csvSchemaName: 'APP_AGENT_DATA',
    tableComment: '',
    columnMetadata: [],
    tableOwner: '',
    tableName: '',
    pendingSchemaCreation: null,
    setCsvSchemaName: vi.fn(),
    setPendingSchemaCreation: vi.fn(),
    setIsObjectModalOpen: vi.fn(),
    resetObjectMetadata: vi.fn(),
    setTableOwner: vi.fn(),
    setTableName: vi.fn(),
    setTableComment: vi.fn(),
    setColumnMetadata: vi.fn(),
  };
}

function listState() {
  return {
    viewingSource: null,
    setSelectedDataSourceIds: vi.fn(),
    setViewingSource: vi.fn(),
    setDeletingSource: vi.fn(),
  };
}

describe('useDataSourceMutations', () => {
  it('closes the CSV modal and exposes pending sources while upload continues', async () => {
    const draft = csvDraft();
    const uploadResult = deferred<{ data: { metadata_warnings?: string[] } }>();
    const apiClient = {
      uploadCsv: vi.fn(() => uploadResult.promise),
      registerTable: vi.fn(),
      deleteSource: vi.fn(),
    };
    const form = objectForm([draft]);
    const onCsvUploadStart = vi.fn();
    const onCsvUploadSettled = vi.fn();
    const invalidateSources = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    const { result } = renderHook(
      () =>
        useDataSourceMutations({
          apiClient,
          objectForm: form,
          listState: listState(),
          schemaNeedsCreation: false,
          normalizedCsvSchema: 'APP_AGENT_DATA',
          schemasAreLoading: false,
          invalidateSources,
          onCsvUploadStart,
          onCsvUploadSettled,
          showToast,
          defaultDataSchema: 'APP_AGENT_DATA',
          getErrorMessage: (error) => (error as Error).message || 'Operation failed.',
          metadataWarningMessage: () => null,
        }),
      { wrapper: wrapper() }
    );

    act(() => {
      result.current.submitCsv({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(form.setIsObjectModalOpen).toHaveBeenCalledWith(false);
    expect(form.resetObjectMetadata).toHaveBeenCalled();
    expect(form.setCsvSchemaName).toHaveBeenCalledWith('APP_AGENT_DATA');
    expect(onCsvUploadStart).toHaveBeenCalledWith([
      expect.objectContaining({
        owner_name: 'APP_AGENT_DATA',
        table_name: 'ACCOUNTS',
        source_type: 'csv',
        status: 'pending',
        column_count: 1,
      }),
    ]);
    expect(showToast).toHaveBeenCalledWith(
      'CSV upload started. Objects will become active when processing finishes.',
      'info'
    );

    await waitFor(() =>
      expect(apiClient.uploadCsv).toHaveBeenCalledWith(
        draft.csvFile,
        'ACCOUNTS',
        'Accounts loaded from CSV',
        [{ column_name: 'ACCOUNT_ID', comment: 'Account key' }],
        'all',
        'APP_AGENT_DATA',
        false
      )
    );

    await act(async () => {
      uploadResult.resolve({ data: { metadata_warnings: [] } });
      await uploadResult.promise;
    });

    await waitFor(() => expect(invalidateSources).toHaveBeenCalled());
    expect(onCsvUploadSettled).toHaveBeenCalledWith([
      expect.objectContaining({ owner_name: 'APP_AGENT_DATA', table_name: 'ACCOUNTS', status: 'pending' }),
    ]);
    expect(showToast).toHaveBeenCalledWith('CSV files loaded and Select AI profile updated.', 'success');
  });
});
