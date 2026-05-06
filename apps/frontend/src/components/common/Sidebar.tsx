import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../context/AuthContext';
import { useAnalyticsChat } from '../../context/AnalyticsChatContext';
import { queryKeys } from '../../lib/queryClient';
import { analyticsApi, type AnalyticsConversationSummary } from '../../services/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

type RouteMenuItem = {
  id: string;
  name: string;
  path: string;
  icon: JSX.Element;
  adminOnly?: boolean;
};

type ActionMenuItem = {
  id: string;
  name: string;
  action: 'new_chat' | 'search_chats';
  icon: JSX.Element;
};

type MenuItem = RouteMenuItem | ActionMenuItem;

type ChatScrollbarState = {
  show: boolean;
  height: number;
  top: number;
};

const MIN_CHAT_SCROLL_THUMB_PX = 48;

function measureChatScrollbar(element: HTMLDivElement | null): ChatScrollbarState {
  if (!element || element.scrollHeight <= element.clientHeight + 1) {
    return { show: false, height: MIN_CHAT_SCROLL_THUMB_PX, top: 0 };
  }

  const thumbHeight = Math.max(
    MIN_CHAT_SCROLL_THUMB_PX,
    Math.round((element.clientHeight / element.scrollHeight) * element.clientHeight)
  );
  const maxScrollTop = element.scrollHeight - element.clientHeight;
  const maxThumbTop = element.clientHeight - thumbHeight;
  const thumbTop = Math.round((element.scrollTop / maxScrollTop) * maxThumbTop);

  return { show: true, height: thumbHeight, top: thumbTop };
}

function parseTimestamp(value: string): Date | null {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;
  const directDate = new Date(rawValue);
  if (!Number.isNaN(directDate.getTime()) && /(?:z|[+-]\d{2}:\d{2})$/i.test(rawValue)) {
    return directDate;
  }
  const normalizedValue = rawValue.includes(' ') ? rawValue.replace(' ', 'T') : rawValue;
  const utcDate = new Date(`${normalizedValue}Z`);
  if (!Number.isNaN(utcDate.getTime())) return utcDate;
  return Number.isNaN(directDate.getTime()) ? null : directDate;
}

function formatRelativeUpdatedAt(value: string): string {
  const date = parseTimestamp(value);
  if (!date) return '';
  const deltaMs = Math.max(0, Date.now() - date.getTime());
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (deltaMs < hourMs) return `${Math.max(1, Math.floor(deltaMs / minuteMs))}m`;
  if (deltaMs < dayMs) return `${Math.max(1, Math.floor(deltaMs / hourMs))}h`;
  if (deltaMs < 7 * dayMs) return `${Math.max(1, Math.floor(deltaMs / dayMs))}d`;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function Icon({
  kind,
}: {
  kind: 'home' | 'new-chat' | 'search' | 'table' | 'dashboards' | 'flow' | 'settings' | 'users';
}) {
  if (kind === 'new-chat') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25V18A2.25 2.25 0 0117.25 20.25H6.75A2.25 2.25 0 014.5 18V6A2.25 2.25 0 016.75 3.75H14.25" />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
  }
  if (kind === 'table') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6.75A2.75 2.75 0 016.75 4h10.5A2.75 2.75 0 0120 6.75v10.5A2.75 2.75 0 0117.25 20H6.75A2.75 2.75 0 014 17.25V6.75zM4 9h16M9 4v16" />
      </svg>
    );
  }
  if (kind === 'dashboards') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V5m4 14v-8m4 8V7m4 12v-5m4 5V9" />
      </svg>
    );
  }
  if (kind === 'flow') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01M8 7h8M7 8v8M17 8v8M8 17h8" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7-3.5a7 7 0 00-.1-1.18l1.55-1.21a.75.75 0 00.18-.96l-1.47-2.55a.75.75 0 00-.9-.33l-1.86.75a6.95 6.95 0 00-2.04-1.18L14.08 3.3a.75.75 0 00-.74-.6h-2.94a.75.75 0 00-.74.6l-.28 1.98a6.95 6.95 0 00-2.04 1.18l-1.86-.75a.75.75 0 00-.9.33l-1.47 2.55a.75.75 0 00.18.96l1.55 1.21a7.84 7.84 0 000 2.36l-1.55 1.21a.75.75 0 00-.18.96l1.47 2.55a.75.75 0 00.9.33l1.86-.75a6.95 6.95 0 002.04 1.18l.28 1.98a.75.75 0 00.74.6h2.94a.75.75 0 00.74-.6l.28-1.98a6.95 6.95 0 002.04-1.18l1.86.75a.75.75 0 00.9-.33l1.47-2.55a.75.75 0 00-.18-.96l-1.55-1.21c.06-.39.1-.78.1-1.18z" />
      </svg>
    );
  }
  if (kind === 'users') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

