import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useAnalyticsChat } from '../../../context/AnalyticsChatContext';
import { createClientId } from '../../../lib/clientId';
import {
  buildConversationMessages,
  findLatestAssistantMessage,
  findLatestUserQuestion,
  getAnalyticsErrorMessage,
  type AnalyticsChatMessage,
  type AnalyticsChatResult,
} from './analyticsChatPanelUtils';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type ApiResponse<T> = Promise<{ data: T }>;
type AnalyticsAskRequest = {
  question: string;
  max_rows?: number;
  conversation_id?: string;
};
type AnalyticsAskResponse = AnalyticsChatResult;
type AnalyticsConversationSummary = {
  conversation_id: string;
  title: string;
  turns: number;
  last_message_preview: string;
  created_at: string;
  updated_at: string;
};
type AnalyticsConversationDetail = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Array<{
    run_id: string;
    question: string;
    created_at: string;
    result: AnalyticsAskResponse;
  }>;
};
type DataSourceSummary = {
  owner_name: string;
  table_name: string;
  row_count?: number;
  source_type?: string;
};

type AnalyticsConversationClient = {
  ask: (payload: AnalyticsAskRequest) => ApiResponse<AnalyticsAskResponse>;
  getConversation: (conversationId: string, maxRows?: number) => ApiResponse<AnalyticsConversationDetail>;
  renameConversation: (conversationId: string, title: string) => ApiResponse<AnalyticsConversationSummary>;
  deleteConversation: (conversationId: string) => Promise<unknown>;
};

type DataSourcesClient = {
  list: () => ApiResponse<{ items: DataSourceSummary[] }>;
};
type AskQuestionVariables = {
  conversationId: string | null;
  draftVersion: number;
  text: string;
  title: string;
};
type UseAskQuestionOptions = {
  activeConversationId: string | null;
  activeConversationTitle: string | null;
  attachConversation: (conversationId: string, title: string) => void;
  analyticsClient: AnalyticsConversationClient;
  conversationId: string | null;
  newConversationVersion: number;
  finishConversationProcessing: (conversationId: string) => void;
  finishDraftProcessing: (draftVersion: number) => void;
  isConversationProcessing: (conversationId: string | null | undefined) => boolean;
  isDraftProcessing: (draftVersion: number) => boolean;
  markConversationUnread: (conversationId: string) => void;
  setConversationId: Dispatch<SetStateAction<string | null>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<AnalyticsChatMessage[]>>;
  startConversationProcessing: (conversationId: string) => void;
  startDraftProcessing: (draftVersion: number, title?: string) => void;
};

const analyticsConversationQueryKey = (conversationId: string | null) =>
  ['analytics', 'conversation', conversationId] as const;
const dataSourcesListQueryKey = ['data-sources', 'list'] as const;

function upsertSidebarConversation(
  queryClient: QueryClient,
  conversation: AnalyticsConversationSummary
) {
  queryClient.setQueriesData<AnalyticsConversationSummary[]>(
    { queryKey: ['analytics', 'sidebar-conversations'] },
    (currentConversations) => {
      if (!Array.isArray(currentConversations)) return currentConversations;
      return [
        conversation,
        ...currentConversations.filter((current) => current.conversation_id !== conversation.conversation_id),
      ];
    }
  );
}

