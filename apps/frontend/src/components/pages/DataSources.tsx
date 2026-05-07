import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Layout } from '../common/Layout';
import { LoadingState } from '../common/LoadingState';
import { GlassModal } from '../common/GlassModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { queryKeys } from '../../lib/queryClient';
import {
  dataSourcesApi,
  type DataSourceCatalogTable,
  type DataSourceColumnMetadata,
  type DataSourceRowsResponse,
  type DataSourceSchema,
  type DataSourceSummary,
} from '../../services/api';

const PAGE_SIZE = 10;
const DEFAULT_DATA_SCHEMA = 'APP_AGENT_DATA';
const EMPTY_DATA_SOURCES: DataSourceSummary[] = [];
const documentToolbarButtonClassName =
  'flex-shrink-0 inline-flex h-10 items-center justify-center rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50';

function getErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'Operation failed.';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function normalizeIdentifier(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function formatLabel(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatColumnType(column: DataSourceColumnMetadata): string {
  const type = String(column.data_type || '').trim().toUpperCase();
  if (!type) return '-';
  if (type.includes('(') || !column.data_length) return type;
  if (['VARCHAR2', 'CHAR', 'NCHAR', 'NVARCHAR2'].includes(type)) {
    return `${type}(${column.data_length})`;
  }
  return type;
}

function SourceTypeBadge({ source }: { source: DataSourceSummary }) {
  const label = source.source_type === 'csv' ? 'CSV' : 'Existing table';
  return (
    <span className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gray-700">
      {label}
    </span>
  );
}

function getStatusBadge(status: string): string {
  const normalized = String(status || '').trim().toLowerCase();
  const classes: Record<string, string> = {
    active:
      'inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-700',
    completed:
      'inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-700',
    pending:
      'inline-flex items-center rounded-xl border border-amber-200 bg-amber-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-700',
    running:
      'inline-flex items-center rounded-xl border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-blue-700',
    failed:
      'inline-flex items-center rounded-xl border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-700',
    error:
      'inline-flex items-center rounded-xl border border-rose-200 bg-rose-50/60 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-700',
  };
  return (
    classes[normalized] ||
    'inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gray-700'
  );
}

function DataSourceObjectCell({ source }: { source: DataSourceSummary }) {
  const qualifiedName = `${source.owner_name}.${source.table_name}`;

  return (
    <div className="flex items-center">
      <div className="min-w-0 whitespace-nowrap" title={qualifiedName}>
        <span className="inline-block rounded bg-oracle-bg-gray px-1.5 py-0.5 align-middle text-xs">
          {source.owner_name}
        </span>
        <span className="inline-block px-0.5 align-middle text-xs text-oracle-light-gray">.</span>
        <span className="inline-block max-w-xs truncate rounded bg-oracle-bg-gray px-1.5 py-0.5 align-middle text-xs">
          {source.table_name}
        </span>
      </div>
    </div>
  );
}

function DeleteDataSourceConfirmMessage({ source }: { source: DataSourceSummary }) {
  const qualifiedName = `${source.owner_name}.${source.table_name}`;
  const isCsv = source.source_type === 'csv';
  return (
    <div className="space-y-2 text-sm leading-relaxed text-oracle-medium-gray">
      <p>
        Are you sure you want to {isCsv ? 'delete' : 'unregister'}{' '}
        <span className="font-mono font-medium text-oracle-dark-gray">{qualifiedName}</span>?
      </p>
      {!isCsv && <p>The original table will not be dropped.</p>}
    </div>
  );
}

function Pagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = totalItems === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min((safePage + 1) * PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-oracle-medium-gray">
      <span>
        Showing {start}-{end} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-gray-300 bg-white px-3 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={safePage === 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
        >
          Previous
        </button>
        <span className="min-w-[76px] text-center">
          Page {safePage + 1} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded border border-gray-300 bg-white px-3 py-1 font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={safePage >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
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

function parseCsvHeaders(csvText: string): string[] {
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

function parseMetadataJson(text: string): { tableComment: string; columns: DataSourceColumnMetadata[] } {
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

function mergeMetadataWithColumns(
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

function DataDictionaryEditor({
  tableComment,
  columns,
  isLoading,
  onTableCommentChange,
  onColumnChange,
}: {
  tableComment: string;
  columns: DataSourceColumnMetadata[];
  isLoading?: boolean;
  onTableCommentChange: (value: string) => void;
  onColumnChange: (index: number, patch: Partial<DataSourceColumnMetadata>) => void;
}) {
  return (
    <div className="rounded-lg border border-oracle-border bg-white">
      <div className="border-b border-oracle-border px-4 py-3">
        <h3 className="text-sm font-semibold text-oracle-dark-gray">Data dictionary</h3>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label className="block text-sm font-medium text-oracle-dark-gray">Table comment</label>
          <textarea
            value={tableComment}
            onChange={(event) => onTableCommentChange(event.target.value)}
            className="input-oracle mt-1 min-h-20 resize-y"
            placeholder="Business meaning for this table"
          />
        </div>
        <div className="max-h-72 overflow-auto rounded border border-gray-200">
          <table className="min-w-[760px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Column</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Comment</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">UI display</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classification</th>
                <th className="w-16 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">PK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5">
                    <LoadingState size="sm" label="Loading..." />
                  </td>
                </tr>
              ) : columns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-sm text-oracle-light-gray">
                    Select an object to edit metadata.
                  </td>
                </tr>
              ) : (
                columns.map((column, index) => (
                  <tr key={`${column.column_name}-${index}`}>
                    <td className="max-w-[180px] px-3 py-2 align-top">
                      <div className="truncate font-mono text-xs text-oracle-dark-gray" title={column.column_name}>
                        {column.column_name}
                      </div>
                      {column.data_type ? (
                        <div className="mt-0.5 truncate text-[11px] text-oracle-light-gray">
                          {column.data_type}
                          {column.data_length ? `(${column.data_length})` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.comment || ''}
                        onChange={(event) => onColumnChange(index, { comment: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="Column meaning"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.ui_display || ''}
                        onChange={(event) => onColumnChange(index, { ui_display: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="Display label"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.classification || ''}
                        onChange={(event) => onColumnChange(index, { classification: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="PII, amount, date"
                      />
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      <input
                        type="checkbox"
                        checked={Boolean(column.primary_key)}
                        onChange={(event) => onColumnChange(index, { primary_key: event.target.checked })}
                        className="mt-2 h-4 w-4 rounded border-gray-300 text-oracle-red accent-oracle-red focus:ring-oracle-red"
                        aria-label={`Primary key ${column.column_name}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DataSources() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [objectMode, setObjectMode] = useState<'csv' | 'existing_table'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [metadataJsonFile, setMetadataJsonFile] = useState<File | null>(null);
  const [csvHeaderColumns, setCsvHeaderColumns] = useState<string[]>([]);
  const [csvTableName, setCsvTableName] = useState('');
  const [csvSchemaName, setCsvSchemaName] = useState(DEFAULT_DATA_SCHEMA);
  const [pendingSchemaCreation, setPendingSchemaCreation] = useState<string | null>(null);
  const [tableOwner, setTableOwner] = useState('');
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tableComment, setTableComment] = useState('');
  const [columnMetadata, setColumnMetadata] = useState<DataSourceColumnMetadata[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<string[]>([]);
  const [viewingSource, setViewingSource] = useState<DataSourceSummary | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [deletingSource, setDeletingSource] = useState<DataSourceSummary | null>(null);
  const selectAllSourcesRef = useRef<HTMLInputElement>(null);

  const sourcesQuery = useQuery({
    queryKey: queryKeys.dataSources.list,
    queryFn: () => dataSourcesApi.list().then((response) => response.data.items),
  });

  const schemasQuery = useQuery({
    queryKey: queryKeys.dataSources.schemas,
    queryFn: () => dataSourcesApi.schemas().then((response) => response.data.items),
    enabled: isObjectModalOpen && objectMode === 'csv',
  });

  const catalogOwnersQuery = useQuery({
    queryKey: ['data-sources', 'catalog-owners'],
    queryFn: () => dataSourcesApi.catalogOwners().then((response) => response.data.items),
    enabled: isObjectModalOpen && objectMode === 'existing_table',
  });

  const catalogTablesQuery = useQuery({
    queryKey: ['data-sources', 'catalog-tables', tableOwner],
    queryFn: () => dataSourcesApi.catalogTables(tableOwner).then((response) => response.data.items),
    enabled: isObjectModalOpen && objectMode === 'existing_table' && Boolean(tableOwner.trim()),
  });

  const catalogTableQuery = useQuery({
    queryKey: ['data-sources', 'catalog-table', tableOwner, tableName],
    queryFn: () => dataSourcesApi.catalogTable(tableOwner, tableName).then((response) => response.data),
    enabled:
      isObjectModalOpen &&
      objectMode === 'existing_table' &&
      Boolean(tableOwner.trim()) &&
      Boolean(tableName.trim()),
  });

  const previewRowsQuery = useQuery<DataSourceRowsResponse>({
    queryKey: queryKeys.dataSources.rows(viewingSource?.data_source_id ?? null, previewPage),
    queryFn: () =>
      dataSourcesApi
        .rows(viewingSource?.data_source_id ?? '', PAGE_SIZE, previewPage * PAGE_SIZE)
        .then((response) => response.data),
    enabled: Boolean(viewingSource?.data_source_id),
  });

  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.list });
    queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.schemas });
  };

  const uploadMutation = useMutation({
    mutationFn: ({ createSchema }: { createSchema: boolean }) => {
      if (!csvFile) throw new Error('Select a CSV file.');
      return dataSourcesApi.uploadCsv(
        csvFile,
        csvTableName,
        tableComment,
        columnMetadata,
        'all',
        normalizeIdentifier(csvSchemaName),
        createSchema
      );
    },
    onSuccess: (response) => {
      setCsvFile(null);
      setMetadataJsonFile(null);
      setCsvHeaderColumns([]);
      setCsvTableName('');
      setCsvSchemaName(DEFAULT_DATA_SCHEMA);
      setTableComment('');
      setColumnMetadata([]);
      setPendingSchemaCreation(null);
      setIsObjectModalOpen(false);
      invalidateSources();
      showToast('CSV loaded and Select AI profile updated.', 'success');
      const warnings = response.data.metadata_warnings || [];
      if (warnings.length > 0) {
        showToast(`Metadata saved with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`, 'warning');
      }
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      dataSourcesApi.registerTable({
        owner: tableOwner.trim(),
        table_name: tableName.trim(),
        display_name: displayName.trim() || undefined,
        table_comment: tableComment.trim() || undefined,
        columns: columnMetadata,
        access_scope: 'all',
      }),
    onSuccess: (response) => {
      setTableOwner('');
      setTableName('');
      setDisplayName('');
      setTableComment('');
      setColumnMetadata([]);
      setIsObjectModalOpen(false);
      invalidateSources();
      showToast('Table registered and Select AI profile updated.', 'success');
      const warnings = response.data.metadata_warnings || [];
      if (warnings.length > 0) {
        showToast(`Metadata saved with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`, 'warning');
      }
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (source: DataSourceSummary) => dataSourcesApi.deleteSource(source.data_source_id),
    onSuccess: (_response, source) => {
      setSelectedDataSourceIds((current) => current.filter((id) => id !== source.data_source_id));
      if (viewingSource?.data_source_id === source.data_source_id) {
        setViewingSource(null);
      }
      setDeletingSource(null);
      invalidateSources();
      showToast(
        source.source_type === 'csv' ? 'Data source and managed table deleted.' : 'Table unregistered from Select AI.',
        'success'
      );
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const sources = sourcesQuery.data ?? EMPTY_DATA_SOURCES;
  const filteredSources = useMemo(() => {
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
  }, [searchTerm, sources, statusFilter]);
  const paginatedSources = filteredSources.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selectedDataSourceIdSet = useMemo(() => new Set(selectedDataSourceIds), [selectedDataSourceIds]);
  const allCurrentPageSourcesSelected =
    paginatedSources.length > 0 &&
    paginatedSources.every((source) => selectedDataSourceIdSet.has(source.data_source_id));
  const someCurrentPageSourcesSelected =
    paginatedSources.some((source) => selectedDataSourceIdSet.has(source.data_source_id));

  useEffect(() => {
    setPage(0);
  }, [filteredSources.length, searchTerm, statusFilter]);

  useEffect(() => {
    if (selectAllSourcesRef.current) {
      selectAllSourcesRef.current.indeterminate = someCurrentPageSourcesSelected && !allCurrentPageSourcesSelected;
    }
  }, [allCurrentPageSourcesSelected, someCurrentPageSourcesSelected]);

  useEffect(() => {
    setPreviewPage(0);
  }, [viewingSource?.data_source_id]);

  useEffect(() => {
    const totalRows = Number(previewRowsQuery.data?.row_count || 0);
    if (totalRows <= 0) return;
    const maxPage = Math.max(0, Math.ceil(totalRows / PAGE_SIZE) - 1);
    setPreviewPage((current) => Math.min(current, maxPage));
  }, [previewRowsQuery.data?.row_count]);

  useEffect(() => {
    const visibleIds = new Set(sources.map((source) => source.data_source_id));
    setSelectedDataSourceIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [sources]);

  useEffect(() => {
    if (!catalogTableQuery.data || objectMode !== 'existing_table') return;
    setTableComment(catalogTableQuery.data.table_comment || '');
    setColumnMetadata(catalogTableQuery.data.columns || []);
  }, [catalogTableQuery.data, objectMode]);

  const stats = useMemo(
    () => ({
      active: sources.filter((source) => String(source.status || '').toLowerCase() === 'active').length,
      csv: sources.filter((source) => source.source_type === 'csv').length,
      tables: sources.filter((source) => source.source_type === 'existing_table').length,
      rows: sources.reduce((sum, source) => sum + Number(source.row_count || 0), 0),
    }),
    [sources]
  );

  const schemaOptions = useMemo(
    () =>
      (schemasQuery.data || [])
        .slice()
        .sort((left, right) => {
          if (left.schema_name === DEFAULT_DATA_SCHEMA) return -1;
          if (right.schema_name === DEFAULT_DATA_SCHEMA) return 1;
          return left.schema_name.localeCompare(right.schema_name);
        }),
    [schemasQuery.data]
  );
  const ownerOptions = catalogOwnersQuery.data || [];
  const tableOptions = useMemo<DataSourceCatalogTable[]>(
    () => (catalogTablesQuery.data || []).slice().sort((left, right) => left.table_name.localeCompare(right.table_name)),
    [catalogTablesQuery.data]
  );
  const normalizedCsvSchema = normalizeIdentifier(csvSchemaName);
  const selectedSchema = schemaOptions.find(
    (schema: DataSourceSchema) => schema.schema_name === normalizedCsvSchema
  );
  const schemaListReady = Boolean(schemasQuery.data);
  const schemaNeedsCreation = Boolean(normalizedCsvSchema && schemaListReady && !selectedSchema?.exists);

  const submitExistingTable = (event: FormEvent) => {
    event.preventDefault();
    if (!tableOwner.trim() || !tableName.trim() || registerMutation.isPending) return;
    registerMutation.mutate();
  };

  const updateColumnMetadata = (index: number, patch: Partial<DataSourceColumnMetadata>) => {
    setColumnMetadata((current) =>
      current.map((column, columnIndex) => (columnIndex === index ? { ...column, ...patch } : column))
    );
  };

  const handleCsvFileChange = (file: File | null) => {
    setCsvFile(file);
    setCsvHeaderColumns([]);
    if (!file) {
      setColumnMetadata([]);
      return;
    }
    file
      .text()
      .then((text) => {
        const headers = parseCsvHeaders(text);
        setCsvHeaderColumns(headers);
        setColumnMetadata((current) => mergeMetadataWithColumns(headers, current));
      })
      .catch(() => showToast('Could not read CSV header.', 'error'));
  };

  const handleMetadataJsonFileChange = (file: File | null) => {
    setMetadataJsonFile(file);
    if (!file) return;
    file
      .text()
      .then((text) => {
        const metadata = parseMetadataJson(text);
        if (metadata.tableComment) {
          setTableComment(metadata.tableComment);
        }
        setColumnMetadata(
          csvHeaderColumns.length > 0
            ? mergeMetadataWithColumns(csvHeaderColumns, metadata.columns)
            : metadata.columns
        );
        showToast('Metadata JSON loaded.', 'success');
      })
      .catch((error) => showToast(getErrorMessage(error), 'error'));
  };

  const submitCsv = (event: FormEvent) => {
    event.preventDefault();
    if (!csvFile || uploadMutation.isPending) return;
    if (schemasQuery.isLoading) return;
    if (normalizedCsvSchema === 'APP_AGENT') {
      showToast('APP_AGENT is reserved for application tables. Choose another schema.', 'error');
      return;
    }
    if (schemaNeedsCreation) {
      setPendingSchemaCreation(normalizedCsvSchema);
      return;
    }
    uploadMutation.mutate({ createSchema: false });
  };

  const confirmSchemaCreation = () => {
    if (!pendingSchemaCreation || uploadMutation.isPending) return;
    setCsvSchemaName(pendingSchemaCreation);
    uploadMutation.mutate({ createSchema: true });
  };

  const closeObjectModal = () => {
    if (uploadMutation.isPending || registerMutation.isPending) return;
    setIsObjectModalOpen(false);
  };

  const toggleDataSourceSelection = (dataSourceId: string, checked: boolean) => {
    setSelectedDataSourceIds((current) => {
      if (checked) {
        return current.includes(dataSourceId) ? current : [...current, dataSourceId];
      }
      return current.filter((id) => id !== dataSourceId);
    });
  };

  const toggleAllVisibleSources = (checked: boolean) => {
    const visibleIds = paginatedSources.map((source) => source.data_source_id);
    setSelectedDataSourceIds((current) => {
      if (checked) {
        const next = new Set(current);
        visibleIds.forEach((id) => next.add(id));
        return Array.from(next);
      }
      return current.filter((id) => !visibleIds.includes(id));
    });
  };

  const previewData = previewRowsQuery.data;
  const previewColumns = previewData?.columns ?? [];
  const previewColumnDetails = useMemo<DataSourceColumnMetadata[]>(() => {
    const details = previewData?.column_details || [];
    const detailsByColumn = new Map(details.map((column) => [normalizeIdentifier(column.column_name), column]));
    return previewColumns.map((columnName, index) => {
      const normalizedColumnName = normalizeIdentifier(columnName);
      return (
        detailsByColumn.get(normalizedColumnName) || {
          column_name: normalizedColumnName,
          ordinal_position: index + 1,
        }
      );
    });
  }, [previewColumns, previewData?.column_details]);
  const previewRows = previewData?.rows ?? [];
  const previewTotalRows = Number(previewData?.row_count ?? viewingSource?.row_count ?? 0);
  const previewTotalPages = Math.max(1, Math.ceil(previewTotalRows / PAGE_SIZE));
  const previewStart = previewTotalRows === 0 ? 0 : previewPage * PAGE_SIZE + 1;
  const previewEnd = Math.min((previewPage + 1) * PAGE_SIZE, previewTotalRows);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Data Source</h1>
            <p className="text-oracle-light-gray">Manage the tables available to Select AI.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setObjectMode('csv');
              setMetadataJsonFile(null);
              setCsvHeaderColumns([]);
              setTableComment('');
              setColumnMetadata([]);
              setIsObjectModalOpen(true);
            }}
            className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-lg border border-transparent bg-oracle-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-oracle-red/90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Object
          </button>
        </div>

        <div className="app-light-surface rag-light-surface rounded-lg bg-white p-8 shadow">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex h-10 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 shadow-sm">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80">Active</p>
                <p className="text-xl font-bold leading-none text-emerald-700 tabular-nums">{formatNumber(stats.active)}</p>
              </div>
              <div className="flex h-10 items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 px-3 shadow-sm">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-blue-900/80">CSV</p>
                <p className="text-xl font-bold leading-none text-blue-700 tabular-nums">{formatNumber(stats.csv)}</p>
              </div>
              <div className="flex h-10 items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-3 shadow-sm">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">Tables</p>
                <p className="text-xl font-bold leading-none text-amber-700 tabular-nums">{formatNumber(stats.tables)}</p>
              </div>
              <div className="flex h-10 items-center justify-between rounded-xl border border-rose-200 bg-rose-50/60 px-3 shadow-sm">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-rose-900/80">Rows</p>
                <p className="text-xl font-bold leading-none text-rose-700 tabular-nums">{formatNumber(stats.rows)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_150px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by schema or table..."
                  className="input-oracle"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input-oracle"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="running">Running</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => invalidateSources()}
                  disabled={sourcesQuery.isLoading}
                  title="Refresh"
                  className={`${documentToolbarButtonClassName} w-10 px-0`}
                  aria-label="Refresh"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200/70 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">
                      <input
                        ref={selectAllSourcesRef}
                        type="checkbox"
                        checked={allCurrentPageSourcesSelected}
                        onChange={(event) => toggleAllVisibleSources(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-oracle-red accent-oracle-red focus:ring-oracle-red"
                        aria-label="Select all data sources on this page"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Object</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Rows</th>
                    <th className="w-[180px] min-w-[180px] px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Created
                    </th>
                    <th className="w-24 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="w-28 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sourcesQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8">
                        <LoadingState size="sm" label="Loading data sources..." />
                      </td>
                    </tr>
                  ) : sourcesQuery.isError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-700">
                        {getErrorMessage(sourcesQuery.error)}
                      </td>
                    </tr>
                  ) : paginatedSources.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-oracle-light-gray">
                        No data sources found
                      </td>
                    </tr>
                  ) : (
                    paginatedSources.map((source) => (
                      <tr key={source.data_source_id}>
                        <td className="px-4 py-3 text-center align-top">
                          <input
                            type="checkbox"
                            checked={selectedDataSourceIdSet.has(source.data_source_id)}
                            onChange={(event) => toggleDataSourceSelection(source.data_source_id, event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-oracle-red accent-oracle-red focus:ring-oracle-red"
                            aria-label={`Select ${source.owner_name}.${source.table_name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <DataSourceObjectCell source={source} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <SourceTypeBadge source={source} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-oracle-medium-gray">
                          {formatNumber(source.row_count)}
                        </td>
                        <td className="w-[180px] min-w-[180px] px-4 py-3 text-center text-sm text-oracle-light-gray">
                          {formatDateTime(source.created_at)}
                        </td>
                        <td className="w-24 px-4 py-3 text-center">
                          <span className={getStatusBadge(source.status)}>{formatLabel(source.status)}</span>
                        </td>
                        <td className="w-28 px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingSource(source)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50"
                              title="View rows"
                              aria-label={`View rows for ${source.owner_name}.${source.table_name}`}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSource(source)}
                              className="rounded border border-red-300 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={deleteMutation.isPending}
                              title={source.source_type === 'csv' ? 'Delete' : 'Unregister'}
                              aria-label={`${source.source_type === 'csv' ? 'Delete' : 'Unregister'} ${source.owner_name}.${source.table_name}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {filteredSources.length > 0 && (
                <div className="mt-4 border-t border-gray-200 px-4 py-3">
                  <Pagination page={page} totalItems={filteredSources.length} onPageChange={setPage} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <GlassModal
        open={isObjectModalOpen}
        onClose={closeObjectModal}
        containerClassName="items-start justify-center p-4"
        panelClassName="mt-8 flex max-h-[88vh] w-full max-w-4xl flex-col border-0"
      >
        <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Add Object</h2>
          <button
            type="button"
            onClick={closeObjectModal}
            className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={uploadMutation.isPending || registerMutation.isPending}
            aria-label="Close add object"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form
          onSubmit={objectMode === 'csv' ? submitCsv : submitExistingTable}
          className="space-y-4 overflow-y-auto bg-white/90 p-5"
        >
          <div>
            <label className="block text-sm font-medium text-oracle-dark-gray">Object source</label>
            <select
              value={objectMode}
              onChange={(event) => {
                setPendingSchemaCreation(null);
                setObjectMode(event.target.value as 'csv' | 'existing_table');
                setMetadataJsonFile(null);
                setCsvHeaderColumns([]);
                setTableComment('');
                setColumnMetadata([]);
              }}
              className="input-oracle mt-1"
              disabled={uploadMutation.isPending || registerMutation.isPending}
            >
              <option value="csv">CSV file</option>
              <option value="existing_table">Existing table</option>
            </select>
          </div>

          {objectMode === 'csv' ? (
            <>
              <p className="text-sm text-oracle-medium-gray">Load a CSV into a data schema.</p>
              <div>
                <label className="block text-sm font-medium text-oracle-dark-gray">CSV file</label>
                <div className="mt-1 flex min-h-11 items-center gap-3 rounded border border-oracle-border bg-white px-3 py-2">
                  <label
                    htmlFor="data-source-csv-file"
                    className="shrink-0 cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Choose file
                  </label>
                  <span className="min-w-0 truncate text-sm text-oracle-medium-gray">
                    {csvFile?.name || 'No file selected'}
                  </span>
                </div>
                <input
                  id="data-source-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => handleCsvFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oracle-dark-gray">Metadata JSON</label>
                <div className="mt-1 flex min-h-11 items-center gap-3 rounded border border-oracle-border bg-white px-3 py-2">
                  <label
                    htmlFor="data-source-metadata-json-file"
                    className="shrink-0 cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Choose file
                  </label>
                  <span className="min-w-0 truncate text-sm text-oracle-medium-gray">
                    {metadataJsonFile?.name || 'No file selected'}
                  </span>
                </div>
                <input
                  id="data-source-metadata-json-file"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => handleMetadataJsonFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oracle-dark-gray">Target schema</label>
                <input
                  value={csvSchemaName}
                  onChange={(event) => setCsvSchemaName(normalizeIdentifier(event.target.value))}
                  className="input-oracle mt-1 font-mono uppercase"
                  placeholder={DEFAULT_DATA_SCHEMA}
                  list="data-source-schema-options"
                />
                <datalist id="data-source-schema-options">
                  {schemaOptions
                    .filter((schema) => !schema.is_app_schema)
                    .map((schema) => (
                      <option key={schema.schema_name} value={schema.schema_name}>
                        {schema.exists ? `${schema.source_count} source(s)` : 'Create on upload'}
                      </option>
                    ))}
                </datalist>
                {normalizedCsvSchema === 'APP_AGENT' ? (
                  <p className="mt-1 text-xs text-red-600">APP_AGENT is reserved for application tables.</p>
                ) : schemaNeedsCreation ? (
                  <p className="mt-1 text-xs text-amber-700">This schema does not exist yet. You will be asked to confirm creation.</p>
                ) : (
                  <p className="mt-1 text-xs text-oracle-light-gray">Use an existing schema or type a new one.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-oracle-dark-gray">Optional table name</label>
                <input
                  value={csvTableName}
                  onChange={(event) => setCsvTableName(event.target.value)}
                  className="input-oracle mt-1 font-mono uppercase"
                  placeholder="FLEX_TRANSACTIONS_TEST"
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-oracle-medium-gray">Register a table that APP_AGENT can read.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-oracle-dark-gray">Owner</label>
                  <select
                    value={tableOwner}
                    onChange={(event) => {
                      setTableOwner(event.target.value);
                      setTableName('');
                      setTableComment('');
                      setColumnMetadata([]);
                    }}
                    className="input-oracle mt-1 font-mono uppercase"
                    disabled={catalogOwnersQuery.isLoading}
                  >
                    <option value="">{catalogOwnersQuery.isLoading ? 'Loading...' : 'Select owner'}</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner.owner_name} value={owner.owner_name}>
                        {owner.owner_name} ({formatNumber(owner.table_count)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-oracle-dark-gray">Table</label>
                  <select
                    value={tableName}
                    onChange={(event) => {
                      setTableName(event.target.value);
                      setTableComment('');
                      setColumnMetadata([]);
                    }}
                    className="input-oracle mt-1 font-mono uppercase"
                    disabled={!tableOwner || catalogTablesQuery.isLoading}
                  >
                    <option value="">
                      {catalogTablesQuery.isLoading ? 'Loading...' : tableOwner ? 'Select table' : 'Select owner first'}
                    </option>
                    {tableOptions.map((table) => (
                      <option key={`${table.owner_name}.${table.table_name}`} value={table.table_name}>
                        {table.table_name} ({formatNumber(table.column_count)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-oracle-dark-gray">Optional display name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="input-oracle mt-1"
                  placeholder="Flexcube daily movements"
                />
              </div>
            </>
          )}

          <DataDictionaryEditor
            tableComment={tableComment}
            columns={columnMetadata}
            isLoading={objectMode === 'existing_table' && catalogTableQuery.isFetching}
            onTableCommentChange={setTableComment}
            onColumnChange={updateColumnMetadata}
          />

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={closeObjectModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={
                objectMode === 'csv'
                  ? !csvFile || uploadMutation.isPending || schemasQuery.isLoading
                  : !tableOwner.trim() || !tableName.trim() || registerMutation.isPending || catalogTableQuery.isFetching
              }
            >
              {objectMode === 'csv'
                ? uploadMutation.isPending
                  ? 'Uploading...'
                  : 'Upload CSV'
                : registerMutation.isPending
                ? 'Registering...'
                : 'Register Table'}
            </button>
          </div>
        </form>
      </GlassModal>

      <GlassModal
        open={Boolean(viewingSource)}
        onClose={() => setViewingSource(null)}
        containerClassName="items-start justify-center p-4"
        panelClassName="mt-8 flex h-[84vh] w-full max-w-6xl flex-col border-0"
      >
        <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">
              {viewingSource ? `${viewingSource.owner_name}.${viewingSource.table_name}` : 'Table rows'}
            </h2>
            <p className="text-sm text-gray-200">
              {previewTotalRows > 0 ? `${formatNumber(previewTotalRows)} rows` : 'No rows'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewingSource(null)}
            className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
            aria-label="Close rows preview"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {previewRowsQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <LoadingState size="sm" label="Loading rows..." />
            </div>
          ) : previewRowsQuery.isError ? (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {getErrorMessage(previewRowsQuery.error)}
            </div>
          ) : previewColumns.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-oracle-light-gray">
              No rows are available for this data source.
            </div>
          ) : (
            <>
              <div className="max-h-[32vh] shrink-0 overflow-auto border-b border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      <th className="w-12 whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        PK
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        Column
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        Type
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        UI display
                      </th>
                      <th className="min-w-[320px] px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        Comment
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        Classification
                      </th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        Nullable
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewColumnDetails.map((column) => (
                      <tr key={`field-${column.column_name}`} className="odd:bg-white even:bg-gray-50/60">
                        <td className="px-3 py-2 align-top">
                          {column.primary_key ? (
                            <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              PK
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-oracle-dark-gray">
                          {column.column_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-oracle-medium-gray">
                          {formatColumnType(column)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-oracle-medium-gray">
                          {column.ui_display || formatLabel(column.column_name)}
                        </td>
                        <td className="max-w-[520px] px-3 py-2 align-top text-oracle-medium-gray">
                          <span className="line-clamp-2" title={column.comment || ''}>
                            {column.comment || '-'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">
                          {column.classification ? (
                            <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                              {column.classification}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top text-oracle-medium-gray">
                          {String(column.nullable || '').toUpperCase() === 'N' ? 'No' : 'Yes'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      {previewColumns.map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={previewColumns.length} className="px-3 py-8 text-center text-sm text-oracle-light-gray">
                          No rows found
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row, rowIndex) => (
                        <tr key={`preview-row-${rowIndex}`} className="odd:bg-white even:bg-gray-50/60">
                          {previewColumns.map((column) => {
                            const value = row[column];
                            const isEmpty = value === null || value === undefined;
                            return (
                              <td
                                key={`${rowIndex}-${column}`}
                                className={`max-w-[260px] whitespace-nowrap px-3 py-2 align-top text-oracle-medium-gray ${
                                  isEmpty ? 'text-gray-400' : ''
                                }`}
                                title={formatCellValue(value)}
                              >
                                <span className="block truncate">{formatCellValue(value)}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-600">
                  Showing {previewStart}-{previewEnd} of {previewTotalRows}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPage((current) => Math.max(0, current - 1))}
                    disabled={previewPage === 0 || previewRowsQuery.isFetching}
                    className="rounded border border-gray-300 px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="min-w-[96px] text-center text-sm text-gray-600">
                    Page {previewPage + 1} of {previewTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPage((current) => Math.min(previewTotalPages - 1, current + 1))}
                    disabled={previewPage >= previewTotalPages - 1 || previewRowsQuery.isFetching}
                    className="rounded border border-gray-300 px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </GlassModal>

      {deletingSource && (
        <ConfirmModal
          icon={
            <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
          iconBg="bg-red-100"
          iconRing="ring-red-50"
          title={deletingSource.source_type === 'csv' ? 'Delete data source' : 'Unregister table'}
          message={<DeleteDataSourceConfirmMessage source={deletingSource} />}
          detail="The Select AI profile will be refreshed."
          confirmText={deletingSource.source_type === 'csv' ? 'Delete' : 'Unregister'}
          confirmClass="bg-oracle-red text-white hover:bg-red-700"
          onConfirm={() => deleteMutation.mutate(deletingSource)}
          onCancel={() => setDeletingSource(null)}
          loading={deleteMutation.isPending}
          loadingText={deletingSource.source_type === 'csv' ? 'Deleting...' : 'Unregistering...'}
        />
      )}

      {pendingSchemaCreation && (
        <ConfirmModal
          icon={
            <svg className="h-10 w-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          }
          iconBg="bg-amber-100"
          iconRing="ring-amber-50"
          title="Create schema"
          message={
            <span>
              Create <span className="font-mono font-semibold">{pendingSchemaCreation}</span> and load this CSV there?
            </span>
          }
          detail="APP_AGENT remains only for application objects."
          confirmText="Create and upload"
          confirmClass="text-amber-700 hover:bg-amber-50"
          onConfirm={confirmSchemaCreation}
          onCancel={() => setPendingSchemaCreation(null)}
          loading={uploadMutation.isPending}
          loadingText="Uploading..."
        />
      )}
    </Layout>
  );
}
