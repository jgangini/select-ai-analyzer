import api from './httpClient';

export type ChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

export type DashboardVisualizationPayload = {
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  chart_spec: ChartSpec;
  layout?: Record<string, unknown>;
};

export type DashboardVisibility = 'private' | 'shared';

export type DashboardSummary = {
  dashboard_id: string;
  dashboard_name: string;
  dashboard_desc: string;
  status: string;
  visibility: DashboardVisibility;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  item_count: number;
};

export type DashboardItem = {
  dashboard_item_id: string;
  order: number;
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec: ChartSpec;
  layout: Record<string, unknown>;
  created_at: string;
};

export type DashboardDetail = DashboardSummary & {
  items: DashboardItem[];
};

export type CreateDashboardPayload = {
  name: string;
  description?: string;
  visibility?: DashboardVisibility;
  items: DashboardVisualizationPayload[];
};

export type AddDashboardItemsPayload = {
  items: DashboardVisualizationPayload[];
};

export type UpdateDashboardPayload = {
  name?: string;
  description?: string;
  visibility?: DashboardVisibility;
};

export type UpdateDashboardItemPayload = {
  title?: string;
  layout?: Record<string, unknown>;
};

export const dashboardsQueryKeys = {
  list: ['dashboards', 'list'] as const,
  ownerList: ['dashboards', 'list', 'owner'] as const,
  detail: (dashboardId: string | null) => ['dashboards', 'detail', dashboardId] as const,
};

export function getDashboardErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'Dashboard action failed.';
}

export const dashboardsApi = {
  list: (limit = 50, ownerOnly = false) =>
    api.get<{ items: DashboardSummary[] }>('/dashboards', {
      params: { limit, ...(ownerOnly ? { owner_only: true } : {}) },
    }),
  get: (dashboardId: string, maxRows = 500) =>
    api.get<DashboardDetail>(`/dashboards/${encodeURIComponent(dashboardId)}`, {
      params: { max_rows: maxRows },
    }),
  create: (payload: CreateDashboardPayload) => api.post<DashboardDetail>('/dashboards', payload),
  addItems: (dashboardId: string, payload: AddDashboardItemsPayload) =>
    api.post<DashboardDetail>(`/dashboards/${encodeURIComponent(dashboardId)}/items`, payload),
  update: (dashboardId: string, payload: UpdateDashboardPayload) =>
    api.patch<DashboardDetail>(`/dashboards/${encodeURIComponent(dashboardId)}`, payload),
  delete: (dashboardId: string) =>
    api.delete<{ dashboard_id: string; deleted: boolean }>(`/dashboards/${encodeURIComponent(dashboardId)}`),
  updateItem: (dashboardId: string, dashboardItemId: string, payload: UpdateDashboardItemPayload) =>
    api.patch<DashboardDetail>(
      `/dashboards/${encodeURIComponent(dashboardId)}/items/${encodeURIComponent(dashboardItemId)}`,
      payload
    ),
  deleteItem: (dashboardId: string, dashboardItemId: string) =>
    api.delete<DashboardDetail>(
      `/dashboards/${encodeURIComponent(dashboardId)}/items/${encodeURIComponent(dashboardItemId)}`
    ),
  reorderItems: (dashboardId: string, itemIds: string[]) =>
    api.put<DashboardDetail>(`/dashboards/${encodeURIComponent(dashboardId)}/items/reorder`, { item_ids: itemIds }),
};
