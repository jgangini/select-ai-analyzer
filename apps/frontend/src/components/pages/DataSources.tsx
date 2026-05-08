import {
  DataSourceDeleteConfirmModal,
  DataSourceObjectModal,
  DataSourceSchemaCreationConfirmModal,
} from './data-sources/DataSourceObjectModal';
import { DataSourcePreviewModal } from './data-sources/DataSourcePreviewModal';
import { DataSourcesTable } from './data-sources/DataSourcesTable';
import { dataSourcesApi, dataSourcesQueryKeys } from '../../services/dataSourcesApi';
import {
  documentToolbarButtonClassName,
  formatNumber,
  type DataSourceStats,
} from './data-sources/dataSourceUtils';
import { useDataSourcesController } from './data-sources/useDataSourcesController';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

const metricToneClassNames = {
  active: {
    container: 'border-emerald-200 bg-emerald-50/60',
    label: 'text-emerald-900/80',
    value: 'text-emerald-700',
  },
  csv: {
    container: 'border-blue-200 bg-blue-50/60',
    label: 'text-blue-900/80',
    value: 'text-blue-700',
  },
  tables: {
    container: 'border-amber-200 bg-amber-50/60',
    label: 'text-amber-900/80',
    value: 'text-amber-700',
  },
  rows: {
    container: 'border-rose-200 bg-rose-50/60',
    label: 'text-rose-900/80',
    value: 'text-rose-700',
  },
} as const;

function DataSourceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof metricToneClassNames;
}) {
  const toneClassNames = metricToneClassNames[tone];

  return (
    <div className={`flex h-10 items-center justify-between rounded-xl border px-3 shadow-sm ${toneClassNames.container}`}>
      <p className={`truncate text-[11px] font-semibold uppercase tracking-wide ${toneClassNames.label}`}>{label}</p>
      <strong className={`text-xl font-bold leading-none tabular-nums ${toneClassNames.value}`}>
        {formatNumber(value)}
      </strong>
    </div>
  );
}

function DataSourcesPageHeader({ onAddObject }: { onAddObject: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Data Source</h1>
        <p className="text-oracle-light-gray">Manage the tables available to Select AI.</p>
      </div>
      <button
        type="button"
        onClick={onAddObject}
        className="inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-lg border border-transparent bg-oracle-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-oracle-red/90"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Object
      </button>
    </div>
  );
}

function DataSourcesOverview({
  stats,
  searchTerm,
  statusFilter,
  isRefreshDisabled,
  onSearchTermChange,
  onStatusFilterChange,
  onRefresh,
}: {
  stats: DataSourceStats;
  searchTerm: string;
  statusFilter: string;
  isRefreshDisabled: boolean;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DataSourceMetric label="Active" value={stats.active} tone="active" />
        <DataSourceMetric label="CSV" value={stats.csv} tone="csv" />
        <DataSourceMetric label="Tables" value={stats.tables} tone="tables" />
        <DataSourceMetric label="Rows" value={stats.rows} tone="rows" />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_150px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search by schema or table..."
            className="input-oracle"
          />
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
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
            onClick={onRefresh}
            disabled={isRefreshDisabled}
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
    </>
  );
}

export function DataSources({ showToast }: { showToast: ShowToast }) {
  const controller = useDataSourcesController({
    apiClient: dataSourcesApi,
    queryKeys: dataSourcesQueryKeys,
    showToast,
  });

  return (
    <>
      <div className="space-y-6">
        <DataSourcesPageHeader onAddObject={controller.openObjectModal} />

        <div className="app-light-surface rag-light-surface rounded-lg bg-white p-8 shadow">
          <div className="space-y-6">
            <DataSourcesOverview {...controller.overviewProps} />
            <DataSourcesTable {...controller.tableProps} />
          </div>
        </div>
      </div>

      <DataSourceObjectModal {...controller.objectModalProps} />
      <DataSourcePreviewModal {...controller.previewModalProps} />
      <DataSourceDeleteConfirmModal {...controller.deleteConfirmProps} />
      <DataSourceSchemaCreationConfirmModal {...controller.schemaConfirmProps} />
    </>
  );
}
