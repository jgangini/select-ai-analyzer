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
  it('loads CSV headers and merges them with existing metadata', async () => {
    const showToast = vi.fn();
    const formHelpers = helpers();
    const { result } = renderHook(() => useDataSourceObjectForm(showToast, formHelpers));

    const file = { text: () => Promise.resolve('ACCOUNT_ID,AMOUNT\n1,25') } as File;
    act(() => result.current.handleCsvFileChange(file));

    await waitFor(() =>
      expect(result.current.columnMetadata).toEqual([{ column_name: 'ACCOUNT_ID' }, { column_name: 'AMOUNT' }])
    );
    expect(formHelpers.parseCsvHeaders).toHaveBeenCalledWith('ACCOUNT_ID,AMOUNT\n1,25');
  });

  it('resets metadata when object mode or owner/table changes', () => {
    const { result } = renderHook(() => useDataSourceObjectForm(vi.fn(), helpers()));

    act(() => {
      result.current.setColumnMetadata([{ column_name: 'ACCOUNT_ID', comment: 'Account' }]);
      result.current.setTableComment('Accounts');
      result.current.changeObjectMode('existing_table');
    });
    expect(result.current.objectMode).toBe('existing_table');
    expect(result.current.columnMetadata).toEqual([]);
    expect(result.current.tableComment).toBe('');

    act(() => {
      result.current.setTableName('OLD_TABLE');
      result.current.changeTableOwner('APP_DATA');
    });
    expect(result.current.tableOwner).toBe('APP_DATA');
    expect(result.current.tableName).toBe('');
  });

  it('loads metadata JSON and shows success feedback', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useDataSourceObjectForm(showToast, helpers()));
    const file = {
      text: () => Promise.resolve(JSON.stringify({ tableComment: 'Core accounts', columns: [{ column_name: 'ACCOUNT_ID' }] })),
    } as File;

    act(() => result.current.handleMetadataJsonFileChange(file));

    await waitFor(() => expect(result.current.tableComment).toBe('Core accounts'));
    expect(result.current.columnMetadata).toEqual([{ column_name: 'ACCOUNT_ID' }]);
    expect(showToast).toHaveBeenCalledWith('Metadata JSON loaded.', 'success');
  });
});
