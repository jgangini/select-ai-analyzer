import { useQuery } from '@tanstack/react-query';

import { Layout } from '../common/Layout';
import { useAppBranding } from '../../hooks/useAppBranding';
import { queryKeys } from '../../lib/queryClient';
import { dataSourcesApi } from '../../services/api';

type StatKind = 'objects' | 'columns' | 'rows';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function StatIcon({ kind }: { kind: StatKind }) {
  if (kind === 'columns') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 6.5h14M5 12h14M5 17.5h14" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 4.75v14.5M15 4.75v14.5" />
      </svg>
    );
  }
  if (kind === 'rows') {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 6.75h14M5 12h14M5 17.25h14" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.75 4.75v14.5M15.25 4.75v14.5" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7.75A2.75 2.75 0 017.75 5h8.5A2.75 2.75 0 0119 7.75v8.5A2.75 2.75 0 0116.25 19h-8.5A2.75 2.75 0 015 16.25v-8.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}

export function Home() {
  const { appName } = useAppBranding();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.dataSources.list,
    queryFn: () => dataSourcesApi.list().then((response) => response.data.items),
  });

  const sources = sourcesQuery.data ?? [];
  const activeSources = sources.filter((source) => String(source.status || '').toLowerCase() === 'active').length;
  const totalColumns = sources.reduce((sum, source) => sum + Number(source.column_count || 0), 0);
  const totalRows = sources.reduce((sum, source) => sum + Number(source.row_count || 0), 0);
  const readinessRate = sources.length > 0 ? Math.round((activeSources / sources.length) * 100) : 0;
  const statCards = [
    { label: 'Objects', value: sources.length, kind: 'objects' as const, caption: 'Tables registered for governed Select AI' },
    { label: 'Columns', value: totalColumns, kind: 'columns' as const, caption: 'Registered fields available for analysis' },
    { label: 'Rows', value: totalRows, kind: 'rows' as const, caption: 'Rows available for analytical questions' },
  ];
  const readinessSummary = sourcesQuery.isLoading
    ? 'Loading registered objects'
    : `${activeSources} of ${sources.length} objects active`;

  return (
    <Layout>
      <div className="space-y-6">
        <section className="app-card app-red-glow-card rounded-3xl px-6 py-7 sm:px-8 lg:px-10">
          <div className="home-hero-grid">
            <div>
              <p className="app-kicker">Select AI analytics workspace</p>
              <h1 className="app-page-title mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                {appName}
              </h1>
              <p className="app-page-description mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
                Register Oracle tables, ask governed analytical questions, and inspect the native Oracle 26ai agent flow behind each answer.
              </p>
            </div>

            <div className="home-stats-grid grid gap-3 sm:grid-cols-3">
              {statCards.map((stat) => (
                <div key={stat.label} className="home-stat-card rounded-2xl p-4">
                  <p className="home-stat-label">{stat.label}</p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <p className="home-stat-value text-3xl font-semibold leading-none">
                      {formatNumber(stat.value)}
                    </p>
                    <span className="home-stat-icon inline-flex h-5 w-5 shrink-0 translate-y-[2px] items-center justify-center">
                      <StatIcon kind={stat.kind} />
                    </span>
                  </div>
                  <p className="home-stat-caption mt-4 text-xs leading-5">{stat.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="home-light-card home-ingestion-card rounded-3xl p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-oracle-red">
                Data readiness
              </p>
              <h2 className="home-light-title mt-2 text-2xl font-semibold">
                Select AI catalog status
              </h2>
            </div>
          </div>
          <p className="home-light-muted mt-4 w-full max-w-none text-sm leading-6">
            Active objects are included in the enforced Select AI object list. Inactive or failed registrations stay visible in Data Source so the team can repair permissions, reload CSV files, or remove obsolete tables.
          </p>
          <div className="mt-6 flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.12em] sm:flex-row sm:items-center sm:justify-between">
            <span className="home-progress-note">{readinessSummary}</span>
            <span className="home-progress-note home-progress-note--right">{readinessRate}% ready</span>
          </div>
          <div className="home-progress-track mt-3 h-3 overflow-hidden rounded-full">
            <div
              className="home-progress-fill h-full rounded-full transition-all duration-500"
              style={{ width: `${readinessRate}%` }}
            />
          </div>
        </section>
      </div>
    </Layout>
  );
}
