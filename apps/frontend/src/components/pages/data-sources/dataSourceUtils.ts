export const PAGE_SIZE = 10;
export const DEFAULT_DATA_SCHEMA = 'APP_AGENT_DATA';
export const EMPTY_DATA_SOURCES: DataSourceSummary[] = [];
export const documentToolbarButtonClassName =
  'flex-shrink-0 inline-flex h-10 items-center justify-center rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50';
const dataSourceStatusBadgeBaseClassName =
  'inline-flex items-center rounded-xl border px-2.5 py-1 text-[11px] font-semibold tracking-wide';
const dataSourceStatusBadgeClassNames: Record<string, string> = {
  active: `${dataSourceStatusBadgeBaseClassName} border-emerald-200 bg-emerald-50/60 text-emerald-700`,
  completed: `${dataSourceStatusBadgeBaseClassName} border-emerald-200 bg-emerald-50/60 text-emerald-700`,
  pending: `${dataSourceStatusBadgeBaseClassName} border-amber-200 bg-amber-50/60 text-amber-700`,
  running: `${dataSourceStatusBadgeBaseClassName} border-blue-200 bg-blue-50/60 text-blue-700`,
  failed: `${dataSourceStatusBadgeBaseClassName} border-rose-200 bg-rose-50/60 text-rose-700`,
  error: `${dataSourceStatusBadgeBaseClassName} border-rose-200 bg-rose-50/60 text-rose-700`,
};

export interface DataSourceStats {
  active: number;
  csv: number;
  tables: number;
  rows: number;
}

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

export type DataSourceObjectMode = 'csv' | 'existing_table';

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

export type DataSourceSchema = {
  schema_name: string;
  exists: boolean;
  is_app_schema: boolean;
  source_count: number;
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

type PaginationWindow = {
  totalPages: number;
  safePage: number;
  start: number;
  end: number;
};

type ObjectSubmitState = {
  disabled: boolean;
  label: string;
};

export function getErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'Operation failed.';
}

