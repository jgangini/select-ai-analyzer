import api from './httpClient';

type ChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

type AnalyticsAskRequest = {
  question: string;
  max_rows?: number;
  conversation_id?: string;
};

type AgentTraceItem = {
  stage: string;
  status: string;
  rows?: number;
  profile_name?: string;
  objects?: Array<{ owner?: string; name?: string; columns?: string[] }>;
};

type AnalyticsAskResponse = {
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

type AnalyticsConversationSummary = {
  conversation_id: string;
  title: string;
  turns: number;
  last_message_preview: string;
  created_at: string;
  updated_at: string;
};

type AnalyticsConversationMessage = {
  run_id: string;
  question: string;
  created_at: string;
  result: AnalyticsAskResponse;
};

type AnalyticsConversationDetail = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: AnalyticsConversationMessage[];
};

export const analyticsQueryKeys = {
  ask: ['analytics', 'ask'] as const,
  conversations: (userId: number | string, search = '') => ['analytics', 'conversations', userId, search] as const,
  sidebarConversations: (userId: number | string) => ['analytics', 'sidebar-conversations', userId] as const,
  conversation: (conversationId: string | null) => ['analytics', 'conversation', conversationId] as const,
};

export function sortConversations(items: AnalyticsConversationSummary[]): AnalyticsConversationSummary[] {
  return items.slice().sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

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
