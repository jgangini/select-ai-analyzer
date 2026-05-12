import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  EMPTY_DATA_SOURCES,
  PAGE_SIZE,
  DEFAULT_DATA_SCHEMA,
  getErrorMessage,
  filterDataSources,
  mergeMetadataWithColumns,
  metadataWarningMessage,
  normalizeIdentifier,
  parseCsvHeaders,
  parseMetadataJson,
  schemaNeedsCreation as resolveSchemaNeedsCreation,
  sortCatalogTables,
  sortSchemaOptions,
  summarizeDataSources,
  type DataSourceCatalogOwner,
  type DataSourceCatalogTable,
  type DataSourceCatalogTableDetail,
  type DataSourceRowsResponse,
  type DataSourceSchema,
  type DataSourceSummary,
} from './dataSourceUtils';
import { useDataSourceListState } from './useDataSourceListState';
import { useDataSourceMutations, type DataSourceMutations } from './useDataSourceMutations';
import { useDataSourceObjectForm, type DataSourceObjectFormState } from './useDataSourceObjectForm';
import type { DataSourceListState } from './useDataSourceListState';

type SourceListQueryState = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

type DataSourcesQueryKeys = {
  list: readonly unknown[];
  schemas: readonly unknown[];
  rows: (dataSourceId: string | null, page: number) => readonly unknown[];
};

type DataSourcesApiForController = {
  list: () => Promise<{ data: { items: DataSourceSummary[] } }>;
  schemas: () => Promise<{ data: { items: DataSourceSchema[] } }>;
  catalogOwners: () => Promise<{ data: { items: DataSourceCatalogOwner[] } }>;
  catalogTables: (owner: string) => Promise<{ data: { items: DataSourceCatalogTable[] } }>;
  catalogTable: (owner: string, tableName: string) => Promise<{ data: DataSourceCatalogTableDetail }>;
  rows: (dataSourceId: string, limit?: number, offset?: number) => Promise<{ data: DataSourceRowsResponse }>;
} & Parameters<typeof useDataSourceMutations>[0]['apiClient'];

function useDataSourceQueries(
  apiClient: DataSourcesApiForController,
  queryKeys: DataSourcesQueryKeys,
  objectForm: DataSourceObjectFormState,
  listState: DataSourceListState
) {
  const schemasQuery = useQuery({
    queryKey: queryKeys.schemas,
    queryFn: () => apiClient.schemas().then((response) => response.data.items),
    enabled: objectForm.isObjectModalOpen && objectForm.objectMode === 'csv',
  });
  const catalogOwnersQuery = useQuery({
    queryKey: ['data-sources', 'catalog-owners'],
    queryFn: () => apiClient.catalogOwners().then((response) => response.data.items),
    enabled: objectForm.isObjectModalOpen && objectForm.objectMode === 'existing_table',
  });
  const catalogTablesQuery = useQuery({
    queryKey: ['data-sources', 'catalog-tables', objectForm.tableOwner],
    queryFn: () => apiClient.catalogTables(objectForm.tableOwner).then((response) => response.data.items),
    enabled: objectForm.isObjectModalOpen && objectForm.objectMode === 'existing_table' && Boolean(objectForm.tableOwner.trim()),
  });
  const catalogTableQuery = useQuery({
    queryKey: ['data-sources', 'catalog-table', objectForm.tableOwner, objectForm.tableName],
    queryFn: () => apiClient.catalogTable(objectForm.tableOwner, objectForm.tableName).then((response) => response.data),
    enabled:
      objectForm.isObjectModalOpen &&
      objectForm.objectMode === 'existing_table' &&
      Boolean(objectForm.tableOwner.trim()) &&
      Boolean(objectForm.tableName.trim()),
  });
  const previewRowsQuery = useQuery<DataSourceRowsResponse>({
    queryKey: queryKeys.rows(listState.viewingSource?.data_source_id ?? null, listState.previewPage),
    queryFn: () =>
      apiClient
        .rows(listState.viewingSource?.data_source_id ?? '', PAGE_SIZE, listState.previewPage * PAGE_SIZE)
        .then((response) => response.data),
    enabled: Boolean(listState.viewingSource?.data_source_id),
  });

  return { schemasQuery, catalogOwnersQuery, catalogTablesQuery, catalogTableQuery, previewRowsQuery };
}

