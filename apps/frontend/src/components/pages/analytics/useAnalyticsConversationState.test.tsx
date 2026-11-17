import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsChatProvider, useAnalyticsChat } from '../../../context/AnalyticsChatContext';
import { useAnalyticsConversationState } from './useAnalyticsConversationState';

afterEach(() => cleanup());

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function conversationDetail(conversationId: string, title = 'Analytics chat') {
  return {
    conversation_id: conversationId,
    title,
    created_at: '2026-05-11T10:00:00Z',
    updated_at: '2026-05-11T10:00:00Z',
    messages: [],
  };
}

function ConversationStateProbe({
  analytics,
  question = 'Which accounts have hidden statement transactions?',
}: {
  analytics: ReturnType<typeof analyticsClient>;
  question?: string;
}) {
  const chat = useAnalyticsChat();
  const conversation = useAnalyticsConversationState({
    agentName: 'Select AI',
    analyticsClient: analytics,
    dataSourcesClient: dataSourcesClient(),
    showToast: vi.fn(),
  });

  return (
    <div>
      <span data-testid="active">{chat.activeConversationId || 'none'}</span>
      <span data-testid="current">{conversation.currentConversationId || 'none'}</span>
      <span data-testid="version">{chat.newConversationVersion}</span>
      <span data-testid="processing">{chat.processingConversationIds.join(',') || 'none'}</span>
      <span data-testid="drafts">{chat.processingDraftVersions.join(',') || 'none'}</span>
      <span data-testid="draft-titles">{chat.draftConversations.map((draft) => draft.title).join('|') || 'none'}</span>
      <span data-testid="unread">{chat.unreadConversationIds.join(',') || 'none'}</span>
      <span data-testid="messages">
        {conversation.messages.map((message) => `${message.role}:${message.content}`).join('|') || 'none'}
      </span>
      <button type="button" onClick={() => chat.openConversation('conversation-1', 'Hidden transactions')}>
        open first
      </button>
      <button type="button" onClick={() => chat.openConversation('conversation-2', 'Other chat')}>
        open second
      </button>
      <button type="button" onClick={chat.openNewConversation}>
        new conversation
      </button>
      <button type="button" onClick={() => conversation.setQuestion(question)}>
        set question
      </button>
      <button type="button" onClick={conversation.submitQuestion}>
        submit question
      </button>
    </div>
  );
}

function renderConversationProbe(analytics: ReturnType<typeof analyticsClient>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <QueryClientProvider client={queryClient}>
        <AnalyticsChatProvider>
          <ConversationStateProbe analytics={analytics} />
        </AnalyticsChatProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
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

  it('keeps an existing chat processing in the background after switching chats', async () => {
    const pendingAsk = deferred<{ data: typeof analyticsResult }>();
    const analytics = analyticsClient({
      ask: vi.fn().mockReturnValue(pendingAsk.promise),
      getConversation: vi.fn((conversationId: string) =>
        Promise.resolve({ data: conversationDetail(conversationId, conversationId === 'conversation-1' ? 'Hidden transactions' : 'Other chat') })
      ),
    });

    renderConversationProbe(analytics);

    fireEvent.click(screen.getByRole('button', { name: 'open first' }));
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('conversation-1'));

    fireEvent.click(screen.getByRole('button', { name: 'set question' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit question' }));

    await waitFor(() => expect(screen.getByTestId('processing')).toHaveTextContent('conversation-1'));
    expect(analytics.ask).toHaveBeenCalledWith({
      question: 'Which accounts have hidden statement transactions?',
      max_rows: 500,
      conversation_id: 'conversation-1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'open second' }));
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('conversation-2'));

    act(() => {
      pendingAsk.resolve({ data: analyticsResult });
    });

    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('conversation-1'));
    expect(screen.getByTestId('processing')).toHaveTextContent('none');
    expect(screen.getByTestId('active')).toHaveTextContent('conversation-2');
    expect(screen.getByTestId('messages')).not.toHaveTextContent('assistant:Deposits increased in March.');
  });

  it('keeps a new-chat request detached when the user starts another new chat', async () => {
    const pendingAsk = deferred<{ data: typeof analyticsResult }>();
    const analytics = analyticsClient({
      ask: vi.fn().mockReturnValue(pendingAsk.promise),
      getConversation: vi.fn((conversationId: string) => Promise.resolve({ data: conversationDetail(conversationId) })),
    });

    renderConversationProbe(analytics);

    fireEvent.click(screen.getByRole('button', { name: 'set question' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit question' }));

    await waitFor(() => expect(screen.getByTestId('drafts')).toHaveTextContent('0'));
    expect(screen.getByTestId('draft-titles')).toHaveTextContent('Which accounts have hidden statement transactions?');
    fireEvent.click(screen.getByRole('button', { name: 'new conversation' }));
    await waitFor(() => expect(screen.getByTestId('version')).toHaveTextContent('1'));
    expect(screen.getByTestId('current')).toHaveTextContent('none');
    expect(screen.getByTestId('messages')).toHaveTextContent('none');
    expect(screen.getByTestId('drafts')).toHaveTextContent('0');

    act(() => {
      pendingAsk.resolve({ data: analyticsResult });
    });

    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('conversation-1'));
    expect(screen.getByTestId('drafts')).toHaveTextContent('none');
    expect(screen.getByTestId('draft-titles')).toHaveTextContent('none');
    expect(screen.getByTestId('current')).toHaveTextContent('none');
    expect(screen.getByTestId('messages')).not.toHaveTextContent('assistant:Deposits increased in March.');
  });
});