function sidebarConversationFromResult(
  result: AnalyticsAskResponse,
  variables: AskQuestionVariables
): AnalyticsConversationSummary {
  const timestamp = new Date().toISOString();
  return {
    conversation_id: result.conversation_id,
    title: variables.title,
    turns: 1,
    last_message_preview: variables.text,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function useConversationMessages(
  activeConversationId: string | null,
  newConversationVersion: number,
  analyticsClient: AnalyticsConversationClient
) {
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AnalyticsChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const conversationQuery = useQuery({
    queryKey: analyticsConversationQueryKey(activeConversationId),
    queryFn: async () => {
      if (!activeConversationId) throw new Error('Conversation id is required.');
      const response = await analyticsClient.getConversation(activeConversationId, 500);
      return response.data;
    },
    enabled: Boolean(activeConversationId),
  });

  useEffect(() => {
    if (!activeConversationId) {
      setConversationId(null);
      setMessages([]);
      setErrorMessage('');
    }
  }, [activeConversationId, newConversationVersion]);

  useEffect(() => {
    const conversation = conversationQuery.data;
    if (!conversation) return;
    setConversationId(conversation.conversation_id);
    setMessages(buildConversationMessages(conversation));
  }, [conversationQuery.data]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return { conversationId, conversationQuery, errorMessage, listRef, messages, setConversationId, setErrorMessage, setMessages };
}

function useHeaderMenu() {
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHeaderMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (headerMenuRef.current && target && !headerMenuRef.current.contains(target)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isHeaderMenuOpen]);

  return { headerMenuRef, isHeaderMenuOpen, setIsHeaderMenuOpen };
}

function useVisibleAskTarget(activeConversationId: string | null, newConversationVersion: number) {
  const activeConversationIdRef = useRef(activeConversationId);
  const newConversationVersionRef = useRef(newConversationVersion);
  activeConversationIdRef.current = activeConversationId;
  newConversationVersionRef.current = newConversationVersion;

  return (variables: AskQuestionVariables) => {
    if (variables.conversationId) {
      return activeConversationIdRef.current === variables.conversationId;
    }
    return activeConversationIdRef.current === null && newConversationVersionRef.current === variables.draftVersion;
  };
}

function useAskQuestion(options: UseAskQuestionOptions) {
  const {
    activeConversationId,
    activeConversationTitle,
    attachConversation,
    analyticsClient,
    conversationId,
    finishConversationProcessing,
    finishDraftProcessing,
    isConversationProcessing,
    isDraftProcessing,
    markConversationUnread,
    newConversationVersion,
    setConversationId,
    setErrorMessage,
    setMessages,
    startConversationProcessing,
    startDraftProcessing,
  } = options;
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const shouldApplyResultToVisibleConversation = useVisibleAskTarget(activeConversationId, newConversationVersion);

  const askMutation = useMutation({
    mutationFn: (variables: AskQuestionVariables) =>
      analyticsClient.ask({
        question: variables.text,
        max_rows: 500,
        conversation_id: variables.conversationId || undefined,
      }).then((response) => response.data),
    onMutate: (variables) => {
      setErrorMessage('');
      setQuestion('');
      if (variables.conversationId) {
        startConversationProcessing(variables.conversationId);
      } else {
        startDraftProcessing(variables.draftVersion, variables.title);
      }
      setMessages((prev) => [
        ...prev,
        { id: createClientId('message'), role: 'user', content: variables.text, timestamp: new Date() },
      ]);
    },
    onSuccess: (result, variables) => {
      if (variables.conversationId) {
        finishConversationProcessing(variables.conversationId);
      } else {
        finishDraftProcessing(variables.draftVersion);
      }
      finishConversationProcessing(result.conversation_id);
      upsertSidebarConversation(queryClient, sidebarConversationFromResult(result, variables));
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      if (!shouldApplyResultToVisibleConversation(variables)) {
        markConversationUnread(result.conversation_id);
        return;
      }
      setConversationId(result.conversation_id);
      attachConversation(result.conversation_id, variables.title);
      setMessages((prev) => [
        ...prev,
        { id: createClientId('message'), role: 'assistant', content: result.answer, timestamp: new Date(), result, question: variables.text },
      ]);
    },
    onError: (error, variables) => {
      if (variables.conversationId) {
        finishConversationProcessing(variables.conversationId);
      } else {
        finishDraftProcessing(variables.draftVersion);
      }
      if (shouldApplyResultToVisibleConversation(variables)) {
        setErrorMessage(getAnalyticsErrorMessage(error));
      }
    },
  });

  const submitQuestion = () => {
    const normalized = question.trim();
    const currentDraftVersion = newConversationVersion;
    if (!normalized || isConversationProcessing(conversationId) || (!conversationId && isDraftProcessing(currentDraftVersion))) return;
    setErrorMessage('');
    askMutation.mutate({
      conversationId,
      draftVersion: currentDraftVersion,
      text: normalized,
      title: activeConversationTitle ?? normalized.slice(0, 120),
    });
  };

  const isAskPending = conversationId ? isConversationProcessing(conversationId) : isDraftProcessing(newConversationVersion);

  return { isAskPending, question, setQuestion, submitQuestion };
}

function useConversationDelete({
  openNewConversation,
  analyticsClient,
  setConversationId,
  setIsGraphPanelOpen,
  setIsHeaderMenuOpen,
  setMessages,
  showToast,
}: {
  openNewConversation: () => void;
  analyticsClient: AnalyticsConversationClient;
  setConversationId: Dispatch<SetStateAction<string | null>>;
  setIsGraphPanelOpen: Dispatch<SetStateAction<boolean>>;
  setIsHeaderMenuOpen: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<AnalyticsChatMessage[]>>;
  showToast: ShowToast;
}) {
  const queryClient = useQueryClient();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => analyticsClient.deleteConversation(id),
    onSuccess: (_response, deletedConversationId) => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.removeQueries({ queryKey: analyticsConversationQueryKey(deletedConversationId) });
      setMessages([]);
      setConversationId(null);
      setIsDeleteConfirmOpen(false);
      setIsHeaderMenuOpen(false);
      setIsGraphPanelOpen(false);
      openNewConversation();
      showToast('Chat deleted.', 'success');
    },
    onError: (error) => showToast(getAnalyticsErrorMessage(error), 'error'),
  });

  const requestDeleteConversation = () => {
    setIsDeleteConfirmOpen(true);
    setIsHeaderMenuOpen(false);
  };

  return { deleteConversationMutation, isDeleteConfirmOpen, requestDeleteConversation, setIsDeleteConfirmOpen };
}