function sortConversations(items: AnalyticsConversationSummary[]): AnalyticsConversationSummary[] {
  return items.slice().sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const HEADER_HEIGHT_PX = 56;
  const FOOTER_HEIGHT_PX = 34;
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [chatScrollbar, setChatScrollbar] = useState<ChatScrollbarState>({
    show: false,
    height: MIN_CHAT_SCROLL_THUMB_PX,
    top: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { activeConversationId, openConversation, openNewConversation, openSearch } = useAnalyticsChat();

  const topMenuItems: MenuItem[] = [
    { id: 'home', name: 'Home', path: '/home', icon: <Icon kind="home" /> },
    { id: 'new-chat', name: 'New chat', action: 'new_chat', icon: <Icon kind="new-chat" /> },
    { id: 'search-chats', name: 'Search chats', action: 'search_chats', icon: <Icon kind="search" /> },
    { id: 'data-sources', name: 'Data Source', path: '/data-sources', icon: <Icon kind="table" /> },
    { id: 'analytics', name: 'Analytics', path: '/analytics', icon: <Icon kind="dashboards" /> },
    { id: 'agent-builder', name: 'Agent Builder', path: '/agent-builder', icon: <Icon kind="flow" /> },
  ];

  const bottomMenuItems: RouteMenuItem[] = [
    { id: 'settings', name: 'Settings', path: '/settings', icon: <Icon kind="settings" /> },
    { id: 'users', name: 'Users', path: '/users', icon: <Icon kind="users" />, adminOnly: true },
  ];

  const recentChatsQuery = useQuery({
    queryKey: queryKeys.analytics.sidebarConversations(user?.user_id ?? 'anonymous'),
    queryFn: async () => {
      const response = await analyticsApi.listConversations(undefined, 20);
      return sortConversations(response.data.items || []);
    },
    enabled: isAuthenticated && !collapsed,
  });

  const updateChatScrollbar = useCallback(() => {
    setChatScrollbar(measureChatScrollbar(chatScrollRef.current));
  }, []);

  useEffect(() => {
    updateChatScrollbar();
  }, [collapsed, recentChatsQuery.data?.length, recentChatsQuery.isError, recentChatsQuery.isLoading, updateChatScrollbar]);

  useEffect(() => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement || collapsed) return;

    scrollElement.addEventListener('scroll', updateChatScrollbar, { passive: true });
    window.addEventListener('resize', updateChatScrollbar);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateChatScrollbar) : null;
    resizeObserver?.observe(scrollElement);
    if (scrollElement.firstElementChild) {
      resizeObserver?.observe(scrollElement.firstElementChild);
    }

    return () => {
      scrollElement.removeEventListener('scroll', updateChatScrollbar);
      window.removeEventListener('resize', updateChatScrollbar);
      resizeObserver?.disconnect();
    };
  }, [collapsed, updateChatScrollbar]);

  const renderMenuButton = (item: MenuItem) => {
    if ('adminOnly' in item && item.adminOnly && user?.group_id !== 0) return null;
    const isActive = 'path' in item ? location.pathname === item.path : false;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if ('path' in item) {
            navigate(item.path);
            return;
          }
          if (item.action === 'new_chat') {
            openNewConversation();
            return;
          }
          openSearch();
        }}
        className={`flex w-full items-center gap-3 transition-colors ${
          collapsed ? 'justify-center px-3 py-3' : 'justify-start px-4 py-3'
        } ${
          isActive
            ? 'bg-oracle-red/95 text-white shadow-[0_10px_24px_rgba(199,70,52,0.22)]'
            : 'text-gray-300 hover:bg-white/[0.07] hover:text-gray-100'
        }`}
        title={collapsed ? item.name : undefined}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span className="text-xs font-medium">{item.name}</span>}
      </button>
    );
  };

  return (
    <div
      className={`app-sidebar fixed left-0 z-40 flex flex-col text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-52'
      }`}
      style={{
        top: `${HEADER_HEIGHT_PX}px`,
        height: `calc(100vh - ${HEADER_HEIGHT_PX}px - ${FOOTER_HEIGHT_PX}px)`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`sidebar-toggle-button flex items-center gap-3 text-gray-300 transition-colors hover:bg-white/[0.07] hover:text-gray-100 ${
          collapsed ? 'justify-center px-3 py-3' : 'justify-start px-4 py-3'
        }`}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg className={`h-5 w-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <nav className="flex min-h-0 flex-1 flex-col py-2">
        <div className="shrink-0">{topMenuItems.map((item) => renderMenuButton(item))}</div>

        {!collapsed && (
          <section className="mt-2 min-h-0 flex-1 flex flex-col" aria-labelledby="sidebar-chats-heading">
            <div className="flex shrink-0 items-center justify-between px-4 pb-2">
              <p id="sidebar-chats-heading" className="text-sm font-medium text-white/90">
                Chats
              </p>
            </div>
            <div className="sidebar-chat-scroll-shell min-h-0 flex-1">
              <div ref={chatScrollRef} className="sidebar-chat-scroll h-full overflow-y-scroll px-2 pr-4">
                <div className="space-y-0.5 pb-2">
                  {recentChatsQuery.isLoading ? (
                    <p className="px-2 py-2 text-xs text-gray-400">Loading chats...</p>
                  ) : recentChatsQuery.isError ? (
                    <p className="px-2 text-xs text-red-300">Could not load chats</p>
                  ) : (recentChatsQuery.data || []).length === 0 ? (
                    <p className="px-2 text-xs text-gray-400">No chats yet</p>
                  ) : (
                    (recentChatsQuery.data || []).map((chat) => {
                      const isActiveChat = location.pathname === '/chat' && activeConversationId === chat.conversation_id;
                      return (
                        <button
                          key={chat.conversation_id}
                          type="button"
                          className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                            isActiveChat ? 'bg-white/10 text-white' : 'text-gray-100 hover:bg-white/5'
                          }`}
                          onClick={() => openConversation(chat.conversation_id, chat.title)}
                          title={chat.title}
                        >
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm leading-5">{chat.title || 'Analytics chat'}</span>
                            <span className="shrink-0 text-[11px] font-medium text-gray-400">
                              {formatRelativeUpdatedAt(chat.updated_at)}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div
                aria-hidden="true"
                className={`sidebar-chat-scroll-rail ${chatScrollbar.show ? 'opacity-100' : 'opacity-0'}`}
              >
                <span
                  className="sidebar-chat-scroll-thumb"
                  style={{
                    height: `${chatScrollbar.height}px`,
                    transform: `translateY(${chatScrollbar.top}px)`,
                  }}
                />
              </div>
            </div>
          </section>
        )}

        <div className={`mt-auto pb-4 ${collapsed ? '' : 'border-t border-white/10 pt-2'}`}>
          {bottomMenuItems.map((item) => renderMenuButton(item))}
        </div>
      </nav>
    </div>
  );
}
