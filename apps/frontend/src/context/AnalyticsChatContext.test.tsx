import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AnalyticsChatProvider, useAnalyticsChat } from './AnalyticsChatContext';

function AnalyticsChatProbe() {
  const chat = useAnalyticsChat();
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="search">{chat.isSearchOpen ? 'open' : 'closed'}</span>
      <span data-testid="conversation">{chat.activeConversationId || 'none'}</span>
      <span data-testid="title">{chat.activeConversationTitle || 'untitled'}</span>
      <button type="button" onClick={chat.openSearch}>
        search
      </button>
      <button type="button" onClick={() => chat.openConversation('conv-1', 'Risk review')}>
        open conversation
      </button>
      <button type="button" onClick={chat.openNewConversation}>
        new conversation
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
  });
});
