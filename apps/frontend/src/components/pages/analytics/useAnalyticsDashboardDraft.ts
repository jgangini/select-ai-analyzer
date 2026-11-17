import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { getAnalyticsErrorMessage, getDefaultDashboardName } from './analyticsChatPanelUtils';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type ApiResponse<T> = Promise<{ data: T }>;
type DashboardTargetMode = 'new' | 'existing';
type AddDashboardStep = 'target' | 'details';
type DashboardVisibility = 'private' | 'shared';
type DashboardChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};
type DashboardVisualizationPayload = {
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  chart_spec: DashboardChartSpec;
  layout?: Record<string, unknown>;
};
type DashboardDraftItem = DashboardVisualizationPayload & {
  draft_id: string;
};
type DashboardSummary = {
  dashboard_id: string;
  dashboard_name: string;
  visibility: DashboardVisibility;
};
type DashboardDetail = {
  dashboard_id: string;
};
type CreateDashboardPayload = {
  name: string;
  description?: string;
  visibility?: DashboardVisibility;
  items: DashboardVisualizationPayload[];
};
type AddDashboardItemsPayload = {
  items: DashboardVisualizationPayload[];
};

type DashboardsClient = {
  list: (limit?: number, ownerOnly?: boolean) => ApiResponse<{ items: DashboardSummary[] }>;
  create: (payload: CreateDashboardPayload) => ApiResponse<DashboardDetail>;
  addItems: (dashboardId: string, payload: AddDashboardItemsPayload) => ApiResponse<DashboardDetail>;
};

const dashboardQueryKeys = {
  list: ['dashboards', 'list'] as const,
  ownerList: ['dashboards', 'list', 'owner'] as const,
  detail: (dashboardId: string | null) => ['dashboards', 'detail', dashboardId] as const,
};

function useDashboardDraftTarget(defaultDashboardName: string) {
  const [dashboardDraftItems, setDashboardDraftItems] = useState<DashboardDraftItem[]>([]);
  const [isDashboardTrayOpen, setIsDashboardTrayOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardVisibility, setDashboardVisibility] = useState<DashboardVisibility>('private');
  const [dashboardTargetMode, setDashboardTargetMode] = useState<DashboardTargetMode>('new');
  const [dashboardTargetId, setDashboardTargetId] = useState('');
  const [pendingDashboardItem, setPendingDashboardItem] = useState<DashboardDraftItem | null>(null);
  const [addDashboardStep, setAddDashboardStep] = useState<AddDashboardStep>('target');
  const [addDashboardMode, setAddDashboardMode] = useState<DashboardTargetMode>('new');
  const [addDashboardId, setAddDashboardId] = useState('');
  const [addDashboardName, setAddDashboardName] = useState('');
  const [addDashboardVisibility, setAddDashboardVisibility] = useState<DashboardVisibility>('private');

  const openAddVisualizationModal = useCallback(
    (item: DashboardDraftItem) => {
      setPendingDashboardItem(item);
      setAddDashboardStep('target');
      setAddDashboardMode(dashboardTargetMode);
      setAddDashboardId(dashboardTargetId);
      setAddDashboardName(dashboardTargetMode === 'new' ? dashboardName.trim() || defaultDashboardName : defaultDashboardName);
      setAddDashboardVisibility(dashboardVisibility);
    },
    [dashboardName, dashboardTargetId, dashboardTargetMode, dashboardVisibility, defaultDashboardName]
  );

  return {
    addDashboardId,
    addDashboardMode,
    addDashboardName,
    addDashboardStep,
    addDashboardVisibility,
    dashboardDraftItems,
    dashboardName,
    dashboardTargetId,
    dashboardTargetMode,
    dashboardVisibility,
    isDashboardTrayOpen,
    openAddVisualizationModal,
    pendingDashboardItem,
    setAddDashboardId,
    setAddDashboardMode,
    setAddDashboardName,
    setAddDashboardStep,
    setAddDashboardVisibility,
    setDashboardDraftItems,
    setDashboardName,
    setDashboardTargetId,
    setDashboardTargetMode,
    setDashboardVisibility,
    setIsDashboardTrayOpen,
    setPendingDashboardItem,
  };
}

