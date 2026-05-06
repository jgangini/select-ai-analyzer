import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../context/AuthContext';
import { useAnalyticsChat } from '../../context/AnalyticsChatContext';
import { queryKeys } from '../../lib/queryClient';
import { analyticsApi, type AnalyticsConversationSummary } from '../../services/api';
import { GlassModal } from './GlassModal';
import { LoadingState } from './LoadingState';

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchMatch(text: string, search: string) {
  const source = String(text || '');
  const query = search.trim();
  if (!query) return source;
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const segments = source.split(regex);
  return (
    <>
      {segments.map((segment, index) => {
        const isMatch = segment.toLowerCase() === query.toLowerCase();
        if (!isMatch) return <span key={`txt-${index}`}>{segment}</span>;
        return (
          <mark key={`mark-${index}`} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">
            {segment}
          </mark>
        );
      })}
    </>
  );
}

function sortConversations(items: AnalyticsConversationSummary[]): AnalyticsConversationSummary[] {
  return items.slice().sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

export function SearchChatsModal() {
  const { user, isAuthenticated } = useAuth();
  const { isSearchOpen, closeSearch, openConversation } = useAnalyticsChat();
  const [search, setSearch] = useState('');
  const normalizedSearch = normalizeForSearch(search);

  const conversationsQuery = useQuery({
    queryKey: queryKeys.analytics.conversations(user?.user_id ?? 'anonymous', normalizedSearch),
    queryFn: async () => {
      const response = await analyticsApi.listConversations(search, 50);
      return sortConversations(response.data.items || []);
    },
    enabled: isAuthenticated && isSearchOpen,
  });

  const filteredConversations = useMemo(() => {
    const items = conversationsQuery.data || [];
    if (!normalizedSearch) return items;
    return items.filter((conversation) => {
      const haystack = normalizeForSearch(
        `${conversation.title || ''} ${conversation.last_message_preview || ''}`
      );
      return haystack.includes(normalizedSearch);
    });
  }, [conversationsQuery.data, normalizedSearch]);

  return (
    <GlassModal
      open={isSearchOpen}
      onClose={closeSearch}
      containerClassName="items-start justify-center p-4"
      panelClassName="w-full max-w-4xl mt-16 border-0"
    >
      <div className="px-5 py-4 flex items-center gap-3 bg-oracle-dark-gray">
        <h2 className="text-lg font-semibold text-white">Search Chats</h2>
        <div className="ml-auto" />
        <button
          type="button"
          onClick={closeSearch}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-200"
          aria-label="Close search chats"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.75)' }}>
        <input
          type="text"
          className="input-oracle w-full"
          placeholder="Search chats..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoFocus
        />

        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-xl border border-white/30 bg-white/70">
          {conversationsQuery.isLoading ? (
            <LoadingState
              size="sm"
              label="Loading chats..."
              className="p-4"
              textClassName="text-oracle-light-gray"
            />
          ) : conversationsQuery.isError ? (
            <p className="p-4 text-sm text-red-700">Could not load chats.</p>
          ) : filteredConversations.length === 0 ? (
            <p className="p-4 text-sm text-oracle-light-gray">No chats found.</p>
          ) : (
            <ul>
              {filteredConversations.map((conversation) => (
                <li key={conversation.conversation_id} className="border-b border-gray-200/70 last:border-b-0">
                  <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 hover:bg-gray-50/70">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        openConversation(conversation.conversation_id, conversation.title);
                        closeSearch();
                      }}
                    >
                      <p className="truncate text-sm font-medium text-oracle-dark-gray">
                        {highlightSearchMatch(conversation.title || 'Analytics chat', search)}
                      </p>
                      <p className="truncate text-xs text-oracle-medium-gray">
                        {conversation.last_message_preview
                          ? highlightSearchMatch(conversation.last_message_preview, search)
                          : 'No messages yet'}
                      </p>
                      <p className="mt-1 text-[11px] text-oracle-light-gray">
                        {conversation.turns} turn(s) - Updated {formatDateTime(conversation.updated_at)}
                      </p>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </GlassModal>
  );
}