function buildDataSourcesController({
  objectForm,
  listState,
  queries,
  mutations,
  sourcesQuery,
  schemaOptions,
  tableOptions,
  schemaNeedsCreation,
  invalidateSources,
}: {
  objectForm: DataSourceObjectFormState;
  listState: DataSourceListState;
  queries: ReturnType<typeof useDataSourceQueries>;
  mutations: DataSourceMutations;
  sourcesQuery: SourceListQueryState;
  schemaOptions: ReturnType<typeof sortSchemaOptions>;
  tableOptions: ReturnType<typeof sortCatalogTables>;
  schemaNeedsCreation: boolean;
  invalidateSources: () => void;
}) {
  return {
    openObjectModal: objectForm.openObjectModal,
    overviewProps: {
      stats: listState.stats,
      searchTerm: listState.searchTerm,
      statusFilter: listState.statusFilter,
      isRefreshDisabled: sourcesQuery.isLoading,
      onSearchTermChange: listState.setSearchTerm,
      onStatusFilterChange: listState.setStatusFilter,
      onRefresh: invalidateSources,
    },
    tableProps: {
      sources: listState.paginatedSources,
      totalItems: listState.filteredSources.length,
      page: listState.page,
      selectedSourceIds: listState.selectedDataSourceIdSet,
      selectAllRef: listState.selectAllSourcesRef,
      allCurrentPageSourcesSelected: listState.allCurrentPageSourcesSelected,
      isLoading: sourcesQuery.isLoading,
      isError: sourcesQuery.isError,
      error: sourcesQuery.error,
      isDeletePending: mutations.deleteMutation.isPending,
      onSelectSource: listState.toggleDataSourceSelection,
      onSelectCurrentPage: listState.toggleAllVisibleSources,
      onPreview: listState.setViewingSource,
      onDelete: listState.setDeletingSource,
      onPageChange: listState.setPage,
    },
    objectModalProps: {
      open: objectForm.isObjectModalOpen,
      objectMode: objectForm.objectMode,
      csvUploadDrafts: objectForm.csvUploadDrafts,
      activeCsvUploadId: objectForm.activeCsvUploadId,
      csvUploadIssues: objectForm.csvUploadIssues,
      csvSchemaName: objectForm.csvSchemaName,
      normalizedCsvSchema: objectForm.normalizedCsvSchema,
      schemaNeedsCreation,
      schemaOptions,
      tableOwner: objectForm.tableOwner,
      tableName: objectForm.tableName,
      columnMetadata: objectForm.columnMetadata,
      ownerOptions: queries.catalogOwnersQuery.data || [],
      tableOptions,
      isUploadPending: mutations.uploadMutation.isPending,
      isRegisterPending: mutations.registerMutation.isPending,
      isSchemasLoading: queries.schemasQuery.isLoading,
      isCatalogOwnersLoading: queries.catalogOwnersQuery.isLoading,
      isCatalogTablesLoading: queries.catalogTablesQuery.isLoading,
      isCatalogTableFetching: queries.catalogTableQuery.isFetching,
      onClose: mutations.closeObjectModal,
      onSubmit: objectForm.objectMode === 'csv' ? mutations.submitCsv : mutations.submitExistingTable,
      onObjectModeChange: objectForm.changeObjectMode,
      onCsvUploadFilesChange: objectForm.handleCsvUploadFilesChange,
      onActiveCsvUploadIdChange: objectForm.setActiveCsvUploadId,
      onCsvUploadDraftRemove: objectForm.removeCsvUploadDraft,
      onCsvSchemaNameChange: objectForm.setCsvSchemaName,
      onTableOwnerChange: objectForm.changeTableOwner,
      onTableNameChange: objectForm.changeTableName,
      onColumnMetadataChange: objectForm.objectMode === 'csv'
        ? objectForm.updateActiveCsvUploadMetadata
        : objectForm.updateColumnMetadata,
    },
    previewModalProps: {
      source: listState.viewingSource,
      response: queries.previewRowsQuery.data,
      isLoading: queries.previewRowsQuery.isLoading,
      isError: queries.previewRowsQuery.isError,
      error: queries.previewRowsQuery.error,
      isFetching: queries.previewRowsQuery.isFetching,
      page: listState.previewPage,
      onPageChange: listState.setPreviewPage,
      onClose: () => listState.setViewingSource(null),
    },
    deleteConfirmProps: {
      source: listState.deletingSource,
      isPending: mutations.deleteMutation.isPending,
      onConfirm: (source: DataSourceSummary) => mutations.deleteMutation.mutate(source),
      onCancel: () => listState.setDeletingSource(null),
    },
    schemaConfirmProps: {
      schemaName: objectForm.pendingSchemaCreation,
      isPending: mutations.uploadMutation.isPending,
      onConfirm: mutations.confirmSchemaCreation,
      onCancel: () => objectForm.setPendingSchemaCreation(null),
    },
  };
}

