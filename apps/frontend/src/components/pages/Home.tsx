import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { analyticsApi, analyticsQueryKeys } from '../../services/analyticsApi';
import { dataSourcesApi, dataSourcesQueryKeys } from '../../services/dataSourcesApi';
import { buildHomeStatCards, buildReadinessSummary, formatNumber, type StatKind } from './homeStats';

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

export function Home({ appName, currentUserId }: { appName: string; currentUserId: number | string }) {
  const navigate = useNavigate();
  const sourcesQuery = useQuery({
    queryKey: dataSourcesQueryKeys.list,
    queryFn: () => dataSourcesApi.list().then((response) => response.data.items),
  });
  const recommendationsQuery = useQuery({
    queryKey: analyticsQueryKeys.questionRecommendations(currentUserId, 6),
    queryFn: () => analyticsApi.getQuestionRecommendations(6).then((response) => response.data),
    staleTime: 30_000,
  });

  const sources = sourcesQuery.data ?? [];
  const statCards = buildHomeStatCards(sources);
  const { readinessRate, readinessSummary } = buildReadinessSummary(sources, sourcesQuery.isLoading);
  const frequentQuestions = recommendationsQuery.data?.frequent || [];
  const openQuestion = (question: string) => {
    navigate(`/chat?question=${encodeURIComponent(question)}`);
  };

  return (
    <div className="space-y-6">
      <section className="app-card app-red-glow-card rounded-3xl px-6 py-7 sm:px-8 lg:px-10">
        <div className="home-hero-grid">
          <div>
            <p className="app-kicker">Select AI analytics workspace</p>
            <h1 className="app-page-title mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              {appName}
            </h1>
            <p className="app-page-description mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Register Oracle tables, ask governed analytical questions, and turn trusted answers into reusable analytics.
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

      {frequentQuestions.length > 0 ? (
        <section className="home-light-card rounded-3xl p-6 sm:p-7">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-oracle-red">
              Your frequent questions
            </p>
            <h2 className="home-light-title text-2xl font-semibold">
              Continue with what you ask most
            </h2>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {frequentQuestions.map((item) => (
              <button
                key={item.question}
                type="button"
                onClick={() => openQuestion(item.question)}
                className="rounded-lg border border-oracle-border bg-white px-4 py-3 text-left text-sm font-medium text-oracle-dark-gray shadow-sm transition hover:border-oracle-red hover:shadow-md"
                title={item.question}
              >
                <span className="block leading-5">{item.question}</span>
                <span className="mt-2 block text-xs font-semibold text-oracle-light-gray">
                  Used {item.usage_count} time{item.usage_count === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

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
  );
}
