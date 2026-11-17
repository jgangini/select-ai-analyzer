import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAnalyticsChat } from '../../../context/AnalyticsChatContext';
import { analyticsApi, analyticsQueryKeys } from '../../../services/analyticsApi';
import { LoadingState } from '../../common/LoadingState';
import { ConfirmDeleteModal, GlassModal } from '../../common/Modal';
import {
  buildConversationMarkdown,
  formatDateTime,
  getSafeFileName,
  normalizeForSearch,
  sortConversations,
} from './searchChatsUtils';

type ConversationSummary = {
  conversation_id: string;
  title: string;
  turns: number;
  last_message_preview: string;
  created_at: string;
  updated_at: string;
};

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

export function SearchChatsModal({
  isAuthenticated,
  showToast,
  userId,
}: {
  isAuthenticated: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  userId: number | null;
}) {
  const queryClient = useQueryClient();
  const {
    isSearchOpen,
    closeSearch,
    openConversation,
    openNewConversation,
    activeConversationId,
    isConversationProcessing,
  } = useAnalyticsChat();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const normalizedSearch = normalizeForSearch(search);

  const conversationsQuery = useQuery({
    queryKey: analyticsQueryKeys.conversations(userId ?? 'anonymous', normalizedSearch),
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

  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => analyticsApi.deleteConversation(conversationId),
    onSuccess: (_response, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.removeQueries({ queryKey: analyticsQueryKeys.conversation(conversationId) });
      setDeleteTarget(null);
      if (activeConversationId === conversationId) openNewConversation();
      showToast('Chat deleted.', 'success');
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Failed to delete chat.', 'error'),
  });

  const openConversationAndClose = (conversation: ConversationSummary) => {
    openConversation(conversation.conversation_id, conversation.title);
    closeSearch();
  };

  const downloadConversation = async (conversation: ConversationSummary) => {
    try {
      const response = await analyticsApi.getConversation(conversation.conversation_id, 5000);
      const markdown = buildConversationMarkdown(response.data);
      const url = window.URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getSafeFileName(conversation.title || 'chat')}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Failed to download chat.', 'error');
    }
  };

  return (
    <>
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
                {filteredConversations.map((conversation) => {
                  const isProcessing = isConversationProcessing(conversation.conversation_id);
                  return (
                    <li key={conversation.conversation_id} className="border-b border-gray-200/70 last:border-b-0">
                      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 hover:bg-gray-50/70">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openConversationAndClose(conversation)}
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
                        <button
                          type="button"
                          className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-50"
                          title="Download chat"
                          aria-label={`Download ${conversation.title || 'chat'}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void downloadConversation(conversation);
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        {isProcessing ? (
                          <span
                            className="flex h-8 w-8 items-center justify-center"
                            title="Processing chat"
                          >
                            <span
                              aria-label={`Processing ${conversation.title || 'chat'}`}
                              role="status"
                              className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent"
                            />
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="rounded border border-red-300 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50"
                            title="Delete"
                            aria-label={`Delete ${conversation.title || 'chat'}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(conversation);
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </GlassModal>

      {deleteTarget && !isConversationProcessing(deleteTarget.conversation_id) && (
        <ConfirmDeleteModal
          title="Delete chat"
          message={
            <span>
              Delete <span className="font-medium text-oracle-dark-gray">{deleteTarget.title || 'Analytics chat'}</span>?
            </span>
          }
          detail="The analytical conversation and its question runs will be removed."
          onConfirm={() => deleteConversationMutation.mutate(deleteTarget.conversation_id)}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteConversationMutation.isPending}
          zIndex="z-[400]"
        />
      )}
    </>
  );
}
