import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { AnalyticsChatProvider, useAnalyticsChat } from '../../../context/AnalyticsChatContext';
import { SearchChatsModal } from './SearchChatsModal';

const analyticsApiMock = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
}));

vi.mock('../../../services/analyticsApi', () => ({
  analyticsApi: analyticsApiMock,
  analyticsQueryKeys: {
    ask: ['analytics', 'ask'],
    conversations: (userId: number | string, search = '') => ['analytics', 'conversations', userId, search],
    sidebarConversations: (userId: number | string) => ['analytics', 'sidebar-conversations', userId],
    conversation: (conversationId: string | null) => ['analytics', 'conversation', conversationId],
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function SearchChatsProbe() {
  const chat = useAnalyticsChat();
  return (
    <>
      <button type="button" onClick={chat.openSearch}>
        open search
      </button>
      <button type="button" onClick={() => chat.startConversationProcessing('conversation-1')}>
        start processing first chat
      </button>
    </>
  );
}

function renderSearchChatsModal() {
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
          <SearchChatsProbe />
          <SearchChatsModal isAuthenticated showToast={vi.fn()} userId={7} />
        </AnalyticsChatProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('SearchChatsModal', () => {
  const conversationTitle = 'Current balance by currency and branch';
  const conversation = {
    conversation_id: 'conversation-1',
    title: conversationTitle,
    turns: 1,
    last_message_preview: conversationTitle,
    created_at: '2026-05-11T22:43:59Z',
    updated_at: '2026-05-11T22:43:59Z',
  };

  it('shows delete confirmation above the search modal', async () => {
    analyticsApiMock.deleteConversation.mockResolvedValue({ data: { deleted: true } });
    analyticsApiMock.listConversations.mockResolvedValue({ data: { items: [conversation] } });

    renderSearchChatsModal();

    fireEvent.click(screen.getByRole('button', { name: 'open search' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Search Chats' })).toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: `Delete ${conversationTitle}` }));

    const searchOverlay = screen.getByRole('heading', { name: 'Search Chats' }).closest('.fixed');
    const deleteOverlay = screen.getByRole('heading', { name: 'Delete chat' }).closest('.fixed');

    expect(searchOverlay).toHaveClass('z-[300]');
    expect(deleteOverlay).toHaveClass('z-[400]');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(analyticsApiMock.deleteConversation).toHaveBeenCalledWith('conversation-1'));
  });

  it('shows processing status and prevents deleting a running chat', async () => {
    analyticsApiMock.listConversations.mockResolvedValue({ data: { items: [conversation] } });

    renderSearchChatsModal();

    fireEvent.click(screen.getByRole('button', { name: 'start processing first chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'open search' }));

    expect(await screen.findByRole('status', { name: `Processing ${conversationTitle}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Delete ${conversationTitle}` })).not.toBeInTheDocument();
    expect(analyticsApiMock.deleteConversation).not.toHaveBeenCalled();
  });
});
