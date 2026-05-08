import { useEffect, useState } from 'react';

import { ConfirmDeleteModal, GlassModal } from '../shared/Modal';

type DashboardModalItem = {
  dashboard_item_id: string;
  title: string;
  sql: string;
};

type DashboardModalDashboard = {
  dashboard_id: string;
  dashboard_name: string;
};

export function RenameVisualizationModal({
  item,
  isSaving,
  onClose,
  onSave,
}: {
  item: DashboardModalItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(item?.title || '');

  useEffect(() => {
    setTitle(item?.title || '');
  }, [item?.dashboard_item_id, item?.title]);

  return (
    <GlassModal
      open={Boolean(item)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-24 w-full max-w-md border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Rename visualization</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close rename dialog"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form
        className="space-y-4 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(title);
        }}
      >
        <label className="block text-sm font-semibold text-oracle-dark-gray" htmlFor="visualization-title">
          Visualization name
        </label>
        <input
          id="visualization-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input-oracle"
          maxLength={500}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

export function RenameDashboardModal({
  dashboard,
  isSaving,
  onClose,
  onSave,
}: {
  dashboard: DashboardModalDashboard | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(dashboard?.dashboard_name || '');

  useEffect(() => {
    setTitle(dashboard?.dashboard_name || '');
  }, [dashboard?.dashboard_id, dashboard?.dashboard_name]);

  return (
    <GlassModal
      open={Boolean(dashboard)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-24 w-full max-w-md border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="text-lg font-semibold text-white">Rename dashboard</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close rename dashboard dialog"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form
        className="space-y-4 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(title);
        }}
      >
        <label className="block text-sm font-semibold text-oracle-dark-gray" htmlFor="dashboard-title">
          Dashboard name
        </label>
        <input
          id="dashboard-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input-oracle"
          maxLength={255}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}

export function SqlModal({ item, onClose }: { item: DashboardModalItem | null; onClose: () => void }) {
  return (
    <GlassModal
      open={Boolean(item)}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-16 flex max-h-[82vh] w-full max-w-5xl flex-col border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
        <h2 className="truncate text-lg font-semibold text-white">Generated SQL</h2>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
          aria-label="Close Generated SQL"
          onClick={onClose}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
        <pre className="max-h-[64vh] overflow-auto rounded-lg border border-[#d9d2cb] bg-white p-4 text-xs leading-5 text-oracle-dark-gray shadow-[inset_0_1px_0_rgba(49,45,42,0.03)]">
          {item?.sql || ''}
        </pre>
      </div>
    </GlassModal>
  );
}

export function DeleteVisualizationModal({
  item,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  item: DashboardModalItem | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!item) return null;
  return (
    <ConfirmDeleteModal
      title="Delete visualization"
      message={
        <span>
          Delete <strong>{item.title}</strong> from this dashboard?
        </span>
      }
      detail="This does not delete the original chat response."
      loading={isDeleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

export function DeleteDashboardModal({
  dashboard,
  isDeleting,
  open,
  onCancel,
  onConfirm,
}: {
  dashboard: DashboardModalDashboard | null;
  isDeleting: boolean;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !dashboard) return null;
  return (
    <ConfirmDeleteModal
      title="Delete dashboard"
      message={
        <span>
          Delete <strong>{dashboard.dashboard_name}</strong>?
        </span>
      }
      detail="The dashboard will be removed from Analytics."
      loading={isDeleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
