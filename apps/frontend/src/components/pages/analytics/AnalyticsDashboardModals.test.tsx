import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenameDashboardModal, RenameVisualizationModal, SqlModal } from './AnalyticsDashboardModals';

describe('AnalyticsDashboardModals', () => {
  afterEach(() => {
    cleanup();
  });

  it('saves a renamed visualization title', () => {
    const onSave = vi.fn();

    render(
      <RenameVisualizationModal
        item={{ dashboard_item_id: 'item-1', title: 'Old title', sql: 'select 1 from dual' }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText('Visualization name'), { target: { value: 'New title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('New title');
  });

  it('saves a renamed dashboard title', () => {
    const onSave = vi.fn();

    render(
      <RenameDashboardModal
        dashboard={{ dashboard_id: 'dashboard-1', dashboard_name: 'Daily view' }}
        isSaving={false}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText('Dashboard name'), { target: { value: 'Executive view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('Executive view');
  });

  it('shows generated SQL and closes from the modal header', () => {
    const onClose = vi.fn();

    render(
      <SqlModal
        item={{ dashboard_item_id: 'item-1', title: 'Balance', sql: 'select balance from accounts' }}
        onClose={onClose}
      />
    );

    expect(screen.getByText('select balance from accounts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Generated SQL' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
