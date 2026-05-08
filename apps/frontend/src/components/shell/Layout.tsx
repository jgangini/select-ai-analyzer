import type { ReactNode } from 'react';
import { useState } from 'react';

import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { AppBrand } from './AppBrand';
import { useAnalyticsChat } from '../../context/AnalyticsChatContext';

interface LayoutProps {
  appName: string;
  children: ReactNode;
  contentContainerClassName?: string;
  isAuthenticated: boolean;
  user: { group_id: number; user_id: number; username: string } | null;
  onLogout: () => void;
  sidebarChats: {
    recentConversations: {
      conversation_id: string;
      title: string;
      created_at: string;
      updated_at: string;
    }[];
    recentConversationsLoading: boolean;
    recentConversationsError: boolean;
  };
}

export function Layout({
  appName,
  children,
  contentContainerClassName,
  isAuthenticated,
  user,
  onLogout,
  sidebarChats,
}: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => sessionStorage.getItem('sidebarCollapsed') === 'true'
  );
  const analyticsChat = useAnalyticsChat();

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem('sidebarCollapsed', next ? 'true' : 'false');
      return next;
    });
  };

  return (
    <div className="app-shell-dark min-h-screen flex flex-col">
      <Header
        brand={<AppBrand appName={appName} className="flex-1" dividerClassName="h-8 app-brand-divider--light" />}
        username={user?.username ?? null}
        onLogout={onLogout}
      />
      <div className="app-content-layer flex flex-1 pt-14">
        <Sidebar
          activeConversationId={analyticsChat.activeConversationId}
          collapsed={sidebarCollapsed}
          isAuthenticated={isAuthenticated}
          user={user ? { groupId: user.group_id, userId: user.user_id } : null}
          onToggle={handleSidebarToggle}
          onOpenConversation={analyticsChat.openConversation}
          onOpenNewConversation={analyticsChat.openNewConversation}
          onOpenSearch={analyticsChat.openSearch}
          sidebarChats={sidebarChats}
        />
        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarCollapsed ? 'ml-16' : 'ml-52'
          }`}
          style={{ marginBottom: '34px' }}
        >
          <div className={contentContainerClassName ?? 'max-w-7xl mx-auto px-6 py-8'}>{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
