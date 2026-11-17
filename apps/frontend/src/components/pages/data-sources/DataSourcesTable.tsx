import type { Ref } from 'react';

import { LoadingState } from '../../common/LoadingState';
import {
  PAGE_SIZE,
  formatDateTime,
  formatLabel,
  formatNumber,
  getDataSourceStatusBadgeClassName,
  getPaginationWindow,
  getErrorMessage,
  type DataSourceSummary,
} from './dataSourceUtils';

interface DataSourcesTableProps {
  sources: DataSourceSummary[];
  totalItems: number;
  page: number;
  selectedSourceIds: Set<string>;
  selectAllRef: Ref<HTMLInputElement>;
  allCurrentPageSourcesSelected: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isDeletePending: boolean;
  onSelectSource: (dataSourceId: string, checked: boolean) => void;
  onSelectCurrentPage: (checked: boolean) => void;
  onPreview: (source: DataSourceSummary) => void;
  onDelete: (source: DataSourceSummary) => void;
  onPageChange: (page: number) => void;
}

function SourceTypeBadge({ source }: { source: DataSourceSummary }) {
  const label = source.source_type === 'csv' ? 'CSV' : 'Existing table';
  return (
    <span className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-gray-700">
      {label}
    </span>
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

function isProcessingSource(source: DataSourceSummary): boolean {
  return ['pending', 'running'].includes(String(source.status || '').trim().toLowerCase());
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
  const { totalPages, safePage, start, end } = getPaginationWindow(totalItems, page, PAGE_SIZE);

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

export function DataSourcesTable({
  sources,
  totalItems,
  page,
  selectedSourceIds,
  selectAllRef,
  allCurrentPageSourcesSelected,
  isLoading,
  isError,
  error,
  isDeletePending,
  onSelectSource,
  onSelectCurrentPage,
  onPreview,
  onDelete,
  onPageChange,
}: DataSourcesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200/70 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-12 px-4 py-3 text-center">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allCurrentPageSourcesSelected}
                onChange={(event) => onSelectCurrentPage(event.target.checked)}
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
            <th className="w-24 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="w-28 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-8">
                <LoadingState size="sm" label="Loading data sources..." />
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-700">
                {getErrorMessage(error)}
              </td>
            </tr>
          ) : sources.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-oracle-light-gray">
                No data sources found
              </td>
            </tr>
          ) : (
            sources.map((source) => {
              const sourceIsProcessing = isProcessingSource(source);
              const qualifiedName = `${source.owner_name}.${source.table_name}`;

              return (
                <tr key={source.data_source_id}>
                  <td className="px-4 py-3 text-center align-top">
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.has(source.data_source_id)}
                      onChange={(event) => onSelectSource(source.data_source_id, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-oracle-red accent-oracle-red focus:ring-oracle-red"
                      aria-label={`Select ${qualifiedName}`}
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
                    <span className={getDataSourceStatusBadgeClassName(source.status)}>{formatLabel(source.status)}</span>
                  </td>
                  <td className="w-28 px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onPreview(source)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={sourceIsProcessing}
                        title={sourceIsProcessing ? 'Processing' : 'View rows'}
                        aria-label={`View rows for ${qualifiedName}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(source)}
                        className="rounded border border-red-300 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isDeletePending || sourceIsProcessing}
                        title={source.source_type === 'csv' ? 'Delete' : 'Unregister'}
                        aria-label={`${source.source_type === 'csv' ? 'Delete' : 'Unregister'} ${qualifiedName}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {totalItems > 0 && (
        <div className="mt-4 border-t border-gray-200 px-4 py-3">
          <Pagination page={page} totalItems={totalItems} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
