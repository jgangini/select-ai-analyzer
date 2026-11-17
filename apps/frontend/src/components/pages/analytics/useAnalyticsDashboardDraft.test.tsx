import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useAnalyticsDashboardDraft } from './useAnalyticsDashboardDraft';

const draftItem = {
  draft_id: 'draft-1',
  run_id: 'run-1',
  title: 'Deposit trend',
  question: 'How are deposits trending?',
  sql: 'select month, amount from deposits',
  chart_spec: { type: 'bar' as const, x: 'MONTH', y: 'AMOUNT' },
};

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function HookWrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

function dashboardsClient(overrides = {}) {
  return {
    list: vi.fn().mockResolvedValue({ data: { items: [] } }),
    create: vi.fn().mockResolvedValue({ data: { dashboard_id: 'dashboard-new' } }),
    addItems: vi.fn().mockResolvedValue({ data: { dashboard_id: 'dashboard-existing' } }),
    ...overrides,
  };
}

describe('useAnalyticsDashboardDraft', () => {
  it('adds a visualization to a new dashboard draft and saves it', async () => {
    const client = dashboardsClient();
    const showToast = vi.fn();
    const { result } = renderHook(
      () => useAnalyticsDashboardDraft({ conversationTitle: 'Deposit review', dashboardsClient: client, showToast }),
      { wrapper: wrapper() }
    );

    act(() => result.current.openAddVisualizationModal(draftItem));
    act(() => result.current.addVisualizationModalProps.onNext());
    act(() => result.current.addVisualizationModalProps.onDashboardNameChange('March deposits'));
    act(() => result.current.addVisualizationModalProps.onDashboardVisibilityChange('shared'));
    act(() => result.current.addVisualizationModalProps.onConfirm());

    expect(result.current.dashboardDraftItems).toEqual([draftItem]);
    expect(result.current.isDashboardTrayOpen).toBe(true);
    expect(result.current.selectedVisualizationIds.has('draft-1')).toBe(true);

    act(() => result.current.dashboardTrayProps.onSave());

    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith({
        name: 'March deposits',
        description: 'Generated from chat: Deposit review',
        visibility: 'shared',
        items: [{ ...draftItem, draft_id: undefined }].map(({ draft_id, ...item }) => item),
      })
    );
    expect(showToast).toHaveBeenCalledWith('Dashboard generated.', 'success');
  });

  it('targets an existing dashboard when one is selected', async () => {
    const client = dashboardsClient({
      list: vi.fn().mockResolvedValue({
        data: { items: [{ dashboard_id: 'dashboard-1', dashboard_name: 'Risk board', visibility: 'private' }] },
      }),
    });
    const { result } = renderHook(
      () => useAnalyticsDashboardDraft({ conversationTitle: 'Risk review', dashboardsClient: client, showToast: vi.fn() }),
      { wrapper: wrapper() }
    );

    act(() => result.current.openAddVisualizationModal(draftItem));
    await waitFor(() => expect(result.current.addVisualizationModalProps.dashboardOptions).toHaveLength(1));

    act(() => result.current.addVisualizationModalProps.onModeChange('existing'));
    act(() => result.current.addVisualizationModalProps.onNext());
    act(() => result.current.addVisualizationModalProps.onConfirm());

    expect(result.current.dashboardTrayProps.targetMode).toBe('existing');
    expect(result.current.dashboardTrayProps.targetId).toBe('dashboard-1');
    expect(result.current.dashboardTrayProps.dashboardName).toBe('Risk board');

    act(() => result.current.dashboardTrayProps.onSave());

    await waitFor(() =>
      expect(client.addItems).toHaveBeenCalledWith('dashboard-1', {
        items: [{ ...draftItem, draft_id: undefined }].map(({ draft_id, ...item }) => item),
      })
    );
  });
});
