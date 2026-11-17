import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from './Sidebar';

afterEach(() => cleanup());

const chat = {
  conversation_id: 'conversation-1',
  title: 'Hidden statement transactions',
  created_at: '2026-05-11T10:00:00Z',
  updated_at: '2026-05-11T10:00:00Z',
};

function renderSidebar({
  processingConversationIds = [],
  unreadConversationIds = [],
}: {
  processingConversationIds?: string[];
  unreadConversationIds?: string[];
}) {
  return render(
    <MemoryRouter
      initialEntries={['/chat']}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Sidebar
        activeConversationId={null}
        activeDraftVersion={0}
        collapsed={false}
        draftConversations={[]}
        isAuthenticated={true}
        processingConversationIds={processingConversationIds}
        unreadConversationIds={unreadConversationIds}
        user={{ groupId: 0, userId: 1 }}
        onToggle={vi.fn()}
        onOpenConversation={vi.fn()}
        onOpenNewConversation={vi.fn()}
        onOpenSearch={vi.fn()}
        sidebarChats={{
          recentConversations: [chat],
          recentConversationsError: false,
          recentConversationsLoading: false,
        }}
      />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  it('shows a processing spinner instead of the chat timestamp', () => {
    renderSidebar({ processingConversationIds: ['conversation-1'] });

    expect(screen.getByLabelText('Processing chat')).toBeInTheDocument();
    expect(screen.queryByText(/\d+m|\d+h|\d+d|\d{2}\/\d{2}/)).not.toBeInTheDocument();
  });

  it('shows an unread response dot when a background answer finished', () => {
    renderSidebar({ unreadConversationIds: ['conversation-1'] });

    expect(screen.getByLabelText('Unread response')).toBeInTheDocument();
    expect(screen.queryByLabelText('Processing chat')).not.toBeInTheDocument();
  });

  it('shows a draft chat immediately while a new question is processing', () => {
    render(
      <MemoryRouter
        initialEntries={['/chat']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Sidebar
          activeConversationId={null}
          activeDraftVersion={1}
          collapsed={false}
          draftConversations={[
            {
              draftVersion: 1,
              title: '¿Qué cuentas tienen mayor saldo bloqueado?',
              created_at: '2026-05-11T10:00:00Z',
              updated_at: '2026-05-11T10:00:00Z',
            },
          ]}
          isAuthenticated={true}
          processingConversationIds={[]}
          unreadConversationIds={[]}
          user={{ groupId: 0, userId: 1 }}
          onToggle={vi.fn()}
          onOpenConversation={vi.fn()}
          onOpenNewConversation={vi.fn()}
          onOpenSearch={vi.fn()}
          sidebarChats={{
            recentConversations: [],
            recentConversationsError: false,
            recentConversationsLoading: false,
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('¿Qué cuentas tienen mayor saldo bloqueado?')).toBeInTheDocument();
    expect(screen.getByLabelText('Processing chat')).toBeInTheDocument();
    expect(screen.queryByText('No chats yet')).not.toBeInTheDocument();
  });
});