function useDashboardSave({
  conversationTitle,
  dashboardDraftItems,
  dashboardName,
  dashboardsClient,
  dashboardTargetId,
  dashboardTargetMode,
  dashboardVisibility,
  resetDraft,
  showToast,
}: {
  conversationTitle: string;
  dashboardDraftItems: DashboardDraftItem[];
  dashboardName: string;
  dashboardsClient: DashboardsClient;
  dashboardTargetId: string;
  dashboardTargetMode: DashboardTargetMode;
  dashboardVisibility: DashboardVisibility;
  resetDraft: () => void;
  showToast: ShowToast;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      const normalizedName = dashboardName.trim() || conversationTitle || 'Analytics dashboard';
      const items = dashboardDraftItems.map(({ draft_id, ...item }) => item);
      if (dashboardTargetMode === 'existing' && dashboardTargetId) {
        return dashboardsClient.addItems(dashboardTargetId, { items }).then((response) => response.data);
      }
      return dashboardsClient
        .create({
          name: normalizedName,
          description: `Generated from chat: ${conversationTitle}`,
          visibility: dashboardVisibility,
          items,
        })
        .then((response) => response.data);
    },
    onSuccess: (dashboard) => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.list });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.ownerList });
      queryClient.setQueryData(dashboardQueryKeys.detail(dashboard.dashboard_id), dashboard);
      resetDraft();
      showToast(dashboardTargetMode === 'existing' ? 'Visualization added to dashboard.' : 'Dashboard generated.', 'success');
      navigate(`/analytics?dashboard=${encodeURIComponent(dashboard.dashboard_id)}`);
    },
    onError: (error) => showToast(getAnalyticsErrorMessage(error), 'error'),
  });
}

type DashboardDraftTargetState = ReturnType<typeof useDashboardDraftTarget>;

function applyAddVisualizationTarget({
  dashboardOptions,
  defaultDashboardName,
  draft,
  showError,
}: {
  dashboardOptions: DashboardSummary[];
  defaultDashboardName: string;
  draft: DashboardDraftTargetState;
  showError: (message: string) => void;
}) {
  if (!draft.pendingDashboardItem) return;
  if (draft.addDashboardMode === 'existing') {
    if (!draft.addDashboardId) {
      showError('Select a dashboard.');
      return;
    }
    const selectedDashboard = dashboardOptions.find((dashboard) => dashboard.dashboard_id === draft.addDashboardId);
    draft.setDashboardTargetMode('existing');
    draft.setDashboardTargetId(draft.addDashboardId);
    draft.setDashboardName(selectedDashboard?.dashboard_name || '');
    draft.setDashboardVisibility(selectedDashboard?.visibility || 'private');
  } else {
    draft.setDashboardTargetMode('new');
    draft.setDashboardTargetId('');
    draft.setDashboardName(draft.addDashboardName.trim() || defaultDashboardName);
    draft.setDashboardVisibility(draft.addDashboardVisibility);
  }
  draft.setDashboardDraftItems((current) =>
    current.some((existing) => existing.draft_id === draft.pendingDashboardItem?.draft_id)
      ? current
      : [...current, draft.pendingDashboardItem as DashboardDraftItem]
  );
  draft.setIsDashboardTrayOpen(true);
  draft.setPendingDashboardItem(null);
}

