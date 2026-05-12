import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { DataSourceCsvUploadDraft } from './dataSourceUtils';

type DataSourceColumnMetadata = {
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

type DataSourceSummary = {
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

type ShowToast = (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;

type DataSourceApiForMutations = {
  uploadCsv: (
    file: File,
    tableName?: string,
    tableComment?: string,
    columns?: DataSourceColumnMetadata[],
    accessScope?: 'all' | 'private',
    targetSchema?: string,
    createSchema?: boolean
  ) => Promise<{ data: { metadata_warnings?: string[] } }>;
  registerTable: (payload: {
    owner: string;
    table_name: string;
    display_name?: string;
    table_comment?: string;
    columns?: DataSourceColumnMetadata[];
    access_scope?: 'all' | 'private';
  }) => Promise<{ data: { metadata_warnings?: string[] } }>;
  deleteSource: (dataSourceId: string) => Promise<unknown>;
};

type DataSourceObjectFormForMutations = {
  csvUploadDrafts: DataSourceCsvUploadDraft[];
  csvSchemaName: string;
  tableComment: string;
  columnMetadata: DataSourceColumnMetadata[];
  tableOwner: string;
  tableName: string;
  pendingSchemaCreation: string | null;
  setCsvSchemaName: (value: string) => void;
  setPendingSchemaCreation: (value: string | null) => void;
  setIsObjectModalOpen: (value: boolean) => void;
  resetObjectMetadata: () => void;
  setTableOwner: (value: string) => void;
  setTableName: (value: string) => void;
  setTableComment: (value: string) => void;
  setColumnMetadata: (value: DataSourceColumnMetadata[]) => void;
};

type DataSourceMutationListState = {
  viewingSource: DataSourceSummary | null;
  setSelectedDataSourceIds: Dispatch<SetStateAction<string[]>>;
  setViewingSource: Dispatch<SetStateAction<DataSourceSummary | null>>;
  setDeletingSource: Dispatch<SetStateAction<DataSourceSummary | null>>;
};

function showMetadataWarnings(
  showToast: ShowToast,
  metadataWarningMessage: (warnings?: string[]) => string | null,
  warnings: string[] = []
) {
  const message = metadataWarningMessage(warnings);
  if (message) showToast(message, 'warning');
}

async function uploadCsvDrafts({
  apiClient,
  drafts,
  normalizedCsvSchema,
  createSchema,
}: {
  apiClient: DataSourceApiForMutations;
  drafts: DataSourceCsvUploadDraft[];
  normalizedCsvSchema: string;
  createSchema: boolean;
}): Promise<{ data: { metadata_warnings: string[] } }> {
  const invalidDraft = drafts.find((draft) => draft.error || !draft.metadataJsonFile);
  if (invalidDraft) throw new Error(`Resolve ${invalidDraft.csvFile.name} before uploading.`);
  if (drafts.length === 0) throw new Error('Select CSV and JSON files.');

  const metadataWarnings: string[] = [];
  for (const draft of drafts) {
    const response = await apiClient.uploadCsv(
      draft.csvFile,
      draft.tableName,
      draft.tableComment,
      draft.columnMetadata,
      'all',
      normalizedCsvSchema,
      createSchema
    );
    metadataWarnings.push(...(response.data.metadata_warnings || []));
  }
  return { data: { metadata_warnings: metadataWarnings } };
}

export function useDataSourceMutations({
  apiClient,
  objectForm,
  listState,
  schemaNeedsCreation,
  normalizedCsvSchema,
  schemasAreLoading,
  invalidateSources,
  showToast,
  defaultDataSchema,
  getErrorMessage,
  metadataWarningMessage,
}: {
  apiClient: DataSourceApiForMutations;
  objectForm: DataSourceObjectFormForMutations;
  listState: DataSourceMutationListState;
  schemaNeedsCreation: boolean;
  normalizedCsvSchema: string;
  schemasAreLoading: boolean;
  invalidateSources: () => void;
  showToast: ShowToast;
  defaultDataSchema: string;
  getErrorMessage: (error: unknown) => string;
  metadataWarningMessage: (warnings?: string[]) => string | null;
}) {
  const uploadMutation = useMutation({
    mutationFn: ({ createSchema }: { createSchema: boolean }) =>
      uploadCsvDrafts({ apiClient, drafts: objectForm.csvUploadDrafts, normalizedCsvSchema, createSchema }),
    onSuccess: (response) => {
      objectForm.setCsvSchemaName(defaultDataSchema);
      objectForm.resetObjectMetadata();
      objectForm.setPendingSchemaCreation(null);
      objectForm.setIsObjectModalOpen(false);
      invalidateSources();
      showToast('CSV files loaded and Select AI profile updated.', 'success');
      showMetadataWarnings(showToast, metadataWarningMessage, response.data.metadata_warnings);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const registerMutation = useMutation({
    mutationFn: () =>
      apiClient.registerTable({
        owner: objectForm.tableOwner.trim(),
        table_name: objectForm.tableName.trim(),
        table_comment: objectForm.tableComment.trim() || undefined,
        columns: objectForm.columnMetadata,
        access_scope: 'all',
      }),
    onSuccess: (response) => {
      objectForm.setTableOwner('');
      objectForm.setTableName('');
      objectForm.setTableComment('');
      objectForm.setColumnMetadata([]);
      objectForm.setIsObjectModalOpen(false);
      invalidateSources();
      showToast('Table registered and Select AI profile updated.', 'success');
      showMetadataWarnings(showToast, metadataWarningMessage, response.data.metadata_warnings);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (source: DataSourceSummary) => apiClient.deleteSource(source.data_source_id),
    onSuccess: (_response, source) => {
      listState.setSelectedDataSourceIds((current) => current.filter((id) => id !== source.data_source_id));
      if (listState.viewingSource?.data_source_id === source.data_source_id) listState.setViewingSource(null);
      listState.setDeletingSource(null);
      invalidateSources();
      showToast(source.source_type === 'csv' ? 'Data source and managed table deleted.' : 'Table unregistered from Select AI.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const submitExistingTable = (event: FormEvent) => {
    event.preventDefault();
    if (!objectForm.tableOwner.trim() || !objectForm.tableName.trim() || registerMutation.isPending) return;
    registerMutation.mutate();
  };

  const submitCsv = (event: FormEvent) => {
    event.preventDefault();
    if (objectForm.csvUploadDrafts.length === 0 || uploadMutation.isPending || schemasAreLoading) return;
    if (objectForm.csvUploadDrafts.some((draft) => draft.error || !draft.metadataJsonFile)) {
      showToast('Resolve CSV and JSON matches before uploading.', 'error');
      return;
    }
    if (normalizedCsvSchema === 'APP_AGENT') {
      showToast('APP_AGENT is reserved for application tables. Choose another schema.', 'error');
      return;
    }
    if (schemaNeedsCreation) {
      objectForm.setPendingSchemaCreation(normalizedCsvSchema);
      return;
    }
    uploadMutation.mutate({ createSchema: false });
  };

  const confirmSchemaCreation = () => {
    if (!objectForm.pendingSchemaCreation || uploadMutation.isPending) return;
    objectForm.setCsvSchemaName(objectForm.pendingSchemaCreation);
    uploadMutation.mutate({ createSchema: true });
  };

  const closeObjectModal = () => {
    if (uploadMutation.isPending || registerMutation.isPending) return;
    objectForm.setIsObjectModalOpen(false);
  };

  return { uploadMutation, registerMutation, deleteMutation, submitExistingTable, submitCsv, confirmSchemaCreation, closeObjectModal };
}

export type DataSourceMutations = ReturnType<typeof useDataSourceMutations>;
