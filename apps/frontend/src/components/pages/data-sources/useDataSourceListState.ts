import { useEffect, useMemo, useRef, useState } from 'react';

type DataSourceSummary = {
  data_source_id: string;
  source_name: string;
  source_type: 'csv' | 'existing_table';
  owner_name: string;
  table_name: string;
  access_scope: 'all' | 'private';
  row_count: number;
  column_count: number;
  status: string;
  created_at: string;
};

type DataSourceStats = {
  active: number;
  csv: number;
  tables: number;
  rows: number;
};

type DataSourceListHelpers = {
  pageSize: number;
  filterDataSources: (
    sources: DataSourceSummary[],
    searchTerm: string,
    statusFilter: string
  ) => DataSourceSummary[];
  summarizeDataSources: (sources: DataSourceSummary[]) => DataSourceStats;
};

export function useDataSourceListState(sources: DataSourceSummary[], helpers: DataSourceListHelpers) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedDataSourceIds, setSelectedDataSourceIds] = useState<string[]>([]);
  const [viewingSource, setViewingSource] = useState<DataSourceSummary | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [deletingSource, setDeletingSource] = useState<DataSourceSummary | null>(null);
  const selectAllSourcesRef = useRef<HTMLInputElement>(null);
  const filteredSources = useMemo(
    () => helpers.filterDataSources(sources, searchTerm, statusFilter),
    [helpers, searchTerm, sources, statusFilter]
  );
  const paginatedSources = filteredSources.slice(page * helpers.pageSize, page * helpers.pageSize + helpers.pageSize);
  const selectedDataSourceIdSet = useMemo(() => new Set(selectedDataSourceIds), [selectedDataSourceIds]);
  const allCurrentPageSourcesSelected =
    paginatedSources.length > 0 &&
    paginatedSources.every((source) => selectedDataSourceIdSet.has(source.data_source_id));
  const someCurrentPageSourcesSelected =
    paginatedSources.some((source) => selectedDataSourceIdSet.has(source.data_source_id));
  const stats = useMemo(() => helpers.summarizeDataSources(sources), [helpers, sources]);

  useEffect(() => setPage(0), [filteredSources.length, searchTerm, statusFilter]);
  useEffect(() => setPreviewPage(0), [viewingSource?.data_source_id]);
  useEffect(() => {
    if (selectAllSourcesRef.current) {
      selectAllSourcesRef.current.indeterminate = someCurrentPageSourcesSelected && !allCurrentPageSourcesSelected;
    }
  }, [allCurrentPageSourcesSelected, someCurrentPageSourcesSelected]);
  useEffect(() => {
    const visibleIds = new Set(sources.map((source) => source.data_source_id));
    setSelectedDataSourceIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [sources]);

  const toggleDataSourceSelection = (dataSourceId: string, checked: boolean) => {
    setSelectedDataSourceIds((current) => {
      if (checked) return current.includes(dataSourceId) ? current : [...current, dataSourceId];
      return current.filter((id) => id !== dataSourceId);
    });
  };

  const toggleAllVisibleSources = (checked: boolean) => {
    const visibleIds = paginatedSources.map((source) => source.data_source_id);
    setSelectedDataSourceIds((current) => {
      if (!checked) return current.filter((id) => !visibleIds.includes(id));
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    selectedDataSourceIds,
    setSelectedDataSourceIds,
    viewingSource,
    setViewingSource,
    previewPage,
    setPreviewPage,
    deletingSource,
    setDeletingSource,
    selectAllSourcesRef,
    filteredSources,
    paginatedSources,
    selectedDataSourceIdSet,
    allCurrentPageSourcesSelected,
    stats,
    toggleDataSourceSelection,
    toggleAllVisibleSources,
  };
}

export type DataSourceListState = ReturnType<typeof useDataSourceListState>;
