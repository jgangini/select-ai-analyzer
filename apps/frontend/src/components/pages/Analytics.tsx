import { Fragment, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { Layout } from '../common/Layout';
import { LoadingState } from '../common/LoadingState';
import { ChartPreview } from '../common/AnalyticsChatPanel';
import { GlassModal } from '../common/GlassModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../../context/ToastContext';
import { dashboardsApi, type DashboardDetail, type DashboardItem } from '../../services/api';
import { queryKeys } from '../../lib/queryClient';

type VisualizationWidth = 'half' | 'full';
type DropPlacement = 'before' | 'after';
type DropColumn = 'left' | 'right' | 'full';
type DropPosition = {
  targetItemId: string | null;
  targetIndex: number | null;
  insertionIndex: number | null;
  width: VisualizationWidth;
  placement: DropPlacement;
  targetColumn: DropColumn;
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function getErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'Dashboard action failed.';
}

function getMetricLabel(item: DashboardItem): string {
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

function applyDashboardCache(queryClient: ReturnType<typeof useQueryClient>, dashboard: DashboardDetail) {
  queryClient.setQueryData(queryKeys.dashboards.detail(dashboard.dashboard_id), dashboard);
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list });
}

function isDragBlockedTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      'button, input, select, textarea, a, [role="menu"], [contenteditable="true"], [data-no-card-drag="true"]'
    )
  );
}

function getVisualizationWidth(item: DashboardItem): VisualizationWidth {
  return item.layout?.width === 'full' ? 'full' : 'half';
}

function getElementDropColumn(itemElement: HTMLElement, gridElement: HTMLElement | null): DropColumn {
  if (!gridElement) return 'full';
  const itemRect = itemElement.getBoundingClientRect();
  const gridRect = gridElement.getBoundingClientRect();
  if (itemRect.width >= gridRect.width * 0.75) return 'full';
  return itemRect.left + itemRect.width / 2 < gridRect.left + gridRect.width / 2 ? 'left' : 'right';
}

