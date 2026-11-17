import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AnalyticsAddVisualizationModal,
  AnalyticsDashboardTray,
  AnalyticsDeleteChatModal,
} from './AnalyticsChatOverlays';

type TrayProps = Parameters<typeof AnalyticsDashboardTray>[0];
type AddVisualizationProps = Parameters<typeof AnalyticsAddVisualizationModal>[0];

const draftItem: TrayProps['items'][number] = {
  draft_id: 'draft-1',
  run_id: 'run-1',
  title: 'Balance by branch',
  question: 'Show balance by branch',
  sql: 'select branch, balance from account_balance',
  chart_spec: { type: 'bar', title: 'Balance by branch' },
};

function trayProps(overrides: Partial<TrayProps> = {}): TrayProps {
  return {
    items: [draftItem],
    targetMode: 'new',
    targetId: '',
    dashboardName: 'Daily banking',
    dashboardVisibility: 'private',
    dashboardOptions: [],
    selectedExistingDashboard: null,
    isSaving: false,
    onClose: vi.fn(),
    onRemoveItem: vi.fn(),
    onExistingDashboardChange: vi.fn(),
    onDashboardNameChange: vi.fn(),
    onDashboardVisibilityChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

function addVisualizationProps(overrides: Partial<AddVisualizationProps> = {}): AddVisualizationProps {
  return {
    item: draftItem,
    step: 'details',
    mode: 'existing',
    dashboardOptions: [
      { dashboard_id: 'dashboard-1', dashboard_name: 'Executive view', visibility: 'shared' },
      { dashboard_id: 'dashboard-2', dashboard_name: 'Private view', visibility: 'private' },
    ],
    isDashboardOptionsLoading: false,
    dashboardId: 'dashboard-1',
    dashboardName: '',
    dashboardVisibility: 'private',
    onClose: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onConfirm: vi.fn(),
    onModeChange: vi.fn(),
    onDashboardIdChange: vi.fn(),
    onDashboardNameChange: vi.fn(),
    onDashboardVisibilityChange: vi.fn(),
    ...overrides,
  };
}

describe('AnalyticsChatOverlays', () => {
  afterEach(() => {
    cleanup();
  });

  it('wires dashboard tray actions for draft visualizations', () => {
    const onClose = vi.fn();
    const onRemoveItem = vi.fn();
    const onDashboardNameChange = vi.fn();
    const onDashboardVisibilityChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AnalyticsDashboardTray
        {...trayProps({
          onClose,
          onRemoveItem,
          onDashboardNameChange,
          onDashboardVisibilityChange,
          onSave,
        })}
      />
    );

    expect(screen.getByText('Visualization list')).toBeInTheDocument();
    expect(screen.getByText('Balance by branch')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /dashboard name/i }), {
      target: { value: 'Updated dashboard' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /shared/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete visualization/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate dashboard/i }));
    fireEvent.click(screen.getByRole('button', { name: /close visualization list/i }));

    expect(onDashboardNameChange).toHaveBeenCalledWith('Updated dashboard');
    expect(onDashboardVisibilityChange).toHaveBeenCalledWith('shared');
    expect(onRemoveItem).toHaveBeenCalledWith('draft-1');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wires the add visualization modal for existing dashboards', () => {
    const onBack = vi.fn();
    const onConfirm = vi.fn();
    const onDashboardIdChange = vi.fn();

    render(
      <AnalyticsAddVisualizationModal
        {...addVisualizationProps({
          onBack,
          onConfirm,
          onDashboardIdChange,
        })}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /dashboard/i }), {
      target: { value: 'dashboard-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(onDashboardIdChange).toHaveBeenCalledWith('dashboard-2');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirms or cancels chat deletion', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AnalyticsDeleteChatModal
        open
        conversationTitle="Daily trend"
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
