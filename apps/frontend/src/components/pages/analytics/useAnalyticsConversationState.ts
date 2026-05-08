import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAnalyticsChat } from '../../../context/AnalyticsChatContext';
import { getAnalyticsErrorMessage } from './analyticsChatPanelUtils';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type ApiResponse<T> = Promise<{ data: T }>;
type AnalyticsAskRequest = {
  question: string;
  max_rows?: number;
  conversation_id?: string;
};
type AnalyticsAskResponse = {
  run_id: string;
  conversation_id: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec: {
    type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
    title?: string;
    x?: string;
    y?: string;
    series?: string;
  };
  agent_trace: Array<{
    stage: string;
    status: string;
    rows?: number;
    profile_name?: string;
    objects?: Array<{ owner?: string; name?: string; columns?: string[] }>;
  }>;
};
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

export type AnalyticsChatMessage =
  | { id: string; role: 'user'; content: string; timestamp: Date }
  | { id: string; role: 'assistant'; content: string; timestamp: Date; result: AnalyticsAskResponse; question: string };

type AnalyticsConversationClient = {
  ask: (payload: AnalyticsAskRequest) => ApiResponse<AnalyticsAskResponse>;
  getConversation: (conversationId: string, maxRows?: number) => ApiResponse<AnalyticsConversationDetail>;
  renameConversation: (conversationId: string, title: string) => ApiResponse<AnalyticsConversationSummary>;
  deleteConversation: (conversationId: string) => Promise<unknown>;
};

type DataSourcesClient = {
  list: () => ApiResponse<{ items: DataSourceSummary[] }>;
};

const analyticsConversationQueryKey = (conversationId: string | null) =>
  ['analytics', 'conversation', conversationId] as const;
const dataSourcesListQueryKey = ['data-sources', 'list'] as const;

function buildConversationMessages(conversation: AnalyticsConversationDetail): AnalyticsChatMessage[] {
  return conversation.messages.flatMap((message) => {
    const timestamp = message.created_at ? new Date(message.created_at) : new Date();
    return [
      {
        id: `${message.run_id}-user`,
        role: 'user' as const,
        content: message.question,
        timestamp,
      },
      {
        id: `${message.run_id}-assistant`,
        role: 'assistant' as const,
        content: message.result.answer,
        timestamp,
        result: message.result,
        question: message.question,
      },
    ];
  });
}

function findLatestMessage<Role extends AnalyticsChatMessage['role']>(
  messages: AnalyticsChatMessage[],
  role: Role
): Extract<AnalyticsChatMessage, { role: Role }> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === role) return message as Extract<AnalyticsChatMessage, { role: Role }>;
  }
  return undefined;
}

function findLatestAssistantMessage(messages: AnalyticsChatMessage[]) {
  return findLatestMessage(messages, 'assistant');
}

function findLatestUserQuestion(messages: AnalyticsChatMessage[]): string {
  return findLatestMessage(messages, 'user')?.content || '';
}

function useConversationMessages(activeConversationId: string | null, analyticsClient: AnalyticsConversationClient) {
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
  }, [activeConversationId]);

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

function useAskQuestion({
  activeConversationTitle,
  attachConversation,
  analyticsClient,
  conversationId,
  setConversationId,
  setErrorMessage,
  setMessages,
}: {
  activeConversationTitle: string | null;
  attachConversation: (conversationId: string, title: string) => void;
  analyticsClient: AnalyticsConversationClient;
  conversationId: string | null;
  setConversationId: Dispatch<SetStateAction<string | null>>;
  setErrorMessage: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<AnalyticsChatMessage[]>>;
}) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');

  const askMutation = useMutation({
    mutationFn: (text: string) =>
      analyticsClient.ask({ question: text, max_rows: 500, conversation_id: conversationId || undefined }).then((response) => response.data),
    onMutate: (text) => {
      setErrorMessage('');
      setQuestion('');
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() },
      ]);
    },
    onSuccess: (result, text) => {
      setConversationId(result.conversation_id);
      attachConversation(result.conversation_id, activeConversationTitle ?? text.slice(0, 120));
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: result.answer, timestamp: new Date(), result, question: text },
      ]);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => setErrorMessage(getAnalyticsErrorMessage(error)),
  });

  const submitQuestion = () => {
    const normalized = question.trim();
    if (!normalized || askMutation.isPending) return;
    setErrorMessage('');
    askMutation.mutate(normalized);
  };

  return { isAskPending: askMutation.isPending, question, setQuestion, submitQuestion };
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
  const { activeConversationId, activeConversationTitle, attachConversation, openNewConversation } = useAnalyticsChat();
  const [isGraphPanelOpen, setIsGraphPanelOpen] = useState(false);
  const { headerMenuRef, isHeaderMenuOpen, setIsHeaderMenuOpen } = useHeaderMenu();
  const conversation = useConversationMessages(activeConversationId, analyticsClient);
  const currentConversationId = activeConversationId || conversation.conversationId;
  const conversationTitle = activeConversationTitle || conversation.conversationQuery.data?.title || 'New analytics chat';
  const latestResult = useMemo(() => findLatestAssistantMessage(conversation.messages)?.result, [conversation.messages]);
  const latestQuestion = useMemo(() => findLatestUserQuestion(conversation.messages), [conversation.messages]);
  const ask = useAskQuestion({
    activeConversationTitle,
    attachConversation,
    analyticsClient,
    conversationId: conversation.conversationId,
    setConversationId: conversation.setConversationId,
    setErrorMessage: conversation.setErrorMessage,
    setMessages: conversation.setMessages,
  });
  const deletion = useConversationDelete({
    openNewConversation,
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
    isAskPending: ask.isAskPending,
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