function getDashboardItemColumn(items: DashboardItem[], itemIndex: number): DropColumn {
  let openColumn: DropColumn = 'left';

  for (let index = 0; index <= itemIndex; index += 1) {
    const width = getVisualizationWidth(items[index]);
    if (width === 'full') {
      if (index === itemIndex) return 'full';
      openColumn = 'left';
      continue;
    }

    const column = openColumn;
    if (index === itemIndex) return column;
    openColumn = openColumn === 'left' ? 'right' : 'left';
  }

  return 'full';
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

type DragSession = {
  active: boolean;
  itemId: string;
  startX: number;
  startY: number;
  dropPosition: DropPosition | null;
};

function RenameVisualizationModal({
  item,
  isSaving,
  onClose,
  onSave,
}: {
  item: DashboardItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(item?.title || '');

  useEffect(() => {
    setTitle(item?.title || '');
  }, [item?.dashboard_item_id, item?.title]);

  return (
    <GlassModal
      open={Boolean(item)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-24 w-full max-w-md border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Rename visualization</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close rename dialog"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form
        className="space-y-4 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(title);
        }}
      >
        <label className="block text-sm font-semibold text-oracle-dark-gray" htmlFor="visualization-title">
          Visualization name
        </label>
        <input
          id="visualization-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input-oracle"
          maxLength={500}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

function RenameDashboardModal({
  dashboard,
  isSaving,
  onClose,
  onSave,
}: {
  dashboard: DashboardDetail | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(dashboard?.dashboard_name || '');

  useEffect(() => {
    setTitle(dashboard?.dashboard_name || '');
  }, [dashboard?.dashboard_id, dashboard?.dashboard_name]);

  return (
    <GlassModal
      open={Boolean(dashboard)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-24 w-full max-w-md border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Rename dashboard</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close rename dashboard dialog"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form
        className="space-y-4 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(title);
        }}
      >
        <label className="block text-sm font-semibold text-oracle-dark-gray" htmlFor="dashboard-title">
          Dashboard name
        </label>
        <input
          id="dashboard-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input-oracle"
          maxLength={255}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

function SqlModal({ item, onClose }: { item: DashboardItem | null; onClose: () => void }) {
  return (
    <GlassModal
      open={Boolean(item)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-16 flex max-h-[82vh] w-full max-w-5xl flex-col border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="truncate text-lg font-semibold text-white">Generated SQL</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close Generated SQL"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
        <pre className="max-h-[64vh] overflow-auto rounded-lg border border-[#d9d2cb] bg-white p-4 text-xs leading-5 text-oracle-dark-gray shadow-[inset_0_1px_0_rgba(49,45,42,0.03)]">
          {item?.sql || ''}
        </pre>
      </div>
    </GlassModal>
  );
}

export function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDashboardId = searchParams.get('dashboard');
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(requestedDashboardId);
  const [renameItem, setRenameItem] = useState<DashboardItem | null>(null);
  const [renameDashboard, setRenameDashboard] = useState<DashboardDetail | null>(null);
  const [deleteItem, setDeleteItem] = useState<DashboardItem | null>(null);
  const [isDeleteDashboardOpen, setIsDeleteDashboardOpen] = useState(false);
  const [sqlItem, setSqlItem] = useState<DashboardItem | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragIndicator, setDragIndicator] = useState<DropPosition | null>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const itemMenuRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.list,
    queryFn: () => dashboardsApi.list().then((response) => response.data.items),
  });

  const dashboards = dashboardsQuery.data || [];
  const firstDashboardId = dashboards[0]?.dashboard_id || null;

  useEffect(() => {
    if (requestedDashboardId) {
      setSelectedDashboardId(requestedDashboardId);
      return;
    }
    if (!selectedDashboardId && firstDashboardId) {
      setSelectedDashboardId(firstDashboardId);
    }
  }, [firstDashboardId, requestedDashboardId, selectedDashboardId]);

  const selectedDashboard = useMemo(
    () => dashboards.find((dashboard) => dashboard.dashboard_id === selectedDashboardId) || null,
    [dashboards, selectedDashboardId]
  );

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboards.detail(selectedDashboardId),
    queryFn: () => dashboardsApi.get(selectedDashboardId || '', 500).then((response) => response.data),
    enabled: Boolean(selectedDashboardId),
  });

  useEffect(() => {
    if (!isHeaderMenuOpen && !openItemMenuId) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (isHeaderMenuOpen && headerMenuRef.current && target && !headerMenuRef.current.contains(target)) {
        setIsHeaderMenuOpen(false);
      }
      if (openItemMenuId && itemMenuRef.current && target && !itemMenuRef.current.contains(target)) {
        setOpenItemMenuId(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isHeaderMenuOpen, openItemMenuId]);

  const updateItemMutation = useMutation({
    mutationFn: ({
      itemId,
      title,
      layout,
    }: {
      itemId: string;
      title?: string;
      layout?: Record<string, unknown>;
    }) => dashboardsApi.updateItem(selectedDashboardId || '', itemId, { title, layout }).then((response) => response.data),
    onSuccess: (dashboard) => {
      applyDashboardCache(queryClient, dashboard);
      setRenameItem(null);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const reorderItemsMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      dashboardsApi.reorderItems(selectedDashboardId || '', itemIds).then((response) => response.data),
    onSuccess: (dashboard) => {
      applyDashboardCache(queryClient, dashboard);
      setDraggedItemId(null);
      setDragOverItemId(null);
      setDragIndicator(null);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({
      item,
      itemIds,
      width,
    }: {
      item: DashboardItem;
      itemIds: string[] | null;
      width: VisualizationWidth;
    }) => {
      let dashboardResponse: DashboardDetail | null = null;
      if (itemIds) {
        dashboardResponse = await dashboardsApi
          .reorderItems(selectedDashboardId || '', itemIds)
          .then((response) => response.data);
      }

      if (getVisualizationWidth(item) !== width) {
        dashboardResponse = await dashboardsApi
          .updateItem(selectedDashboardId || '', item.dashboard_item_id, {
            layout: {
              ...(item.layout || {}),
              width,
            },
          })
          .then((response) => response.data);
      }

      return dashboardResponse || dashboard;
    },
    onSuccess: (nextDashboard) => {
      if (nextDashboard) applyDashboardCache(queryClient, nextDashboard);
      setDraggedItemId(null);
      setDragOverItemId(null);
      setDragIndicator(null);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const updateDashboardMutation = useMutation({
    mutationFn: ({ dashboardId, name }: { dashboardId: string; name: string }) =>
      dashboardsApi.update(dashboardId, { name }).then((response) => response.data),
    onSuccess: (dashboard) => {
      applyDashboardCache(queryClient, dashboard);
      setRenameDashboard(null);
      showToast('Dashboard renamed.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ dashboardId, itemId }: { dashboardId: string; itemId: string }) =>
      dashboardsApi.deleteItem(dashboardId, itemId).then((response) => response.data),
    onSuccess: (dashboard) => {
      applyDashboardCache(queryClient, dashboard);
      setDeleteItem(null);
      setOpenItemMenuId(null);
      showToast('Visualization deleted.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: (dashboardId: string) => dashboardsApi.delete(dashboardId).then((response) => response.data),
    onSuccess: ({ dashboard_id: deletedDashboardId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list });
      queryClient.removeQueries({ queryKey: queryKeys.dashboards.detail(deletedDashboardId) });
      const nextDashboardId = dashboards.find((item) => item.dashboard_id !== deletedDashboardId)?.dashboard_id || null;
      setSelectedDashboardId(nextDashboardId);
      setSearchParams(nextDashboardId ? { dashboard: nextDashboardId } : {});
      setIsDeleteDashboardOpen(false);
      setIsHeaderMenuOpen(false);
      showToast('Dashboard deleted.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const dashboard = dashboardQuery.data || null;
  const dashboardItems = dashboard?.items || [];

  const resetDragState = () => {
    dragSessionRef.current = null;
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDragIndicator(null);
  };

  const selectDashboard = (dashboardId: string) => {
    resetDragState();
    setSelectedDashboardId(dashboardId);
    setSearchParams({ dashboard: dashboardId });
  };

  const moveItemToDropPosition = (itemId: string, dropPosition: DropPosition) => {
    if (dropPosition.insertionIndex === null) return;
    const itemIds = dashboardItems.map((item) => item.dashboard_item_id);
    const currentIndex = itemIds.indexOf(itemId);
    const item = dashboardItems[currentIndex];
    if (currentIndex < 0 || !item || moveItemMutation.isPending) return;
    const nextItemIds = itemIds.filter((id) => id !== itemId);
    const nextIndex = Math.max(
      0,
      Math.min(
        dropPosition.insertionIndex > currentIndex ? dropPosition.insertionIndex - 1 : dropPosition.insertionIndex,
        nextItemIds.length
      )
    );
    nextItemIds.splice(nextIndex, 0, itemId);

    const orderChanged = nextItemIds.some((id, index) => id !== itemIds[index]);
    const widthChanged = getVisualizationWidth(item) !== dropPosition.width;
    if (!orderChanged && !widthChanged) return;

    moveItemMutation.mutate({
      item,
      itemIds: orderChanged ? nextItemIds : null,
      width: dropPosition.width,
    });
  };

  const getDropPositionAtPoint = (clientX: number, clientY: number): DropPosition => {
    const gridElement = document.querySelector<HTMLElement>('[data-dashboard-grid="true"]');
    const itemElements = gridElement
      ? Array.from(gridElement.querySelectorAll<HTMLElement>('[data-dashboard-item-id]'))
      : [];
    const elementAtPoint = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const dropZoneElement = elementAtPoint?.closest<HTMLElement>('[data-dashboard-drop-zone-target-id]');
    if (dropZoneElement && gridElement) {
      const dropZoneTargetId = dropZoneElement.dataset.dashboardDropZoneTargetId || null;
      const dropZoneTargetIndex = dropZoneTargetId
        ? dashboardItems.findIndex((item) => item.dashboard_item_id === dropZoneTargetId)
        : -1;
      const dropZoneTargetElement = itemElements.find(
        (element) => element.dataset.dashboardItemId === dropZoneTargetId
      );

      if (dropZoneTargetId && dropZoneTargetIndex >= 0) {
        return {
          targetItemId: dropZoneTargetId,
          targetIndex: dropZoneTargetIndex,
          insertionIndex: dropZoneTargetIndex + 1,
          width: 'half' as const,
          placement: 'after' as const,
          targetColumn: dropZoneTargetElement
            ? getElementDropColumn(dropZoneTargetElement, gridElement)
            : ('left' as const),
        };
      }
    }

    const itemElement = elementAtPoint?.closest<HTMLElement>('[data-dashboard-item-id]');
    let targetItemId = itemElement?.dataset.dashboardItemId || null;
    let targetIndex = targetItemId
      ? dashboardItems.findIndex((item) => item.dashboard_item_id === targetItemId)
      : -1;

    if (!itemElement || !targetItemId || targetIndex < 0) {
      if (!gridElement || itemElements.length === 0) {
        return {
          targetItemId: null,
          targetIndex: null,
          insertionIndex: null,
          width: 'full' as const,
          placement: 'before' as const,
          targetColumn: 'full' as const,
        };
      }

      const gridRect = gridElement.getBoundingClientRect();
      const isNearGrid =
        clientX >= gridRect.left - 32 &&
        clientX <= gridRect.right + 32 &&
        clientY >= gridRect.top - 56 &&
        clientY <= gridRect.bottom + 56;

      if (!isNearGrid) {
        return {
          targetItemId: null,
          targetIndex: null,
          insertionIndex: null,
          width: 'full' as const,
          placement: 'before' as const,
          targetColumn: 'full' as const,
        };
      }

      const firstElement = itemElements[0];
      const lastElement = itemElements[itemElements.length - 1];
      const firstRect = firstElement.getBoundingClientRect();
      const lastRect = lastElement.getBoundingClientRect();
      const columnCount = getComputedStyle(gridElement).gridTemplateColumns.split(' ').filter(Boolean).length;

      if (columnCount > 1) {
        const activeDragItemId = dragSessionRef.current?.itemId || null;
        const halfItemElements = itemElements.filter((candidate) => {
          const candidateRect = candidate.getBoundingClientRect();
          return (
            candidate.dataset.dashboardItemId !== activeDragItemId &&
            candidateRect.width < gridRect.width * 0.75 &&
            clientY >= candidateRect.top &&
            clientY <= candidateRect.bottom
          );
        });
        const rowElement = halfItemElements.find((candidate) => {
          const candidateRect = candidate.getBoundingClientRect();
          const candidateColumn = getElementDropColumn(candidate, gridElement);
          const hasRowPartner = itemElements.some((other) => {
            if (other === candidate || other.dataset.dashboardItemId === activeDragItemId) return false;
            const otherRect = other.getBoundingClientRect();
            if (otherRect.width >= gridRect.width * 0.75) return false;
            const overlap = Math.min(candidateRect.bottom, otherRect.bottom) - Math.max(candidateRect.top, otherRect.top);
            return overlap > Math.min(candidateRect.height, otherRect.height) * 0.45;
          });

          if (hasRowPartner) return false;
          return candidateColumn === 'left'
            ? clientX > candidateRect.right && clientX <= gridRect.right + 32
            : clientX < candidateRect.left && clientX >= gridRect.left - 32;
        });

        if (rowElement) {
          const rowItemId = rowElement.dataset.dashboardItemId || null;
          const rowItemIndex = rowItemId
            ? dashboardItems.findIndex((item) => item.dashboard_item_id === rowItemId)
            : -1;
          const rowRect = rowElement.getBoundingClientRect();
          const rowColumn = getElementDropColumn(rowElement, gridElement);

          if (rowItemId && rowItemIndex >= 0 && rowColumn === 'left' && clientX > rowRect.right && clientX <= gridRect.right + 32) {
            return {
              targetItemId: rowItemId,
              targetIndex: rowItemIndex,
              insertionIndex: rowItemIndex + 1,
              width: 'half' as const,
              placement: 'after' as const,
              targetColumn: rowColumn,
            };
          }

          if (rowItemId && rowItemIndex >= 0 && rowColumn === 'right' && clientX < rowRect.left && clientX >= gridRect.left - 32) {
            return {
              targetItemId: rowItemId,
              targetIndex: rowItemIndex,
              insertionIndex: rowItemIndex,
              width: 'half' as const,
              placement: 'before' as const,
              targetColumn: rowColumn,
            };
          }
        }
      }

      if (clientY < firstRect.top) {
        targetItemId = firstElement.dataset.dashboardItemId || null;
        targetIndex = 0;
        return {
          targetItemId,
          targetIndex,
          insertionIndex: 0,
          width: 'full' as const,
          placement: 'before' as const,
          targetColumn: getElementDropColumn(firstElement, gridElement),
        };
      }

      if (clientY > lastRect.bottom) {
        targetItemId = lastElement.dataset.dashboardItemId || null;
        targetIndex = dashboardItems.length - 1;
        return {
          targetItemId,
          targetIndex,
          insertionIndex: dashboardItems.length,
          width: 'full' as const,
          placement: 'after' as const,
          targetColumn: getElementDropColumn(lastElement, gridElement),
        };
      }

      const nearestElement = itemElements.reduce((nearest, candidate) => {
        const nearestRect = nearest.getBoundingClientRect();
        const candidateRect = candidate.getBoundingClientRect();
        const nearestDistance = Math.abs(clientY - (nearestRect.top + nearestRect.height / 2));
        const candidateDistance = Math.abs(clientY - (candidateRect.top + candidateRect.height / 2));
        return candidateDistance < nearestDistance ? candidate : nearest;
      }, itemElements[0]);
      const nearestId = nearestElement.dataset.dashboardItemId || null;
      const nearestIndex = nearestId
        ? dashboardItems.findIndex((item) => item.dashboard_item_id === nearestId)
        : -1;

      if (!nearestId || nearestIndex < 0) {
        return {
          targetItemId: null,
          targetIndex: null,
          insertionIndex: null,
          width: 'full' as const,
          placement: 'before' as const,
          targetColumn: 'full' as const,
        };
      }

      const nearestRect = nearestElement.getBoundingClientRect();
      const placement: DropPlacement = clientY < nearestRect.top + nearestRect.height / 2 ? 'before' : 'after';
      return {
        targetItemId: nearestId,
        targetIndex: nearestIndex,
        insertionIndex: nearestIndex + (placement === 'before' ? 0 : 1),
        width: 'full' as const,
        placement,
        targetColumn: getElementDropColumn(nearestElement, gridElement),
      };
    }

    const rect = itemElement.getBoundingClientRect();
    const targetGridElement = itemElement.parentElement;
    const columnCount = targetGridElement
      ? getComputedStyle(targetGridElement).gridTemplateColumns.split(' ').filter(Boolean).length
      : 2;
    const targetColumn = getElementDropColumn(itemElement, targetGridElement);

    const verticalRatio = (clientY - rect.top) / Math.max(rect.height, 1);
    if (verticalRatio < 0.24) {
      return {
        targetItemId,
        targetIndex,
        insertionIndex: targetIndex,
        width: 'full' as const,
        placement: 'before' as const,
        targetColumn,
      };
    }
    if (verticalRatio > 0.76) {
      return {
        targetItemId,
        targetIndex,
        insertionIndex: targetIndex + 1,
        width: 'full' as const,
        placement: 'after' as const,
        targetColumn,
      };
    }

    const isBeforeTarget =
      columnCount <= 1 ? clientY < rect.top + rect.height / 2 : clientX < rect.left + rect.width / 2;
    const placement: DropPlacement = isBeforeTarget ? 'before' : 'after';

    return {
      targetItemId,
      targetIndex,
      insertionIndex: targetIndex + (isBeforeTarget ? 0 : 1),
      width: 'half' as const,
      placement,
      targetColumn,
    };
  };

  const handleCardMouseDown = (
    event: ReactMouseEvent<HTMLElement>,
    itemId: string,
    disabled: boolean
  ) => {
    if (event.button !== 0 || disabled || isDragBlockedTarget(event.target)) return;
    event.preventDefault();
    setOpenItemMenuId(null);
    dragSessionRef.current = {
      active: false,
      itemId,
      startX: event.clientX,
      startY: event.clientY,
      dropPosition: null,
    };
  };

  const updateDragSession = (event: MouseEvent) => {
    const session = dragSessionRef.current;
    if (!session || reorderItemsMutation.isPending || moveItemMutation.isPending) return;

    const movedX = event.clientX - session.startX;
    const movedY = event.clientY - session.startY;
    if (!session.active && Math.hypot(movedX, movedY) < 6) return;

    event.preventDefault();
    if (!session.active) {
      session.active = true;
      setDraggedItemId(session.itemId);
    }

    const dropPosition = getDropPositionAtPoint(event.clientX, event.clientY);
    session.dropPosition = dropPosition;
    setDragOverItemId(dropPosition.targetItemId);
    setDragIndicator(dropPosition.insertionIndex === null ? null : dropPosition);
  };

  const finishDragSession = (event: MouseEvent) => {
    const session = dragSessionRef.current;
    if (!session) return;

    if (session.active && session.dropPosition && session.dropPosition.insertionIndex !== null) {
      event.preventDefault();
      moveItemToDropPosition(session.itemId, session.dropPosition);
    }

    resetDragState();
  };

  useEffect(() => {
    document.addEventListener('mousemove', updateDragSession);
    document.addEventListener('mouseup', finishDragSession);
    return () => {
      document.removeEventListener('mousemove', updateDragSession);
      document.removeEventListener('mouseup', finishDragSession);
    };
  });

  const dashboardTabs =
    dashboards.length > 0 ? (
      <nav
        className="border-t border-oracle-border bg-[#fffdfb]"
        aria-label="Analytics dashboards"
      >
        <div className="flex overflow-x-auto" role="tablist" aria-label="Available dashboards">
          {dashboards.map((dashboardSummary) => {
            const isSelected = dashboardSummary.dashboard_id === selectedDashboardId;
            return (
              <button
                key={dashboardSummary.dashboard_id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`inline-flex min-w-[12rem] max-w-[18rem] shrink-0 flex-col border border-l-0 border-t-0 px-3 py-2 text-left transition-colors first:border-l ${
                  isSelected
                    ? 'border-oracle-red bg-oracle-red text-white shadow-[0_10px_24px_rgba(199,70,52,0.18)]'
                    : 'border-oracle-border bg-white text-oracle-dark-gray hover:border-oracle-red/50 hover:text-oracle-red'
                }`}
                onClick={() => selectDashboard(dashboardSummary.dashboard_id)}
              >
                <span className="truncate text-sm font-semibold">{dashboardSummary.dashboard_name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    ) : null;

  const renderDashboardHeader = (title: string) => (
    <div
      className={`chat-conversation-header flex shrink-0 items-center gap-3 border-b border-oracle-border bg-gray-50 px-4 py-3 ${
        isHeaderMenuOpen ? 'chat-conversation-header--menu-open' : ''
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
        <span className="text-sm font-bold text-white">AI</span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-oracle-dark-gray" title={title}>
          {title}
        </h1>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-oracle-light-gray">Select AI Analytics</span>
        </div>
      </div>
      <div className="relative ml-auto" ref={headerMenuRef}>
        <button
          type="button"
          className="rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5"
          aria-label="Dashboard actions"
          aria-haspopup="menu"
          aria-expanded={isHeaderMenuOpen}
          title="Dashboard actions"
          onClick={() => setIsHeaderMenuOpen((current) => !current)}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
          </svg>
        </button>
        {isHeaderMenuOpen && (
          <div
            className="chat-header-actions-menu absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
            role="menu"
            aria-label="Dashboard actions"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!dashboard || updateDashboardMutation.isPending || deleteDashboardMutation.isPending}
              onClick={() => {
                if (!dashboard) return;
                setRenameDashboard(dashboard);
                setIsHeaderMenuOpen(false);
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!dashboard || deleteDashboardMutation.isPending}
              onClick={() => {
                setIsDeleteDashboardOpen(true);
                setIsHeaderMenuOpen(false);
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12h6l1-12M10 11v6m4-6v6" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout contentContainerClassName="h-[calc(100vh-90px)] max-w-none px-0 py-0">
      <div className="h-full">
        {dashboardsQuery.isLoading ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader('Analytics dashboards')}
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <LoadingState label="Loading analytics..." textClassName="text-oracle-medium-gray" />
            </div>
          </section>
        ) : dashboards.length === 0 ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader('Analytics dashboards')}
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-oracle-medium-gray">
              Generate a dashboard from selected chat visualizations.
            </div>
          </section>
        ) : !selectedDashboardId ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader('Analytics dashboards')}
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-oracle-medium-gray">
              Select a dashboard.
            </div>
            {dashboardTabs}
          </section>
        ) : dashboardQuery.isLoading ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader(selectedDashboard?.dashboard_name || 'Loading dashboard')}
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <LoadingState label="Loading dashboard..." textClassName="text-oracle-medium-gray" />
            </div>
            {dashboardTabs}
          </section>
        ) : dashboardQuery.isError ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader(selectedDashboard?.dashboard_name || 'Analytics dashboard')}
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load dashboard.
            </div>
            {dashboardTabs}
          </section>
        ) : dashboard ? (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader(dashboard.dashboard_name)}
              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f1ed] p-4 sm:p-5">
                {dashboardItems.length === 0 ? (
                  <div className="rounded-lg border border-oracle-border bg-white px-6 py-12 text-center text-sm text-oracle-medium-gray">
                    No visualizations are available in this dashboard.
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-4 md:grid-cols-2" data-dashboard-grid="true">
                    {dashboardItems.map((item, itemIndex) => {
                      const isBusy =
                        updateItemMutation.isPending ||
                        deleteItemMutation.isPending ||
                        reorderItemsMutation.isPending ||
                        moveItemMutation.isPending;
                      const isDragging = draggedItemId === item.dashboard_item_id;
                      const visualizationWidth = getVisualizationWidth(item);
                      const visualizationColumn = getDashboardItemColumn(dashboardItems, itemIndex);
                      const nextDashboardItem = dashboardItems[itemIndex + 1] || null;
                      const showTrailingHalfDropZone =
                        Boolean(draggedItemId) &&
                        !isDragging &&
                        visualizationWidth === 'half' &&
                        visualizationColumn === 'left' &&
                        (!nextDashboardItem || getVisualizationWidth(nextDashboardItem) === 'full');
                      const draggedItemIndex = draggedItemId
                        ? dashboardItems.findIndex((dashboardItem) => dashboardItem.dashboard_item_id === draggedItemId)
                        : -1;
                      const draggedItem = draggedItemIndex >= 0 ? dashboardItems[draggedItemIndex] : null;
                      const isNoopInsertion =
                        dragIndicator?.insertionIndex !== null &&
                        dragIndicator?.insertionIndex !== undefined &&
                        draggedItemIndex >= 0 &&
                        (dragIndicator.insertionIndex === draggedItemIndex ||
                          dragIndicator.insertionIndex === draggedItemIndex + 1) &&
                        draggedItem !== null &&
                        dragIndicator.width === getVisualizationWidth(draggedItem);
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
                        <Fragment key={item.dashboard_item_id}>
                        <article
                          data-testid="analytics-visualization-card"
                          data-dashboard-item-id={item.dashboard_item_id}
                          aria-grabbed={isDragging}
                          className={`relative min-w-0 cursor-grab overflow-visible rounded-lg border bg-white p-4 shadow-sm transition-[border-color,background-color,box-shadow,opacity,transform] hover:border-oracle-red/40 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oracle-red/40 ${
                            isDropTarget
                              ? 'border-oracle-red bg-[#fff7f5] shadow-lg ring-2 ring-oracle-red/30'
                              : 'border-oracle-border'
                          } ${visualizationWidth === 'full' ? 'md:col-span-2' : ''} ${
                            isDragging ? 'scale-[0.99] select-none opacity-60' : ''
                          } ${isBusy ? 'cursor-default opacity-70' : ''}`}
                          tabIndex={0}
                          title="Drag to move visualization"
                          onMouseDown={(event) => handleCardMouseDown(event, item.dashboard_item_id, isBusy)}
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
                                  disabled={isBusy}
                                  onClick={() => {
                                    setOpenItemMenuId((current) =>
                                      current === item.dashboard_item_id ? null : item.dashboard_item_id
                                    );
                                  }}
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
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
                                      onClick={() => {
                                        setSqlItem(item);
                                        setOpenItemMenuId(null);
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      SQL
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={updateItemMutation.isPending}
                                      onClick={() => {
                                        setRenameItem(item);
                                        setOpenItemMenuId(null);
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Rename
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={deleteItemMutation.isPending}
                                      onClick={() => {
                                        setDeleteItem(item);
                                        setOpenItemMenuId(null);
                                      }}
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12h6l1-12M10 11v6m4-6v6" />
                                      </svg>
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {item.chart_spec?.type === 'metric' && item.rows.length > 0 ? (
                            <div
                              data-no-card-drag="true"
                              className="cursor-auto rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-5 shadow-sm"
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oracle-light-gray">
                                {getMetricLabel(item)}
                              </p>
                              <p className="mt-2 text-4xl font-semibold text-oracle-dark-gray">
                                {formatCellValue(item.rows[0][item.columns[0]])}
                              </p>
                            </div>
                          ) : (
                            <div data-no-card-drag="true" className="cursor-auto">
                              <ChartPreview spec={item.chart_spec} columns={item.columns} rows={item.rows} />
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
                    })}
                  </div>
                )}
              </div>
              {dashboardTabs}
          </section>
        ) : (
          <section className="app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md">
            {renderDashboardHeader(selectedDashboard?.dashboard_name || 'Analytics dashboard')}
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-oracle-medium-gray">
              {selectedDashboard?.dashboard_name || 'Dashboard'} was not found.
            </div>
            {dashboardTabs}
          </section>
        )}
      </div>

      <RenameVisualizationModal
        item={renameItem}
        isSaving={updateItemMutation.isPending}
        onClose={() => setRenameItem(null)}
        onSave={(title) => {
          if (!renameItem) return;
          updateItemMutation.mutate({ itemId: renameItem.dashboard_item_id, title: title.trim() });
        }}
      />
      <RenameDashboardModal
        dashboard={renameDashboard}
        isSaving={updateDashboardMutation.isPending}
        onClose={() => setRenameDashboard(null)}
        onSave={(title) => {
          if (!renameDashboard) return;
          updateDashboardMutation.mutate({ dashboardId: renameDashboard.dashboard_id, name: title.trim() });
        }}
      />
      {deleteItem && (
        <ConfirmDeleteModal
          title="Delete visualization"
          message={
            <span>
              Delete <strong>{deleteItem.title}</strong> from this dashboard?
            </span>
          }
          detail="This does not delete the original chat response."
          loading={deleteItemMutation.isPending}
          onCancel={() => setDeleteItem(null)}
          onConfirm={() => {
            if (!selectedDashboardId || !deleteItem) return;
            deleteItemMutation.mutate({ dashboardId: selectedDashboardId, itemId: deleteItem.dashboard_item_id });
          }}
        />
      )}
      {isDeleteDashboardOpen && dashboard && (
        <ConfirmDeleteModal
          title="Delete dashboard"
          message={
            <span>
              Delete <strong>{dashboard.dashboard_name}</strong>?
            </span>
          }
          detail="The dashboard will be removed from Analytics."
          loading={deleteDashboardMutation.isPending}
          onCancel={() => setIsDeleteDashboardOpen(false)}
          onConfirm={() => deleteDashboardMutation.mutate(dashboard.dashboard_id)}
        />
      )}
      <SqlModal item={sqlItem} onClose={() => setSqlItem(null)} />
    </Layout>
  );
}
