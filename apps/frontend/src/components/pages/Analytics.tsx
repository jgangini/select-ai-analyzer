import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import {
  dashboardsApi,
  dashboardsQueryKeys,
  getDashboardErrorMessage,
  type DashboardDetail,
  type DashboardItem,
  type DashboardVisibility,
} from '../../services/dashboardsApi';
import {
  getDashboardItemColumn,
  getDashboardItemMoveUpdate,
  getDropPositionAtPoint,
  getVisualizationWidth,
  isDragBlockedTarget,
  type DashboardItemMoveUpdate,
  type DropPosition,
} from './analytics/dashboardDropPosition';
import { ChartPreview } from './analytics/AnalyticsChartPreview';
import {
  DeleteDashboardModal,
  DeleteVisualizationModal,
  RenameDashboardModal,
  RenameVisualizationModal,
  SqlModal,
} from './analytics/AnalyticsDashboardModals';
import { AnalyticsDashboardHeader, AnalyticsDashboardTabs } from './analytics/AnalyticsDashboardHeader';
import { AnalyticsDashboardSurface } from './analytics/AnalyticsDashboardSurface';
import { AnalyticsVisualizationCard } from './analytics/AnalyticsVisualizationCard';

function applyDashboardCache(queryClient: ReturnType<typeof useQueryClient>, dashboard: DashboardDetail) {
  queryClient.setQueryData(dashboardsQueryKeys.detail(dashboard.dashboard_id), dashboard);
  queryClient.invalidateQueries({ queryKey: dashboardsQueryKeys.list });
  queryClient.invalidateQueries({ queryKey: dashboardsQueryKeys.ownerList });
}

function renderDashboardChartPreview(item: DashboardItem) {
  return <ChartPreview spec={item.chart_spec} columns={item.columns} rows={item.rows} />;
}

type DragSession = {
  active: boolean;
  itemId: string;
  startX: number;
  startY: number;
  dropPosition: DropPosition | null;
};

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