function useConversationRename({
  attachConversation,
  analyticsClient,
  conversationTitle,
  currentConversationId,
  deleteConversationPending,
  setIsHeaderMenuOpen,
  showToast,
}: {
  attachConversation: (conversationId: string, title: string) => void;
  analyticsClient: AnalyticsConversationClient;
  conversationTitle: string;
  currentConversationId: string | null;
  deleteConversationPending: boolean;
  setIsHeaderMenuOpen: Dispatch<SetStateAction<boolean>>;
  showToast: ShowToast;
}) {
  const queryClient = useQueryClient();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipBlurRenameRef = useRef(false);
  const [isInlineRenaming, setIsInlineRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      analyticsClient.renameConversation(id, title).then((response) => response.data),
    onSuccess: (conversation) => {
      attachConversation(conversation.conversation_id, conversation.title);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: analyticsConversationQueryKey(conversation.conversation_id) });
      setIsInlineRenaming(false);
      setIsHeaderMenuOpen(false);
      showToast('Chat renamed.', 'success');
    },
    onError: (error) => {
      setRenameDraft(conversationTitle);
      setIsInlineRenaming(false);
      showToast(getAnalyticsErrorMessage(error), 'error');
    },
  });

  useEffect(() => {
    if (!isInlineRenaming) return;
    window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  }, [isInlineRenaming]);

  const submitInlineRename = () => {
    if (!currentConversationId || renameConversationMutation.isPending) return;
    const normalizedTitle = renameDraft.trim();
    if (!normalizedTitle || normalizedTitle === conversationTitle) {
      setRenameDraft(conversationTitle);
      setIsInlineRenaming(false);
      return;
    }
    renameConversationMutation.mutate({ id: currentConversationId, title: normalizedTitle });
  };

  const cancelInlineRename = () => {
    skipBlurRenameRef.current = true;
    setRenameDraft(conversationTitle);
    setIsInlineRenaming(false);
  };

  const handleRenameBlur = () => {
    if (skipBlurRenameRef.current) {
      skipBlurRenameRef.current = false;
      return;
    }
    submitInlineRename();
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitInlineRename();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelInlineRename();
    }
  };

  const startInlineRename = () => {
    if (!currentConversationId || renameConversationMutation.isPending || deleteConversationPending) return;
    setRenameDraft(conversationTitle);
    setIsInlineRenaming(true);
    setIsHeaderMenuOpen(false);
  };

  return {
    handleRenameBlur,
    handleRenameKeyDown,
    isInlineRenaming,
    renameConversationMutation,
    renameDraft,
    setRenameDraft,
    startInlineRename,
    titleInputRef,
  };
}

