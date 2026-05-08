import { describe, expect, it } from 'vitest';

import {
  buildPreviewColumnDetails,
  catalogTablePlaceholder,
  filterDataSources,
  getDataSourceStatusBadgeClassName,
  getObjectSubmitState,
  getPaginationWindow,
  mergeMetadataWithColumns,
  parseCsvHeaders,
  parseMetadataJson,
  schemaNeedsCreation,
  sortCatalogTables,
  sortSchemaOptions,
  summarizeDataSources,
  metadataWarningMessage,
  userSchemaOptions,
  type DataSourceSchema,
  type DataSourceSummary,
} from './dataSourceUtils';

const sources: DataSourceSummary[] = [
  {
    data_source_id: 'one',
    source_name: 'Cards CSV',
    source_type: 'csv',
    owner_name: 'APP_AGENT_DATA',
    table_name: 'CARD_ACTIVITY',
    access_scope: 'all',
    row_count: 12,
    column_count: 4,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    data_source_id: 'two',
    source_name: 'Core Account',
    source_type: 'existing_table',
    owner_name: 'CORE',
    table_name: 'ACCOUNT_BALANCE',
    access_scope: 'all',
    row_count: 20,
    column_count: 5,
    status: 'FAILED',
    created_at: '2026-01-02T00:00:00Z',
  },
];

describe('data source utilities', () => {
  it('filters sources by status and search text', () => {
    const filtered = filterDataSources(sources, 'balance', 'failed');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].data_source_id).toBe('two');
  });

  it('summarizes source counts and rows', () => {
    expect(summarizeDataSources(sources)).toEqual({
      active: 1,
      csv: 1,
      tables: 1,
      rows: 32,
    });
  });

  it('parses quoted CSV headers into normalized identifiers', () => {
    expect(parseCsvHeaders('"Account, Number",balance,"DRCR_IND"\n123,10,D')).toEqual([
      'ACCOUNT, NUMBER',
      'BALANCE',
      'DRCR_IND',
    ]);
  });

  it('merges metadata onto detected columns while preserving CSV order', () => {
    const metadata = mergeMetadataWithColumns(['account_id', 'balance'], [
      { column_name: 'BALANCE', comment: 'Available balance', primary_key: false },
      { column_name: 'ACCOUNT_ID', comment: 'Account key', primary_key: true },
    ]);

    expect(metadata.map((column) => [column.column_name, column.comment, column.primary_key])).toEqual([
      ['ACCOUNT_ID', 'Account key', true],
      ['BALANCE', 'Available balance', false],
    ]);
    expect(metadata.map((column) => column.ordinal_position)).toEqual([1, 2]);
  });

  it('builds preview column details from metadata and fallback ordinals', () => {
    const details = buildPreviewColumnDetails(['account_id', 'balance'], [
      { column_name: 'BALANCE', data_type: 'NUMBER', comment: 'Current balance' },
    ]);

    expect(details).toEqual([
      { column_name: 'ACCOUNT_ID', ordinal_position: 1 },
      { column_name: 'BALANCE', data_type: 'NUMBER', comment: 'Current balance' },
    ]);
  });

  it('accepts common metadata JSON aliases', () => {
    const parsed = parseMetadataJson(
      JSON.stringify({
        description: 'Banking table',
        fields: [
          {
            name: 'account_id',
            type: 'varchar2',
            length: 30,
            description: 'Account key',
            uiDisplay: 'Account',
            data_class: 'identifier',
            pk: 'yes',
          },
        ],
      })
    );

    expect(parsed.tableComment).toBe('Banking table');
    expect(parsed.columns[0]).toMatchObject({
      column_name: 'ACCOUNT_ID',
      data_type: 'varchar2',
      data_length: 30,
      comment: 'Account key',
      ui_display: 'Account',
      classification: 'identifier',
      primary_key: true,
    });
  });
});

