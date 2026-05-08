export function getAnalyticsErrorMessage(error: unknown): string {
  const maybeError =
    error && typeof error === 'object'
      ? (error as { response?: { data?: { detail?: string } }; message?: string })
      : {};
  return maybeError.response?.data?.detail || maybeError.message || 'The question could not be executed.';
}

export function getDefaultDashboardName(conversationTitle: string): string {
  const normalized = conversationTitle.replace(/^New analytics chat$/i, 'Analytics dashboard').trim();
  return normalized || 'Analytics dashboard';
}

export function getUserInitials(name: string): string {
  return String(name || 'User')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function buildDashboardDraftItem<TChartSpec extends object>(
  result: { run_id: string; sql: string; chart_spec: TChartSpec },
  question: string
) {
  const chartTitle = (result.chart_spec as { title?: string }).title;
  return {
    draft_id: result.run_id,
    run_id: result.run_id,
    title: chartTitle || question.slice(0, 120) || 'Analytics visualization',
    question,
    sql: result.sql,
    chart_spec: result.chart_spec,
  };
}
