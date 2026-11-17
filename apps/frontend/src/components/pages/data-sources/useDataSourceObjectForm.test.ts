import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDataSourceObjectForm } from './useDataSourceObjectForm';

function helpers() {
  return {
    defaultDataSchema: 'APP_AGENT_DATA',
    getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Unknown error'),
    mergeMetadataWithColumns: vi.fn((columnNames: string[], metadata: { column_name: string }[]) =>
      columnNames.map((columnName) => metadata.find((item) => item.column_name === columnName) || { column_name: columnName })
    ),
    normalizeIdentifier: (value: string) => value.trim().toUpperCase(),
    parseCsvHeaders: vi.fn((csvText: string) => csvText.split(/\r?\n/)[0].split(',')),
    parseMetadataJson: vi.fn((text: string) => JSON.parse(text)),
  };
}

describe('useDataSourceObjectForm', () => {
  it('builds upload drafts by matching CSV and JSON files by name', async () => {
    const showToast = vi.fn();
    const formHelpers = helpers();
    const { result } = renderHook(() => useDataSourceObjectForm(showToast, formHelpers));

    const csvFile = new File(['ACCOUNT_ID,AMOUNT\n1,25'], 'accounts.csv', { type: 'text/csv' });
    const jsonFile = new File([
      JSON.stringify({ tableComment: 'Core accounts', columns: [{ column_name: 'AMOUNT', comment: 'Balance' }] }),
    ], 'accounts.json', { type: 'application/json' });
    act(() => result.current.handleCsvUploadFilesChange([csvFile, jsonFile]));

    await waitFor(() =>
      expect(result.current.csvUploadDrafts[0]).toMatchObject({
        baseName: 'accounts',
        tableName: 'ACCOUNTS',
        metadataJsonFile: jsonFile,
        tableComment: 'Core accounts',
        error: null,
      })
    );
    expect(formHelpers.parseCsvHeaders).toHaveBeenCalledWith('ACCOUNT_ID,AMOUNT\n1,25');
    expect(result.current.csvUploadDrafts[0].columnMetadata).toEqual([
      { column_name: 'ACCOUNT_ID' },
      { column_name: 'AMOUNT', comment: 'Balance' },
    ]);
  });

  it('resets metadata when object mode or owner/table changes', () => {
    const { result } = renderHook(() => useDataSourceObjectForm(vi.fn(), helpers()));

    act(() => {
      result.current.setCsvUploadDrafts([
        {
          id: 'accounts',
          baseName: 'accounts',
          csvFile: {} as File,
          metadataJsonFile: {} as File,
          tableName: 'ACCOUNTS',
          tableComment: '',
          columnMetadata: [{ column_name: 'ACCOUNT_ID', comment: 'Account' }],
          error: null,
        },
      ]);
      result.current.setColumnMetadata([{ column_name: 'ACCOUNT_ID', comment: 'Account' }]);
      result.current.setTableComment('Accounts');
      result.current.changeObjectMode('existing_table');
    });
    expect(result.current.objectMode).toBe('existing_table');
    expect(result.current.csvUploadDrafts).toEqual([]);
    expect(result.current.columnMetadata).toEqual([]);
    expect(result.current.tableComment).toBe('');

    act(() => {
      result.current.setTableName('OLD_TABLE');
      result.current.changeTableOwner('APP_DATA');
    });
    expect(result.current.tableOwner).toBe('APP_DATA');
    expect(result.current.tableName).toBe('');
  });

  it('marks CSV files without matching metadata as not ready', async () => {
    const { result } = renderHook(() => useDataSourceObjectForm(vi.fn(), helpers()));
    const csvFile = new File(['ACCOUNT_ID\n1'], 'accounts.csv', { type: 'text/csv' });

    act(() => result.current.handleCsvUploadFilesChange([csvFile]));

    await waitFor(() => expect(result.current.csvUploadDrafts[0].error).toContain('Missing matching JSON metadata.'));
  });

  it('keeps selected CSV files when matching JSON files are added later', async () => {
    const { result } = renderHook(() => useDataSourceObjectForm(vi.fn(), helpers()));
    const csvFile = new File(['ACCOUNT_ID\n1'], 'accounts.csv', { type: 'text/csv' });
    const jsonFile = new File([JSON.stringify({ columns: [{ column_name: 'ACCOUNT_ID', comment: 'Account' }] })], 'accounts.json', {
      type: 'application/json',
    });

    act(() => result.current.handleCsvUploadFilesChange([csvFile]));
    await waitFor(() => expect(result.current.csvUploadDrafts[0].metadataJsonFile).toBeNull());

    act(() => result.current.handleCsvUploadFilesChange([jsonFile]));

    await waitFor(() =>
      expect(result.current.csvUploadDrafts[0]).toMatchObject({
        csvFile,
        metadataJsonFile: jsonFile,
        error: null,
      })
    );
    expect(result.current.csvUploadDrafts[0].columnMetadata).toEqual([
      { column_name: 'ACCOUNT_ID', comment: 'Account' },
    ]);
  });
});
