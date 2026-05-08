import api from './httpClient';

export type DataSourceObjectMode = 'csv' | 'existing_table';

export type DataSourceSummary = {
  data_source_id: string;
  source_name: string;
  source_type: 'csv' | 'existing_table';
  owner_name: string;
  table_name: string;
  access_scope: 'all' | 'private';
  row_count: number;
  column_count: number;
  status: string;
  created_at: string;
};

export type DataSourceSchema = {
  schema_name: string;
  exists: boolean;
  is_app_schema: boolean;
  source_count: number;
};

export type DataSourceColumnMetadata = {
  column_name: string;
  data_type?: string;
  data_length?: number;
  nullable?: string;
  ordinal_position?: number;
  comment?: string;
  ui_display?: string;
  classification?: string;
  primary_key?: boolean;
};

export type DataSourceRowsResponse = {
  data_source: DataSourceSummary;
  columns: string[];
  column_details: DataSourceColumnMetadata[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  limit: number;
  offset: number;
};

export type DataSourceCatalogOwner = {
  owner_name: string;
  table_count: number;
};

export type DataSourceCatalogTable = {
  owner_name: string;
  table_name: string;
  row_count: number;
  column_count: number;
  table_comment?: string;
};

export type DataSourceCatalogTableDetail = {
  owner_name: string;
  table_name: string;
  table_comment: string;
  columns: DataSourceColumnMetadata[];
};

export type RegisterTablePayload = {
  owner: string;
  table_name: string;
  display_name?: string;
  table_comment?: string;
  columns?: DataSourceColumnMetadata[];
  access_scope?: 'all' | 'private';
};

export type DataSourceMutationResponse = {
  data_source_id: string;
  owner_name: string;
  table_name: string;
  row_count?: number;
  metadata_warnings?: string[];
};

export const dataSourcesQueryKeys = {
  list: ['data-sources', 'list'] as const,
  schemas: ['data-sources', 'schemas'] as const,
  rows: (dataSourceId: string | null, page: number) => ['data-sources', 'rows', dataSourceId, page] as const,
};

export const dataSourcesApi = {
  list: () => api.get<{ items: DataSourceSummary[] }>('/data-sources'),
  schemas: () => api.get<{ items: DataSourceSchema[] }>('/data-sources/schemas'),
  catalogOwners: () => api.get<{ items: DataSourceCatalogOwner[] }>('/data-sources/catalog/owners'),
  catalogTables: (owner: string) =>
    api.get<{ items: DataSourceCatalogTable[] }>('/data-sources/catalog/tables', {
      params: { owner },
    }),
  catalogTable: (owner: string, tableName: string) =>
    api.get<DataSourceCatalogTableDetail>('/data-sources/catalog/table', {
      params: { owner, table_name: tableName },
    }),
  createSchema: (schemaName: string) => api.post('/data-sources/schemas', { schema_name: schemaName }),
  rows: (dataSourceId: string, limit = 10, offset = 0) =>
    api.get<DataSourceRowsResponse>(`/data-sources/${encodeURIComponent(dataSourceId)}/rows`, {
      params: { limit, offset },
    }),
  deleteSource: (dataSourceId: string) =>
    api.delete(`/data-sources/${encodeURIComponent(dataSourceId)}`),
  registerTable: (payload: RegisterTablePayload) =>
    api.post<DataSourceMutationResponse>('/data-sources/table-access', payload),
  uploadCsv: (
    file: File,
    tableName?: string,
    tableComment?: string,
    columns?: DataSourceColumnMetadata[],
    accessScope: 'all' | 'private' = 'all',
    targetSchema = 'APP_AGENT_DATA',
    createSchema = false
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (tableName?.trim()) formData.append('table_name', tableName.trim());
    if (tableComment?.trim()) formData.append('table_comment', tableComment.trim());
    if (columns && columns.length > 0) formData.append('columns_metadata_json', JSON.stringify(columns));
    formData.append('target_schema', targetSchema.trim());
    formData.append('create_schema', String(createSchema));
    formData.append('access_scope', accessScope);
    return api.post<DataSourceMutationResponse>('/data-sources/csv', formData);
  },
};
