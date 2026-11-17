import { useEffect, useState, type ReactNode } from 'react';

import { GlassModal } from '../../common/Modal';

type AssistantChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};

type AssistantAnalyticsResult = {
  run_id: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  chart_spec: AssistantChartSpec;
};

type DashboardDraftItem = {
  draft_id: string;
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  chart_spec: AssistantChartSpec;
  layout?: Record<string, unknown>;
};

export function AssistantResult({
  result,
  question,
  onAddVisualization,
  isVisualizationAdded,
  renderChartPreview,
  renderResultTable,
}: {
  result: AssistantAnalyticsResult;
  question: string;
  onAddVisualization: (item: DashboardDraftItem) => void;
  isVisualizationAdded: boolean;
  renderChartPreview: (input: {
    result: AssistantAnalyticsResult;
    question: string;
    onAddVisualization: (item: DashboardDraftItem) => void;
    isVisualizationAdded: boolean;
  }) => ReactNode;
  renderResultTable: (result: AssistantAnalyticsResult) => ReactNode;
}) {
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  useEffect(() => {
    if (!isSqlModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSqlModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSqlModalOpen]);

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-line text-sm leading-6 text-oracle-dark-gray">{result.answer}</p>
      <div aria-label="Analytical chart">
        {renderChartPreview({ result, question, onAddVisualization, isVisualizationAdded })}
      </div>
      <button
        type="button"
        className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-200"
        title="Generated SQL"
        onClick={() => setIsSqlModalOpen(true)}
      >
        <svg className="h-2.5 w-2.5 shrink-0 text-oracle-light-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>SQL</span>
      </button>
      {isSqlModalOpen && (
        <GlassModal
          open={isSqlModalOpen}
          onClose={() => setIsSqlModalOpen(false)}
          containerClassName="items-start justify-center p-4"
          panelClassName="mt-16 flex max-h-[82vh] w-full max-w-5xl flex-col border-0"
          panelStyle={{
            background: '#ffffff',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
            <h2 id="generated-sql-title" className="text-lg font-semibold text-white">
              Generated SQL
            </h2>
            <div className="ml-auto" />
            <button
              type="button"
              className="rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
              aria-label="Close Generated SQL"
              onClick={() => setIsSqlModalOpen(false)}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white p-4">
            <pre className="max-h-72 overflow-auto rounded-lg border border-[#d9d2cb] bg-white p-4 text-xs leading-5 text-oracle-dark-gray shadow-[inset_0_1px_0_rgba(49,45,42,0.03)]">
              {result.sql}
            </pre>
            {renderResultTable(result)}
          </div>
        </GlassModal>
      )}
    </div>
  );
}
