import { useEffect, useState } from 'react';

import { ConfirmDeleteModal, GlassModal } from '../../common/Modal';

type DashboardModalItem = {
  dashboard_item_id: string;
  title: string;
  sql: string;
};

type DashboardModalDashboard = {
  dashboard_id: string;
  dashboard_name: string;
};

function DashboardModalHeader({
  title,
  closeLabel,
  onClose,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
      <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
      <button
        type="button"
        className="ml-auto rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function RenameEntityModal({
  open,
  initialTitle,
  resetKey,
  modalTitle,
  closeLabel,
  fieldId,
  fieldLabel,
  maxLength,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean;
  initialTitle: string;
  resetKey: string | undefined;
  modalTitle: string;
  closeLabel: string;
  fieldId: string;
  fieldLabel: string;
  maxLength: number;
  isSaving: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [resetKey, initialTitle]);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      containerClassName="items-start justify-center p-4"
      panelClassName="mt-24 w-full max-w-md border-0"
      panelStyle={{ background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
    >
      <DashboardModalHeader title={modalTitle} closeLabel={closeLabel} onClose={onClose} />
      <form
        className="space-y-4 bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(title);
        }}
      >
        <label className="block text-sm font-semibold text-oracle-dark-gray" htmlFor={fieldId}>
          {fieldLabel}
        </label>
        <input
          id={fieldId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="input-oracle"
          maxLength={maxLength}
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
  return (
    <RenameEntityModal
      open={Boolean(item)}
      initialTitle={item?.title || ''}
      resetKey={item?.dashboard_item_id}
      modalTitle="Rename visualization"
      closeLabel="Close rename dialog"
      fieldId="visualization-title"
      fieldLabel="Visualization name"
      maxLength={500}
      isSaving={isSaving}
      onClose={onClose}
      onSave={onSave}
    />
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
  return (
    <RenameEntityModal
      open={Boolean(dashboard)}
      initialTitle={dashboard?.dashboard_name || ''}
      resetKey={dashboard?.dashboard_id}
      modalTitle="Rename dashboard"
      closeLabel="Close rename dashboard dialog"
      fieldId="dashboard-title"
      fieldLabel="Dashboard name"
      maxLength={255}
      isSaving={isSaving}
      onClose={onClose}
      onSave={onSave}
    />
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
      <DashboardModalHeader title="Generated SQL" closeLabel="Close Generated SQL" onClose={onClose} />
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
