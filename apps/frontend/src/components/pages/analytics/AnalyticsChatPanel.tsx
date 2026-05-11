import { useCallback, useEffect, useState } from 'react';

import { replaceSuggestedQuestionAt, selectRandomSuggestedQuestions } from '../../../config/suggestedQuestions';
import { analyticsApi } from '../../../services/analyticsApi';
import { dashboardsApi } from '../../../services/dashboardsApi';
import { dataSourcesApi } from '../../../services/dataSourcesApi';
import { OracleAgentGraphPanel } from './OracleAgentGraphPanel';
import { ChartPreview } from './AnalyticsChartPreview';
import {
  AnalyticsChatComposer,
  AnalyticsChatHeader,
  AnalyticsChatMessageList,
  AnalyticsSuggestedQuestionButtons,
} from './AnalyticsChatPanelParts';
import { AssistantResult } from './AnalyticsChatResult';
import { ResultTable } from './AnalyticsResultTable';
import { useAnalyticsConversationState } from './useAnalyticsConversationState';
import { useAnalyticsDashboardDraft } from './useAnalyticsDashboardDraft';
import { AnalyticsAddVisualizationModal, AnalyticsDashboardTray, AnalyticsDeleteChatModal } from './AnalyticsChatOverlays';
import { buildDashboardDraftItem, getUserInitials } from './analyticsChatPanelUtils';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

export function AnalyticsChatPanel({
  agentName,
  showToast,
  suggestedQuestions = [],
  userName = 'You',
}: {
  agentName: string;
  showToast: ShowToast;
  suggestedQuestions?: string[];
  userName?: string;
}) {
  const conversation = useAnalyticsConversationState({ agentName, analyticsClient: analyticsApi, dataSourcesClient: dataSourcesApi, showToast });
  const dashboard = useAnalyticsDashboardDraft({
    conversationTitle: conversation.conversationTitle,
    dashboardsClient: dashboardsApi,
    showToast,
  });
  const composerProps = {
    value: conversation.question,
    errorMessage: conversation.errorMessage,
    isPending: conversation.isAskPending,
    onChange: conversation.setQuestion,
    onSubmit: conversation.submitQuestion,
  };
  const renderComposer = (placeholder: string) => <AnalyticsChatComposer {...composerProps} placeholder={placeholder} />;
  const userInitials = getUserInitials(userName || 'You');
  const [startQuestions, setStartQuestions] = useState<string[]>(() => selectRandomSuggestedQuestions(suggestedQuestions, 3));

  useEffect(() => {
    if (!conversation.isInitialCentered) return;
    setStartQuestions(selectRandomSuggestedQuestions(suggestedQuestions, 3));
  }, [conversation.currentConversationId, conversation.isInitialCentered, suggestedQuestions]);

  const handleRefreshSuggestedQuestion = useCallback(
    (questionIndex: number) => {
      setStartQuestions((currentQuestions) => replaceSuggestedQuestionAt(suggestedQuestions, currentQuestions, questionIndex));
    },
    [suggestedQuestions]
  );

  return (
    <div
      className={`app-light-surface chat-panel-surface relative flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md transition-all duration-300 ${
        !conversation.isInitialCentered && conversation.isGraphPanelOpen ? 'pr-[50%]' : ''
      }`}
    >
      {conversation.isInitialCentered ? (
        <div className="chat-start-surface flex min-h-0 flex-1 items-center justify-center bg-oracle-bg-gray px-6">
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <h2 className="text-center text-4xl font-semibold text-oracle-dark-gray">
              What are you working on?
            </h2>
            <AnalyticsSuggestedQuestionButtons
              questions={startQuestions}
              disabled={conversation.isAskPending}
              onSelect={conversation.setQuestion}
              onRefreshQuestion={handleRefreshSuggestedQuestion}
            />
            {renderComposer('Ask about balances, debits, credits, customers, products, fraud, or operating dates...')}
          </div>
        </div>
      ) : (
        <>
          <AnalyticsChatHeader
            title={conversation.conversationTitle}
            currentConversationId={conversation.currentConversationId}
            isHeaderMenuOpen={conversation.isHeaderMenuOpen}
            isInlineRenaming={conversation.isInlineRenaming}
            renameDraft={conversation.renameDraft}
            isRenaming={conversation.renameConversationMutation.isPending}
            isDeleting={conversation.deleteConversationMutation.isPending}
            isProcessing={conversation.isAskPending}
            isGraphPanelOpen={conversation.isGraphPanelOpen}
            hasLatestResult={Boolean(conversation.latestResult)}
            dashboardDraftCount={dashboard.dashboardDraftItems.length}
            headerMenuRef={conversation.headerMenuRef}
            titleInputRef={conversation.titleInputRef}
            onRenameDraftChange={conversation.setRenameDraft}
            onRenameBlur={conversation.handleRenameBlur}
            onRenameKeyDown={conversation.handleRenameKeyDown}
            onStartRename={conversation.startInlineRename}
            onToggleHeaderMenu={() => conversation.setIsHeaderMenuOpen((prev) => !prev)}
            onToggleDashboardTray={dashboard.toggleDashboardTray}
            onToggleGraphPanel={conversation.toggleGraphPanel}
            onDeleteRequest={conversation.requestDeleteConversation}
          />

          {dashboard.isDashboardTrayOpen && (
            <AnalyticsDashboardTray
              {...dashboard.dashboardTrayProps}
            />
          )}

          <AnalyticsChatMessageList
            listRef={conversation.listRef}
            isLoading={conversation.isLoadingConversation}
            messages={conversation.messages}
            isAssistantPending={conversation.isAskPending}
            agentName={conversation.agentName}
            userName={userName}
            userInitials={userInitials}
            renderAssistantResult={(message) => (
              <AssistantResult
                result={message.result}
                question={message.question}
                onAddVisualization={dashboard.openAddVisualizationModal}
                isVisualizationAdded={dashboard.selectedVisualizationIds.has(message.result.run_id)}
                renderChartPreview={({ result, question, onAddVisualization, isVisualizationAdded }) => (
                  <ChartPreview
                    spec={result.chart_spec}
                    columns={result.columns}
                    rows={result.rows}
                    renderTable={(tableProps) => <ResultTable {...tableProps} />}
                    isVisualizationAdded={isVisualizationAdded}
                    onAddVisualization={() => onAddVisualization(buildDashboardDraftItem(result, question))}
                  />
                )}
                renderResultTable={(result) => <ResultTable columns={result.columns} rows={result.rows} />}
              />
            )}
          />

          <div className="chat-composer-footer shrink-0 border-t border-oracle-border bg-white p-3">
            {renderComposer('Ask a follow-up question...')}
          </div>
        </>
      )}
      {!conversation.isInitialCentered && conversation.isGraphPanelOpen && (
        <OracleAgentGraphPanel
          result={conversation.latestResult}
          dataSources={conversation.graphDataSources}
          latestQuestion={conversation.latestQuestion}
          onClose={() => conversation.setIsGraphPanelOpen(false)}
        />
      )}
      <AnalyticsAddVisualizationModal
        {...dashboard.addVisualizationModalProps}
      />
      <AnalyticsDeleteChatModal
        open={Boolean(conversation.isDeleteConfirmOpen && conversation.currentConversationId)}
        conversationTitle={conversation.conversationTitle}
        isDeleting={conversation.deleteConversationMutation.isPending}
        onConfirm={() => {
          if (conversation.currentConversationId) {
            conversation.deleteConversationMutation.mutate(conversation.currentConversationId);
          }
        }}
        onCancel={() => conversation.setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
}
