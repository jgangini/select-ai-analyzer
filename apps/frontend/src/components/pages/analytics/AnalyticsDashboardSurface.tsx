import type { ReactNode } from 'react';

import { LoadingState } from '../shared/LoadingState';

const dashboardSectionClassName =
  'app-light-surface flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md';

function DashboardSection({
  children,
  header,
  tabs,
}: {
  children: ReactNode;
  header: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <section className={dashboardSectionClassName}>
      {header}
      {children}
      {tabs}
    </section>
  );
}

function CenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-oracle-medium-gray">
      {children}
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <LoadingState label="Loading..." textClassName="text-oracle-medium-gray" />
    </div>
  );
}

export function AnalyticsDashboardSurface({
  dashboardError,
  dashboardItemsContent,
  dashboardItemsEmpty,
  dashboardLoaded,
  dashboardLoading,
  dashboardName,
  dashboardsEmpty,
  dashboardsLoading,
  emptyDashboardHeader,
  headerForTitle,
  selectedDashboardId,
  selectedDashboardName,
  tabs,
}: {
  dashboardError: boolean;
  dashboardItemsContent: ReactNode;
  dashboardItemsEmpty: boolean;
  dashboardLoaded: boolean;
  dashboardLoading: boolean;
  dashboardName: string | null;
  dashboardsEmpty: boolean;
  dashboardsLoading: boolean;
  emptyDashboardHeader: ReactNode;
  headerForTitle: (title: string) => ReactNode;
  selectedDashboardId: string | null;
  selectedDashboardName: string | null;
  tabs: ReactNode;
}) {
  if (dashboardsLoading) {
    return (
      <DashboardSection header={emptyDashboardHeader}>
        <DashboardLoadingState />
      </DashboardSection>
    );
  }

  if (dashboardsEmpty) {
    return (
      <DashboardSection header={emptyDashboardHeader}>
        <CenterMessage>Generate a dashboard from selected chat visualizations.</CenterMessage>
      </DashboardSection>
    );
  }

  if (!selectedDashboardId) {
    return (
      <DashboardSection header={emptyDashboardHeader} tabs={tabs}>
        <CenterMessage>Select a dashboard.</CenterMessage>
      </DashboardSection>
    );
  }

  if (dashboardLoading) {
    return (
      <DashboardSection header={headerForTitle(selectedDashboardName || 'Loading...')} tabs={tabs}>
        <DashboardLoadingState />
      </DashboardSection>
    );
  }

  if (dashboardError) {
    return (
      <DashboardSection header={headerForTitle(selectedDashboardName || 'Analytics dashboard')} tabs={tabs}>
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load dashboard.
        </div>
      </DashboardSection>
    );
  }

  if (dashboardLoaded) {
    return (
      <DashboardSection header={headerForTitle(dashboardName ?? '')} tabs={tabs}>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f1ed] p-4 sm:p-5">
          {dashboardItemsEmpty ? (
            <div className="rounded-lg border border-oracle-border bg-white px-6 py-12 text-center text-sm text-oracle-medium-gray">
              No visualizations are available in this dashboard.
            </div>
          ) : (
            dashboardItemsContent
          )}
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection header={headerForTitle(selectedDashboardName || 'Analytics dashboard')} tabs={tabs}>
      <CenterMessage>{selectedDashboardName || 'Dashboard'} was not found.</CenterMessage>
    </DashboardSection>
  );
}
