import type { FormEvent } from 'react';

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
  type DataSourceColumnMetadata,
  type DataSourceObjectMode,
  type DataSourceSchema,
  type DataSourceSummary,
} from './dataSourceUtils';

interface DataSourceObjectModalProps {
  open: boolean;
  objectMode: DataSourceObjectMode;
  csvFile: File | null;
  metadataJsonFile: File | null;
  csvSchemaName: string;
  csvTableName: string;
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
  onCsvFileChange: (file: File | null) => void;
  onMetadataJsonFileChange: (file: File | null) => void;
  onCsvSchemaNameChange: (value: string) => void;
  onCsvTableNameChange: (value: string) => void;
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

function DataSourceFilePicker({
  id,
  label,
  accept,
  fileName,
  onFileChange,
}: {
  id: string;
  label: string;
  accept: string;
  fileName?: string;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-oracle-dark-gray">{label}</label>
      <div className="mt-1 flex min-h-11 items-center gap-3 rounded border border-oracle-border bg-white px-3 py-2">
        <label
          htmlFor={id}
          className="shrink-0 cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Choose file
        </label>
        <span className="min-w-0 truncate text-sm text-oracle-medium-gray">
          {fileName || 'No file selected'}
        </span>
      </div>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        className="hidden"
      />
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
          Create <span className="font-mono font-semibold">{schemaName}</span> and load this CSV there?
        </span>
      }
      detail="APP_AGENT remains only for application objects."
      confirmText="Create and upload"
      confirmClass="text-amber-700 hover:bg-amber-50"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={isPending}
      loadingText="Uploading..."
    />
  );
}

export function DataSourceObjectModal({
  open,
  objectMode,
  csvFile,
  metadataJsonFile,
  csvSchemaName,
  csvTableName,
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
  onCsvFileChange,
  onMetadataJsonFileChange,
  onCsvSchemaNameChange,
  onCsvTableNameChange,
  onTableOwnerChange,
  onTableNameChange,
  onColumnMetadataChange,
}: DataSourceObjectModalProps) {
  const submitState = getObjectSubmitState({
    objectMode,
    csvFile,
    isUploadPending,
    isSchemasLoading,
    tableOwner,
    tableName,
    isRegisterPending,
    isCatalogTableFetching,
  });

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-8 flex max-h-[88vh] w-full max-w-4xl flex-col border-0"
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

        {objectMode === 'csv' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <DataSourceFilePicker
                id="data-source-csv-file"
                label="CSV file"
                accept=".csv,text/csv"
                fileName={csvFile?.name}
                onFileChange={onCsvFileChange}
              />
              <DataSourceFilePicker
                id="data-source-metadata-json-file"
                label="Metadata JSON"
                accept=".json,application/json"
                fileName={metadataJsonFile?.name}
                onFileChange={onMetadataJsonFileChange}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
                {normalizedCsvSchema === 'APP_AGENT' ? (
                  <p className="mt-1 text-xs text-red-600">APP_AGENT is reserved for application tables.</p>
                ) : schemaNeedsCreation ? (
                  <p className="mt-1 text-xs text-amber-700">This schema does not exist yet. You will be asked to confirm creation.</p>
                ) : (
                  <p className="mt-1 text-xs text-oracle-light-gray">Use an existing schema or type a new one.</p>
                )}
              </div>
              <div>
                <label htmlFor="data-source-csv-table-name" className="block text-sm font-medium text-oracle-dark-gray">Optional table name</label>
                <input
                  id="data-source-csv-table-name"
                  value={csvTableName}
                  onChange={(event) => onCsvTableNameChange(event.target.value)}
                  className="input-oracle mt-1 font-mono uppercase"
                  placeholder="FLEX_TRANSACTIONS_TEST"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-oracle-medium-gray">Register a table that APP_AGENT can read.</p>
            <div className="grid gap-4 sm:grid-cols-2">
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

        <DataDictionaryEditor
          columns={columnMetadata}
          isLoading={objectMode === 'existing_table' && isCatalogTableFetching}
          onColumnChange={onColumnMetadataChange}
          renderLoadingState={() => <LoadingState size="sm" label="Loading..." />}
        />

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
