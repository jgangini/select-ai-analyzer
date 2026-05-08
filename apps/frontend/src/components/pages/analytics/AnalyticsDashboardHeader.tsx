import type { RefObject } from 'react';

import {
  DashboardVisibilityIcon,
  MoreVerticalIcon,
  RenameIcon,
  TrashIcon,
  type DashboardVisibility,
} from './AnalyticsIcons';

type DashboardTabSummary = {
  dashboard_id: string;
  dashboard_name: string;
  visibility?: DashboardVisibility;
};

type DashboardHeaderBase = DashboardTabSummary;

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
              <DashboardVisibilityIcon
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
              <DashboardVisibilityIcon visibility={visibility} className="h-3.5 w-3.5" />
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
          <MoreVerticalIcon />
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
              <RenameIcon />
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
              <DashboardVisibilityIcon visibility={nextVisibility} className="h-4 w-4" />
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
