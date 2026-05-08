import { ConfirmModal, GlassModal } from '../shared/Modal';

type DashboardTargetMode = 'new' | 'existing';
type AddDashboardStep = 'target' | 'details';
type DashboardVisibility = 'private' | 'shared';
type DashboardChartSpec = {
  type: 'bar' | 'line' | 'area' | 'pie' | 'table' | 'metric';
  title?: string;
  x?: string;
  y?: string;
  series?: string;
};
type DashboardSummary = {
  dashboard_id: string;
  dashboard_name: string;
  visibility: DashboardVisibility;
};
type DashboardDraftItem = {
  draft_id: string;
  run_id?: string;
  title: string;
  question: string;
  sql: string;
  chart_spec: DashboardChartSpec;
  layout?: Record<string, unknown>;
};

function VisibilityIcon({
  visibility,
  className = 'h-4 w-4',
}: {
  visibility: DashboardVisibility;
  className?: string;
}) {
  if (visibility === 'shared') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H2v-2a4 4 0 013-3.87m9-6.13a4 4 0 11-8 0 4 4 0 018 0zm7 0a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.25a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5zM6.75 10.5V8a5.25 5.25 0 0110.5 0v2.5m-11.5 0h12.5a1 1 0 011 1v8a1 1 0 01-1 1H5.75a1 1 0 01-1-1v-8a1 1 0 011-1z" />
    </svg>
  );
}

