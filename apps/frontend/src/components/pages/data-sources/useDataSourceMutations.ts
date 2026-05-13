import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useMutation } from '@tanstack/react-query';

import type { DataSourceColumnMetadata, DataSourceCsvUploadDraft, DataSourceSummary } from './dataSourceUtils';

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

type CsvUploadMutationVariables = {
  createSchema: boolean;
  drafts: DataSourceCsvUploadDraft[];
  normalizedCsvSchema: string;
  pendingSources: DataSourceSummary[];
};

type CsvUploadStarter = {
  objectForm: DataSourceObjectFormForMutations;
  defaultDataSchema: string;
  onCsvUploadStart: (sources: DataSourceSummary[]) => void;
  showToast: ShowToast;
  uploadMutation: { mutate: (variables: CsvUploadMutationVariables) => void };
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

function cloneCsvUploadDrafts(drafts: DataSourceCsvUploadDraft[]): DataSourceCsvUploadDraft[] {
  return drafts.map((draft) => ({
    ...draft,
    columnMetadata: draft.columnMetadata.map((column) => ({ ...column })),
  }));
}

function pendingDataSourceFromDraft(
  draft: DataSourceCsvUploadDraft,
  normalizedCsvSchema: string,
  startedAt: string
): DataSourceSummary {
  return {
    data_source_id: `pending:${normalizedCsvSchema}.${draft.tableName}:${draft.id}`,
    source_name: draft.tableName,
    source_type: 'csv',
    owner_name: normalizedCsvSchema,
    table_name: draft.tableName,
    access_scope: 'all',
    row_count: 0,
    column_count: draft.columnMetadata.length,
    status: 'pending',
    created_at: startedAt,
  };
}

function startCsvUpload(
  { objectForm, defaultDataSchema, onCsvUploadStart, showToast, uploadMutation }: CsvUploadStarter,
  createSchema: boolean,
  targetSchema: string
) {
  const drafts = cloneCsvUploadDrafts(objectForm.csvUploadDrafts);
  const startedAt = new Date().toISOString();
  const pendingSources = drafts.map((draft) => pendingDataSourceFromDraft(draft, targetSchema, startedAt));

  objectForm.setPendingSchemaCreation(null);
  objectForm.setIsObjectModalOpen(false);
  objectForm.resetObjectMetadata();
  objectForm.setCsvSchemaName(defaultDataSchema);
  onCsvUploadStart(pendingSources);
  showToast('CSV upload started. Objects will become active when processing finishes.', 'info');
  uploadMutation.mutate({ createSchema, drafts, normalizedCsvSchema: targetSchema, pendingSources });
}

export function useDataSourceMutations({
  apiClient,
  objectForm,
  listState,
  schemaNeedsCreation,
  normalizedCsvSchema,
  schemasAreLoading,
  invalidateSources,
  onCsvUploadStart,
  onCsvUploadSettled,
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
  invalidateSources: () => Promise<void>;
  onCsvUploadStart: (sources: DataSourceSummary[]) => void;
  onCsvUploadSettled: (sources: DataSourceSummary[]) => void;
  showToast: ShowToast;
  defaultDataSchema: string;
  getErrorMessage: (error: unknown) => string;
  metadataWarningMessage: (warnings?: string[]) => string | null;
}) {
  const uploadMutation = useMutation({
    mutationFn: ({ createSchema, drafts, normalizedCsvSchema: targetSchema }: CsvUploadMutationVariables) =>
      uploadCsvDrafts({ apiClient, drafts, normalizedCsvSchema: targetSchema, createSchema }),
    onSuccess: async (response, variables) => {
      await invalidateSources();
      onCsvUploadSettled(variables.pendingSources);
      showToast('CSV files loaded and Select AI profile updated.', 'success');
      showMetadataWarnings(showToast, metadataWarningMessage, response.data.metadata_warnings);
    },
    onError: async (error, variables) => {
      await invalidateSources();
      onCsvUploadSettled(variables?.pendingSources || []);
      showToast(getErrorMessage(error), 'error');
    },
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
      void invalidateSources();
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
      void invalidateSources();
      showToast(source.source_type === 'csv' ? 'Data source and managed table deleted.' : 'Table unregistered from Select AI.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const submitExistingTable = (event: FormEvent) => {
    event.preventDefault();
    if (!objectForm.tableOwner.trim() || !objectForm.tableName.trim() || registerMutation.isPending) return;
    registerMutation.mutate();
  };

  const csvUploadStarter = { objectForm, defaultDataSchema, onCsvUploadStart, showToast, uploadMutation };

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
    startCsvUpload(csvUploadStarter, false, normalizedCsvSchema);
  };

  const confirmSchemaCreation = () => {
    if (!objectForm.pendingSchemaCreation || uploadMutation.isPending) return;
    startCsvUpload(csvUploadStarter, true, objectForm.pendingSchemaCreation);
  };

  const closeObjectModal = () => {
    if (uploadMutation.isPending || registerMutation.isPending) return;
    objectForm.setIsObjectModalOpen(false);
  };

  return { uploadMutation, registerMutation, deleteMutation, submitExistingTable, submitCsv, confirmSchemaCreation, closeObjectModal };
}

export type DataSourceMutations = ReturnType<typeof useDataSourceMutations>;