export function useDataSourcesController({
  apiClient,
  queryKeys,
  showToast,
}: {
  apiClient: DataSourcesApiForController;
  queryKeys: DataSourcesQueryKeys;
  showToast: ShowToast;
}) {
  const queryClient = useQueryClient();
  const objectForm = useDataSourceObjectForm(showToast, {
    defaultDataSchema: DEFAULT_DATA_SCHEMA,
    getErrorMessage,
    mergeMetadataWithColumns,
    normalizeIdentifier,
    parseCsvHeaders,
    parseMetadataJson,
  });
  const sourcesQuery = useQuery({
    queryKey: queryKeys.list,
    queryFn: () => apiClient.list().then((response) => response.data.items),
  });
  const sources = sourcesQuery.data ?? EMPTY_DATA_SOURCES;
  const listHelpers = useMemo(
    () => ({ pageSize: PAGE_SIZE, filterDataSources, summarizeDataSources }),
    []
  );
  const listState = useDataSourceListState(sources, listHelpers);
  const queries = useDataSourceQueries(apiClient, queryKeys, objectForm, listState);
  const schemaOptions = useMemo(
    () => sortSchemaOptions(queries.schemasQuery.data || []),
    [queries.schemasQuery.data]
  );
  const tableOptions = useMemo(
    () => sortCatalogTables(queries.catalogTablesQuery.data || []),
    [queries.catalogTablesQuery.data]
  );
  const selectedSchema = schemaOptions.find((schema) => schema.schema_name === objectForm.normalizedCsvSchema);
  const schemaNeedsCreation = resolveSchemaNeedsCreation(
    objectForm.normalizedCsvSchema,
    queries.schemasQuery.data,
    selectedSchema
  );
  const invalidateSources = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.list });
    queryClient.invalidateQueries({ queryKey: queryKeys.schemas });
  };
  const mutations = useDataSourceMutations({
    apiClient,
    objectForm,
    listState,
    schemaNeedsCreation,
    normalizedCsvSchema: objectForm.normalizedCsvSchema,
    schemasAreLoading: queries.schemasQuery.isLoading,
    invalidateSources,
    showToast,
    defaultDataSchema: DEFAULT_DATA_SCHEMA,
    getErrorMessage,
    metadataWarningMessage,
  });
  const previewRowCount = queries.previewRowsQuery.data?.row_count;
  const catalogTable = queries.catalogTableQuery.data;
  const { objectMode, setColumnMetadata, setTableComment } = objectForm;
  const { setPreviewPage } = listState;

  useEffect(() => {
    const totalRows = Number(previewRowCount || 0);
    if (totalRows <= 0) return;
    const maxPage = Math.max(0, Math.ceil(totalRows / PAGE_SIZE) - 1);
    setPreviewPage((current) => Math.min(current, maxPage));
  }, [previewRowCount, setPreviewPage]);
  useEffect(() => {
    if (!catalogTable || objectMode !== 'existing_table') return;
    setTableComment(catalogTable.table_comment || '');
    setColumnMetadata(catalogTable.columns || []);
  }, [catalogTable, objectMode, setColumnMetadata, setTableComment]);

  return buildDataSourcesController({
    objectForm,
    listState,
    queries,
    mutations,
    sourcesQuery,
    schemaOptions,
    tableOptions,
    schemaNeedsCreation,
    invalidateSources,
  });
}
