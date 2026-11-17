import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('./httpClient', () => ({ default: apiMock }));

import { dataSourcesApi } from './dataSourcesApi';

describe('dataSourcesApi.uploadCsv', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
  });

  it('serializes CSV upload options into FormData', () => {
    const file = new File(['id\n1'], 'accounts.csv', { type: 'text/csv' });
    const columns = [{ column_name: 'ACCOUNT_ID', comment: 'Account identifier', primary_key: true }];

    dataSourcesApi.uploadCsv(file, ' accounts ', ' Core accounts ', columns, 'private', ' APP_DATA ', true);

    expect(apiMock.post).toHaveBeenCalledWith('/data-sources/csv', expect.any(FormData));
    const formData = apiMock.post.mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('table_name')).toBe('accounts');
    expect(formData.get('table_comment')).toBe('Core accounts');
    expect(formData.get('columns_metadata_json')).toBe(JSON.stringify(columns));
    expect(formData.get('target_schema')).toBe('APP_DATA');
    expect(formData.get('create_schema')).toBe('true');
    expect(formData.get('access_scope')).toBe('private');
  });
});
