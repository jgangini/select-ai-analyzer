import type { RefObject } from 'react';

type DashboardVisibility = 'private' | 'shared';

type DashboardTabSummary = {
  dashboard_id: string;
  dashboard_name: string;
  visibility?: DashboardVisibility;
};

type DashboardHeaderBase = DashboardTabSummary;

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H2v-2a4 4 0 013-3.87m9-6.13a4 4 0 11-8 0 4 4 0 018 0zm7 0a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15.25a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5zM6.75 10.5V8a5.25 5.25 0 0110.5 0v2.5m-11.5 0h12.5a1 1 0 011 1v8a1 1 0 01-1 1H5.75a1 1 0 01-1-1v-8a1 1 0 011-1z"
      />
    </svg>
  );
}

export function AnalyticsDashboardTabs({
  dashboards,
  selectedDashboardId,
  onSelect,
}: {
  dashboards: DashboardTabSummary[];
  selectedDashboardId: string | null;
  onSelect: (dashboardId: string) => void;
}) {
  if (dashboards.length === 0) return null;

  return (
    <nav className="border-t border-oracle-border bg-[#fffdfb]" aria-label="Analytics dashboards">
      <div className="flex overflow-x-auto" role="tablist" aria-label="Available dashboards">
        {dashboards.map((dashboardSummary) => {
          const isSelected = dashboardSummary.dashboard_id === selectedDashboardId;
          const visibility = dashboardSummary.visibility || 'private';
          const visibilityLabel = visibility === 'shared' ? 'Shared' : 'Private';
          return (
            <button
              key={dashboardSummary.dashboard_id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`${dashboardSummary.dashboard_name}. ${visibilityLabel} dashboard`}
              title={`${dashboardSummary.dashboard_name} - ${visibilityLabel}`}
              className={`inline-flex w-56 max-w-56 shrink-0 items-center gap-2 border border-l-0 border-t-0 px-3 py-2 text-left transition-colors first:border-l ${
                isSelected
                  ? 'border-oracle-red bg-oracle-red text-white shadow-[0_10px_24px_rgba(199,70,52,0.18)]'
                  : 'border-oracle-border bg-white text-oracle-dark-gray hover:border-oracle-red/50 hover:text-oracle-red'
              }`}
              onClick={() => onSelect(dashboardSummary.dashboard_id)}
            >
              <VisibilityIcon
                visibility={visibility}
                className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-oracle-medium-gray'}`}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {dashboardSummary.dashboard_name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AnalyticsDashboardHeader<TDashboard extends DashboardHeaderBase>({
  title,
  dashboard,
  isMenuOpen,
  menuRef,
  canManageDashboard,
  isUpdatePending,
  isDeletePending,
  onToggleMenu,
  onRename,
  onVisibilityChange,
  onDelete,
}: {
  title: string;
  dashboard: TDashboard | null;
  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
  canManageDashboard: boolean;
  isUpdatePending: boolean;
  isDeletePending: boolean;
  onToggleMenu: () => void;
  onRename: (dashboard: TDashboard) => void;
  onVisibilityChange: (dashboardId: string, visibility: DashboardVisibility) => void;
  onDelete: () => void;
}) {
  const visibility = dashboard?.visibility || 'private';
  const nextVisibility: DashboardVisibility = visibility === 'shared' ? 'private' : 'shared';
  const visibilityLabel = visibility === 'shared' ? 'Shared' : 'Private';

  return (
    <div
      className={`chat-conversation-header flex shrink-0 items-center gap-3 border-b border-oracle-border bg-gray-50 px-4 py-3 ${
        isMenuOpen ? 'chat-conversation-header--menu-open' : ''
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
        <span className="text-sm font-bold text-white">AI</span>
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-oracle-dark-gray" title={title}>
          {title}
        </h1>
        <div className="flex items-center gap-1.5">
          {dashboard ? (
            <span className="inline-flex items-center gap-1 text-xs text-oracle-light-gray" title={visibilityLabel}>
              <VisibilityIcon visibility={visibility} className="h-3.5 w-3.5" />
              {visibilityLabel}
            </span>
          ) : null}
          <span className="text-xs text-oracle-light-gray">Select AI Analytics</span>
        </div>
      </div>
      <div className="relative ml-auto" ref={menuRef}>
        <button
          type="button"
          className="rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5"
          aria-label="Dashboard actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          title="Dashboard actions"
          onClick={onToggleMenu}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z"
            />
          </svg>
        </button>
        {isMenuOpen && (
          <div
            className="chat-header-actions-menu absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
            role="menu"
            aria-label="Dashboard actions"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!dashboard || !canManageDashboard || isUpdatePending || isDeletePending}
              onClick={() => {
                if (dashboard) onRename(dashboard);
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!dashboard || !canManageDashboard || isUpdatePending || isDeletePending}
              onClick={() => {
                if (dashboard) onVisibilityChange(dashboard.dashboard_id, nextVisibility);
              }}
            >
              <VisibilityIcon visibility={nextVisibility} className="h-4 w-4" />
              {nextVisibility === 'shared' ? 'Share' : 'Make private'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canManageDashboard || isDeletePending}
              onClick={onDelete}
            >
              <TrashIcon />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
