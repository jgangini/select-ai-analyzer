import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  setup: { check: ['setup', 'check'] as const },
  users: { me: ['users', 'me'] as const, list: ['users', 'list'] as const, groups: ['users', 'groups'] as const },
  analytics: {
    ask: ['analytics', 'ask'] as const,
    conversations: (userId: number | string, search = '') => ['analytics', 'conversations', userId, search] as const,
    sidebarConversations: (userId: number | string) => ['analytics', 'sidebar-conversations', userId] as const,
    conversation: (conversationId: string | null) => ['analytics', 'conversation', conversationId] as const,
  },
  dataSources: {
    list: ['data-sources', 'list'] as const,
    schemas: ['data-sources', 'schemas'] as const,
    rows: (dataSourceId: string | null, page: number) => ['data-sources', 'rows', dataSourceId, page] as const,
  },
  dashboards: {
    list: ['dashboards', 'list'] as const,
    ownerList: ['dashboards', 'list', 'owner'] as const,
    detail: (dashboardId: string | null) => ['dashboards', 'detail', dashboardId] as const,
  },
  agentBuilder: { flow: ['agent-builder', 'flow'] as const },
  models: { list: ['models'] as const },
};