export function useAnalyticsDashboardDraft({
  conversationTitle,
  dashboardsClient,
  showToast,
}: {
  conversationTitle: string;
  dashboardsClient: DashboardsClient;
  showToast: ShowToast;
}) {
  const defaultDashboardName = useMemo(() => getDefaultDashboardName(conversationTitle), [conversationTitle]);
  const draft = useDashboardDraftTarget(defaultDashboardName);
  const dashboardsQuery = useQuery({
    queryKey: dashboardQueryKeys.ownerList,
    queryFn: () => dashboardsClient.list(100, true).then((response) => response.data.items),
    enabled: Boolean(draft.pendingDashboardItem) || draft.isDashboardTrayOpen,
  });
  const dashboardOptions = dashboardsQuery.data || [];
  const selectedExistingDashboard = useMemo(
    () => dashboardOptions.find((dashboard) => dashboard.dashboard_id === draft.dashboardTargetId) || null,
    [dashboardOptions, draft.dashboardTargetId]
  );
  const selectedVisualizationIds = useMemo(
    () => new Set(draft.dashboardDraftItems.map((item) => item.draft_id)),
    [draft.dashboardDraftItems]
  );

  useEffect(() => {
    if (!draft.pendingDashboardItem || draft.addDashboardMode !== 'existing' || draft.addDashboardId || dashboardOptions.length === 0) return;
    draft.setAddDashboardId(dashboardOptions[0].dashboard_id);
  }, [dashboardOptions, draft]);

  const resetDraft = () => {
    draft.setDashboardDraftItems([]);
    draft.setDashboardName('');
    draft.setDashboardVisibility('private');
    draft.setDashboardTargetMode('new');
    draft.setDashboardTargetId('');
    draft.setIsDashboardTrayOpen(false);
  };
  const saveDashboardMutation = useDashboardSave({ ...draft, conversationTitle, dashboardsClient, resetDraft, showToast });

  const closeAddVisualizationModal = () => {
    draft.setPendingDashboardItem(null);
    draft.setAddDashboardStep('target');
  };
  const advanceAddVisualizationStep = () => {
    if (draft.addDashboardMode === 'existing') {
      const nextDashboardId = draft.addDashboardId || dashboardOptions[0]?.dashboard_id || '';
      if (!nextDashboardId) {
        showToast('No dashboards available.', 'error');
        return;
      }
      draft.setAddDashboardId(nextDashboardId);
    }
    draft.setAddDashboardStep('details');
  };
  const confirmAddVisualizationTarget = () =>
    applyAddVisualizationTarget({
      dashboardOptions,
      defaultDashboardName,
      draft,
      showError: (message) => showToast(message, 'error'),
    });

  return {
    addVisualizationModalProps: {
      item: draft.pendingDashboardItem,
      step: draft.addDashboardStep,
      mode: draft.addDashboardMode,
      dashboardOptions,
      isDashboardOptionsLoading: dashboardsQuery.isLoading,
      dashboardId: draft.addDashboardId,
      dashboardName: draft.addDashboardName,
      dashboardVisibility: draft.addDashboardVisibility,
      onClose: closeAddVisualizationModal,
      onBack: () => draft.setAddDashboardStep('target'),
      onNext: advanceAddVisualizationStep,
      onConfirm: confirmAddVisualizationTarget,
      onModeChange: draft.setAddDashboardMode,
      onDashboardIdChange: draft.setAddDashboardId,
      onDashboardNameChange: draft.setAddDashboardName,
      onDashboardVisibilityChange: draft.setAddDashboardVisibility,
    },
    dashboardDraftItems: draft.dashboardDraftItems,
    dashboardTrayProps: {
      items: draft.dashboardDraftItems,
      targetMode: draft.dashboardTargetMode,
      targetId: draft.dashboardTargetId,
      dashboardName: draft.dashboardName,
      dashboardVisibility: draft.dashboardVisibility,
      dashboardOptions,
      selectedExistingDashboard,
      isSaving: saveDashboardMutation.isPending,
      onClose: () => draft.setIsDashboardTrayOpen(false),
      onRemoveItem: (draftId: string) =>
        draft.setDashboardDraftItems((current) => current.filter((item) => item.draft_id !== draftId)),
      onExistingDashboardChange: (nextId: string) => {
        const dashboard = dashboardOptions.find((item) => item.dashboard_id === nextId);
        draft.setDashboardTargetId(nextId);
        draft.setDashboardName(dashboard?.dashboard_name || '');
      },
      onDashboardNameChange: draft.setDashboardName,
      onDashboardVisibilityChange: draft.setDashboardVisibility,
      onSave: () => saveDashboardMutation.mutate(),
    },
    isDashboardTrayOpen: draft.isDashboardTrayOpen,
    openAddVisualizationModal: draft.openAddVisualizationModal,
    selectedVisualizationIds,
    toggleDashboardTray: () => draft.setIsDashboardTrayOpen((current) => !current),
  };
}