export function metadataWarningMessage(warnings: string[] = []): string | null {
  if (warnings.length === 0) return null;
  return `Metadata saved with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function sortSchemaOptions(schemas: DataSourceSchema[] = []): DataSourceSchema[] {
  return schemas.slice().sort((left, right) => {
    if (left.schema_name === DEFAULT_DATA_SCHEMA) return -1;
    if (right.schema_name === DEFAULT_DATA_SCHEMA) return 1;
    return left.schema_name.localeCompare(right.schema_name);
  });
}

export function sortCatalogTables(tables: DataSourceCatalogTable[] = []): DataSourceCatalogTable[] {
  return tables.slice().sort((left, right) => left.table_name.localeCompare(right.table_name));
}

export function schemaNeedsCreation(
  normalizedSchemaName: string,
  schemas: DataSourceSchema[] | undefined,
  selectedSchema: DataSourceSchema | undefined
): boolean {
  return Boolean(normalizedSchemaName && schemas && !selectedSchema?.exists);
}

export function userSchemaOptions(schemas: DataSourceSchema[]): DataSourceSchema[] {
  return schemas.filter((schema) => !schema.is_app_schema);
}

export function catalogTablePlaceholder(tableOwner: string, isCatalogTablesLoading: boolean): string {
  if (isCatalogTablesLoading) return 'Loading...';
  return tableOwner ? 'Select table' : 'Select owner first';
}

export function getObjectSubmitState({
  objectMode,
  csvFile,
  isUploadPending,
  isSchemasLoading,
  tableOwner,
  tableName,
  isRegisterPending,
  isCatalogTableFetching,
}: {
  objectMode: DataSourceObjectMode;
  csvFile: File | null;
  isUploadPending: boolean;
  isSchemasLoading: boolean;
  tableOwner: string;
  tableName: string;
  isRegisterPending: boolean;
  isCatalogTableFetching: boolean;
}): ObjectSubmitState {
  if (objectMode === 'csv') {
    return {
      disabled: !csvFile || isUploadPending || isSchemasLoading,
      label: isUploadPending ? 'Uploading...' : 'Upload CSV',
    };
  }

  return {
    disabled: !tableOwner.trim() || !tableName.trim() || isRegisterPending || isCatalogTableFetching,
    label: isRegisterPending ? 'Registering...' : 'Register Table',
  };
}

export function normalizeIdentifier(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function formatLabel(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getDataSourceStatusBadgeClassName(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  return (
    dataSourceStatusBadgeClassNames[normalized] ||
    `${dataSourceStatusBadgeBaseClassName} border-gray-200 bg-gray-50 text-gray-700`
  );
}

export function formatDateTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function summarizeDataSources(sources: DataSourceSummary[]): DataSourceStats {
  return {
    active: sources.filter((source) => String(source.status || '').toLowerCase() === 'active').length,
    csv: sources.filter((source) => source.source_type === 'csv').length,
    tables: sources.filter((source) => source.source_type === 'existing_table').length,
    rows: sources.reduce((sum, source) => sum + Number(source.row_count || 0), 0),
  };
}

export function filterDataSources(
  sources: DataSourceSummary[],
  searchTerm: string,
  statusFilter: string
): DataSourceSummary[] {
  const term = searchTerm.trim().toLowerCase();
  return sources
    .filter((source) => !statusFilter || String(source.status || '').toLowerCase() === statusFilter)
    .filter((source) => {
      if (!term) return true;
      return [
        source.source_name,
        source.source_type,
        source.owner_name,
        source.table_name,
        source.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
}

export function formatColumnType(column: DataSourceColumnMetadata): string {
  const type = String(column.data_type || '').trim().toUpperCase();
  if (!type) return '-';
  if (type.includes('(') || !column.data_length) return type;
  if (['VARCHAR2', 'CHAR', 'NCHAR', 'NVARCHAR2'].includes(type)) {
    return `${type}(${column.data_length})`;
  }
  return type;
}

export function getPaginationWindow(totalItems: number, page: number, pageSize = PAGE_SIZE): PaginationWindow {
  const itemCount = Math.max(0, Number(totalItems || 0));
  const normalizedPageSize = Math.max(1, Number(pageSize || PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(itemCount / normalizedPageSize));
  const requestedPage = Math.max(0, Math.trunc(Number.isFinite(page) ? page : 0));
  const safePage = Math.min(requestedPage, totalPages - 1);
  const start = itemCount === 0 ? 0 : safePage * normalizedPageSize + 1;
  const end = Math.min((safePage + 1) * normalizedPageSize, itemCount);
  return { totalPages, safePage, start, end };
}

function parseCsvHeaderLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

export function parseCsvHeaders(csvText: string): string[] {
  const firstLine = csvText.split(/\r?\n/, 1)[0] || '';
  return parseCsvHeaderLine(firstLine)
    .map((column) => normalizeIdentifier(column))
    .filter(Boolean);
}

function columnsToMetadata(columnNames: string[]): DataSourceColumnMetadata[] {
  return columnNames.map((columnName, index) => ({
    column_name: columnName,
    ordinal_position: index + 1,
    comment: '',
    ui_display: '',
    classification: '',
    primary_key: false,
  }));
}

function pickMetadataValue(raw: Record<string, unknown>, keys: string[]): unknown {
  const normalizedEntries = new Map(Object.entries(raw).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const key of keys) {
    const value = normalizedEntries.get(key.trim().toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
}

function metadataText(raw: unknown): string {
  return String(raw || '').trim();
}

function metadataBoolean(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  return ['1', 'true', 't', 'yes', 'y', 'si', 's'].includes(String(raw || '').trim().toLowerCase());
}

export function parseMetadataJson(text: string): { tableComment: string; columns: DataSourceColumnMetadata[] } {
  const payload = JSON.parse(text) as unknown;
  const payloadObject = payload && !Array.isArray(payload) && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : null;
  const tableComment = payloadObject
    ? metadataText(
        pickMetadataValue(payloadObject, ['table_comment', 'tableComment', 'table comment', 'description', 'table_description'])
      )
    : '';
  const rawColumns = Array.isArray(payload)
    ? payload
    : payloadObject
      ? pickMetadataValue(payloadObject, ['columns', 'data_dictionary', 'dataDictionary', 'fields', 'items'])
      : null;

  if (!Array.isArray(rawColumns)) {
    throw new Error('Metadata JSON must include a columns array.');
  }

  const columns: DataSourceColumnMetadata[] = [];
  rawColumns.forEach((rawColumn, index) => {
    if (!rawColumn || typeof rawColumn !== 'object' || Array.isArray(rawColumn)) return;
    const column = rawColumn as Record<string, unknown>;
    const rawName = pickMetadataValue(column, ['column_name', 'columnName', 'Column Name', 'name', 'column', 'field']);
    const columnName = normalizeIdentifier(metadataText(rawName));
    if (!columnName) return;
    const dataLength = Number(pickMetadataValue(column, ['data_length', 'dataLength', 'length']) || 0);
    const ordinal = Number(pickMetadataValue(column, ['ordinal_position', 'ordinalPosition', 'position', 'order']) || index + 1);
    columns.push({
      column_name: columnName,
      data_type: metadataText(pickMetadataValue(column, ['data_type', 'dataType', 'type'])) || undefined,
      data_length: Number.isFinite(dataLength) && dataLength > 0 ? dataLength : undefined,
      nullable: metadataText(pickMetadataValue(column, ['nullable', 'nullable_flag', 'nullableFlag'])) || undefined,
      ordinal_position: Number.isFinite(ordinal) && ordinal > 0 ? ordinal : index + 1,
      comment: metadataText(pickMetadataValue(column, ['comment', 'Comment', 'description'])),
      ui_display: metadataText(pickMetadataValue(column, ['ui_display', 'uiDisplay', 'UI_Display', 'UI Display'])),
      classification: metadataText(pickMetadataValue(column, ['classification', 'Classification', 'data_class'])),
      primary_key: metadataBoolean(pickMetadataValue(column, ['primary_key', 'primaryKey', 'Primary Key', 'PK', 'pk'])),
    });
  });

  return { tableComment, columns };
}

export function mergeMetadataWithColumns(
  columnNames: string[],
  metadata: DataSourceColumnMetadata[]
): DataSourceColumnMetadata[] {
  const metadataByColumn = new Map(metadata.map((column) => [normalizeIdentifier(column.column_name), column]));
  return columnNames.map((columnName, index) => {
    const normalizedColumnName = normalizeIdentifier(columnName);
    return {
      ...columnsToMetadata([normalizedColumnName])[0],
      ...metadataByColumn.get(normalizedColumnName),
      column_name: normalizedColumnName,
      ordinal_position: index + 1,
    };
  });
}

export function buildPreviewColumnDetails(
  columnNames: string[],
  metadata: DataSourceColumnMetadata[] = []
): DataSourceColumnMetadata[] {
  const detailsByColumn = new Map(metadata.map((column) => [normalizeIdentifier(column.column_name), column]));
  return columnNames.map((columnName, index) => {
    const normalizedColumnName = normalizeIdentifier(columnName);
    return (
      detailsByColumn.get(normalizedColumnName) || {
        column_name: normalizedColumnName,
        ordinal_position: index + 1,
      }
    );
  });
}