function DashboardVisibilityControl({
  value,
  onChange,
}: {
  value: DashboardVisibility;
  onChange: (visibility: DashboardVisibility) => void;
}) {
  const options: Array<{ value: DashboardVisibility; label: string; description: string }> = [
    { value: 'private', label: 'Private', description: 'Only you can manage it.' },
    { value: 'shared', label: 'Shared', description: 'Visible to all users.' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Dashboard visibility">
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              isSelected
                ? 'border-oracle-red bg-red-50 text-oracle-red'
                : 'border-gray-200 bg-white text-oracle-dark-gray hover:bg-gray-50'
            }`}
            onClick={() => onChange(option.value)}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <VisibilityIcon visibility={option.value} />
              {option.label}
            </span>
            <span className="mt-1 block text-xs text-oracle-medium-gray">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AnalyticsDeleteChatModal({
  open,
  conversationTitle,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  conversationTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <ConfirmModal
      icon={
        <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      }
      iconBg="bg-red-100"
      iconRing="ring-red-50"
      title="Delete chat"
      message={
        <span>
          Delete <span className="font-medium text-oracle-dark-gray">{conversationTitle}</span>?
        </span>
      }
      detail="The analytical conversation and its question runs will be removed."
      confirmText="Delete"
      confirmClass="bg-oracle-red text-white hover:bg-red-700"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={isDeleting}
      loadingText="Deleting..."
    />
  );
}

export function AnalyticsDashboardTray({
  items,
  targetMode,
  targetId,
  dashboardName,
  dashboardVisibility,
  dashboardOptions,
  selectedExistingDashboard,
  isSaving,
  onClose,
  onRemoveItem,
  onExistingDashboardChange,
  onDashboardNameChange,
  onDashboardVisibilityChange,
  onSave,
}: {
  items: DashboardDraftItem[];
  targetMode: DashboardTargetMode;
  targetId: string;
  dashboardName: string;
  dashboardVisibility: DashboardVisibility;
  dashboardOptions: DashboardSummary[];
  selectedExistingDashboard: DashboardSummary | null;
  isSaving: boolean;
  onClose: () => void;
  onRemoveItem: (draftId: string) => void;
  onExistingDashboardChange: (dashboardId: string) => void;
  onDashboardNameChange: (name: string) => void;
  onDashboardVisibilityChange: (visibility: DashboardVisibility) => void;
  onSave: () => void;
}) {
  return (
    <aside className="absolute right-4 top-[4.25rem] z-40 w-80 overflow-hidden rounded-xl border border-[#dfcbc1] bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-[#eadfd7] bg-[#fbf8f5] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-oracle-dark-gray">Visualization list</h3>
          <p className="text-xs text-oracle-light-gray">{items.length} selected</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-oracle-medium-gray transition-colors hover:bg-black/5"
          onClick={onClose}
          aria-label="Close visualization list"
          title="Close"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto px-3 py-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#dfcbc1] px-3 py-6 text-center text-sm text-oracle-medium-gray">
            Add charts from chat responses to build a dashboard.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.draft_id} className="rounded-lg border border-[#eadfd7] bg-[#fffdfb] p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-oracle-red text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-oracle-dark-gray" title={item.title}>
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-oracle-medium-gray" title={item.question}>
                      {item.question}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-300 bg-white p-1.5 text-red-600 transition-colors hover:bg-red-50"
                    onClick={() => onRemoveItem(item.draft_id)}
                    title="Delete"
                    aria-label="Delete visualization"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2 border-t border-[#eadfd7] bg-[#fbf8f5] p-3">
        {targetMode === 'existing' ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-oracle-light-gray">
              Existing dashboard
            </label>
            <select
              value={targetId}
              onChange={(event) => onExistingDashboardChange(event.target.value)}
              className="input-oracle h-9 rounded-lg py-1.5 text-xs"
              aria-label="Existing dashboard"
            >
              {selectedExistingDashboard &&
              !dashboardOptions.some((item) => item.dashboard_id === selectedExistingDashboard.dashboard_id) ? (
                <option value={selectedExistingDashboard.dashboard_id}>{selectedExistingDashboard.dashboard_name}</option>
              ) : null}
              {dashboardOptions.map((dashboard) => (
                <option key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                  {dashboard.visibility === 'shared' ? 'Shared' : 'Private'} - {dashboard.dashboard_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={dashboardName}
              onChange={(event) => onDashboardNameChange(event.target.value)}
              className="input-oracle h-9 rounded-lg py-1.5 text-xs"
              placeholder="Dashboard name"
              aria-label="Dashboard name"
            />
            <DashboardVisibilityControl value={dashboardVisibility} onChange={onDashboardVisibilityChange} />
          </div>
        )}
        <button
          type="button"
          className="w-full rounded-lg bg-oracle-red px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={items.length === 0 || isSaving || (targetMode === 'existing' && !targetId)}
          onClick={onSave}
        >
          {isSaving
            ? targetMode === 'existing'
              ? 'Adding...'
              : 'Generating...'
            : targetMode === 'existing'
              ? 'Add to dashboard'
              : 'Generate dashboard'}
        </button>
      </div>
    </aside>
  );
}

export function AnalyticsAddVisualizationModal({
  item,
  step,
  mode,
  dashboardOptions,
  isDashboardOptionsLoading,
  dashboardId,
  dashboardName,
  dashboardVisibility,
  onClose,
  onBack,
  onNext,
  onConfirm,
  onModeChange,
  onDashboardIdChange,
  onDashboardNameChange,
  onDashboardVisibilityChange,
}: {
  item: DashboardDraftItem | null;
  step: AddDashboardStep;
  mode: DashboardTargetMode;
  dashboardOptions: DashboardSummary[];
  isDashboardOptionsLoading: boolean;
  dashboardId: string;
  dashboardName: string;
  dashboardVisibility: DashboardVisibility;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  onModeChange: (mode: DashboardTargetMode) => void;
  onDashboardIdChange: (dashboardId: string) => void;
  onDashboardNameChange: (dashboardName: string) => void;
  onDashboardVisibilityChange: (visibility: DashboardVisibility) => void;
}) {
  const isExistingDashboardUnavailable = isDashboardOptionsLoading || dashboardOptions.length === 0;
  const primaryDisabled =
    step === 'target'
      ? mode === 'existing' && isExistingDashboardUnavailable
      : mode === 'existing' && (!dashboardId || isDashboardOptionsLoading);

  return (
    <GlassModal
      open={Boolean(item)}
      onClose={onClose}
      containerClassName="items-center justify-center p-4"
      panelClassName="w-full max-w-md border-0"
      panelStyle={{
        background: '#ffffff',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }}
    >
      <div className="flex w-full min-w-0 flex-col items-center px-6 pb-5 pt-7 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50">
          <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 19V5m4 14v-8m4 8V7m4 12v-5m4 5V9" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-oracle-dark-gray">
          {step === 'target' ? 'Add visualization' : mode === 'existing' ? 'Select dashboard' : 'New dashboard'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-oracle-medium-gray">
          {step === 'target'
            ? 'Choose where this visualization will be saved.'
            : mode === 'existing'
              ? 'Pick the dashboard that will receive this visualization.'
              : 'Name the dashboard that will be generated.'}
        </p>
        {item ? (
          <p className="mt-3 max-w-full truncate text-xs font-medium text-oracle-dark-gray" title={item.title}>
            {item.title}
          </p>
        ) : null}

        {step === 'target' ? (
          <div className="mt-5 grid w-full gap-3">
            <button
              type="button"
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                mode === 'existing'
                  ? 'border-oracle-red bg-red-50 text-oracle-red'
                  : 'border-gray-200 bg-white text-oracle-dark-gray hover:bg-gray-50'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={!isDashboardOptionsLoading && dashboardOptions.length === 0}
              onClick={() => onModeChange('existing')}
            >
              <span className="block text-sm font-semibold">Existing dashboard</span>
              <span className="mt-1 block text-xs text-oracle-medium-gray">
                Add it to one of your dashboards.
              </span>
            </button>
            <button
              type="button"
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                mode === 'new'
                  ? 'border-oracle-red bg-red-50 text-oracle-red'
                  : 'border-gray-200 bg-white text-oracle-dark-gray hover:bg-gray-50'
              }`}
              onClick={() => onModeChange('new')}
            >
              <span className="block text-sm font-semibold">New dashboard</span>
              <span className="mt-1 block text-xs text-oracle-medium-gray">
                Start a new dashboard with this visualization.
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-5 w-full text-left">
            {mode === 'existing' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-oracle-dark-gray" htmlFor="add-dashboard-existing">
                  Dashboard
                </label>
                {isDashboardOptionsLoading ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-oracle-medium-gray">
                    Loading...
                  </div>
                ) : dashboardOptions.length > 0 ? (
                  <select
                    id="add-dashboard-existing"
                    value={dashboardId}
                    onChange={(event) => onDashboardIdChange(event.target.value)}
                    className="input-oracle h-10 rounded-lg py-2 text-sm"
                    aria-label="Dashboard"
                  >
                    {dashboardOptions.map((dashboard) => (
                      <option key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                        {dashboard.visibility === 'shared' ? 'Shared' : 'Private'} - {dashboard.dashboard_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-oracle-medium-gray">
                    No dashboards available.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-oracle-dark-gray" htmlFor="add-dashboard-new">
                  Dashboard name
                </label>
                <input
                  id="add-dashboard-new"
                  type="text"
                  value={dashboardName}
                  onChange={(event) => onDashboardNameChange(event.target.value)}
                  className="input-oracle h-10 rounded-lg py-2 text-sm"
                  placeholder="Dashboard name"
                />
                <DashboardVisibilityControl value={dashboardVisibility} onChange={onDashboardVisibilityChange} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex border-t border-gray-100">
        <button
          type="button"
          onClick={step === 'target' ? onClose : onBack}
          className="flex-1 py-4 text-sm font-medium text-oracle-medium-gray transition-colors hover:bg-gray-50"
        >
          {step === 'target' ? 'Cancel' : 'Back'}
        </button>
        <div className="w-px bg-gray-100" />
        <button
          type="button"
          onClick={step === 'target' ? onNext : onConfirm}
          disabled={primaryDisabled}
          className="flex-1 bg-oracle-red py-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step === 'target' ? 'Next' : 'Add'}
        </button>
      </div>
    </GlassModal>
  );
}
