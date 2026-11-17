import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AnalyticsChatProvider, useAnalyticsChat } from './AnalyticsChatContext';

afterEach(() => cleanup());

function AnalyticsChatProbe() {
  const chat = useAnalyticsChat();
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="search">{chat.isSearchOpen ? 'open' : 'closed'}</span>
      <span data-testid="conversation">{chat.activeConversationId || 'none'}</span>
      <span data-testid="title">{chat.activeConversationTitle || 'untitled'}</span>
      <span data-testid="new-version">{chat.newConversationVersion}</span>
      <span data-testid="processing">{chat.processingConversationIds.join(',') || 'none'}</span>
      <span data-testid="draft-processing">{chat.processingDraftVersions.join(',') || 'none'}</span>
      <span data-testid="drafts">{chat.draftConversations.map((draft) => draft.title).join(',') || 'none'}</span>
      <span data-testid="unread">{chat.unreadConversationIds.join(',') || 'none'}</span>
      <button type="button" onClick={chat.openSearch}>
        search
      </button>
      <button type="button" onClick={() => chat.openConversation('conv-1', 'Risk review')}>
        open conversation
      </button>
      <button type="button" onClick={chat.openNewConversation}>
        new conversation
      </button>
      <button type="button" onClick={() => chat.startConversationProcessing('conv-1')}>
        start processing
      </button>
      <button type="button" onClick={() => chat.finishConversationProcessing('conv-1')}>
        finish processing
      </button>
      <button type="button" onClick={() => chat.startDraftProcessing(chat.newConversationVersion, 'Balance analysis')}>
        start draft
      </button>
      <button type="button" onClick={() => chat.finishDraftProcessing(chat.newConversationVersion)}>
        finish draft
      </button>
      <button type="button" onClick={() => chat.markConversationUnread('conv-1')}>
        mark unread
      </button>
    </div>
  );
}

describe('AnalyticsChatContext', () => {
  it('tracks search and conversation state while routing to chat', () => {
    render(
      <MemoryRouter
        initialEntries={['/home']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AnalyticsChatProvider>
          <AnalyticsChatProbe />
        </AnalyticsChatProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'search' }));
    expect(screen.getByTestId('search')).toHaveTextContent('open');

    fireEvent.click(screen.getByRole('button', { name: 'open conversation' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/chat');
    expect(screen.getByTestId('search')).toHaveTextContent('closed');
    expect(screen.getByTestId('conversation')).toHaveTextContent('conv-1');
    expect(screen.getByTestId('title')).toHaveTextContent('Risk review');

    fireEvent.click(screen.getByRole('button', { name: 'new conversation' }));
    expect(screen.getByTestId('conversation')).toHaveTextContent('none');
    expect(screen.getByTestId('title')).toHaveTextContent('untitled');
    expect(screen.getByTestId('new-version')).toHaveTextContent('1');
  });

  it('tracks processing and unread response state for sidebar indicators', () => {
    render(
      <MemoryRouter
        initialEntries={['/home']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AnalyticsChatProvider>
          <AnalyticsChatProbe />
        </AnalyticsChatProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'start processing' }));
    expect(screen.getByTestId('processing')).toHaveTextContent('conv-1');

    fireEvent.click(screen.getByRole('button', { name: 'finish processing' }));
    expect(screen.getByTestId('processing')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'start draft' }));
    expect(screen.getByTestId('draft-processing')).toHaveTextContent('0');
    expect(screen.getByTestId('drafts')).toHaveTextContent('Balance analysis');

    fireEvent.click(screen.getByRole('button', { name: 'finish draft' }));
    expect(screen.getByTestId('draft-processing')).toHaveTextContent('none');
    expect(screen.getByTestId('drafts')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'mark unread' }));
    expect(screen.getByTestId('unread')).toHaveTextContent('conv-1');

    fireEvent.click(screen.getByRole('button', { name: 'open conversation' }));
    expect(screen.getByTestId('unread')).toHaveTextContent('none');
  });
});
