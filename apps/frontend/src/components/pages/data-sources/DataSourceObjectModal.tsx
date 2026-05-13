import type { ChangeEvent, DragEvent, FormEvent } from 'react';

import { LoadingState } from '../../common/LoadingState';
import { ConfirmModal, GlassModal } from '../../common/Modal';
import { DataDictionaryEditor } from './DataDictionaryEditor';
import {
  DEFAULT_DATA_SCHEMA,
  catalogTablePlaceholder,
  formatNumber,
  getObjectSubmitState,
  normalizeIdentifier,
  userSchemaOptions,
  type DataSourceCatalogOwner,
  type DataSourceCatalogTable,
  type DataSourceCsvUploadDraft,
  type DataSourceColumnMetadata,
  type DataSourceObjectMode,
  type DataSourceSchema,
  type DataSourceSummary,
} from './dataSourceUtils';

interface DataSourceObjectModalProps {
  open: boolean;
  objectMode: DataSourceObjectMode;
  csvUploadDrafts: DataSourceCsvUploadDraft[];
  activeCsvUploadId: string | null;
  csvUploadIssues: string[];
  csvSchemaName: string;
  normalizedCsvSchema: string;
  schemaNeedsCreation: boolean;
  schemaOptions: DataSourceSchema[];
  tableOwner: string;
  tableName: string;
  columnMetadata: DataSourceColumnMetadata[];
  ownerOptions: DataSourceCatalogOwner[];
  tableOptions: DataSourceCatalogTable[];
  isUploadPending: boolean;
  isRegisterPending: boolean;
  isSchemasLoading: boolean;
  isCatalogOwnersLoading: boolean;
  isCatalogTablesLoading: boolean;
  isCatalogTableFetching: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onObjectModeChange: (mode: DataSourceObjectMode) => void;
  onCsvUploadFilesChange: (files: FileList | File[] | null) => void;
  onActiveCsvUploadIdChange: (value: string) => void;
  onCsvUploadDraftRemove: (id: string) => void;
  onCsvSchemaNameChange: (value: string) => void;
  onTableOwnerChange: (value: string) => void;
  onTableNameChange: (value: string) => void;
  onColumnMetadataChange: (index: number, patch: Partial<DataSourceColumnMetadata>) => void;
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

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CsvUploadStatusBadge({ draft }: { draft: DataSourceCsvUploadDraft }) {
  if (draft.error) {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
        Review
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
      Ready
    </span>
  );
}

function CsvUploadDraftList({
  drafts,
  activeDraftId,
  readyCount,
  onSelectDraft,
  onRemoveDraft,
}: {
  drafts: DataSourceCsvUploadDraft[];
  activeDraftId: string | null;
  readyCount: number;
  onSelectDraft: (id: string) => void;
  onRemoveDraft: (id: string) => void;
}) {
  return (
    <div className="flex h-[25rem] flex-col rounded-lg border border-oracle-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-oracle-border px-4 py-3">
        <h3 className="text-sm font-semibold text-oracle-dark-gray">Files</h3>
        <span className="text-xs text-oracle-medium-gray">
          {readyCount}/{drafts.length} ready
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {drafts.map((draft) => {
          const active = draft.id === activeDraftId;
          return (
            <div
              key={draft.id}
              className={`border-b border-gray-100 px-3 py-2 last:border-b-0 ${
                active ? 'border-l-2 border-l-oracle-red bg-gray-50' : 'border-l-2 border-l-transparent bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDraft(draft.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-xs font-semibold text-oracle-dark-gray">
                      {draft.tableName}
                    </span>
                    <CsvUploadStatusBadge draft={draft} />
                  </div>
                  <p className="mt-1 truncate text-xs text-oracle-medium-gray" title={draft.csvFile.name}>
                    {draft.csvFile.name} - {formatFileSize(draft.csvFile.size)}
                  </p>
                  <p className={`mt-0.5 truncate text-xs ${draft.metadataJsonFile ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {draft.metadataJsonFile ? draft.metadataJsonFile.name : 'Missing JSON metadata'}
                  </p>
                  {draft.error ? <p className="mt-1 text-xs text-rose-700">{draft.error}</p> : null}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveDraft(draft.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-oracle-medium-gray transition-colors hover:bg-gray-100 hover:text-oracle-dark-gray"
                  aria-label={`Remove ${draft.csvFile.name}`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DataSourceDeleteConfirmModal({
  source,
  isPending,
  onConfirm,
  onCancel,
}: {
  source: DataSourceSummary | null;
  isPending: boolean;
  onConfirm: (source: DataSourceSummary) => void;
  onCancel: () => void;
}) {
  if (!source) return null;

  return (
    <ConfirmModal
      icon={
        <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      }
      iconBg="bg-red-100"
      iconRing="ring-red-50"
      title={source.source_type === 'csv' ? 'Delete data source' : 'Unregister table'}
      message={<DeleteDataSourceConfirmMessage source={source} />}
      detail="The Select AI profile will be refreshed."
      confirmText={source.source_type === 'csv' ? 'Delete' : 'Unregister'}
      confirmClass="bg-oracle-red text-white hover:bg-red-700"
      onConfirm={() => onConfirm(source)}
      onCancel={onCancel}
      loading={isPending}
      loadingText={source.source_type === 'csv' ? 'Deleting...' : 'Unregistering...'}
    />
  );
}

export function DataSourceSchemaCreationConfirmModal({
  schemaName,
  isPending,
  onConfirm,
  onCancel,
}: {
  schemaName: string | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!schemaName) return null;

  return (
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
          Create <span className="font-mono font-semibold">{schemaName}</span> and load the selected CSV files there?
        </span>
      }
      detail="APP_AGENT remains only for application objects."
      confirmText="Create and upload"
      confirmClass="text-amber-700 hover:bg-amber-50"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={isPending}
      loadingText="Uploading..."
      zIndex="z-[400]"
    />
  );
}

export function DataSourceObjectModal({
  open,
  objectMode,
  csvUploadDrafts,
  activeCsvUploadId,
  csvUploadIssues,
  csvSchemaName,
  normalizedCsvSchema,
  schemaNeedsCreation,
  schemaOptions,
  tableOwner,
  tableName,
  columnMetadata,
  ownerOptions,
  tableOptions,
  isUploadPending,
  isRegisterPending,
  isSchemasLoading,
  isCatalogOwnersLoading,
  isCatalogTablesLoading,
  isCatalogTableFetching,
  onClose,
  onSubmit,
  onObjectModeChange,
  onCsvUploadFilesChange,
  onActiveCsvUploadIdChange,
  onCsvUploadDraftRemove,
  onCsvSchemaNameChange,
  onTableOwnerChange,
  onTableNameChange,
  onColumnMetadataChange,
}: DataSourceObjectModalProps) {
  const submitState = getObjectSubmitState({
    objectMode,
    csvUploadDrafts,
    isUploadPending,
    isSchemasLoading,
    tableOwner,
    tableName,
    isRegisterPending,
    isCatalogTableFetching,
  });
  const activeCsvUpload = csvUploadDrafts.find((draft) => draft.id === activeCsvUploadId) || null;
  const readyCsvUploadCount = csvUploadDrafts.filter((draft) => !draft.error && draft.metadataJsonFile).length;

  const handleCsvFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    onCsvUploadFilesChange(event.target.files);
    event.target.value = '';
  };

  const handleCsvDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onCsvUploadFilesChange(event.dataTransfer.files);
  };

  const handleCsvDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const objectSourceField = (
    <div>
      <label htmlFor="data-source-object-mode" className="block text-sm font-medium text-oracle-dark-gray">Object source</label>
      <select
        id="data-source-object-mode"
        value={objectMode}
        onChange={(event) => onObjectModeChange(event.target.value as DataSourceObjectMode)}
        className="input-oracle mt-1"
        disabled={isUploadPending || isRegisterPending}
      >
        <option value="csv">CSV file</option>
        <option value="existing_table">Existing table</option>
      </select>
    </div>
  );

  const targetSchemaFeedback = normalizedCsvSchema === 'APP_AGENT'
    ? 'APP_AGENT is reserved for application tables.'
    : schemaNeedsCreation
      ? 'This schema does not exist yet. You will be asked to confirm creation.'
      : '';

  const targetSchemaField = (
    <div>
      <label htmlFor="data-source-csv-schema" className="block text-sm font-medium text-oracle-dark-gray">Target schema</label>
      <input
        id="data-source-csv-schema"
        value={csvSchemaName}
        onChange={(event) => onCsvSchemaNameChange(normalizeIdentifier(event.target.value))}
        className="input-oracle mt-1 font-mono uppercase"
        placeholder={DEFAULT_DATA_SCHEMA}
        list="data-source-schema-options"
      />
      <datalist id="data-source-schema-options">
        {userSchemaOptions(schemaOptions).map((schema) => (
          <option key={schema.schema_name} value={schema.schema_name}>
            {schema.exists ? `${schema.source_count} source(s)` : 'Create on upload'}
          </option>
        ))}
      </datalist>
      {targetSchemaFeedback ? (
        <p className={`mt-1 text-xs ${normalizedCsvSchema === 'APP_AGENT' ? 'text-red-600' : 'text-amber-700'}`}>
          {targetSchemaFeedback}
        </p>
      ) : null}
    </div>
  );

  const addFilesControl = (
    <div className="flex items-end">
      <label htmlFor="data-source-csv-batch-files" className="btn-secondary h-[42px] cursor-pointer whitespace-nowrap">
        + Add files
      </label>
    </div>
  );

  const activeCsvHeaderMeta = activeCsvUpload ? (
    <div className="flex min-w-0 items-center gap-2">
      <span>:</span>
      <span className="min-w-0 truncate font-mono font-semibold text-oracle-dark-gray" title={activeCsvUpload.tableName}>
        {activeCsvUpload.tableName}
      </span>
      <span
        className={`min-w-0 truncate ${activeCsvUpload.metadataJsonFile ? 'text-emerald-700' : 'text-rose-700'}`}
        title={activeCsvUpload.metadataJsonFile?.name || 'Missing JSON'}
      >
        {activeCsvUpload.metadataJsonFile ? activeCsvUpload.metadataJsonFile.name : 'Missing JSON'}
      </span>
    </div>
  ) : null;

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-8 flex max-h-[88vh] w-full max-w-6xl flex-col border-0"
    >
      <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Add Object</h2>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUploadPending || isRegisterPending}
          aria-label="Close add object"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto bg-white/90 p-5">
        {objectMode === 'csv' ? (
          <>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              {objectSourceField}
              {targetSchemaField}
              {addFilesControl}
            </div>
            <input
              id="data-source-csv-batch-files"
              type="file"
              multiple
              accept=".csv,.json,text/csv,application/json"
              onChange={handleCsvFilesChange}
              className="hidden"
            />
            <div className="space-y-3">
              {csvUploadIssues.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {csvUploadIssues.map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </div>
              ) : null}
              {csvUploadDrafts.length === 0 ? (
                <div
                  className="flex min-h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center"
                  onDrop={handleCsvDrop}
                  onDragOver={handleCsvDragOver}
                >
                  <div>
                    <div className="text-sm font-semibold text-oracle-dark-gray">Drop CSV and JSON files</div>
                    <label
                      htmlFor="data-source-csv-batch-files"
                      className="mt-2 inline-flex cursor-pointer text-sm font-medium text-oracle-blue-link hover:underline"
                    >
                      Select files
                    </label>
                  </div>
                </div>
              ) : (
                <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
                  <CsvUploadDraftList
                    drafts={csvUploadDrafts}
                    activeDraftId={activeCsvUploadId}
                    readyCount={readyCsvUploadCount}
                    onSelectDraft={onActiveCsvUploadIdChange}
                    onRemoveDraft={onCsvUploadDraftRemove}
                  />
                  <div className="min-w-0">
                    <DataDictionaryEditor
                      columns={activeCsvUpload?.columnMetadata || []}
                      className="h-[25rem]"
                      headerMeta={activeCsvHeaderMeta}
                      onColumnChange={onColumnMetadataChange}
                      renderLoadingState={() => <LoadingState size="sm" label="Loading..." />}
                      scrollClassName="min-h-0 flex-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {objectSourceField}
              <div>
                <label htmlFor="data-source-table-owner" className="block text-sm font-medium text-oracle-dark-gray">Owner</label>
                <select
                  id="data-source-table-owner"
                  value={tableOwner}
                  onChange={(event) => onTableOwnerChange(event.target.value)}
                  className="input-oracle mt-1 font-mono uppercase"
                  disabled={isCatalogOwnersLoading}
                >
                  <option value="">{isCatalogOwnersLoading ? 'Loading...' : 'Select owner'}</option>
                  {ownerOptions.map((owner) => (
                    <option key={owner.owner_name} value={owner.owner_name}>
                      {owner.owner_name} ({formatNumber(owner.table_count)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="data-source-table-name" className="block text-sm font-medium text-oracle-dark-gray">Table</label>
                <select
                  id="data-source-table-name"
                  value={tableName}
                  onChange={(event) => onTableNameChange(event.target.value)}
                  className="input-oracle mt-1 font-mono uppercase"
                  disabled={!tableOwner || isCatalogTablesLoading}
                >
                  <option value="">
                    {catalogTablePlaceholder(tableOwner, isCatalogTablesLoading)}
                  </option>
                  {tableOptions.map((table) => (
                    <option key={`${table.owner_name}.${table.table_name}`} value={table.table_name}>
                      {table.table_name} ({formatNumber(table.column_count)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {objectMode === 'existing_table' ? (
          <DataDictionaryEditor
            columns={columnMetadata}
            isLoading={isCatalogTableFetching}
            onColumnChange={onColumnMetadataChange}
            renderLoadingState={() => <LoadingState size="sm" label="Loading..." />}
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitState.disabled}
          >
            {submitState.label}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}
