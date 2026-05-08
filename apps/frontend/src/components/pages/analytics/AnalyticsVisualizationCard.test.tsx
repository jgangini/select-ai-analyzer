import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsVisualizationCard } from './AnalyticsVisualizationCard';

type CardProps = Parameters<typeof AnalyticsVisualizationCard>[0];

const item: CardProps['item'] = {
  dashboard_item_id: 'item-1',
  order: 0,
  title: 'Total balance',
  question: 'Show total balance',
  sql: 'select sum(balance) total_balance from accounts',
  columns: ['TOTAL_BALANCE'],
  rows: [{ TOTAL_BALANCE: 1250.5 }],
  row_count: 1,
  chart_spec: { type: 'metric', y: 'TOTAL_BALANCE' },
  layout: { width: 'half' },
  created_at: '2026-01-01T00:00:00Z',
};

function cardProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    item,
    itemIndex: 0,
    visualizationWidth: 'half',
    visualizationColumn: 'left',
    nextVisualizationWidth: null,
    draggedItemIndex: -1,
    draggedItemWidth: null,
    canManageDashboard: true,
    isMutating: false,
    isUpdatePending: false,
    isDeletePending: false,
    draggedItemId: null,
    dragOverItemId: null,
    dragIndicator: null,
    openItemMenuId: 'item-1',
    itemMenuRef: createRef<HTMLDivElement>(),
    onCardMouseDown: vi.fn(),
    onToggleMenu: vi.fn(),
    onViewSql: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    renderChartPreview: vi.fn(() => <div>Chart preview</div>),
    ...overrides,
  };
}

describe('AnalyticsVisualizationCard', () => {
  it('renders metric cards and wires card/menu actions', () => {
    const onCardMouseDown = vi.fn();
    const onToggleMenu = vi.fn();
    const onViewSql = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(
      <AnalyticsVisualizationCard
        {...cardProps({ onCardMouseDown, onToggleMenu, onViewSql, onRename, onDelete })}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('analytics-visualization-card'));
    fireEvent.click(screen.getByRole('button', { name: /visualization actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^sql$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(screen.getByText('Total balance')).toBeInTheDocument();
    expect(screen.getByText('1,250.5')).toBeInTheDocument();
    expect(onCardMouseDown.mock.calls[0][1]).toBe('item-1');
    expect(onCardMouseDown.mock.calls[0][2]).toBe(false);
    expect(onToggleMenu).toHaveBeenCalledWith('item-1');
    expect(onViewSql).toHaveBeenCalledWith(item);
    expect(onRename).toHaveBeenCalledWith(item);
    expect(onDelete).toHaveBeenCalledWith(item);
  });
});
