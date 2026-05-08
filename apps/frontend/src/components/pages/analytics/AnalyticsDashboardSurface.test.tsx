import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsDashboardSurface } from './AnalyticsDashboardSurface';

type SurfaceProps = Parameters<typeof AnalyticsDashboardSurface>[0];

function surfaceProps(overrides: Partial<SurfaceProps> = {}): SurfaceProps {
  return {
    dashboardError: false,
    dashboardItemsContent: <div>Dashboard content</div>,
    dashboardItemsEmpty: false,
    dashboardLoaded: true,
    dashboardLoading: false,
    dashboardName: 'Executive view',
    dashboardsEmpty: false,
    dashboardsLoading: false,
    emptyDashboardHeader: <div>Empty header</div>,
    headerForTitle: vi.fn((title: string) => <div>{title}</div>),
    selectedDashboardId: 'dashboard-1',
    selectedDashboardName: 'Executive view',
    tabs: <div>Dashboard tabs</div>,
    ...overrides,
  };
}

describe('AnalyticsDashboardSurface', () => {
  it('renders dashboard content after a dashboard has loaded', () => {
    render(<AnalyticsDashboardSurface {...surfaceProps()} />);

    expect(screen.getByText('Executive view')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard tabs')).toBeInTheDocument();
  });

  it('renders empty and error states from surface flags', () => {
    const { rerender } = render(
      <AnalyticsDashboardSurface {...surfaceProps({ dashboardsEmpty: true, selectedDashboardId: null })} />
    );

    expect(screen.getByText('Generate a dashboard from selected chat visualizations.')).toBeInTheDocument();

    rerender(<AnalyticsDashboardSurface {...surfaceProps({ dashboardError: true, dashboardLoaded: false })} />);

    expect(screen.getByText('Could not load dashboard.')).toBeInTheDocument();
  });
});
