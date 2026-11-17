import { useEffect, useMemo, useState } from 'react';

import { AddVisualizationButton } from './AnalyticsChartChrome';
import {
  compareTableCellValues,
  formatCellValue,
  normalizeChartSearch,
  PAGE_SIZE,
  type TableSortMode,
} from './analyticsChartUtils';

function ResultTableControls({
  search,
  sortMode,
  sortLabelColumn,
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onSearchChange,
  onSortModeChange,
  onAddVisualization,
}: {
  search: string;
  sortMode: TableSortMode;
  sortLabelColumn: string;
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: TableSortMode) => void;
  onAddVisualization?: () => void;
}) {
  return (
    <div
      className={`mb-3 grid min-w-0 gap-2 ${
        onAddVisualization
          ? 'sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'
          : 'sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)]'
      } sm:items-center`}
    >
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        placeholder="Filter table values..."
        aria-label="Filter table values"
        data-testid="analytics-table-filter"
      />
      <select
        value={sortMode}
        onChange={(event) => onSortModeChange(event.target.value as TableSortMode)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        aria-label="Sort table values"
        data-testid="analytics-table-sort"
      >
        <option value="original">Original order</option>
        <option value="column-asc">{sortLabelColumn} A-Z</option>
        <option value="column-desc">{sortLabelColumn} Z-A</option>
      </select>
      {onAddVisualization ? (
        <AddVisualizationButton
          visibleCount={visibleCount}
          totalCount={totalCount}
          isVisualizationAdded={isVisualizationAdded}
          onAddVisualization={onAddVisualization}
        />
      ) : null}
    </div>
  );
}

export function ResultTable({
  columns,
  rows,
  onAddVisualization,
  isVisualizationAdded = false,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  onAddVisualization?: () => void;
  isVisualizationAdded?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSortMode, setTableSortMode] = useState<TableSortMode>('original');
  const normalizedTableSearch = normalizeChartSearch(tableSearch);
  const filteredRows = useMemo(() => {
    if (!normalizedTableSearch) return rows;
    return rows.filter((row) =>
      columns.some((column) => normalizeChartSearch(formatCellValue(row[column])).includes(normalizedTableSearch))
    );
  }, [columns, normalizedTableSearch, rows]);
  const sortedRows = useMemo(() => {
    if (tableSortMode === 'original') return filteredRows;
    const sortColumn = columns[0];
    if (!sortColumn) return filteredRows;
    const direction = tableSortMode === 'column-asc' ? 1 : -1;
    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareTableCellValues(left.row[sortColumn], right.row[sortColumn]);
        return comparison === 0 ? left.index - right.index : comparison * direction;
      })
      .map((item) => item.row);
  }, [columns, filteredRows, tableSortMode]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visibleRows = sortedRows.slice(start, start + PAGE_SIZE);
  const sortLabelColumn = columns[0] ? columns[0].replace(/_/g, ' ') : 'First column';

  useEffect(() => {
    setPage(0);
  }, [sortedRows.length, columns.join('|'), normalizedTableSearch, tableSortMode]);

  if (!rows.length) {
    return <p className="text-sm text-oracle-medium-gray">The query returned no rows.</p>;
  }

  return (
    <div className="rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm">
      <ResultTableControls
        search={tableSearch}
        sortMode={tableSortMode}
        sortLabelColumn={sortLabelColumn}
        visibleCount={sortedRows.length}
        totalCount={rows.length}
        isVisualizationAdded={isVisualizationAdded}
        onSearchChange={setTableSearch}
        onSortModeChange={setTableSortMode}
        onAddVisualization={onAddVisualization}
      />
      <div className="analytics-result-table overflow-hidden rounded-lg border border-[#e2d8d0] bg-white">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm text-oracle-dark-gray">
            <thead className="bg-oracle-table-header">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap border-b border-[#e2d8d0] px-4 py-3 text-xs font-semibold uppercase text-oracle-dark-gray"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {visibleRows.length > 0 ? (
                visibleRows.map((row, rowIndex) => (
                  <tr key={`${safePage}-${rowIndex}`} className="border-b border-[#eee6df] last:border-b-0 hover:bg-[#faf8f6]">
                    {columns.map((column) => (
                      <td key={column} className="whitespace-nowrap px-4 py-3 text-oracle-dark-gray">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-oracle-medium-gray" colSpan={Math.max(1, columns.length)}>
                    No table rows match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2d8d0] bg-[#fbf9f7] px-4 py-3 text-xs text-oracle-medium-gray">
          <span>
            {sortedRows.length > 0
              ? `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, sortedRows.length)} of ${sortedRows.length}`
              : 'No rows to show'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-[#e2d8d0] bg-white px-3 py-1 text-xs font-medium text-oracle-dark-gray transition-colors hover:bg-[#f6f2ef] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage === 0}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded border border-[#e2d8d0] bg-white px-3 py-1 text-xs font-medium text-oracle-dark-gray transition-colors hover:bg-[#f6f2ef] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
