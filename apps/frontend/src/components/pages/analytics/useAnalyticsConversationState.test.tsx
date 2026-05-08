import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsChatProvider } from '../../../context/AnalyticsChatContext';
import { useAnalyticsConversationState } from './useAnalyticsConversationState';

const analyticsResult = {
  run_id: 'run-1',
  conversation_id: 'conversation-1',
  answer: 'Deposits increased in March.',
  sql: 'select * from deposits',
  columns: ['MONTH', 'AMOUNT'],
  rows: [{ month: 'March', amount: 1200 }],
  row_count: 1,
  chart_spec: { type: 'bar' as const, x: 'MONTH', y: 'AMOUNT' },
  agent_trace: [{ stage: 'select_ai.showsql', status: 'completed' }],
};

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function HookWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AnalyticsChatProvider>{children}</AnalyticsChatProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };
}

function analyticsClient(overrides = {}) {
  return {
    ask: vi.fn().mockResolvedValue({ data: analyticsResult }),
    getConversation: vi.fn(),
    renameConversation: vi.fn(),
    deleteConversation: vi.fn(),
    ...overrides,
  };
}

function dataSourcesClient(overrides = {}) {
  return {
    list: vi.fn().mockResolvedValue({
      data: { items: [{ owner_name: 'APP_AGENT_DATA', table_name: 'FLEX_EXT_ACCOUNT_TRANSACTIONS', row_count: 25 }] },
    }),
    ...overrides,
  };
}

describe('useAnalyticsConversationState', () => {
  it('submits a question, appends user and assistant messages, and keeps the conversation id', async () => {
    const analytics = analyticsClient();
    const { result } = renderHook(
      () =>
        useAnalyticsConversationState({
          agentName: 'Select AI',
          analyticsClient: analytics,
          dataSourcesClient: dataSourcesClient(),
          showToast: vi.fn(),
        }),
      { wrapper: wrapper() }
    );

    act(() => result.current.setQuestion('How are deposits trending?'));
    act(() => result.current.submitQuestion());

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(analytics.ask).toHaveBeenCalledWith({
      question: 'How are deposits trending?',
      max_rows: 500,
      conversation_id: undefined,
    });
    expect(result.current.currentConversationId).toBe('conversation-1');
    expect(result.current.latestQuestion).toBe('How are deposits trending?');
    expect(result.current.latestResult?.answer).toBe('Deposits increased in March.');
  });

  it('loads data source summaries only after the graph panel is opened', async () => {
    const dataSources = dataSourcesClient();
    const { result } = renderHook(
      () =>
        useAnalyticsConversationState({
          agentName: 'Select AI',
          analyticsClient: analyticsClient(),
          dataSourcesClient: dataSources,
          showToast: vi.fn(),
        }),
      { wrapper: wrapper() }
    );

    expect(dataSources.list).not.toHaveBeenCalled();

    act(() => result.current.toggleGraphPanel());

    await waitFor(() => expect(dataSources.list).toHaveBeenCalledTimes(1));
    expect(result.current.isGraphPanelOpen).toBe(true);
    await waitFor(() =>
      expect(result.current.graphDataSources).toEqual([
        { owner_name: 'APP_AGENT_DATA', table_name: 'FLEX_EXT_ACCOUNT_TRANSACTIONS', row_count: 25 },
      ])
    );
  });
});
