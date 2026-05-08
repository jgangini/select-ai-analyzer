import { Fragment, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from 'react';

import type { DropColumn, DropPlacement, DropPosition, VisualizationWidth } from './dashboardDropPosition';

type VisualizationCardItem = {
  dashboard_item_id: string;
  order: number;
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec: {
    type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
    title?: string;
    x?: string;
    y?: string;
    series?: string;
  };
  layout: Record<string, unknown>;
  created_at: string;
};

interface AnalyticsVisualizationCardProps {
  item: VisualizationCardItem;
  itemIndex: number;
  visualizationWidth: VisualizationWidth;
  visualizationColumn: DropColumn;
  nextVisualizationWidth: VisualizationWidth | null;
  draggedItemIndex: number;
  draggedItemWidth: VisualizationWidth | null;
  canManageDashboard: boolean;
  isMutating: boolean;
  isUpdatePending: boolean;
  isDeletePending: boolean;
  draggedItemId: string | null;
  dragOverItemId: string | null;
  dragIndicator: DropPosition | null;
  openItemMenuId: string | null;
  itemMenuRef: RefObject<HTMLDivElement>;
  onCardMouseDown: (event: ReactMouseEvent<HTMLElement>, itemId: string, disabled: boolean) => void;
  onToggleMenu: (itemId: string) => void;
  onViewSql: (item: VisualizationCardItem) => void;
  onRename: (item: VisualizationCardItem) => void;
  onDelete: (item: VisualizationCardItem) => void;
  renderChartPreview: (item: VisualizationCardItem) => ReactNode;
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function getMetricLabel(item: VisualizationCardItem): string {
  const firstRow = item.rows[0] || {};
  const numericColumns = item.columns.filter((column) => Number.isFinite(Number(firstRow[column])));
  const candidate =
    item.chart_spec?.y ||
    numericColumns[0] ||
    item.columns.find((column) => column && !/^\d+(\.\d+)?$/.test(column)) ||
    'Value';
  const normalized = String(candidate || 'Value').replace(/_/g, ' ').trim();
  return normalized || 'Value';
}

function getInsertionLineClass(placement: DropPlacement, width: VisualizationWidth, targetColumn: DropColumn): string {
  const base =
    'pointer-events-none absolute z-30 rounded-full bg-oracle-red shadow-[0_0_0_3px_rgba(199,70,52,0.16),0_0_18px_rgba(199,70,52,0.42)]';

  if (width === 'full') {
    const verticalPosition = placement === 'before' ? '-top-2' : '-bottom-2';
    if (targetColumn === 'left') {
      return `${base} ${verticalPosition} left-3 right-3 h-1 md:left-0 md:right-auto md:w-[calc(200%+1rem)]`;
    }
    if (targetColumn === 'right') {
      return `${base} ${verticalPosition} left-3 right-3 h-1 md:left-auto md:right-0 md:w-[calc(200%+1rem)]`;
    }
    return `${base} ${verticalPosition} left-3 right-3 h-1`;
  }

  return placement === 'before'
    ? `${base} -top-2 left-3 right-3 h-1 md:-left-2 md:bottom-4 md:right-auto md:top-4 md:h-auto md:w-1`
    : `${base} -bottom-2 left-3 right-3 h-1 md:-right-2 md:bottom-4 md:left-auto md:top-4 md:h-auto md:w-1`;
}

export function AnalyticsVisualizationCard({
  item,
  itemIndex,
  visualizationWidth,
  visualizationColumn,
  nextVisualizationWidth,
  draggedItemIndex,
  draggedItemWidth,
  canManageDashboard,
  isMutating,
  isUpdatePending,
  isDeletePending,
  draggedItemId,
  dragOverItemId,
  dragIndicator,
  openItemMenuId,
  itemMenuRef,
  onCardMouseDown,
  onToggleMenu,
  onViewSql,
  onRename,
  onDelete,
  renderChartPreview,
}: AnalyticsVisualizationCardProps) {
  const isBusy = !canManageDashboard || isMutating;
  const isDragging = draggedItemId === item.dashboard_item_id;
  const showTrailingHalfDropZone =
    Boolean(draggedItemId) &&
    !isDragging &&
    visualizationWidth === 'half' &&
    visualizationColumn === 'left' &&
    (!nextVisualizationWidth || nextVisualizationWidth === 'full');
  const isNoopInsertion =
    dragIndicator?.insertionIndex !== null &&
    dragIndicator?.insertionIndex !== undefined &&
    draggedItemIndex >= 0 &&
    (dragIndicator.insertionIndex === draggedItemIndex ||
      dragIndicator.insertionIndex === draggedItemIndex + 1) &&
    draggedItemWidth !== null &&
    dragIndicator.width === draggedItemWidth;
  const showInsertionBefore =
    Boolean(draggedItemId) &&
    !isNoopInsertion &&
    dragIndicator?.targetIndex === itemIndex &&
    dragIndicator.placement === 'before';
  const showInsertionAfter =
    Boolean(draggedItemId) &&
    !isNoopInsertion &&
    dragIndicator?.targetIndex === itemIndex &&
    dragIndicator.placement === 'after';
  const isDropTarget = Boolean(
    draggedItemId && dragOverItemId === item.dashboard_item_id && draggedItemId !== item.dashboard_item_id
  );

  return (
    <Fragment>
      <article
        data-testid="analytics-visualization-card"
        data-dashboard-item-id={item.dashboard_item_id}
        aria-grabbed={isDragging}
        className={`relative min-w-0 cursor-grab overflow-visible rounded-lg border bg-white p-4 shadow-sm transition-[border-color,background-color,box-shadow,opacity,transform] hover:border-oracle-red/40 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oracle-red/40 ${
          isDropTarget ? 'border-oracle-red bg-[#fff7f5] shadow-lg ring-2 ring-oracle-red/30' : 'border-oracle-border'
        } ${visualizationWidth === 'full' ? 'md:col-span-2' : ''} ${
          isDragging ? 'scale-[0.99] select-none opacity-60' : ''
        } ${isBusy ? 'cursor-default opacity-70' : ''}`}
        tabIndex={0}
        title="Drag to move visualization"
        onMouseDown={(event) => onCardMouseDown(event, item.dashboard_item_id, isBusy)}
      >
        {showInsertionBefore && (
          <span
            data-testid="visualization-drop-indicator"
            className={getInsertionLineClass(
              'before',
              dragIndicator?.width || 'half',
              dragIndicator?.targetColumn || 'full'
            )}
          />
        )}
        {showInsertionAfter && (
          <span
            data-testid="visualization-drop-indicator"
            className={getInsertionLineClass(
              'after',
              dragIndicator?.width || 'half',
              dragIndicator?.targetColumn || 'full'
            )}
          />
        )}
        <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-oracle-dark-gray" title={item.title}>
              {item.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-oracle-medium-gray" title={item.question}>
              {item.question}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
            <div className="relative" ref={openItemMenuId === item.dashboard_item_id ? itemMenuRef : undefined}>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45"
                title="Visualization actions"
                aria-label="Visualization actions"
                aria-haspopup="menu"
                aria-expanded={openItemMenuId === item.dashboard_item_id}
                disabled={isMutating}
                onClick={() => onToggleMenu(item.dashboard_item_id)}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z"
                  />
                </svg>
              </button>
              {openItemMenuId === item.dashboard_item_id && (
                <div
                  className="chat-header-actions-menu absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
                  role="menu"
                  aria-label="Visualization actions"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => onViewSql(item)}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    SQL
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canManageDashboard || isUpdatePending}
                    onClick={() => onRename(item)}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canManageDashboard || isDeletePending}
                    onClick={() => onDelete(item)}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {item.chart_spec?.type === 'metric' && item.rows.length > 0 ? (
          <div data-no-card-drag="true" className="cursor-auto rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oracle-light-gray">
              {getMetricLabel(item)}
            </p>
            <p className="mt-2 text-4xl font-semibold text-oracle-dark-gray">
              {formatCellValue(item.rows[0][item.columns[0]])}
            </p>
          </div>
        ) : (
          <div data-no-card-drag="true" className="cursor-auto">
            {renderChartPreview(item)}
          </div>
        )}
      </article>
      {showTrailingHalfDropZone && (
        <div
          aria-hidden="true"
          data-dashboard-drop-zone="true"
          data-dashboard-drop-zone-target-id={item.dashboard_item_id}
          className="relative hidden min-h-[6rem] rounded-lg border border-dashed border-transparent md:block"
        />
      )}
    </Fragment>
  );
}
