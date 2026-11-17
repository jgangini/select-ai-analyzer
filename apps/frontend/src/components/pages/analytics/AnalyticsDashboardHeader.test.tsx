import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsDashboardHeader, AnalyticsDashboardTabs } from './AnalyticsDashboardHeader';

describe('AnalyticsDashboardHeader', () => {
  it('renders dashboard tabs and selects a dashboard', () => {
    const onSelect = vi.fn();

    render(
      <AnalyticsDashboardTabs
        dashboards={[
          { dashboard_id: 'one', dashboard_name: 'Private dashboard', visibility: 'private' },
          { dashboard_id: 'two', dashboard_name: 'Shared dashboard', visibility: 'shared' },
        ]}
        selectedDashboardId="two"
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('tab', { name: /shared dashboard/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /private dashboard/i }));

    expect(onSelect).toHaveBeenCalledWith('one');
  });

  it('guards dashboard menu actions when the current user cannot manage it', () => {
    const onRename = vi.fn();
    const onVisibilityChange = vi.fn();
    const onDelete = vi.fn();

    render(
      <AnalyticsDashboardHeader
        title="Portfolio"
        dashboard={{ dashboard_id: 'dashboard-one', dashboard_name: 'Portfolio', visibility: 'shared' }}
        isMenuOpen
        menuRef={{ current: null }}
        canManageDashboard={false}
        isUpdatePending={false}
        isDeletePending={false}
        onToggleMenu={vi.fn()}
        onRename={onRename}
        onVisibilityChange={onVisibilityChange}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('menuitem', { name: /rename/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /make private/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeDisabled();
  });
});