describe('data source controller utilities', () => {
  it('keeps APP_AGENT_DATA first while sorting schema options', () => {
    const schemas: DataSourceSchema[] = [
      { schema_name: 'ZZZ', exists: true, is_app_schema: false, source_count: 0 },
      { schema_name: 'APP_AGENT_DATA', exists: true, is_app_schema: false, source_count: 1 },
      { schema_name: 'AAA', exists: true, is_app_schema: false, source_count: 0 },
    ];

    expect(sortSchemaOptions(schemas).map((schema) => schema.schema_name)).toEqual([
      'APP_AGENT_DATA',
      'AAA',
      'ZZZ',
    ]);
  });

  it('sorts catalog tables by table name', () => {
    const sorted = sortCatalogTables([
      { owner_name: 'CORE', table_name: 'Z_TABLE', row_count: 0, column_count: 1 },
      { owner_name: 'CORE', table_name: 'A_TABLE', row_count: 0, column_count: 1 },
    ]);

    expect(sorted.map((table) => table.table_name)).toEqual(['A_TABLE', 'Z_TABLE']);
  });

  it('detects when a typed schema needs creation only after schemas load', () => {
    const missingSchema = { schema_name: 'NEW_SCHEMA', exists: false, is_app_schema: false, source_count: 0 };

    expect(schemaNeedsCreation('NEW_SCHEMA', undefined, undefined)).toBe(false);
    expect(schemaNeedsCreation('NEW_SCHEMA', [missingSchema], missingSchema)).toBe(true);
    expect(schemaNeedsCreation('', [missingSchema], missingSchema)).toBe(false);
  });

  it('filters user-selectable schemas and labels table placeholders', () => {
    const schemas: DataSourceSchema[] = [
      { schema_name: 'APP_AGENT', exists: true, is_app_schema: true, source_count: 0 },
      { schema_name: 'APP_AGENT_DATA', exists: true, is_app_schema: false, source_count: 2 },
    ];

    expect(userSchemaOptions(schemas).map((schema) => schema.schema_name)).toEqual(['APP_AGENT_DATA']);
    expect(catalogTablePlaceholder('', false)).toBe('Select owner first');
    expect(catalogTablePlaceholder('CORE', false)).toBe('Select table');
    expect(catalogTablePlaceholder('CORE', true)).toBe('Loading...');
  });

  it('formats metadata warning messages with singular and plural text', () => {
    expect(metadataWarningMessage([])).toBeNull();
    expect(metadataWarningMessage(['one'])).toBe('Metadata saved with 1 warning.');
    expect(metadataWarningMessage(['one', 'two'])).toBe('Metadata saved with 2 warnings.');
  });

  it('maps known and unknown statuses to badge tone classes', () => {
    expect(getDataSourceStatusBadgeClassName('ACTIVE')).toContain('text-emerald-700');
    expect(getDataSourceStatusBadgeClassName('running')).toContain('text-blue-700');
    expect(getDataSourceStatusBadgeClassName('error')).toContain('text-rose-700');
    expect(getDataSourceStatusBadgeClassName('archived')).toContain('text-gray-700');
  });

  it('derives submit button state for CSV upload and table registration', () => {
    const csvInput: Parameters<typeof getObjectSubmitState>[0] = {
      objectMode: 'csv',
      csvFile: {} as File,
      isUploadPending: false,
      isSchemasLoading: false,
      tableOwner: '',
      tableName: '',
      isRegisterPending: false,
      isCatalogTableFetching: false,
    };
    const csvReady = getObjectSubmitState(csvInput);
    const tablePending = getObjectSubmitState({
      objectMode: 'existing_table',
      csvFile: null,
      isUploadPending: false,
      isSchemasLoading: false,
      tableOwner: 'CORE',
      tableName: 'ACCOUNTS',
      isRegisterPending: true,
      isCatalogTableFetching: false,
    });

    expect(csvReady).toEqual({ disabled: false, label: 'Upload CSV' });
    expect(getObjectSubmitState({ ...csvInput, csvFile: null }).disabled).toBe(true);
    expect(tablePending).toEqual({ disabled: true, label: 'Registering...' });
  });

  it('clamps pagination windows for empty, normal, and out-of-range pages', () => {
    expect(getPaginationWindow(0, 3, 10)).toEqual({ totalPages: 1, safePage: 0, start: 0, end: 0 });
    expect(getPaginationWindow(42, 2, 10)).toEqual({ totalPages: 5, safePage: 2, start: 21, end: 30 });
    expect(getPaginationWindow(42, 99, 10)).toEqual({ totalPages: 5, safePage: 4, start: 41, end: 42 });
  });
});