export function Analytics({
  currentUserId = 0,
  showToast,
}: {
  currentUserId?: number;
  showToast: ShowToast;
}) {
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

  const dashboardsQuery = useQuery({
    queryKey: dashboardsQueryKeys.list,
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

  function resetDragState() {
    dragSessionRef.current = null;
    setDraggedItemId(null);
    setDragOverItemId(null);
    setDragIndicator(null);
  }

  function closeItemMenu() {
    setOpenItemMenuId(null);
  }

  const dashboardQuery = useQuery({
    queryKey: dashboardsQueryKeys.detail(selectedDashboardId),
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
    onError: (error) => showToast(getDashboardErrorMessage(error), 'error'),
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ item, itemIds, width }: DashboardItemMoveUpdate) => {
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
      resetDragState();
    },
    onError: (error) => showToast(getDashboardErrorMessage(error), 'error'),
  });

  const updateDashboardMutation = useMutation({
    mutationFn: ({
      dashboardId,
      name,
      visibility,
    }: {
      dashboardId: string;
      name?: string;
      visibility?: DashboardVisibility;
    }) => dashboardsApi.update(dashboardId, { name, visibility }).then((response) => response.data),
    onSuccess: (dashboard, variables) => {
      applyDashboardCache(queryClient, dashboard);
      if (variables.name) {
        setRenameDashboard(null);
        showToast('Dashboard renamed.', 'success');
      } else if (variables.visibility) {
        showToast(variables.visibility === 'shared' ? 'Dashboard shared.' : 'Dashboard set to private.', 'success');
      }
    },
    onError: (error) => showToast(getDashboardErrorMessage(error), 'error'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ dashboardId, itemId }: { dashboardId: string; itemId: string }) =>
      dashboardsApi.deleteItem(dashboardId, itemId).then((response) => response.data),
    onSuccess: (dashboard) => {
      applyDashboardCache(queryClient, dashboard);
      setDeleteItem(null);
      closeItemMenu();
      showToast('Visualization deleted.', 'success');
    },
    onError: (error) => showToast(getDashboardErrorMessage(error), 'error'),
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: (dashboardId: string) => dashboardsApi.delete(dashboardId).then((response) => response.data),
    onSuccess: ({ dashboard_id: deletedDashboardId }) => {
      queryClient.invalidateQueries({ queryKey: dashboardsQueryKeys.list });
      queryClient.invalidateQueries({ queryKey: dashboardsQueryKeys.ownerList });
      queryClient.removeQueries({ queryKey: dashboardsQueryKeys.detail(deletedDashboardId) });
      const nextDashboardId = dashboards.find((item) => item.dashboard_id !== deletedDashboardId)?.dashboard_id || null;
      setSelectedDashboardId(nextDashboardId);
      setSearchParams(nextDashboardId ? { dashboard: nextDashboardId } : {});
      setIsDeleteDashboardOpen(false);
      setIsHeaderMenuOpen(false);
      showToast('Dashboard deleted.', 'success');
    },
    onError: (error) => showToast(getDashboardErrorMessage(error), 'error'),
  });

  const dashboard = dashboardQuery.data || null;
  const dashboardItems = dashboard?.items || [];
  const draggedItemIndex = draggedItemId
    ? dashboardItems.findIndex((dashboardItem) => dashboardItem.dashboard_item_id === draggedItemId)
    : -1;
  const draggedItem = draggedItemIndex >= 0 ? dashboardItems[draggedItemIndex] : null;
  const draggedItemWidth = draggedItem ? getVisualizationWidth(draggedItem) : null;
  const canManageDashboard = Boolean(
    dashboard && (currentUserId === 0 || dashboard.created_by_user_id === currentUserId)
  );
  const isVisualizationMutating =
    updateItemMutation.isPending ||
    deleteItemMutation.isPending ||
    moveItemMutation.isPending;

  const selectDashboard = (dashboardId: string) => {
    resetDragState();
    setSelectedDashboardId(dashboardId);
    setSearchParams({ dashboard: dashboardId });
  };

  const moveItemToDropPosition = (itemId: string, dropPosition: DropPosition) => {
    if (moveItemMutation.isPending) return;
    const moveUpdate = getDashboardItemMoveUpdate(dashboardItems, itemId, dropPosition);
    if (!moveUpdate) return;
    moveItemMutation.mutate(moveUpdate);
  };

  const handleCardMouseDown = (
    event: ReactMouseEvent<HTMLElement>,
    itemId: string,
    disabled: boolean
  ) => {
    if (event.button !== 0 || disabled || isDragBlockedTarget(event.target)) return;
    event.preventDefault();
    closeItemMenu();
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
    if (!session || moveItemMutation.isPending) return;

    const movedX = event.clientX - session.startX;
    const movedY = event.clientY - session.startY;
    if (!session.active && Math.hypot(movedX, movedY) < 6) return;

    event.preventDefault();
    if (!session.active) {
      session.active = true;
      setDraggedItemId(session.itemId);
    }

    const dropPosition = getDropPositionAtPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      dashboardItems,
      activeDragItemId: session.itemId,
    });
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

  const dashboardTabs = (
    <AnalyticsDashboardTabs
      dashboards={dashboards}
      selectedDashboardId={selectedDashboardId}
      onSelect={selectDashboard}
    />
  );

  const renderDashboardHeader = (title: string) => (
    <AnalyticsDashboardHeader
      title={title}
      dashboard={dashboard}
      isMenuOpen={isHeaderMenuOpen}
      menuRef={headerMenuRef}
      canManageDashboard={canManageDashboard}
      isUpdatePending={updateDashboardMutation.isPending}
      isDeletePending={deleteDashboardMutation.isPending}
      onToggleMenu={() => setIsHeaderMenuOpen((current) => !current)}
      onRename={(selectedDashboard) => {
        setRenameDashboard(selectedDashboard);
        setIsHeaderMenuOpen(false);
      }}
      onVisibilityChange={(dashboardId, visibility) => {
        updateDashboardMutation.mutate({ dashboardId, visibility });
        setIsHeaderMenuOpen(false);
      }}
      onDelete={() => {
        setIsDeleteDashboardOpen(true);
        setIsHeaderMenuOpen(false);
      }}
    />
  );

  const dashboardItemsContent = (
    <div className="grid min-w-0 gap-4 md:grid-cols-2" data-dashboard-grid="true">
      {dashboardItems.map((item, itemIndex) => (
        <AnalyticsVisualizationCard
          key={item.dashboard_item_id}
          item={item}
          itemIndex={itemIndex}
          visualizationWidth={getVisualizationWidth(item)}
          visualizationColumn={getDashboardItemColumn(dashboardItems, itemIndex)}
          nextVisualizationWidth={
            dashboardItems[itemIndex + 1] ? getVisualizationWidth(dashboardItems[itemIndex + 1]) : null
          }
          draggedItemIndex={draggedItemIndex}
          draggedItemWidth={draggedItemWidth}
          canManageDashboard={canManageDashboard}
          isMutating={isVisualizationMutating}
          isUpdatePending={updateItemMutation.isPending}
          isDeletePending={deleteItemMutation.isPending}
          draggedItemId={draggedItemId}
          dragOverItemId={dragOverItemId}
          dragIndicator={dragIndicator}
          openItemMenuId={openItemMenuId}
          itemMenuRef={itemMenuRef}
          onCardMouseDown={handleCardMouseDown}
          onToggleMenu={(itemId) =>
            setOpenItemMenuId((current) => (current === itemId ? null : itemId))
          }
          onViewSql={(selectedItem) => {
            setSqlItem(selectedItem);
            closeItemMenu();
          }}
          onRename={(selectedItem) => {
            setRenameItem(selectedItem);
            closeItemMenu();
          }}
          onDelete={(selectedItem) => {
            setDeleteItem(selectedItem);
            closeItemMenu();
          }}
          renderChartPreview={renderDashboardChartPreview}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="h-full">
        <AnalyticsDashboardSurface
          dashboardError={dashboardQuery.isError}
          dashboardItemsContent={dashboardItemsContent}
          dashboardItemsEmpty={dashboardItems.length === 0}
          dashboardLoaded={Boolean(dashboard)}
          dashboardLoading={dashboardQuery.isLoading}
          dashboardName={dashboard?.dashboard_name || null}
          dashboardsEmpty={dashboards.length === 0}
          dashboardsLoading={dashboardsQuery.isLoading}
          emptyDashboardHeader={renderDashboardHeader('Analytics dashboards')}
          headerForTitle={renderDashboardHeader}
          selectedDashboardId={selectedDashboardId}
          selectedDashboardName={selectedDashboard?.dashboard_name || null}
          tabs={dashboardTabs}
        />
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
      <DeleteVisualizationModal
        item={deleteItem}
        isDeleting={deleteItemMutation.isPending}
        onCancel={() => setDeleteItem(null)}
        onConfirm={() => {
          if (!selectedDashboardId || !deleteItem) return;
          deleteItemMutation.mutate({ dashboardId: selectedDashboardId, itemId: deleteItem.dashboard_item_id });
        }}
      />
      <DeleteDashboardModal
        dashboard={dashboard}
        isDeleting={deleteDashboardMutation.isPending}
        open={isDeleteDashboardOpen}
        onCancel={() => setIsDeleteDashboardOpen(false)}
        onConfirm={() => {
          if (dashboard) deleteDashboardMutation.mutate(dashboard.dashboard_id);
        }}
      />
      <SqlModal item={sqlItem} onClose={() => setSqlItem(null)} />
    </>
  );
}
