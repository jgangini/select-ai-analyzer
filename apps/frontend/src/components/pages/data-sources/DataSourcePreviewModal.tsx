import { useMemo, type Dispatch, type SetStateAction } from 'react';

import { GlassModal } from '../shared/Modal';
import { LoadingState } from '../shared/LoadingState';
import {
  buildPreviewColumnDetails,
  formatCellValue,
  formatColumnType,
  formatLabel,
  formatNumber,
  getPaginationWindow,
  getErrorMessage,
  type DataSourceColumnMetadata,
  type DataSourceRowsResponse,
  type DataSourceSummary,
} from './dataSourceUtils';

interface DataSourcePreviewModalProps {
  source: DataSourceSummary | null;
  response?: DataSourceRowsResponse;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  page: number;
  onPageChange: Dispatch<SetStateAction<number>>;
  onClose: () => void;
}

export function DataSourcePreviewModal({
  source,
  response,
  isLoading,
  isError,
  error,
  isFetching,
  page,
  onPageChange,
  onClose,
}: DataSourcePreviewModalProps) {
  const previewColumns = response?.columns ?? [];
  const previewColumnDetails = useMemo<DataSourceColumnMetadata[]>(() => {
    return buildPreviewColumnDetails(previewColumns, response?.column_details);
  }, [previewColumns, response?.column_details]);
  const previewRows = response?.rows ?? [];
  const previewTotalRows = Number(response?.row_count ?? source?.row_count ?? 0);
  const {
    totalPages: previewTotalPages,
    safePage,
    start: previewStart,
    end: previewEnd,
  } = getPaginationWindow(previewTotalRows, page);

  return (
    <GlassModal
      open={Boolean(source)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-8 flex h-[84vh] w-full max-w-6xl flex-col border-0"
    >
      <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {source ? `${source.owner_name}.${source.table_name}` : 'Table rows'}
          </h2>
          <p className="text-sm text-gray-200">
            {previewTotalRows > 0 ? `${formatNumber(previewTotalRows)} rows` : 'No rows'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close rows preview"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-white">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <LoadingState size="sm" label="Loading rows..." />
          </div>
        ) : isError ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {getErrorMessage(error)}
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
                    <th className="w-12 whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">PK</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">Column</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">Type</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">UI display</th>
                    <th className="min-w-[320px] px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">Comment</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">Classification</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">Nullable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {previewColumnDetails.map((column) => (
                    <tr key={`field-${column.column_name}`} className="odd:bg-white even:bg-gray-50/60">
                      <td className="px-3 py-2 align-top">
                        {column.primary_key ? (
                          <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">PK</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-oracle-dark-gray">{column.column_name}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-oracle-medium-gray">{formatColumnType(column)}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-oracle-medium-gray">{column.ui_display || formatLabel(column.column_name)}</td>
                      <td className="max-w-[520px] px-3 py-2 align-top text-oracle-medium-gray">
                        <span className="line-clamp-2" title={column.comment || ''}>{column.comment || '-'}</span>
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
                      <th key={column} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={previewColumns.length} className="px-3 py-8 text-center text-sm text-oracle-light-gray">No rows found</td>
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
                              className={`max-w-[260px] whitespace-nowrap px-3 py-2 align-top text-oracle-medium-gray ${isEmpty ? 'text-gray-400' : ''}`}
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
              <p className="text-sm text-gray-600">Showing {previewStart}-{previewEnd} of {previewTotalRows}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange((current) => Math.max(0, current - 1))}
                  disabled={page === 0 || isFetching}
                  className="rounded border border-gray-300 px-3 py-1 text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="min-w-[96px] text-center text-sm text-gray-600">Page {safePage + 1} of {previewTotalPages}</span>
                <button
                  type="button"
                  onClick={() => onPageChange((current) => Math.min(previewTotalPages - 1, current + 1))}
                  disabled={safePage >= previewTotalPages - 1 || isFetching}
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
  );
}
