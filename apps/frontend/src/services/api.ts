import axios from 'axios';

const baseURL = '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const requestUrl = error?.config?.url ?? '';
      if (!requestUrl.includes('/auth/login')) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('builder-last-flow-id');
        sessionStorage.removeItem('flow-builder-state');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { baseURL };

export type ChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

export type AnalyticsAskRequest = {
  question: string;
  max_rows?: number;
  conversation_id?: string;
};

export type AgentTraceItem = {
  stage: string;
  status: string;
  rows?: number;
  profile_name?: string;
  objects?: Array<{ owner?: string; name?: string; columns?: string[] }>;
};

export type AnalyticsAskResponse = {
  run_id: string;
  conversation_id: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec: ChartSpec;
  agent_trace: AgentTraceItem[];
};

export type AnalyticsConversationSummary = {
  conversation_id: string;
  title: string;
  turns: number;
  last_message_preview: string;
  created_at: string;
  updated_at: string;
};

export type AnalyticsConversationMessage = {
  run_id: string;
  question: string;
  created_at: string;
  result: AnalyticsAskResponse;
};

export type AnalyticsConversationDetail = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: AnalyticsConversationMessage[];
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

export type DataSourceSummary = {
  data_source_id: string;
  source_name: string;
  source_type: 'csv' | 'existing_table';
  owner_name: string;
  table_name: string;
  access_scope: 'all' | 'private';
  row_count: number;
  column_count: number;
  status: string;
  created_at: string;
};

export type DataSourceSchema = {
  schema_name: string;
  exists: boolean;
  is_app_schema: boolean;
  source_count: number;
};

export type DataSourceRowsResponse = {
  data_source: DataSourceSummary;
  columns: string[];
  column_details: DataSourceColumnMetadata[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  limit: number;
  offset: number;
};

export type DataSourceColumnMetadata = {
  column_name: string;
  data_type?: string;
  data_length?: number;
  nullable?: string;
  ordinal_position?: number;
  comment?: string;
  ui_display?: string;
  classification?: string;
  primary_key?: boolean;
};

export type DataSourceCatalogOwner = {
  owner_name: string;
  table_count: number;
};

export type DataSourceCatalogTable = {
  owner_name: string;
  table_name: string;
  row_count: number;
  column_count: number;
  table_comment?: string;
};

export type DataSourceCatalogTableDetail = {
  owner_name: string;
  table_name: string;
  table_comment: string;
  columns: DataSourceColumnMetadata[];
};

export type RegisterTablePayload = {
  owner: string;
  table_name: string;
  display_name?: string;
  table_comment?: string;
  columns?: DataSourceColumnMetadata[];
  access_scope?: 'all' | 'private';
};

export type DataSourceMutationResponse = {
  data_source_id: string;
  owner_name: string;
  table_name: string;
  row_count?: number;
  metadata_warnings?: string[];
};

export type AgentObjectType = 'TOOL' | 'TASK' | 'AGENT' | 'TEAM';

export type AgentObjectPayload = {
  object_type: AgentObjectType;
  name: string;
  attributes: Record<string, unknown>;
};

export type AgentObjectResponse = {
  agent_definition_id?: string;
  object_type?: AgentObjectType;
  object_name?: string;
  attributes: Record<string, unknown>;
  script: string;
};

export type RunTeamPayload = {
  team_name: string;
  prompt: string;
  conversation_id?: string;
};

export type RunTeamResponse = {
  run_id: string;
  conversation_id: string;
  team_name: string;
  response: string;
};

export const analyticsApi = {
  ask: (payload: AnalyticsAskRequest) => api.post<AnalyticsAskResponse>('/analytics/ask', payload),
  listConversations: (search?: string, limit = 50) =>
    api.get<{ items: AnalyticsConversationSummary[] }>('/analytics/conversations', {
      params: { ...(search?.trim() ? { search: search.trim() } : {}), limit },
    }),
  getConversation: (conversationId: string, maxRows = 500) =>
    api.get<AnalyticsConversationDetail>(`/analytics/conversations/${encodeURIComponent(conversationId)}`, {
      params: { max_rows: maxRows },
    }),
  renameConversation: (conversationId: string, title: string) =>
    api.put<AnalyticsConversationSummary>(`/analytics/conversations/${encodeURIComponent(conversationId)}`, { title }),
  deleteConversation: (conversationId: string) =>
    api.delete(`/analytics/conversations/${encodeURIComponent(conversationId)}`),
};

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

export const dataSourcesApi = {
  list: () => api.get<{ items: DataSourceSummary[] }>('/data-sources'),
  schemas: () => api.get<{ items: DataSourceSchema[] }>('/data-sources/schemas'),
  catalogOwners: () => api.get<{ items: DataSourceCatalogOwner[] }>('/data-sources/catalog/owners'),
  catalogTables: (owner: string) =>
    api.get<{ items: DataSourceCatalogTable[] }>('/data-sources/catalog/tables', {
      params: { owner },
    }),
  catalogTable: (owner: string, tableName: string) =>
    api.get<DataSourceCatalogTableDetail>('/data-sources/catalog/table', {
      params: { owner, table_name: tableName },
    }),
  createSchema: (schemaName: string) => api.post('/data-sources/schemas', { schema_name: schemaName }),
  rows: (dataSourceId: string, limit = 10, offset = 0) =>
    api.get<DataSourceRowsResponse>(`/data-sources/${encodeURIComponent(dataSourceId)}/rows`, {
      params: { limit, offset },
    }),
  deleteSource: (dataSourceId: string) =>
    api.delete(`/data-sources/${encodeURIComponent(dataSourceId)}`),
  registerTable: (payload: RegisterTablePayload) =>
    api.post<DataSourceMutationResponse>('/data-sources/table-access', payload),
  uploadCsv: (
    file: File,
    tableName?: string,
    tableComment?: string,
    columns?: DataSourceColumnMetadata[],
    accessScope: 'all' | 'private' = 'all',
    targetSchema = 'APP_AGENT_DATA',
    createSchema = false
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (tableName?.trim()) {
      formData.append('table_name', tableName.trim());
    }
    if (tableComment?.trim()) {
      formData.append('table_comment', tableComment.trim());
    }
    if (columns && columns.length > 0) {
      formData.append('columns_metadata_json', JSON.stringify(columns));
    }
    formData.append('target_schema', targetSchema.trim());
    formData.append('create_schema', String(createSchema));
    formData.append('access_scope', accessScope);
    return api.post<DataSourceMutationResponse>('/data-sources/csv', formData);
  },
};

export const agentBuilderApi = {
  script: (payload: AgentObjectPayload) => api.post<AgentObjectResponse>('/agent-builder/script', payload),
  createObject: (payload: AgentObjectPayload) => api.post<AgentObjectResponse>('/agent-builder/objects', payload),
  runTeam: (payload: RunTeamPayload) => api.post<RunTeamResponse>('/agent-builder/run-team', payload),
};

export const settingsApi = {
  getPublic: () => api.get('/settings/public'),
  get: () => api.get('/settings'),
  update: (updates: Record<string, unknown>) => api.put('/settings', { updates }),
  uploadAgentAvatar: (file: File) => {
    const payload = new FormData();
    payload.append('file', file);
    return api.post('/settings/agent-avatar', payload);
  },
  deleteAgentAvatar: () => api.delete('/settings/agent-avatar'),
};

export default api;
