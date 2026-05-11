import { type FormEvent, type KeyboardEvent, type ReactNode, type RefObject, useEffect, useRef } from 'react';

import { LoadingState } from '../../common/LoadingState';
import { GraphIcon, MoreVerticalIcon, RefreshIcon, RenameIcon, TrashIcon } from './AnalyticsIcons';

interface AnalyticsChatHeaderProps {
  title: string;
  currentConversationId: string | null | undefined;
  isHeaderMenuOpen: boolean;
  isInlineRenaming: boolean;
  renameDraft: string;
  isRenaming: boolean;
  isDeleting: boolean;
  isGraphPanelOpen: boolean;
  hasLatestResult: boolean;
  dashboardDraftCount: number;
  headerMenuRef: RefObject<HTMLDivElement>;
  titleInputRef: RefObject<HTMLInputElement>;
  onRenameDraftChange: (value: string) => void;
  onRenameBlur: () => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onStartRename: () => void;
  onToggleHeaderMenu: () => void;
  onToggleDashboardTray: () => void;
  onToggleGraphPanel: () => void;
  onDeleteRequest: () => void;
}

export function AnalyticsChatHeader({
  title,
  currentConversationId,
  isHeaderMenuOpen,
  isInlineRenaming,
  renameDraft,
  isRenaming,
  isDeleting,
  isGraphPanelOpen,
  hasLatestResult,
  dashboardDraftCount,
  headerMenuRef,
  titleInputRef,
  onRenameDraftChange,
  onRenameBlur,
  onRenameKeyDown,
  onStartRename,
  onToggleHeaderMenu,
  onToggleDashboardTray,
  onToggleGraphPanel,
  onDeleteRequest,
}: AnalyticsChatHeaderProps) {
  return (
    <div
      className={`chat-conversation-header flex shrink-0 items-center gap-3 border-b border-oracle-border bg-gray-50 px-4 py-3 ${
        isHeaderMenuOpen ? 'chat-conversation-header--menu-open' : ''
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
        <span className="text-sm font-bold text-white">AI</span>
      </div>
      <div className="min-w-0">
        {isInlineRenaming && currentConversationId ? (
          <input
            ref={titleInputRef}
            type="text"
            value={renameDraft}
            disabled={isRenaming}
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onBlur={onRenameBlur}
            onKeyDown={onRenameKeyDown}
            className="input-oracle h-8 py-1 text-sm font-semibold"
            aria-label="Chat title"
          />
        ) : (
          <div className="truncate text-sm font-semibold text-oracle-dark-gray">{title}</div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-oracle-light-gray">Select AI Analytics</span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className={`relative rounded-md p-1.5 transition-colors ${
            dashboardDraftCount > 0
              ? 'bg-oracle-red text-white hover:bg-red-700'
              : 'text-oracle-medium-gray hover:bg-black/5'
          }`}
          aria-label="Visualization list"
          title="Visualization list"
          onClick={onToggleDashboardTray}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19V5m4 14v-8m4 8V7m4 12v-5m4 5V9" />
          </svg>
          {dashboardDraftCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-oracle-red shadow">
              {dashboardDraftCount}
            </span>
          ) : null}
        </button>
        <div className="relative" ref={headerMenuRef}>
          <button
            type="button"
            className="rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5"
            aria-label="Chat actions"
            aria-haspopup="menu"
            aria-expanded={isHeaderMenuOpen}
            title="Chat actions"
            onClick={onToggleHeaderMenu}
          >
            <MoreVerticalIcon />
          </button>
          {isHeaderMenuOpen && (
            <div
              className="chat-header-actions-menu absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
              role="menu"
              aria-label="Chat actions"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onStartRename}
                disabled={!currentConversationId || isRenaming || isDeleting || isInlineRenaming}
              >
                <RenameIcon />
                {isRenaming ? 'Renaming...' : 'Rename chat'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasLatestResult}
                onClick={onToggleGraphPanel}
              >
                <GraphIcon />
                {isGraphPanelOpen ? 'Hide graph' : 'Graph'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!currentConversationId || isDeleting}
                onClick={onDeleteRequest}
              >
                <TrashIcon />
                Delete chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AssistantTypingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="flex flex-row gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
        <span className="text-xs font-bold text-white">AI</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-semibold text-oracle-medium-gray">{agentName}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

type ChatListMessage<TResult> =
  | { id: string; role: 'user'; content: string; timestamp: Date }
  | { id: string; role: 'assistant'; content: string; timestamp: Date; result: TResult; question: string };

type AssistantChatListMessage<TResult> = Extract<ChatListMessage<TResult>, { role: 'assistant' }>;

function ChatMessageBubble<TResult>({
  message,
  agentName,
  userName,
  userInitials,
  renderAssistantResult,
}: {
  message: ChatListMessage<TResult>;
  agentName: string;
  userName: string;
  userInitials: string;
  renderAssistantResult: (message: AssistantChatListMessage<TResult>) => ReactNode;
}) {
  const isAssistant = message.role === 'assistant';
  const messageWidthClass = isAssistant ? 'w-full max-w-[52rem]' : 'max-w-[72%]';

  return (
    <div className={`flex min-w-0 gap-2.5 ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
          isAssistant ? 'bg-oracle-red' : 'bg-oracle-dark-gray'
        }`}
      >
        <span className="text-xs font-bold text-white">{isAssistant ? 'AI' : userInitials}</span>
      </div>

      <div className={`flex min-w-0 flex-col gap-1 ${messageWidthClass} ${isAssistant ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-semibold text-oracle-medium-gray">
            {isAssistant ? agentName : userName}
          </span>
          <span className="text-[10px] text-oracle-light-gray">{formatTime(message.timestamp)}</span>
        </div>

        <div
          className={`max-w-full rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
            isAssistant
              ? 'chat-assistant-message w-full rounded-tl-sm border border-gray-200 bg-white text-oracle-dark-gray'
              : 'rounded-tr-sm bg-oracle-dark-gray text-white'
          }`}
        >
          {isAssistant ? renderAssistantResult(message) : (
            <div className="whitespace-pre-wrap break-words text-right">{message.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsChatMessageList<TResult>({
  listRef,
  isLoading,
  messages,
  isAssistantPending,
  agentName,
  userName,
  userInitials,
  renderAssistantResult,
}: {
  listRef: RefObject<HTMLDivElement>;
  isLoading: boolean;
  messages: ChatListMessage<TResult>[];
  isAssistantPending: boolean;
  agentName: string;
  userName: string;
  userInitials: string;
  renderAssistantResult: (message: AssistantChatListMessage<TResult>) => ReactNode;
}) {
  return (
    <div ref={listRef} className="chat-message-list chat-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden p-4">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <LoadingState size="sm" label="Loading..." textClassName="text-oracle-medium-gray" />
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              agentName={agentName}
              userName={userName}
              userInitials={userInitials}
              renderAssistantResult={renderAssistantResult}
            />
          ))}
          {isAssistantPending ? <AssistantTypingIndicator agentName={agentName} /> : null}
        </>
      )}
    </div>
  );
}

export function AnalyticsSuggestedQuestionButtons({
  questions,
  disabled = false,
  onSelect,
  onRefreshQuestion,
}: {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void;
  onRefreshQuestion?: (questionIndex: number) => void;
}) {
  if (!questions.length) return null;

  return (
    <div className="grid w-full gap-2 sm:grid-cols-3" aria-label="Suggested questions">
      {questions.map((question, index) => (
        <div key={question} className="relative h-14">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="chat-sample-question flex h-14 w-full items-center rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-left text-sm leading-5 text-oracle-dark-gray shadow-sm transition hover:-translate-y-0.5 hover:border-oracle-red hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            title={question}
          >
            <span className="chat-sample-question-text pr-7">{question}</span>
          </button>
          {onRefreshQuestion ? (
            <button
              type="button"
              disabled={disabled}
              className="chat-sample-question-refresh absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-sm text-oracle-medium-gray transition hover:text-oracle-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oracle-red focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Cambiar pregunta sugerida ${index + 1}`}
              title="Cambiar pregunta"
              onClick={(event) => {
                event.stopPropagation();
                onRefreshQuestion(index);
              }}
            >
              <RefreshIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface AnalyticsChatComposerProps {
  value: string;
  placeholder: string;
  errorMessage?: string;
  isPending: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function AnalyticsChatComposer({
  value,
  placeholder,
  errorMessage,
  isPending,
  onChange,
  onSubmit,
}: AnalyticsChatComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 224)}px`;
  }, [value]);

  const submitQuestion = (event?: FormEvent) => {
    event?.preventDefault();
    if (!value.trim() || isPending) return;
    onSubmit();
  };

  return (
    <form onSubmit={submitQuestion} className="relative w-full">
      {errorMessage && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      <div className="chat-composer-surface flex w-full items-end gap-2 rounded-2xl border border-oracle-border bg-white px-3 py-2 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={1}
            className="chat-composer-input block max-h-56 min-h-8 min-w-[12rem] w-full resize-none overflow-hidden border-0 bg-transparent py-1 text-sm leading-6 text-oracle-dark-gray outline-none placeholder:text-oracle-medium-gray selection:bg-gray-200 selection:text-oracle-dark-gray"
            placeholder={placeholder}
            aria-label={placeholder}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-gramm-editor="false"
            data-enable-grammarly="false"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                submitQuestion(event);
              }
            }}
          />
        </div>
        <button
          type="submit"
          className="mb-0.5 shrink-0 rounded-full bg-oracle-red p-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!value.trim() || isPending}
          title="Send"
          aria-label="Send"
        >
          {isPending ? (
            <svg className="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
