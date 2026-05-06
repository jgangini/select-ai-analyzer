import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AnalyticsChatContextType {
  isSearchOpen: boolean;
  activeConversationId: string | null;
  activeConversationTitle: string | null;
  openSearch: () => void;
  closeSearch: () => void;
  openConversation: (conversationId: string, title?: string | null) => void;
  openNewConversation: () => void;
  attachConversation: (conversationId: string, title?: string | null) => void;
}

const AnalyticsChatContext = createContext<AnalyticsChatContextType | undefined>(undefined);

export function AnalyticsChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(null);

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => setIsSearchOpen(false);

  const openConversation = (conversationId: string, title?: string | null) => {
    setActiveConversationId(conversationId);
    setActiveConversationTitle(title ?? null);
    setIsSearchOpen(false);
    navigate('/chat');
  };

  const openNewConversation = () => {
    setActiveConversationId(null);
    setActiveConversationTitle(null);
    setIsSearchOpen(false);
    navigate('/chat');
  };

  const attachConversation = (conversationId: string, title?: string | null) => {
    setActiveConversationId(conversationId);
    if (title !== undefined) {
      setActiveConversationTitle(title);
    }
  };

  const value = useMemo<AnalyticsChatContextType>(
    () => ({
      isSearchOpen,
      activeConversationId,
      activeConversationTitle,
      openSearch,
      closeSearch,
      openConversation,
      openNewConversation,
      attachConversation,
    }),
    [isSearchOpen, activeConversationId, activeConversationTitle]
  );

  return <AnalyticsChatContext.Provider value={value}>{children}</AnalyticsChatContext.Provider>;
}

export function useAnalyticsChat(): AnalyticsChatContextType {
  const context = useContext(AnalyticsChatContext);
  if (!context) {
    throw new Error('useAnalyticsChat must be used within AnalyticsChatProvider');
  }
  return context;
}