export function useAnalyticsConversationState({
  agentName,
  analyticsClient,
  dataSourcesClient,
  showToast,
}: {
  agentName: string;
  analyticsClient: AnalyticsConversationClient;
  dataSourcesClient: DataSourcesClient;
  showToast: ShowToast;
}) {
  const {
    activeConversationId,
    activeConversationTitle,
    attachConversation,
    clearConversationStatus,
    finishConversationProcessing,
    finishDraftProcessing,
    isConversationProcessing,
    isDraftProcessing,
    markConversationUnread,
    newConversationVersion,
    openNewConversation,
    startConversationProcessing,
    startDraftProcessing,
  } = useAnalyticsChat();
  const [isGraphPanelOpen, setIsGraphPanelOpen] = useState(false);
  const { headerMenuRef, isHeaderMenuOpen, setIsHeaderMenuOpen } = useHeaderMenu();
  const conversation = useConversationMessages(activeConversationId, newConversationVersion, analyticsClient);
  const currentConversationId = activeConversationId || conversation.conversationId;
  const conversationTitle = activeConversationTitle || conversation.conversationQuery.data?.title || 'New analytics chat';
  const latestResult = useMemo(() => findLatestAssistantMessage(conversation.messages)?.result, [conversation.messages]);
  const latestQuestion = useMemo(() => findLatestUserQuestion(conversation.messages), [conversation.messages]);
  const ask = useAskQuestion({
    activeConversationId,
    activeConversationTitle,
    attachConversation,
    analyticsClient,
    conversationId: currentConversationId,
    finishConversationProcessing,
    finishDraftProcessing,
    isConversationProcessing,
    isDraftProcessing,
    markConversationUnread,
    newConversationVersion,
    setConversationId: conversation.setConversationId,
    setErrorMessage: conversation.setErrorMessage,
    setMessages: conversation.setMessages,
    startConversationProcessing,
    startDraftProcessing,
  });
  const deletion = useConversationDelete({
    openNewConversation: () => {
      if (currentConversationId) clearConversationStatus(currentConversationId);
      openNewConversation();
    },
    analyticsClient,
    setConversationId: conversation.setConversationId,
    setIsGraphPanelOpen,
    setIsHeaderMenuOpen,
    setMessages: conversation.setMessages,
    showToast,
  });
  const rename = useConversationRename({
    attachConversation,
    analyticsClient,
    conversationTitle,
    currentConversationId,
    deleteConversationPending: deletion.deleteConversationMutation.isPending,
    setIsHeaderMenuOpen,
    showToast,
  });
  const graphDataSourcesQuery = useQuery({
    queryKey: dataSourcesListQueryKey,
    queryFn: () => dataSourcesClient.list().then((response) => response.data.items),
    enabled: isGraphPanelOpen,
  });
  const toggleGraphPanel = () => {
    setIsGraphPanelOpen((current) => !current);
    setIsHeaderMenuOpen(false);
  };

  return {
    ...ask,
    agentName,
    conversationTitle,
    currentConversationId,
    deleteConversationMutation: deletion.deleteConversationMutation,
    errorMessage: conversation.errorMessage,
    graphDataSources: graphDataSourcesQuery.data || [],
    handleRenameBlur: rename.handleRenameBlur,
    handleRenameKeyDown: rename.handleRenameKeyDown,
    headerMenuRef,
    isDeleteConfirmOpen: deletion.isDeleteConfirmOpen,
    isGraphPanelOpen,
    isHeaderMenuOpen,
    isInitialCentered: conversation.messages.length === 0 && !conversation.conversationQuery.isLoading,
    isInlineRenaming: rename.isInlineRenaming,
    isLoadingConversation: conversation.conversationQuery.isLoading,
    latestQuestion,
    latestResult,
    listRef: conversation.listRef,
    messages: conversation.messages,
    renameConversationMutation: rename.renameConversationMutation,
    renameDraft: rename.renameDraft,
    requestDeleteConversation: deletion.requestDeleteConversation,
    setIsDeleteConfirmOpen: deletion.setIsDeleteConfirmOpen,
    setIsGraphPanelOpen,
    setIsHeaderMenuOpen,
    setRenameDraft: rename.setRenameDraft,
    startInlineRename: rename.startInlineRename,
    titleInputRef: rename.titleInputRef,
    toggleGraphPanel,
  };
}
