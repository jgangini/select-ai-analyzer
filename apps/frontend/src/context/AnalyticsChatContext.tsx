import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export type DraftConversationPreview = {
  draftVersion: number;
  title: string;
  created_at: string;
  updated_at: string;
};

interface AnalyticsChatContextType {
  isSearchOpen: boolean;
  activeConversationId: string | null;
  activeConversationTitle: string | null;
  newConversationVersion: number;
  draftConversations: DraftConversationPreview[];
  processingConversationIds: string[];
  processingDraftVersions: number[];
  unreadConversationIds: string[];
  openSearch: () => void;
  closeSearch: () => void;
  openConversation: (conversationId: string, title?: string | null) => void;
  openNewConversation: () => void;
  attachConversation: (conversationId: string, title?: string | null) => void;
  startConversationProcessing: (conversationId: string) => void;
  finishConversationProcessing: (conversationId: string) => void;
  startDraftProcessing: (draftVersion: number, title?: string) => void;
  finishDraftProcessing: (draftVersion: number) => void;
  markConversationUnread: (conversationId: string) => void;
  markConversationRead: (conversationId: string) => void;
  clearConversationStatus: (conversationId: string) => void;
  isConversationProcessing: (conversationId: string | null | undefined) => boolean;
  isDraftProcessing: (draftVersion: number) => boolean;
  hasUnreadResponse: (conversationId: string | null | undefined) => boolean;
}

const AnalyticsChatContext = createContext<AnalyticsChatContextType | undefined>(undefined);

function addUnique<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items : [...items, item];
}

function removeItem<T>(items: T[], item: T): T[] {
  return items.filter((currentItem) => currentItem !== item);
}

function upsertDraftConversation(
  drafts: DraftConversationPreview[],
  draftVersion: number,
  title?: string
): DraftConversationPreview[] {
  const timestamp = new Date().toISOString();
  const draftTitle = String(title || 'New analytics chat').trim() || 'New analytics chat';
  const nextDraft = {
    draftVersion,
    title: draftTitle,
    created_at: timestamp,
    updated_at: timestamp,
  };
  return [
    nextDraft,
    ...drafts.filter((draft) => draft.draftVersion !== draftVersion),
  ];
}

function useConversationStatusState() {
  const [newConversationVersion, setNewConversationVersion] = useState(0);
  const [draftConversations, setDraftConversations] = useState<DraftConversationPreview[]>([]);
  const [processingConversationIds, setProcessingConversationIds] = useState<string[]>([]);
  const [processingDraftVersions, setProcessingDraftVersions] = useState<number[]>([]);
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>([]);

  const markConversationRead = useCallback((conversationId: string) => {
    setUnreadConversationIds((currentIds) => removeItem(currentIds, conversationId));
  }, []);

  const markConversationUnread = useCallback((conversationId: string) => {
    setUnreadConversationIds((currentIds) => addUnique(currentIds, conversationId));
  }, []);

  const startConversationProcessing = useCallback((conversationId: string) => {
    setProcessingConversationIds((currentIds) => addUnique(currentIds, conversationId));
    setUnreadConversationIds((currentIds) => removeItem(currentIds, conversationId));
  }, []);

  const finishConversationProcessing = useCallback((conversationId: string) => {
    setProcessingConversationIds((currentIds) => removeItem(currentIds, conversationId));
  }, []);

  const startDraftProcessing = useCallback((draftVersion: number, title?: string) => {
    setProcessingDraftVersions((currentVersions) => addUnique(currentVersions, draftVersion));
    setDraftConversations((currentDrafts) => upsertDraftConversation(currentDrafts, draftVersion, title));
  }, []);

  const finishDraftProcessing = useCallback((draftVersion: number) => {
    setProcessingDraftVersions((currentVersions) => removeItem(currentVersions, draftVersion));
    setDraftConversations((currentDrafts) =>
      currentDrafts.filter((draft) => draft.draftVersion !== draftVersion)
    );
  }, []);

  const clearConversationStatus = useCallback((conversationId: string) => {
    setProcessingConversationIds((currentIds) => removeItem(currentIds, conversationId));
    setUnreadConversationIds((currentIds) => removeItem(currentIds, conversationId));
  }, []);

  const isConversationProcessing = useCallback(
    (conversationId: string | null | undefined) =>
      Boolean(conversationId && processingConversationIds.includes(conversationId)),
    [processingConversationIds]
  );

  const isDraftProcessing = useCallback(
    (draftVersion: number) => processingDraftVersions.includes(draftVersion),
    [processingDraftVersions]
  );

  const hasUnreadResponse = useCallback(
    (conversationId: string | null | undefined) =>
      Boolean(conversationId && unreadConversationIds.includes(conversationId)),
    [unreadConversationIds]
  );

  const advanceNewConversationVersion = useCallback(() => {
    setNewConversationVersion((currentVersion) => currentVersion + 1);
  }, []);

  return {
    advanceNewConversationVersion,
    clearConversationStatus,
    draftConversations,
    finishConversationProcessing,
    finishDraftProcessing,
    hasUnreadResponse,
    isConversationProcessing,
    isDraftProcessing,
    markConversationRead,
    markConversationUnread,
    newConversationVersion,
    processingConversationIds,
    processingDraftVersions,
    startConversationProcessing,
    startDraftProcessing,
    unreadConversationIds,
  };
}

export function AnalyticsChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState<string | null>(null);
  const status = useConversationStatusState();

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const openConversation = useCallback((conversationId: string, title?: string | null) => {
    setActiveConversationId(conversationId);
    setActiveConversationTitle(title ?? null);
    setIsSearchOpen(false);
    status.markConversationRead(conversationId);
    navigate('/chat');
  }, [navigate, status]);

  const openNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversationTitle(null);
    setIsSearchOpen(false);
    status.advanceNewConversationVersion();
    navigate('/chat');
  }, [navigate, status]);

  const attachConversation = useCallback((conversationId: string, title?: string | null) => {
    setActiveConversationId(conversationId);
    if (title !== undefined) {
      setActiveConversationTitle(title);
    }
    status.markConversationRead(conversationId);
  }, [status]);

  const value = useMemo<AnalyticsChatContextType>(
    () => ({
      isSearchOpen,
      activeConversationId,
      activeConversationTitle,
      newConversationVersion: status.newConversationVersion,
      draftConversations: status.draftConversations,
      processingConversationIds: status.processingConversationIds,
      processingDraftVersions: status.processingDraftVersions,
      unreadConversationIds: status.unreadConversationIds,
      openSearch,
      closeSearch,
      openConversation,
      openNewConversation,
      attachConversation,
      startConversationProcessing: status.startConversationProcessing,
      finishConversationProcessing: status.finishConversationProcessing,
      startDraftProcessing: status.startDraftProcessing,
      finishDraftProcessing: status.finishDraftProcessing,
      markConversationUnread: status.markConversationUnread,
      markConversationRead: status.markConversationRead,
      clearConversationStatus: status.clearConversationStatus,
      isConversationProcessing: status.isConversationProcessing,
      isDraftProcessing: status.isDraftProcessing,
      hasUnreadResponse: status.hasUnreadResponse,
    }),
    [
      isSearchOpen,
      activeConversationId,
      activeConversationTitle,
      status,
      openSearch,
      closeSearch,
      openConversation,
      openNewConversation,
      attachConversation,
    ]
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
