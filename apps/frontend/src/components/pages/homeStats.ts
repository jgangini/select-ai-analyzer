export type StatKind = 'objects' | 'columns' | 'rows';

export type HomeStatsSource = {
  row_count: number;
  column_count: number;
  status: string;
};

type HomeStatCard = {
  label: string;
  value: number;
  kind: StatKind;
  caption: string;
};

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function buildHomeStatCards(sources: HomeStatsSource[]): HomeStatCard[] {
  const totalColumns = sources.reduce((sum, source) => sum + Number(source.column_count || 0), 0);
  const totalRows = sources.reduce((sum, source) => sum + Number(source.row_count || 0), 0);
  return [
    { label: 'Objects', value: sources.length, kind: 'objects', caption: 'Tables registered for governed Select AI' },
    { label: 'Columns', value: totalColumns, kind: 'columns', caption: 'Registered fields available for analysis' },
    { label: 'Rows', value: totalRows, kind: 'rows', caption: 'Rows available for analytical questions' },
  ];
}

export function buildReadinessSummary(
  sources: HomeStatsSource[],
  isLoading: boolean
): { readinessRate: number; readinessSummary: string } {
  const activeSources = sources.filter((source) => String(source.status || '').toLowerCase() === 'active').length;
  const readinessRate = sources.length > 0 ? Math.round((activeSources / sources.length) * 100) : 0;
  return {
    readinessRate,
    readinessSummary: isLoading ? 'Loading registered objects' : `${activeSources} of ${sources.length} objects active`,
  };
}
