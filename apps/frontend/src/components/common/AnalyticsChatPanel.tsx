import { FormEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dagre from '@dagrejs/dagre';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useAnalyticsChat } from '../../context/AnalyticsChatContext';
import { queryKeys } from '../../lib/queryClient';
import {
  analyticsApi,
  dataSourcesApi,
  dashboardsApi,
  type AnalyticsAskResponse,
  type ChartSpec,
  type DashboardVisualizationPayload,
  type DashboardVisibility,
  type DataSourceSummary,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from './ConfirmModal';
import { GlassModal } from './GlassModal';
import { LoadingState } from './LoadingState';
import { useAppBranding } from '../../hooks/useAppBranding';

type Message =
  | { id: string; role: 'user'; content: string; timestamp: Date }
  | { id: string; role: 'assistant'; content: string; timestamp: Date; result: AnalyticsAskResponse; question: string };

const CHART_COLORS = ['#c74634', '#234967', '#2f7d7e', '#d48a2c', '#7a5a86', '#2f6b4f', '#8c4d39', '#687789'];
const PAGE_SIZE = 10;

type ChartSortMode = 'original' | 'value-desc' | 'value-asc' | 'label-asc' | 'label-desc';
type TableSortMode = 'original' | 'column-asc' | 'column-desc';
type DashboardTargetMode = 'new' | 'existing';
type AddDashboardStep = 'target' | 'details';

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

type ChartPoint = {
  label: string;
  value: number;
  index: number;
};

type ChartScrollbarState = {
  show: boolean;
  width: number;
  left: number;
};

type DashboardDraftItem = DashboardVisualizationPayload & {
  draft_id: string;
};

type GraphTableRef = {
  owner: string;
  name: string;
  columns: string[];
  rowCount?: number;
  sourceType?: string;
};

type OracleGraphNodeStatus = 'idle' | 'completed' | 'failed';

type OracleGraphNode = {
  key: string;
  label: string;
  detail: string;
  kind: 'input' | 'profile' | 'table' | 'sql' | 'execute' | 'answer';
  status: OracleGraphNodeStatus;
};

type OracleGraphEdge = {
  source: string;
  target: string;
  label?: string;
};

type OracleGraphRenderNode = OracleGraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OracleGraphEdgePath = OracleGraphEdge & {
  points: Array<{ x: number; y: number }>;
};

const GRAPH_NODE_HEIGHT = 64;
const GRAPH_NODE_WIDTH_MIN = 150;
const GRAPH_NODE_WIDTH_MAX = 220;
const GRAPH_CHAR_WIDTH = 7;
const MIN_CHART_SCROLL_THUMB_PX = 48;
const BAR_CHART_HEIGHT_PX = 268;
const BAR_CHART_TOP_PADDING_PX = 34;
const BAR_CHART_BOTTOM_PADDING_PX = 38;
const BAR_CHART_MAX_BAR_HEIGHT_PX = 176;

function getInitials(name: string): string {
  return String(name || 'User')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'The question could not be executed.';
}

function valueAsNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function isNumericLabel(value: unknown): boolean {
  const text = String(value ?? '').replace(/,/g, '').trim();
  return text.length > 0 && Number.isFinite(Number(text));
}

function formatMetricLabel(candidates: Array<unknown>, fallback = 'Value'): string {
  const candidate = candidates.find((value) => {
    const text = String(value ?? '').trim();
    return text.length > 0 && !isNumericLabel(text);
  });
  const text = String(candidate || fallback).replace(/_/g, ' ').trim();
  return text || fallback;
}

function formatJsonForDisplay(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeSqlIdentifier(value: string): string {
  return String(value || '').replace(/"/g, '').trim().toUpperCase();
}

function qualifiedTableKey(owner: string, name: string): string {
  return `${normalizeSqlIdentifier(owner)}.${normalizeSqlIdentifier(name)}`;
}

function truncateGraphText(value: string, maxLength = 30): string {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  const head = Math.ceil((maxLength - 3) / 2);
  const tail = Math.floor((maxLength - 3) / 2);
  return `${text.slice(0, head)}...${text.slice(text.length - tail)}`;
}

function graphNodeWidth(node: OracleGraphNode): number {
  const maxLen = Math.max(node.label.length, node.detail.length);
  return Math.max(GRAPH_NODE_WIDTH_MIN, Math.min(GRAPH_NODE_WIDTH_MAX, 52 + maxLen * GRAPH_CHAR_WIDTH));
}

function buildOracleGraphWithDagre(
  nodes: OracleGraphNode[],
  edges: OracleGraphEdge[]
): { nodes: OracleGraphRenderNode[]; edgePaths: OracleGraphEdgePath[] } {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const safeEdges = edges.filter((edge) => nodeKeys.has(edge.source) && nodeKeys.has(edge.target));
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 70, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({ points: [] }));

  for (const node of nodes) {
    g.setNode(node.key, { width: graphNodeWidth(node), height: GRAPH_NODE_HEIGHT });
  }
  for (const edge of safeEdges) {
    g.setEdge(edge.source, edge.target, {});
  }
  dagre.layout(g);

  const renderNodes = nodes
    .map((node) => {
      const layoutNode = g.node(node.key);
      if (!layoutNode) return null;
      return {
        ...node,
        x: layoutNode.x,
        y: layoutNode.y,
        width: (layoutNode as { width?: number }).width ?? graphNodeWidth(node),
        height: GRAPH_NODE_HEIGHT,
      };
    })
    .filter((node): node is OracleGraphRenderNode => Boolean(node));

  const edgePaths = safeEdges.map((edge) => {
    const layoutEdge = g.edge(edge.source, edge.target);
    const points = (layoutEdge?.points as Array<{ x: number; y: number }> | undefined) || [];
    if (points.length >= 2) {
      return { ...edge, points };
    }
    const source = g.node(edge.source);
    const target = g.node(edge.target);
    return {
      ...edge,
      points:
        source && target
          ? [
              { x: source.x, y: source.y + GRAPH_NODE_HEIGHT / 2 },
              { x: target.x, y: target.y - GRAPH_NODE_HEIGHT / 2 },
            ]
          : [],
    };
  });

  return { nodes: renderNodes, edgePaths };
}

function parseSqlTableRefs(sql: string): GraphTableRef[] {
  const refs: GraphTableRef[] = [];
  const seen = new Set<string>();
  const regex = /\b(?:FROM|JOIN)\s+((?:"?[A-Z0-9_$#]+"?\.)?"?[A-Z0-9_$#]+"?)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(String(sql || ''))) !== null) {
    const raw = normalizeSqlIdentifier(match[1]);
    if (!raw || raw.startsWith('SELECT')) continue;
    const parts = raw.split('.');
    const owner = parts.length > 1 ? parts[0] : '';
    const name = parts.length > 1 ? parts[1] : parts[0];
    const key = qualifiedTableKey(owner || '?', name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    refs.push({ owner, name, columns: [] });
  }
  return refs;
}

function traceTableRefs(result: AnalyticsAskResponse | undefined): GraphTableRef[] {
  const refs: GraphTableRef[] = [];
  const seen = new Set<string>();
  for (const traceItem of result?.agent_trace || []) {
    for (const item of traceItem.objects || []) {
      const owner = normalizeSqlIdentifier(String(item.owner || ''));
      const name = normalizeSqlIdentifier(String(item.name || ''));
      if (!name) continue;
      const key = qualifiedTableKey(owner || '?', name);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({
        owner,
        name,
        columns: Array.isArray(item.columns) ? item.columns.map((column) => normalizeSqlIdentifier(column)) : [],
      });
    }
  }
  return refs;
}

function resolveGraphTables(
  result: AnalyticsAskResponse | undefined,
  dataSources: DataSourceSummary[]
): GraphTableRef[] {
  const refs = traceTableRefs(result);
  if (refs.length === 0) {
    refs.push(...parseSqlTableRefs(result?.sql || ''));
  }
  const sourcesByQualifiedName = new Map(
    dataSources.map((source) => [qualifiedTableKey(source.owner_name, source.table_name), source])
  );
  const sourcesByTableName = new Map(dataSources.map((source) => [normalizeSqlIdentifier(source.table_name), source]));
  return refs.map((ref) => {
    const source =
      sourcesByQualifiedName.get(qualifiedTableKey(ref.owner, ref.name)) ||
      sourcesByTableName.get(normalizeSqlIdentifier(ref.name));
    return {
      owner: source?.owner_name || ref.owner || 'UNKNOWN',
      name: source?.table_name || ref.name,
      columns: ref.columns.length > 0 ? ref.columns : result?.columns || [],
      rowCount: source?.row_count,
      sourceType: source?.source_type,
    };
  });
}

function resolveChartFields(spec: ChartSpec, columns: string[], rows: Array<Record<string, unknown>>) {
  const numericColumns = columns.filter((column) => rows.some((row) => valueAsNumber(row[column]) !== null));
  const dimensionColumns = columns.filter((column) => !numericColumns.includes(column));
  return {
    x: spec.x && columns.includes(spec.x) ? spec.x : dimensionColumns[0] || columns[0],
    y: spec.y && columns.includes(spec.y) ? spec.y : numericColumns[0] || columns[1] || columns[0],
  };
}

function pointOnCircle(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = pointOnCircle(cx, cy, outerRadius, startAngle);
  const outerEnd = pointOnCircle(cx, cy, outerRadius, endAngle);
  const innerEnd = pointOnCircle(cx, cy, innerRadius, endAngle);
  const innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function normalizeChartSearch(value: string): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase();
}

function formatAxisValue(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  if (absolute >= 10_000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function buildYAxisTicks(maxValue: number): number[] {
  const safeMax = Math.max(1, maxValue);
  return [safeMax, safeMax * 0.75, safeMax * 0.5, safeMax * 0.25, 0];
}

function compareTableCellValues(leftValue: unknown, rightValue: unknown): number {
  const leftNumber = valueAsNumber(leftValue);
  const rightNumber = valueAsNumber(rightValue);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }
  return formatCellValue(leftValue).localeCompare(formatCellValue(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function AddVisualizationButton({
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onAddVisualization,
}: {
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onAddVisualization: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border text-lg font-semibold transition-colors ${
        isVisualizationAdded
          ? 'border-gray-300 bg-gray-50 text-oracle-medium-gray'
          : 'border-gray-300 bg-white text-oracle-medium-gray hover:border-gray-400 hover:bg-gray-50 hover:text-oracle-dark-gray'
      }`}
      onClick={onAddVisualization}
      disabled={isVisualizationAdded}
      title={isVisualizationAdded ? 'Visualization already added' : `${visibleCount} of ${totalCount} values. Add visualization`}
      aria-label={isVisualizationAdded ? 'Visualization already added' : 'Add visualization'}
      data-testid="add-visualization-button"
    >
      {isVisualizationAdded ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span aria-hidden="true">+</span>
      )}
    </button>
  );
}

function ChartControls({
  search,
  sortMode,
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onSearchChange,
  onSortModeChange,
  onAddVisualization,
}: {
  search: string;
  sortMode: ChartSortMode;
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: ChartSortMode) => void;
  onAddVisualization?: () => void;
}) {
  if (totalCount <= 1 && !onAddVisualization) return null;

  return (
    <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] sm:items-center">
      {totalCount > 1 ? (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
            placeholder="Filter chart values..."
            aria-label="Filter chart values"
            data-testid="analytics-chart-filter"
          />
          <select
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as ChartSortMode)}
            className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
            aria-label="Sort chart values"
            data-testid="analytics-chart-sort"
          >
            <option value="original">Original order</option>
            <option value="value-desc">Highest first</option>
            <option value="value-asc">Lowest first</option>
            <option value="label-asc">Label A-Z</option>
            <option value="label-desc">Label Z-A</option>
          </select>
        </>
      ) : (
        <div className="sm:col-span-2" />
      )}
      {onAddVisualization ? (
        <AddVisualizationButton
          visibleCount={visibleCount}
          totalCount={totalCount}
          isVisualizationAdded={isVisualizationAdded}
          onAddVisualization={onAddVisualization}
        />
      ) : (
        <span className="sr-only" data-testid="analytics-chart-count">
          {visibleCount} of {totalCount}
        </span>
      )}
    </div>
  );
}

function measureChartScrollbar(element: HTMLDivElement | null): ChartScrollbarState {
  if (!element || element.scrollWidth <= element.clientWidth + 1) {
    return { show: false, width: MIN_CHART_SCROLL_THUMB_PX, left: 0 };
  }

  const thumbWidth = Math.max(
    MIN_CHART_SCROLL_THUMB_PX,
    Math.round((element.clientWidth / element.scrollWidth) * element.clientWidth)
  );
  const maxScrollLeft = element.scrollWidth - element.clientWidth;
  const maxThumbLeft = element.clientWidth - thumbWidth;
  const thumbLeft = Math.round((element.scrollLeft / maxScrollLeft) * maxThumbLeft);

  return { show: true, width: thumbWidth, left: thumbLeft };
}

function ChartScrollFrame({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollbar, setScrollbar] = useState<ChartScrollbarState>({
    show: false,
    width: MIN_CHART_SCROLL_THUMB_PX,
    left: 0,
  });

  const updateScrollbar = useCallback(() => {
    setScrollbar(measureChartScrollbar(scrollRef.current));
  }, []);

  const scrollToClientX = useCallback(
    (clientX: number) => {
      const scrollElement = scrollRef.current;
      const railElement = railRef.current;
      if (!scrollElement || !railElement) return;

      const railRect = railElement.getBoundingClientRect();
      const maxThumbLeft = Math.max(0, railRect.width - scrollbar.width);
      const nextThumbLeft = Math.min(
        maxThumbLeft,
        Math.max(0, clientX - railRect.left - scrollbar.width / 2)
      );
      const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
      scrollElement.scrollLeft = maxThumbLeft > 0 ? (nextThumbLeft / maxThumbLeft) * maxScrollLeft : 0;
      updateScrollbar();
    },
    [scrollbar.width, updateScrollbar]
  );

  const handleRailMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!scrollbar.show) return;
    event.preventDefault();
    scrollToClientX(event.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      scrollToClientX(moveEvent.clientX);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  useEffect(() => {
    updateScrollbar();
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    window.addEventListener('resize', updateScrollbar);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollbar) : null;
    resizeObserver?.observe(scrollElement);
    if (scrollElement.firstElementChild) {
      resizeObserver?.observe(scrollElement.firstElementChild);
    }

    return () => {
      window.removeEventListener('resize', updateScrollbar);
      resizeObserver?.disconnect();
    };
  }, [children, updateScrollbar]);

  return (
    <div className="chart-scroll-shell">
      <div
        ref={scrollRef}
        className="chart-horizontal-scroll overflow-x-scroll overflow-y-hidden pb-3"
        data-testid="analytics-chart-scroll"
        onScroll={updateScrollbar}
      >
        {children}
      </div>
      <div
        ref={railRef}
        aria-hidden="true"
        className={`chart-horizontal-scroll-rail ${scrollbar.show ? 'opacity-100' : 'opacity-0'}`}
        data-testid="analytics-chart-scroll-rail"
        onMouseDown={handleRailMouseDown}
      >
        <span
          className="chart-horizontal-scroll-thumb"
          style={{
            width: `${scrollbar.width}px`,
            transform: `translateX(${scrollbar.left}px)`,
          }}
        />
      </div>
    </div>
  );
}

function ResultTableControls({
  search,
  sortMode,
  sortLabelColumn,
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onSearchChange,
  onSortModeChange,
  onAddVisualization,
}: {
  search: string;
  sortMode: TableSortMode;
  sortLabelColumn: string;
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: TableSortMode) => void;
  onAddVisualization?: () => void;
}) {
  return (
    <div
      className={`mb-3 grid min-w-0 gap-2 ${
        onAddVisualization
          ? 'sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto]'
          : 'sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)]'
      } sm:items-center`}
    >
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        placeholder="Filter table values..."
        aria-label="Filter table values"
        data-testid="analytics-table-filter"
      />
      <select
        value={sortMode}
        onChange={(event) => onSortModeChange(event.target.value as TableSortMode)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        aria-label="Sort table values"
        data-testid="analytics-table-sort"
      >
        <option value="original">Original order</option>
        <option value="column-asc">{sortLabelColumn} A-Z</option>
        <option value="column-desc">{sortLabelColumn} Z-A</option>
      </select>
      {onAddVisualization ? (
        <AddVisualizationButton
          visibleCount={visibleCount}
          totalCount={totalCount}
          isVisualizationAdded={isVisualizationAdded}
          onAddVisualization={onAddVisualization}
        />
      ) : null}
    </div>
  );
}

export function ChartPreview({
  spec,
  columns,
  rows,
  onAddVisualization,
  isVisualizationAdded = false,
}: {
  spec: ChartSpec;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  onAddVisualization?: () => void;
  isVisualizationAdded?: boolean;
}) {
  const [chartSearch, setChartSearch] = useState('');
  const [chartSortMode, setChartSortMode] = useState<ChartSortMode>('original');
  const numericColumns = columns.filter((column) => rows.some((row) => valueAsNumber(row[column]) !== null));
  const singleRowNumericComparison = rows.length === 1 && numericColumns.length >= 2 && spec.type !== 'metric';
  const { x, y } = resolveChartFields(spec, columns, rows);
  const allPoints: ChartPoint[] = useMemo(() => {
    const sourcePoints = singleRowNumericComparison
      ? numericColumns.map((column, index) => ({
          label: column,
          value: valueAsNumber(rows[0][column]) ?? 0,
          index,
        }))
      : rows
          .map((row, index) => ({
            label: formatCellValue(row[x]),
            value: valueAsNumber(row[y]) ?? 0,
            index,
          }))
          .filter((point) => Number.isFinite(point.value));

    return sourcePoints;
  }, [numericColumns, rows, singleRowNumericComparison, x, y]);
  const normalizedChartSearch = normalizeChartSearch(chartSearch);
  const points = useMemo(() => {
    const filteredPoints = normalizedChartSearch
      ? allPoints.filter((point) => normalizeChartSearch(point.label).includes(normalizedChartSearch))
      : allPoints;

    return filteredPoints.slice().sort((left, right) => {
      if (chartSortMode === 'value-desc') return right.value - left.value;
      if (chartSortMode === 'value-asc') return left.value - right.value;
      if (chartSortMode === 'label-asc') return left.label.localeCompare(right.label);
      if (chartSortMode === 'label-desc') return right.label.localeCompare(left.label);
      return left.index - right.index;
    });
  }, [allPoints, chartSortMode, normalizedChartSearch]);
  const maxValue = Math.max(...points.map((point) => Math.abs(point.value)), 1);

  if (!rows.length || spec.type === 'table' || (!singleRowNumericComparison && (!x || !y)) || allPoints.length === 0) {
    return (
      <ResultTable
        columns={columns}
        rows={rows}
        isVisualizationAdded={isVisualizationAdded}
        onAddVisualization={onAddVisualization}
      />
    );
  }

  if (spec.type === 'metric') {
    const metric = points[0];
    const metricLabel = formatMetricLabel([metric?.label, y, spec.y, columns[0]]);
    return (
      <div className="relative rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-5 shadow-sm">
        {onAddVisualization ? (
          <div className="absolute right-4 top-4">
            <AddVisualizationButton
              visibleCount={1}
              totalCount={1}
              isVisualizationAdded={isVisualizationAdded}
              onAddVisualization={onAddVisualization}
            />
          </div>
        ) : null}
        <p className="pr-12 text-xs font-semibold uppercase tracking-[0.14em] text-oracle-light-gray">{metricLabel}</p>
        <p className="mt-2 text-4xl font-semibold text-oracle-dark-gray">
          {formatCellValue(metric?.value ?? rows.length)}
        </p>
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm">
        <ChartControls
          search={chartSearch}
          sortMode={chartSortMode}
          visibleCount={0}
          totalCount={allPoints.length}
          isVisualizationAdded={isVisualizationAdded}
          onSearchChange={setChartSearch}
          onSortModeChange={setChartSortMode}
          onAddVisualization={onAddVisualization}
        />
        <p className="text-sm text-oracle-medium-gray">No chart values match the current filter.</p>
      </div>
    );
  }

  if (spec.type === 'line' || spec.type === 'area') {
    const chartWidth = Math.max(620, points.length * 92);
    const step = points.length > 1 ? (chartWidth - 100) / (points.length - 1) : 0;
    const path = points
      .map((point, index) => {
        const px = 40 + index * step;
        const py = 190 - (Math.max(point.value, 0) / maxValue) * 150;
        return `${index === 0 ? 'M' : 'L'} ${px} ${py}`;
      })
      .join(' ');
    const areaPath = `${path} L ${40 + (points.length - 1) * step} 205 L 40 205 Z`;
    return (
      <div className="rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm">
        <ChartControls
          search={chartSearch}
          sortMode={chartSortMode}
          visibleCount={points.length}
          totalCount={allPoints.length}
          isVisualizationAdded={isVisualizationAdded}
          onSearchChange={setChartSearch}
          onSortModeChange={setChartSortMode}
          onAddVisualization={onAddVisualization}
        />
        <ChartScrollFrame>
          <svg
            viewBox={`0 0 ${chartWidth} 240`}
            className="h-64 max-w-none"
            style={{ width: `${chartWidth}px` }}
            role="img"
            aria-label={spec.title || 'Line chart'}
          >
            <line x1="38" y1="205" x2={chartWidth - 30} y2="205" stroke="#d9d2cb" />
            <line x1="38" y1="28" x2="38" y2="205" stroke="#d9d2cb" />
            {spec.type === 'area' && <path d={areaPath} fill="rgba(199,70,52,0.12)" />}
            <path d={path} fill="none" stroke="#c74634" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => {
              const px = 40 + index * step;
              const py = 190 - (Math.max(point.value, 0) / maxValue) * 150;
              return <circle key={`${point.label}-${index}`} cx={px} cy={py} r="4.5" fill={CHART_COLORS[index % CHART_COLORS.length]} />;
            })}
          </svg>
        </ChartScrollFrame>
      </div>
    );
  }

  if (spec.type === 'pie') {
    const total = points.reduce((sum, point) => sum + Math.max(point.value, 0), 0) || 1;
    const cx = 110;
    const cy = 110;
    const outerRadius = 82;
    const innerRadius = 42;
    const gapRadians = points.length > 1 ? 0.012 : 0;
    let currentAngle = -Math.PI / 2;
    const slices = points.map((point, index) => {
      const share = Math.max(point.value, 0) / total;
      const rawEndAngle = currentAngle + share * Math.PI * 2;
      const startAngle = currentAngle + gapRadians;
      const endAngle = rawEndAngle - gapRadians;
      currentAngle = rawEndAngle;
      return {
        label: point.label,
        value: point.value,
        share,
        color: CHART_COLORS[index % CHART_COLORS.length],
        isFullRing: share >= 0.999,
        path: donutSlicePath(cx, cy, outerRadius, innerRadius, startAngle, Math.max(startAngle, endAngle)),
      };
    });
    const ringRadius = (outerRadius + innerRadius) / 2;
    const ringStrokeWidth = outerRadius - innerRadius;

    return (
      <div className="grid min-w-0 gap-4 rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm lg:grid-cols-[minmax(160px,220px)_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <ChartControls
            search={chartSearch}
            sortMode={chartSortMode}
            visibleCount={points.length}
            totalCount={allPoints.length}
            isVisualizationAdded={isVisualizationAdded}
            onSearchChange={setChartSearch}
            onSortModeChange={setChartSortMode}
            onAddVisualization={onAddVisualization}
          />
        </div>
        <svg viewBox="0 0 220 220" className="mx-auto h-56 w-full max-w-56" role="img" aria-label={spec.title || 'Pie chart'}>
          <circle cx={cx} cy={cy} r={outerRadius} fill="#f7f4f1" />
          {slices.map((slice, index) =>
            slice.isFullRing ? (
              <circle
                key={`${slice.label}-${index}`}
                cx={cx}
                cy={cy}
                r={ringRadius}
                fill="none"
                stroke={slice.color}
                strokeWidth={ringStrokeWidth}
              />
            ) : (
              <path
                key={`${slice.label}-${index}`}
                d={slice.path}
                fill={slice.color}
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            )
          )}
          <circle cx={cx} cy={cy} r={innerRadius - 1} fill="#ffffff" />
        </svg>
        <div className="min-w-0 space-y-2 self-center justify-self-start">
          {slices.slice(0, 8).map((point) => (
            <div key={point.label} className="flex w-fit max-w-full items-center gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: point.color }}
                />
                <span className="truncate text-oracle-medium-gray">{point.label}</span>
              </span>
              <span className="shrink-0 font-semibold text-oracle-dark-gray">
                {formatCellValue(point.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const compactBarChart = points.length <= 4;
  const barChartWidth = Math.max(420, points.length * 112);
  const yAxisTicks = buildYAxisTicks(maxValue);

  return (
    <div className="rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm">
      <ChartControls
        search={chartSearch}
        sortMode={chartSortMode}
        visibleCount={points.length}
        totalCount={allPoints.length}
        isVisualizationAdded={isVisualizationAdded}
        onSearchChange={setChartSearch}
        onSortModeChange={setChartSortMode}
        onAddVisualization={onAddVisualization}
      />
      <div className="grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between pr-2 text-right text-[10px] font-medium tabular-nums text-oracle-light-gray"
          style={{
            height: `${BAR_CHART_HEIGHT_PX}px`,
            paddingTop: `${BAR_CHART_TOP_PADDING_PX}px`,
            paddingBottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
          }}
        >
          {yAxisTicks.map((tick, index) => (
            <span key={`${tick}-${index}`}>{formatAxisValue(tick)}</span>
          ))}
        </div>
        <ChartScrollFrame>
          <div
            className={`relative ${compactBarChart ? 'min-w-full' : ''}`}
            style={
              compactBarChart
                ? { height: `${BAR_CHART_HEIGHT_PX}px` }
                : { minWidth: `${barChartWidth}px`, height: `${BAR_CHART_HEIGHT_PX}px` }
            }
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 right-0 flex flex-col justify-between border-l border-[#c9c0b8]"
              style={{
                top: `${BAR_CHART_TOP_PADDING_PX}px`,
                bottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
              }}
            >
              {yAxisTicks.map((tick, index) => (
                <span
                  key={`${tick}-${index}`}
                  className={`border-t ${index === yAxisTicks.length - 1 ? 'border-[#c9c0b8]' : 'border-[#eee6df]'}`}
                />
              ))}
            </div>
            <div
              className={`relative z-10 flex h-full gap-4 ${compactBarChart ? 'justify-center' : ''}`}
            >
              {points.map((point, index) => {
                const height = Math.max(8, (Math.abs(point.value) / maxValue) * BAR_CHART_MAX_BAR_HEIGHT_PX);
                return (
                  <div
                    key={`${point.label}-${index}`}
                    className="relative h-full w-24 shrink-0"
                  >
                    <div
                      className="absolute left-0 right-0 flex flex-col items-center justify-end"
                      style={{
                        top: `${BAR_CHART_TOP_PADDING_PX}px`,
                        bottom: `${BAR_CHART_BOTTOM_PADDING_PX}px`,
                      }}
                    >
                      <div className="mb-2 max-w-full whitespace-nowrap text-center text-xs font-semibold tabular-nums text-oracle-medium-gray">
                        {formatCellValue(point.value)}
                      </div>
                      <div
                        className="w-full rounded-t-md shadow-[0_8px_16px_rgba(49,45,42,0.12)]"
                        style={{ height: `${height}px`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        title={`${point.label}: ${formatCellValue(point.value)}`}
                      />
                    </div>
                    <div
                      className="absolute bottom-0 left-0 right-0 flex items-start justify-center pt-2 text-center text-xs text-oracle-light-gray"
                      style={{ height: `${BAR_CHART_BOTTOM_PADDING_PX}px` }}
                      title={point.label}
                    >
                      <span className="w-full truncate">
                        {point.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartScrollFrame>
      </div>
    </div>
  );
}

function ResultTable({
  columns,
  rows,
  onAddVisualization,
  isVisualizationAdded = false,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  onAddVisualization?: () => void;
  isVisualizationAdded?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [tableSortMode, setTableSortMode] = useState<TableSortMode>('original');
  const normalizedTableSearch = normalizeChartSearch(tableSearch);
  const filteredRows = useMemo(() => {
    if (!normalizedTableSearch) return rows;
    return rows.filter((row) =>
      columns.some((column) => normalizeChartSearch(formatCellValue(row[column])).includes(normalizedTableSearch))
    );
  }, [columns, normalizedTableSearch, rows]);
  const sortedRows = useMemo(() => {
    if (tableSortMode === 'original') return filteredRows;
    const sortColumn = columns[0];
    if (!sortColumn) return filteredRows;
    const direction = tableSortMode === 'column-asc' ? 1 : -1;
    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const comparison = compareTableCellValues(left.row[sortColumn], right.row[sortColumn]);
        return comparison === 0 ? left.index - right.index : comparison * direction;
      })
      .map((item) => item.row);
  }, [columns, filteredRows, tableSortMode]);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const visibleRows = sortedRows.slice(start, start + PAGE_SIZE);
  const sortLabelColumn = columns[0] ? columns[0].replace(/_/g, ' ') : 'First column';

  useEffect(() => {
    setPage(0);
  }, [sortedRows.length, columns.join('|'), normalizedTableSearch, tableSortMode]);

  if (!rows.length) {
    return <p className="text-sm text-oracle-medium-gray">The query returned no rows.</p>;
  }

  return (
    <div className="rounded-lg border border-[#e2d8d0] bg-[#fffdfb] p-4 shadow-sm">
      <ResultTableControls
        search={tableSearch}
        sortMode={tableSortMode}
        sortLabelColumn={sortLabelColumn}
        visibleCount={sortedRows.length}
        totalCount={rows.length}
        isVisualizationAdded={isVisualizationAdded}
        onSearchChange={setTableSearch}
        onSortModeChange={setTableSortMode}
        onAddVisualization={onAddVisualization}
      />
      <div className="analytics-result-table overflow-hidden rounded-lg border border-[#e2d8d0] bg-white">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm text-oracle-dark-gray">
            <thead className="bg-oracle-table-header">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap border-b border-[#e2d8d0] px-4 py-3 text-xs font-semibold uppercase text-oracle-dark-gray"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {visibleRows.length > 0 ? (
                visibleRows.map((row, rowIndex) => (
                  <tr key={`${safePage}-${rowIndex}`} className="border-b border-[#eee6df] last:border-b-0 hover:bg-[#faf8f6]">
                    {columns.map((column) => (
                      <td key={column} className="whitespace-nowrap px-4 py-3 text-oracle-dark-gray">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-sm text-oracle-medium-gray" colSpan={Math.max(1, columns.length)}>
                    No table rows match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2d8d0] bg-[#fbf9f7] px-4 py-3 text-xs text-oracle-medium-gray">
          <span>
            {sortedRows.length > 0
              ? `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, sortedRows.length)} of ${sortedRows.length}`
              : 'No rows to show'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-[#e2d8d0] bg-white px-3 py-1 text-xs font-medium text-oracle-dark-gray transition-colors hover:bg-[#f6f2ef] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage === 0}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              className="rounded border border-[#e2d8d0] bg-white px-3 py-1 text-xs font-medium text-oracle-dark-gray transition-colors hover:bg-[#f6f2ef] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantResult({
  result,
  question,
  onAddVisualization,
  isVisualizationAdded,
}: {
  result: AnalyticsAskResponse;
  question: string;
  onAddVisualization: (item: DashboardDraftItem) => void;
  isVisualizationAdded: boolean;
}) {
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  useEffect(() => {
    if (!isSqlModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSqlModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSqlModalOpen]);

  return (
    <div className="space-y-4">
      <p className="whitespace-pre-line text-sm leading-6 text-oracle-dark-gray">{result.answer}</p>
      <div aria-label="Analytical chart">
        <ChartPreview
          spec={result.chart_spec}
          columns={result.columns}
          rows={result.rows}
          isVisualizationAdded={isVisualizationAdded}
          onAddVisualization={() =>
            onAddVisualization({
              draft_id: result.run_id,
              run_id: result.run_id,
              title: result.chart_spec.title || question.slice(0, 120) || 'Analytics visualization',
              question,
              sql: result.sql,
              chart_spec: result.chart_spec,
            })
          }
        />
      </div>
      <button
        type="button"
        className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-200"
        title="Generated SQL"
        onClick={() => setIsSqlModalOpen(true)}
      >
        <svg className="h-2.5 w-2.5 shrink-0 text-oracle-light-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>SQL</span>
      </button>
      {isSqlModalOpen && (
        <GlassModal
          open={isSqlModalOpen}
          onClose={() => setIsSqlModalOpen(false)}
          containerClassName="items-start justify-center p-4"
          panelClassName="mt-16 flex max-h-[82vh] w-full max-w-5xl flex-col border-0"
          panelStyle={{
            background: '#ffffff',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          }}
        >
          <div className="flex shrink-0 items-center gap-3 bg-oracle-dark-gray px-5 py-4">
            <h2 id="generated-sql-title" className="text-lg font-semibold text-white">
              Generated SQL
            </h2>
            <div className="ml-auto" />
            <button
              type="button"
              className="rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
              aria-label="Close Generated SQL"
              onClick={() => setIsSqlModalOpen(false)}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white p-4">
            <pre className="max-h-72 overflow-auto rounded-lg border border-[#d9d2cb] bg-white p-4 text-xs leading-5 text-oracle-dark-gray shadow-[inset_0_1px_0_rgba(49,45,42,0.03)]">
              {result.sql}
            </pre>
            <ResultTable columns={result.columns} rows={result.rows} />
          </div>
        </GlassModal>
      )}
    </div>
  );
}

function OracleAgentGraphPanel({
  result,
  dataSources,
  latestQuestion,
  onClose,
}: {
  result?: AnalyticsAskResponse;
  dataSources: DataSourceSummary[];
  latestQuestion: string;
  onClose: () => void;
}) {
  const graphTables = useMemo(() => resolveGraphTables(result, dataSources), [result, dataSources]);
  const graphTablesForFlow = graphTables.slice(0, 6);
  const traceItems = result?.agent_trace || [];
  const profileName =
    traceItems.find((item) => item.profile_name)?.profile_name ||
    traceItems.find((item) => item.stage === 'select_ai.scope_profile')?.stage ||
    'Scoped Select AI profile';
  const statusForStage = (stagePart: string, fallback: OracleGraphNodeStatus): OracleGraphNodeStatus => {
    const status = String(traceItems.find((item) => item.stage.includes(stagePart))?.status || fallback).toLowerCase();
    return status === 'failed' ? 'failed' : status === 'completed' ? 'completed' : 'idle';
  };
  const graphNodes: OracleGraphNode[] = [
    {
      key: 'request',
      label: 'Question',
      detail: 'Natural-language request',
      kind: 'input',
      status: result ? 'completed' : 'idle',
    },
    {
      key: 'profile',
      label: 'DBMS_CLOUD_AI',
      detail: profileName,
      kind: 'profile',
      status: statusForStage('scope_profile', result ? 'completed' : 'idle'),
    },
    ...graphTablesForFlow.map((table, index): OracleGraphNode => ({
      key: `table_${index}`,
      label: table.name,
      detail: table.owner,
      kind: 'table',
      status: graphTables.length > 0 ? 'completed' : 'idle',
    })),
    {
      key: 'sql',
      label: 'SHOWSQL',
      detail: 'Read-only SELECT generated',
      kind: 'sql',
      status: statusForStage('showsql', result?.sql ? 'completed' : 'idle'),
    },
    {
      key: 'execute',
      label: 'SELECT executor',
      detail: `${result?.row_count ?? 0} rows returned`,
      kind: 'execute',
      status: statusForStage('execute_select', result ? 'completed' : 'idle'),
    },
    {
      key: 'answer',
      label: 'Answer and chart',
      detail: result?.chart_spec?.type ? `${result.chart_spec.type} visualization` : 'Waiting for result',
      kind: 'answer',
      status: result ? 'completed' : 'idle',
    },
  ];
  const tableNodeKeys = graphTablesForFlow.map((_table, index) => `table_${index}`);
  const graphEdges: OracleGraphEdge[] = [
    { source: 'request', target: 'profile' },
    ...(tableNodeKeys.length
      ? tableNodeKeys.flatMap((tableNodeKey, index) => [
          { source: 'profile', target: tableNodeKey, label: index === 0 ? 'object_list' : '' },
          { source: tableNodeKey, target: 'sql' },
        ])
      : [{ source: 'profile', target: 'sql' }]),
    { source: 'sql', target: 'execute' },
    { source: 'execute', target: 'answer' },
  ];
  const { nodes: renderNodes, edgePaths } = useMemo(
    () => buildOracleGraphWithDagre(graphNodes, graphEdges),
    [graphNodes, graphEdges]
  );
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('profile');
  useEffect(() => {
    if (!renderNodes.some((node) => node.key === selectedNodeKey)) {
      setSelectedNodeKey(renderNodes[0]?.key || 'profile');
    }
  }, [renderNodes, selectedNodeKey]);
  const selectedNode = renderNodes.find((node) => node.key === selectedNodeKey);
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [graphPanning, setGraphPanning] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphPanRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const graphBounds = useMemo(() => {
    if (!renderNodes.length) {
      return { x: 0, y: 0, width: 460, height: 420 };
    }
    const minX = Math.min(...renderNodes.map((node) => node.x - node.width / 2), ...edgePaths.flatMap((edge) => edge.points.map((point) => point.x)));
    const minY = Math.min(...renderNodes.map((node) => node.y - node.height / 2), ...edgePaths.flatMap((edge) => edge.points.map((point) => point.y)));
    const maxX = Math.max(...renderNodes.map((node) => node.x + node.width / 2), ...edgePaths.flatMap((edge) => edge.points.map((point) => point.x)));
    const maxY = Math.max(...renderNodes.map((node) => node.y + node.height / 2), ...edgePaths.flatMap((edge) => edge.points.map((point) => point.y)));
    return {
      x: minX - 36,
      y: minY - 36,
      width: Math.max(460, maxX - minX + 72),
      height: Math.max(420, maxY - minY + 72),
    };
  }, [renderNodes, edgePaths]);
  const graphCanvasHeight = Math.max(420, graphBounds.height);
  const graphEffectiveViewBox = useMemo(() => {
    const zoom = Math.max(0.7, Math.min(2.2, graphZoom));
    const width = graphBounds.width / zoom;
    const height = graphBounds.height / zoom;
    return {
      x: graphBounds.x + (graphBounds.width - width) / 2 + graphPan.x,
      y: graphBounds.y + (graphBounds.height - height) / 2 + graphPan.y,
      width,
      height,
    };
  }, [graphBounds, graphPan, graphZoom]);
  const adjustGraphZoom = useCallback((delta: number) => {
    setGraphZoom((prev) => Math.max(0.7, Math.min(2.2, Math.round((prev + delta) * 100) / 100)));
  }, []);
  const resetGraphZoom = useCallback(() => {
    setGraphZoom(1);
    setGraphPan({ x: 0, y: 0 });
  }, []);
  const handleGraphWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      adjustGraphZoom(event.deltaY > 0 ? -0.1 : 0.1);
    },
    [adjustGraphZoom]
  );

  useEffect(() => {
    const element = graphContainerRef.current;
    if (!element) return;
    element.addEventListener('wheel', handleGraphWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleGraphWheel);
  }, [handleGraphWheel]);

  const handleGraphPanStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    graphPanRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: graphPan.x,
      panY: graphPan.y,
    };
    setGraphPanning(true);
  };

  useEffect(() => {
    if (!graphPanning) return;
    const onMove = (event: MouseEvent) => {
      if (!graphPanRef.current) return;
      const dx = event.clientX - graphPanRef.current.startX;
      const dy = event.clientY - graphPanRef.current.startY;
      setGraphPan({
        x: graphPanRef.current.panX - dx,
        y: graphPanRef.current.panY - dy,
      });
    };
    const onUp = () => {
      graphPanRef.current = null;
      setGraphPanning(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [graphPanning]);

  useEffect(() => {
    resetGraphZoom();
  }, [resetGraphZoom, result?.conversation_id]);

  const selectedNodeInspection = useMemo(() => {
    if (!selectedNode) return null;
    const traceFor = (stagePart: string) =>
      traceItems.find((item) => item.stage.toLowerCase().includes(stagePart.toLowerCase()));
    const base = {
      title: selectedNode.label,
      subtitle: selectedNode.detail,
      status: selectedNode.status,
      inputPayload: undefined as unknown,
      outputPayload: undefined as unknown,
      responseText: '',
    };
    if (selectedNode.key === 'request') {
      return {
        ...base,
        inputPayload: { question: latestQuestion || result?.chart_spec?.title || '' },
        outputPayload: {
          conversation_id: result?.conversation_id || '',
          run_id: result?.run_id || '',
        },
      };
    }
    if (selectedNode.key === 'profile') {
      return {
        ...base,
        inputPayload: {
          package: 'DBMS_CLOUD_AI',
          profile_name: profileName,
          action: 'showsql',
          enforce_object_list: true,
        },
        outputPayload: {
          profile_name: profileName,
          object_list: graphTables.map((table) => ({
            owner: table.owner,
            name: table.name,
            columns: table.columns,
          })),
          trace: traceFor('scope_profile') || null,
        },
      };
    }
    if (selectedNode.key.startsWith('table_')) {
      const table = graphTablesForFlow[Number(selectedNode.key.replace('table_', ''))];
      return {
        ...base,
        inputPayload: {
          source: 'Select AI object_list',
          owner: table?.owner || '',
          table_name: table?.name || '',
        },
        outputPayload: {
          row_count: table?.rowCount ?? null,
          source_type: table?.sourceType || '',
          columns: table?.columns || [],
        },
      };
    }
    if (selectedNode.key === 'sql') {
      return {
        ...base,
        inputPayload: {
          question: latestQuestion || result?.chart_spec?.title || '',
          profile_name: profileName,
          action: 'DBMS_CLOUD_AI.GENERATE showsql',
        },
        outputPayload: {
          generated_sql: result?.sql || '',
          trace: traceFor('showsql') || null,
        },
      };
    }
    if (selectedNode.key === 'execute') {
      return {
        ...base,
        inputPayload: {
          sql: result?.sql || '',
          read_only: true,
          max_rows: 500,
        },
        outputPayload: {
          row_count: result?.row_count ?? 0,
          columns: result?.columns || [],
          sample_rows: (result?.rows || []).slice(0, 5),
          trace: traceFor('execute_select') || null,
        },
      };
    }
    if (selectedNode.key === 'answer') {
      return {
        ...base,
        responseText: result?.answer || '',
        inputPayload: {
          columns: result?.columns || [],
          row_count: result?.row_count ?? 0,
          chart_type: result?.chart_spec?.type || 'table',
        },
        outputPayload: {
          answer: result?.answer || '',
          chart_spec: result?.chart_spec || {},
        },
      };
    }
    return base;
  }, [graphTables, graphTablesForFlow, latestQuestion, profileName, result, selectedNode, traceItems]);

  const resolveNodeClassName = (node: OracleGraphRenderNode, selected: boolean) => {
    if (selected) {
      if (node.status === 'completed') return 'fill-emerald-200 stroke-emerald-600 text-emerald-800';
      if (node.status === 'failed') return 'fill-rose-200 stroke-rose-600 text-rose-800';
      return 'fill-gray-200 stroke-gray-500 text-oracle-dark-gray';
    }
    if (node.status === 'completed') return 'fill-emerald-50 stroke-emerald-500 text-emerald-700';
    if (node.status === 'failed') return 'fill-rose-50 stroke-rose-500 text-rose-700';
    return 'fill-white stroke-gray-300 text-oracle-medium-gray';
  };

  return (
    <aside className="chat-graph-panel absolute inset-y-0 right-0 z-10 flex w-1/2 min-w-[520px] flex-col border-l border-oracle-border bg-white shadow-2xl">
      <div className="flex items-center gap-2 border-b border-oracle-border bg-gray-50 px-4 py-[11.5px]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-oracle-dark-gray text-white">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 256 256">
            <path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm56-80a16,16,0,1,1,16,16A16,16,0,0,1,112,128Zm88,72a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-oracle-dark-gray">Live Graph</p>
          <p className="truncate text-[11px] text-oracle-medium-gray">
            {result ? `Conversation: ${result.conversation_id}` : 'Ask a question to populate the graph'}
          </p>
        </div>
        <button
          type="button"
          className="ml-auto rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5"
          onClick={onClose}
          aria-label="Close agent graph"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-oracle-bg-gray p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-oracle-dark-gray">Graph flow</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-[10px] text-oracle-medium-gray">
                <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--idle" />Idle</span>
                <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--completed" />Completed</span>
                <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--failed" />Failed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => adjustGraphZoom(-0.1)}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  -
                </button>
                <button
                  type="button"
                  className="h-6 rounded border border-gray-300 bg-white px-2 text-[10px] text-gray-700 hover:bg-gray-50"
                  onClick={resetGraphZoom}
                  title="Reset zoom"
                  aria-label="Reset zoom"
                >
                  {`${Math.round(graphZoom * 100)}%`}
                </button>
                <button
                  type="button"
                  className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => adjustGraphZoom(0.1)}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div
            ref={graphContainerRef}
            className={`h-[420px] select-none rounded-md border border-gray-200 bg-oracle-bg-gray [scrollbar-width:thin] [scrollbar-color:#9CA3AF_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent ${
              graphZoom === 1 ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'
            }`}
            onMouseDown={handleGraphPanStart}
            style={{ cursor: graphPanning ? 'grabbing' : 'grab' }}
          >
            <div
              style={{
                width: '100%',
                height: graphCanvasHeight,
                minHeight: graphCanvasHeight,
                margin: '0 auto',
              }}
            >
              <svg
                width="100%"
                height={graphCanvasHeight}
                viewBox={`${graphEffectiveViewBox.x} ${graphEffectiveViewBox.y} ${graphEffectiveViewBox.width} ${graphEffectiveViewBox.height}`}
                preserveAspectRatio="xMidYMin meet"
                className="block"
                role="img"
                aria-label="Oracle 26ai runtime graph"
              >
              <defs>
                <marker id="oracleGraphArrowGray" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 z" fill="#9CA3AF" />
                </marker>
                <marker id="oracleGraphArrowGreen" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 z" fill="#10B981" />
                </marker>
                <marker id="oracleGraphArrowRose" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
                  <path d="M0,0 L5,2.5 L0,5 z" fill="#E11D48" />
                </marker>
              </defs>
              {edgePaths.map((edge, index) => {
                const pathD =
                  edge.points.length >= 2
                    ? `M ${edge.points[0].x} ${edge.points[0].y} ${edge.points
                        .slice(1)
                        .map((point) => `L ${point.x} ${point.y}`)
                        .join(' ')}`
                    : '';
                const sourceNode = renderNodes.find((node) => node.key === edge.source);
                const targetNode = renderNodes.find((node) => node.key === edge.target);
                const isFailed = sourceNode?.status === 'failed' || targetNode?.status === 'failed';
                const isCompleted = sourceNode?.status === 'completed' && targetNode?.status === 'completed';
                const labelPoint = edge.points[Math.max(0, Math.floor(edge.points.length / 2))];
                return (
                  <g key={`${edge.source}-${edge.target}-${index}`}>
                    <path
                      d={pathD}
                      fill="none"
                      className={`${isFailed ? 'stroke-rose-500' : isCompleted ? 'stroke-emerald-500' : 'stroke-gray-300'} transition-colors`}
                      strokeWidth={2}
                      markerEnd={isFailed ? 'url(#oracleGraphArrowRose)' : isCompleted ? 'url(#oracleGraphArrowGreen)' : 'url(#oracleGraphArrowGray)'}
                    />
                    {edge.label && labelPoint ? (
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y - 8}
                        textAnchor="middle"
                        className="fill-oracle-medium-gray text-[10px]"
                      >
                        {edge.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {renderNodes.map((node) => {
                const isSelected = selectedNodeKey === node.key;
                const nodeClassName = resolveNodeClassName(node, isSelected);
                return (
                  <g
                    key={node.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.label}: ${node.detail}`}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => setSelectedNodeKey(node.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedNodeKey(node.key);
                      }
                    }}
                    className="group cursor-pointer outline-none"
                  >
                    <rect
                      x={node.x - node.width / 2}
                      y={node.y - node.height / 2}
                      width={node.width}
                      height={node.height}
                      rx={10}
                      className={`${nodeClassName} transition-all duration-200 group-hover:opacity-70`}
                      strokeWidth={1.8}
                    />
                    <text
                      x={node.x}
                      y={node.y - 5}
                      textAnchor="middle"
                      className="fill-current text-[12px] font-semibold"
                    >
                      {truncateGraphText(node.label, 23)}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + 13}
                      textAnchor="middle"
                      className="fill-current text-[10px] opacity-80"
                    >
                      {truncateGraphText(node.detail, 25)}
                    </text>
                  </g>
                );
              })}
              </svg>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-oracle-dark-gray">Node inspector</p>
            {selectedNodeInspection ? (
              <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-oracle-medium-gray">
                {selectedNodeKey}
              </span>
            ) : null}
          </div>
          {!selectedNodeInspection ? (
            <p className="text-[11px] text-oracle-light-gray">Select a node in the graph to inspect input and output.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-oracle-medium-gray">
                  Status: <span className="font-semibold text-oracle-dark-gray">{selectedNodeInspection.status}</span>
                </span>
                <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-oracle-medium-gray">
                  Kind: <span className="font-semibold text-oracle-dark-gray">{selectedNode?.kind || '-'}</span>
                </span>
              </div>

              {selectedNodeInspection.responseText ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-oracle-dark-gray">Response</p>
                  <div className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-oracle-medium-gray">
                    {selectedNodeInspection.responseText}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-oracle-dark-gray">Input</p>
                  {selectedNodeInspection.inputPayload === undefined ? (
                    <p className="text-[11px] text-oracle-light-gray">No input payload available.</p>
                  ) : (
                    <pre className="max-h-[170px] overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-oracle-medium-gray">
                      {formatJsonForDisplay(selectedNodeInspection.inputPayload)}
                    </pre>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-oracle-dark-gray">Output</p>
                  {selectedNodeInspection.outputPayload === undefined ? (
                    <p className="text-[11px] text-oracle-light-gray">No output payload available.</p>
                  ) : (
                    <pre className="max-h-[190px] overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-oracle-medium-gray">
                      {formatJsonForDisplay(selectedNodeInspection.outputPayload)}
                    </pre>
                  )}
                </div>
              </div>
            </>
          )}
        </div>


      </div>
    </aside>
  );
}

export function AnalyticsChatPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipBlurRenameRef = useRef(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const { agentName } = useAppBranding();
  const {
    activeConversationId,
    activeConversationTitle,
    attachConversation,
    openNewConversation,
  } = useAnalyticsChat();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isInlineRenaming, setIsInlineRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isGraphPanelOpen, setIsGraphPanelOpen] = useState(false);
  const [dashboardDraftItems, setDashboardDraftItems] = useState<DashboardDraftItem[]>([]);
  const [isDashboardTrayOpen, setIsDashboardTrayOpen] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardVisibility, setDashboardVisibility] = useState<DashboardVisibility>('private');
  const [dashboardTargetMode, setDashboardTargetMode] = useState<DashboardTargetMode>('new');
  const [dashboardTargetId, setDashboardTargetId] = useState('');
  const [pendingDashboardItem, setPendingDashboardItem] = useState<DashboardDraftItem | null>(null);
  const [addDashboardStep, setAddDashboardStep] = useState<AddDashboardStep>('target');
  const [addDashboardMode, setAddDashboardMode] = useState<DashboardTargetMode>('new');
  const [addDashboardId, setAddDashboardId] = useState('');
  const [addDashboardName, setAddDashboardName] = useState('');
  const [addDashboardVisibility, setAddDashboardVisibility] = useState<DashboardVisibility>('private');
  const currentConversationId = activeConversationId || conversationId;

  const conversationQuery = useQuery({
    queryKey: queryKeys.analytics.conversation(activeConversationId),
    queryFn: async () => {
      if (!activeConversationId) throw new Error('Conversation id is required.');
      const response = await analyticsApi.getConversation(activeConversationId, 500);
      return response.data;
    },
    enabled: Boolean(activeConversationId),
  });

  const graphDataSourcesQuery = useQuery({
    queryKey: queryKeys.dataSources.list,
    queryFn: () => dataSourcesApi.list().then((response) => response.data.items),
    enabled: isGraphPanelOpen,
  });

  const dashboardsQuery = useQuery({
    queryKey: queryKeys.dashboards.ownerList,
    queryFn: () => dashboardsApi.list(100, true).then((response) => response.data.items),
    enabled: Boolean(pendingDashboardItem) || isDashboardTrayOpen,
  });

  useEffect(() => {
    if (!activeConversationId) {
      setConversationId(null);
      setMessages([]);
      setErrorMessage('');
    }
  }, [activeConversationId]);

  useEffect(() => {
    const conversation = conversationQuery.data;
    if (!conversation) return;
    setConversationId(conversation.conversation_id);
    setMessages(
      conversation.messages.flatMap((message) => {
        const timestamp = message.created_at ? new Date(message.created_at) : new Date();
        return [
          {
            id: `${message.run_id}-user`,
            role: 'user' as const,
            content: message.question,
            timestamp,
          },
          {
            id: `${message.run_id}-assistant`,
            role: 'assistant' as const,
            content: message.result.answer,
            timestamp,
            result: message.result,
            question: message.question,
          },
        ];
      })
    );
  }, [conversationQuery.data]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const input = composerInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 224)}px`;
  }, [question]);

  useEffect(() => {
    if (!isHeaderMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (headerMenuRef.current && target && !headerMenuRef.current.contains(target)) {
        setIsHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isHeaderMenuOpen]);

  const latestResult = useMemo(
    () => [...messages].reverse().find((message): message is Extract<Message, { role: 'assistant' }> => message.role === 'assistant')?.result,
    [messages]
  );
  const latestQuestion = useMemo(
    () => [...messages].reverse().find((message): message is Extract<Message, { role: 'user' }> => message.role === 'user')?.content || '',
    [messages]
  );
  const conversationTitle = activeConversationTitle || conversationQuery.data?.title || 'New analytics chat';
  const defaultDashboardName = useMemo(() => {
    const normalized = conversationTitle.replace(/^New analytics chat$/i, 'Analytics dashboard').trim();
    return normalized || 'Analytics dashboard';
  }, [conversationTitle]);
  const dashboardOptions = dashboardsQuery.data || [];
  const selectedExistingDashboard = useMemo(
    () => dashboardOptions.find((dashboard) => dashboard.dashboard_id === dashboardTargetId) || null,
    [dashboardOptions, dashboardTargetId]
  );
  const selectedVisualizationIds = useMemo(
    () => new Set(dashboardDraftItems.map((item) => item.draft_id)),
    [dashboardDraftItems]
  );

  useEffect(() => {
    if (!pendingDashboardItem || addDashboardMode !== 'existing' || addDashboardId || dashboardOptions.length === 0) {
      return;
    }
    setAddDashboardId(dashboardOptions[0].dashboard_id);
  }, [addDashboardId, addDashboardMode, dashboardOptions, pendingDashboardItem]);

  const openAddVisualizationModal = useCallback(
    (item: DashboardDraftItem) => {
      setPendingDashboardItem(item);
      setAddDashboardStep('target');
      setAddDashboardMode(dashboardTargetMode);
      setAddDashboardId(dashboardTargetId);
      setAddDashboardName(dashboardTargetMode === 'new' ? dashboardName.trim() || defaultDashboardName : defaultDashboardName);
      setAddDashboardVisibility(dashboardVisibility);
    },
    [dashboardName, dashboardTargetId, dashboardTargetMode, dashboardVisibility, defaultDashboardName]
  );

  const closeAddVisualizationModal = () => {
    setPendingDashboardItem(null);
    setAddDashboardStep('target');
  };

  const advanceAddVisualizationStep = () => {
    if (addDashboardMode === 'existing') {
      const nextDashboardId = addDashboardId || dashboardOptions[0]?.dashboard_id || '';
      if (!nextDashboardId) {
        showToast('No dashboards available.', 'error');
        return;
      }
      setAddDashboardId(nextDashboardId);
    }
    setAddDashboardStep('details');
  };

  const confirmAddVisualizationTarget = () => {
    if (!pendingDashboardItem) return;

    const nextItems = (current: DashboardDraftItem[]) => {
      if (current.some((existing) => existing.draft_id === pendingDashboardItem.draft_id)) {
        return current;
      }
      return [...current, pendingDashboardItem];
    };

    if (addDashboardMode === 'existing') {
      if (!addDashboardId) {
        showToast('Select a dashboard.', 'error');
        return;
      }
      const selectedDashboard = dashboardOptions.find((dashboard) => dashboard.dashboard_id === addDashboardId);
      setDashboardTargetMode('existing');
      setDashboardTargetId(addDashboardId);
      setDashboardName(selectedDashboard?.dashboard_name || '');
      setDashboardVisibility(selectedDashboard?.visibility || 'private');
    } else {
      const normalizedName = addDashboardName.trim() || defaultDashboardName;
      setDashboardTargetMode('new');
      setDashboardTargetId('');
      setDashboardName(normalizedName);
      setDashboardVisibility(addDashboardVisibility);
    }

    setDashboardDraftItems(nextItems);
    setIsDashboardTrayOpen(true);
    setPendingDashboardItem(null);
  };

  const removeVisualizationFromDraft = (draftId: string) => {
    setDashboardDraftItems((current) => current.filter((item) => item.draft_id !== draftId));
  };

  const saveDashboardMutation = useMutation({
    mutationFn: () => {
      const normalizedName = dashboardName.trim() || conversationTitle || 'Analytics dashboard';
      const items = dashboardDraftItems.map(({ draft_id, ...item }) => item);
      if (dashboardTargetMode === 'existing' && dashboardTargetId) {
        return dashboardsApi.addItems(dashboardTargetId, { items }).then((response) => response.data);
      }
      return dashboardsApi.create({
        name: normalizedName,
        description: `Generated from chat: ${conversationTitle}`,
        visibility: dashboardVisibility,
        items,
      }).then((response) => response.data);
    },
    onSuccess: (dashboard) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.ownerList });
      queryClient.setQueryData(queryKeys.dashboards.detail(dashboard.dashboard_id), dashboard);
      setDashboardDraftItems([]);
      setDashboardName('');
      setDashboardVisibility('private');
      setDashboardTargetMode('new');
      setDashboardTargetId('');
      setIsDashboardTrayOpen(false);
      showToast(dashboardTargetMode === 'existing' ? 'Visualization added to dashboard.' : 'Dashboard generated.', 'success');
      navigate(`/analytics?dashboard=${encodeURIComponent(dashboard.dashboard_id)}`);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  useEffect(() => {
    if (!isInlineRenaming) return;
    window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  }, [isInlineRenaming]);

  const askMutation = useMutation({
    mutationFn: (text: string) =>
      analyticsApi.ask({ question: text, max_rows: 500, conversation_id: conversationId || undefined }).then((response) => response.data),
    onMutate: (text) => {
      setErrorMessage('');
      setQuestion('');
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() },
      ]);
    },
    onSuccess: (result, text) => {
      setConversationId(result.conversation_id);
      attachConversation(result.conversation_id, activeConversationTitle ?? text.slice(0, 120));
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: result.answer, timestamp: new Date(), result, question: text },
      ]);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => analyticsApi.deleteConversation(id),
    onSuccess: (_response, deletedConversationId) => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.removeQueries({ queryKey: queryKeys.analytics.conversation(deletedConversationId) });
      setMessages([]);
      setConversationId(null);
      setIsDeleteConfirmOpen(false);
      setIsHeaderMenuOpen(false);
      setIsGraphPanelOpen(false);
      openNewConversation();
      showToast('Chat deleted.', 'success');
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      analyticsApi.renameConversation(id, title).then((response) => response.data),
    onSuccess: (conversation) => {
      attachConversation(conversation.conversation_id, conversation.title);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.conversation(conversation.conversation_id) });
      setIsInlineRenaming(false);
      setIsHeaderMenuOpen(false);
      showToast('Chat renamed.', 'success');
    },
    onError: (error) => {
      setRenameDraft(conversationTitle);
      setIsInlineRenaming(false);
      showToast(getErrorMessage(error), 'error');
    },
  });

  const startInlineRename = () => {
    if (!currentConversationId || renameConversationMutation.isPending || deleteConversationMutation.isPending) return;
    setRenameDraft(conversationTitle);
    setIsInlineRenaming(true);
    setIsHeaderMenuOpen(false);
  };

  const submitInlineRename = () => {
    if (!currentConversationId || renameConversationMutation.isPending) return;
    const normalizedTitle = renameDraft.trim();
    if (!normalizedTitle || normalizedTitle === conversationTitle) {
      setRenameDraft(conversationTitle);
      setIsInlineRenaming(false);
      return;
    }
    renameConversationMutation.mutate({ id: currentConversationId, title: normalizedTitle });
  };

  const cancelInlineRename = () => {
    skipBlurRenameRef.current = true;
    setRenameDraft(conversationTitle);
    setIsInlineRenaming(false);
  };

  const submitQuestion = (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = question.trim();
    if (!normalized || askMutation.isPending) return;
    setErrorMessage('');
    askMutation.mutate(normalized);
  };

  const renderComposer = (placeholder: string) => (
    <form onSubmit={submitQuestion} className="relative w-full">
      {errorMessage && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      <div className="chat-composer-surface flex w-full items-end gap-2 rounded-2xl border border-oracle-border bg-white px-3 py-2 shadow-sm">
        <div className="relative min-w-0 flex-1">
        <textarea
          ref={composerInputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={1}
          className="chat-composer-input block max-h-56 min-h-8 min-w-[12rem] w-full resize-none overflow-hidden border-0 bg-transparent py-1 text-sm leading-6 text-oracle-dark-gray outline-none placeholder:text-oracle-medium-gray selection:bg-gray-200 selection:text-oracle-dark-gray"
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          data-gramm="false"
          data-gramm-editor="false"
          data-enable-grammarly="false"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              submitQuestion(event);
            }
          }}
        />
        </div>
        <button
          type="submit"
          className="mb-0.5 shrink-0 rounded-full bg-oracle-red p-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!question.trim() || askMutation.isPending}
          title="Send"
          aria-label="Send"
        >
          {askMutation.isPending ? (
            <svg className="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a9 9 0 1 1-9 9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );

  const isInitialCentered = messages.length === 0 && !conversationQuery.isLoading;
  const userInitials = getInitials(user?.name || user?.username || 'You');

  return (
    <div
      className={`app-light-surface chat-panel-surface relative flex h-full flex-col overflow-hidden border border-oracle-border bg-white shadow-md transition-all duration-300 ${
        !isInitialCentered && isGraphPanelOpen ? 'pr-[50%]' : ''
      }`}
    >
      {isInitialCentered ? (
        <div className="chat-start-surface flex min-h-0 flex-1 items-center justify-center bg-oracle-bg-gray px-6">
          <div className="flex w-full max-w-3xl flex-col items-center gap-6">
            <h2 className="text-center text-4xl font-semibold text-oracle-dark-gray">
              What are you working on?
            </h2>
            {renderComposer('Ask about balances, debits, credits, customers, products, fraud, or operating dates...')}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`chat-conversation-header flex shrink-0 items-center gap-3 border-b border-oracle-border bg-gray-50 px-4 py-3 ${
              isHeaderMenuOpen ? 'chat-conversation-header--menu-open' : ''
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            <div className="min-w-0">
              {isInlineRenaming && currentConversationId ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={renameDraft}
                    disabled={renameConversationMutation.isPending}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => {
                      if (skipBlurRenameRef.current) {
                        skipBlurRenameRef.current = false;
                        return;
                      }
                      submitInlineRename();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitInlineRename();
                        return;
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelInlineRename();
                      }
                    }}
                    className="input-oracle h-8 py-1 text-sm font-semibold"
                    aria-label="Chat title"
                  />
                </div>
              ) : (
                <div className="truncate text-sm font-semibold text-oracle-dark-gray">{conversationTitle}</div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-oracle-light-gray">
                  Select AI Analytics
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className={`relative rounded-md p-1.5 transition-colors ${
                  dashboardDraftItems.length > 0
                    ? 'bg-oracle-red text-white hover:bg-red-700'
                    : 'text-oracle-medium-gray hover:bg-black/5'
                }`}
                aria-label="Visualization list"
                title="Visualization list"
                onClick={() => setIsDashboardTrayOpen((current) => !current)}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19V5m4 14v-8m4 8V7m4 12v-5m4 5V9" />
                </svg>
                {dashboardDraftItems.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-oracle-red shadow">
                    {dashboardDraftItems.length}
                  </span>
                ) : null}
              </button>
              <div className="relative" ref={headerMenuRef}>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5"
                  aria-label="Chat actions"
                  aria-haspopup="menu"
                  aria-expanded={isHeaderMenuOpen}
                  title="Chat actions"
                  onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
                  </svg>
                </button>
                {isHeaderMenuOpen && (
                  <div
                    className="chat-header-actions-menu absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
                    role="menu"
                    aria-label="Chat actions"
                  >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={startInlineRename}
                    disabled={!currentConversationId || renameConversationMutation.isPending || deleteConversationMutation.isPending || isInlineRenaming}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {renameConversationMutation.isPending ? 'Renaming...' : 'Rename chat'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!latestResult}
                    onClick={() => {
                      setIsGraphPanelOpen((current) => !current);
                      setIsHeaderMenuOpen(false);
                    }}
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,200,88ZM80,56A16,16,0,1,1,96,72,16,16,0,0,1,80,56ZM56,208a16,16,0,1,1,16-16A16,16,0,0,1,56,208Zm56-80a16,16,0,1,1,16,16A16,16,0,0,1,112,128Zm88,72a16,16,0,1,1,16-16A16,16,0,0,1,200,200Z" />
                    </svg>
                    {isGraphPanelOpen ? 'Hide graph' : 'Graph'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!currentConversationId || deleteConversationMutation.isPending}
                    onClick={() => {
                      setIsDeleteConfirmOpen(true);
                      setIsHeaderMenuOpen(false);
                    }}
                  >
                    <TrashIcon />
                    Delete chat
                  </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {isDashboardTrayOpen && (
            <aside className="absolute right-4 top-[4.25rem] z-40 w-80 overflow-hidden rounded-xl border border-[#dfcbc1] bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-[#eadfd7] bg-[#fbf8f5] px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-oracle-dark-gray">Visualization list</h3>
                  <p className="text-xs text-oracle-light-gray">{dashboardDraftItems.length} selected</p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-oracle-medium-gray transition-colors hover:bg-black/5"
                  onClick={() => setIsDashboardTrayOpen(false)}
                  aria-label="Close visualization list"
                  title="Close"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto px-3 py-3">
                {dashboardDraftItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#dfcbc1] px-3 py-6 text-center text-sm text-oracle-medium-gray">
                    Add charts from chat responses to build a dashboard.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboardDraftItems.map((item, index) => (
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
                            onClick={() => removeVisualizationFromDraft(item.draft_id)}
                            title="Delete"
                            aria-label="Delete visualization"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                {dashboardTargetMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-oracle-light-gray">
                      Existing dashboard
                    </label>
                    <select
                      value={dashboardTargetId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        const dashboard = dashboardOptions.find((item) => item.dashboard_id === nextId);
                        setDashboardTargetId(nextId);
                        setDashboardName(dashboard?.dashboard_name || '');
                      }}
                      className="input-oracle h-9 rounded-lg py-1.5 text-xs"
                      aria-label="Existing dashboard"
                    >
                      {selectedExistingDashboard && !dashboardOptions.some((item) => item.dashboard_id === selectedExistingDashboard.dashboard_id) ? (
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
                      onChange={(event) => setDashboardName(event.target.value)}
                      className="input-oracle h-9 rounded-lg py-1.5 text-xs"
                      placeholder="Dashboard name"
                      aria-label="Dashboard name"
                    />
                    <DashboardVisibilityControl value={dashboardVisibility} onChange={setDashboardVisibility} />
                  </div>
                )}
                <button
                  type="button"
                  className="w-full rounded-lg bg-oracle-red px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    dashboardDraftItems.length === 0 ||
                    saveDashboardMutation.isPending ||
                    (dashboardTargetMode === 'existing' && !dashboardTargetId)
                  }
                  onClick={() => saveDashboardMutation.mutate()}
                >
                  {saveDashboardMutation.isPending
                    ? dashboardTargetMode === 'existing'
                      ? 'Adding...'
                      : 'Generating...'
                    : dashboardTargetMode === 'existing'
                      ? 'Add to dashboard'
                      : 'Generate dashboard'}
                </button>
              </div>
            </aside>
          )}

          <div ref={listRef} className="chat-message-list chat-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden p-4">
            {conversationQuery.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingState size="sm" label="Loading..." textClassName="text-oracle-medium-gray" />
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  const messageWidthClass =
                    message.role === 'assistant'
                      ? 'w-full max-w-[52rem]'
                      : 'max-w-[72%]';

                  return (
                    <div key={message.id} className={`flex min-w-0 gap-2.5 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                          message.role === 'assistant' ? 'bg-oracle-red' : 'bg-oracle-dark-gray'
                        }`}
                      >
                        <span className="text-xs font-bold text-white">{message.role === 'assistant' ? 'AI' : userInitials}</span>
                      </div>

                      <div className={`flex min-w-0 flex-col gap-1 ${messageWidthClass} ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[11px] font-semibold text-oracle-medium-gray">
                            {message.role === 'assistant' ? agentName : user?.name || 'You'}
                          </span>
                          <span className="text-[10px] text-oracle-light-gray">{formatTime(message.timestamp)}</span>
                        </div>

                        <div
                          className={`max-w-full rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                            message.role === 'user'
                              ? 'rounded-tr-sm bg-oracle-dark-gray text-white'
                              : 'chat-assistant-message w-full rounded-tl-sm border border-gray-200 bg-white text-oracle-dark-gray'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <div className="whitespace-pre-wrap break-words text-right">{message.content}</div>
                          ) : (
                            <AssistantResult
                              result={message.result}
                              question={message.question}
                              onAddVisualization={openAddVisualizationModal}
                              isVisualizationAdded={selectedVisualizationIds.has(message.result.run_id)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {askMutation.isPending && (
                  <div className="flex flex-row gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-oracle-red">
                      <span className="text-xs font-bold text-white">AI</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[11px] font-semibold text-oracle-medium-gray">{agentName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-oracle-light-gray" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="chat-composer-footer shrink-0 border-t border-oracle-border bg-white p-3">
            {renderComposer('Ask a follow-up question...')}
          </div>
        </>
      )}
      {!isInitialCentered && isGraphPanelOpen && (
        <OracleAgentGraphPanel
          result={latestResult}
          dataSources={graphDataSourcesQuery.data || []}
          latestQuestion={latestQuestion}
          onClose={() => setIsGraphPanelOpen(false)}
        />
      )}
      {pendingDashboardItem && (
        <GlassModal
          open={Boolean(pendingDashboardItem)}
          onClose={closeAddVisualizationModal}
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
              {addDashboardStep === 'target'
                ? 'Add visualization'
                : addDashboardMode === 'existing'
                  ? 'Select dashboard'
                  : 'New dashboard'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-oracle-medium-gray">
              {addDashboardStep === 'target'
                ? 'Choose where this visualization will be saved.'
                : addDashboardMode === 'existing'
                  ? 'Pick the dashboard that will receive this visualization.'
                  : 'Name the dashboard that will be generated.'}
            </p>
            <p className="mt-3 max-w-full truncate text-xs font-medium text-oracle-dark-gray" title={pendingDashboardItem.title}>
              {pendingDashboardItem.title}
            </p>

            {addDashboardStep === 'target' ? (
              <div className="mt-5 grid w-full gap-3">
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    addDashboardMode === 'existing'
                      ? 'border-oracle-red bg-red-50 text-oracle-red'
                      : 'border-gray-200 bg-white text-oracle-dark-gray hover:bg-gray-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={!dashboardsQuery.isLoading && dashboardOptions.length === 0}
                  onClick={() => setAddDashboardMode('existing')}
                >
                  <span className="block text-sm font-semibold">Existing dashboard</span>
                  <span className="mt-1 block text-xs text-oracle-medium-gray">
                    Add it to one of your dashboards.
                  </span>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    addDashboardMode === 'new'
                      ? 'border-oracle-red bg-red-50 text-oracle-red'
                      : 'border-gray-200 bg-white text-oracle-dark-gray hover:bg-gray-50'
                  }`}
                  onClick={() => setAddDashboardMode('new')}
                >
                  <span className="block text-sm font-semibold">New dashboard</span>
                  <span className="mt-1 block text-xs text-oracle-medium-gray">
                    Start a new dashboard with this visualization.
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-5 w-full text-left">
                {addDashboardMode === 'existing' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-oracle-dark-gray" htmlFor="add-dashboard-existing">
                      Dashboard
                    </label>
                    {dashboardsQuery.isLoading ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-oracle-medium-gray">
                        Loading...
                      </div>
                    ) : dashboardOptions.length > 0 ? (
                      <select
                        id="add-dashboard-existing"
                        value={addDashboardId}
                        onChange={(event) => setAddDashboardId(event.target.value)}
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
                      value={addDashboardName}
                      onChange={(event) => setAddDashboardName(event.target.value)}
                      className="input-oracle h-10 rounded-lg py-2 text-sm"
                      placeholder="Dashboard name"
                    />
                    <DashboardVisibilityControl value={addDashboardVisibility} onChange={setAddDashboardVisibility} />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex border-t border-gray-100">
            <button
              type="button"
              onClick={addDashboardStep === 'target' ? closeAddVisualizationModal : () => setAddDashboardStep('target')}
              className="flex-1 py-4 text-sm font-medium text-oracle-medium-gray transition-colors hover:bg-gray-50"
            >
              {addDashboardStep === 'target' ? 'Cancel' : 'Back'}
            </button>
            <div className="w-px bg-gray-100" />
            <button
              type="button"
              onClick={addDashboardStep === 'target' ? advanceAddVisualizationStep : confirmAddVisualizationTarget}
              disabled={
                addDashboardStep === 'target'
                  ? addDashboardMode === 'existing' && (dashboardsQuery.isLoading || dashboardOptions.length === 0)
                  : addDashboardMode === 'existing' && (!addDashboardId || dashboardsQuery.isLoading)
              }
              className="flex-1 bg-oracle-red py-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addDashboardStep === 'target' ? 'Next' : 'Add'}
            </button>
          </div>
        </GlassModal>
      )}
      {isDeleteConfirmOpen && currentConversationId && (
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
          onConfirm={() => deleteConversationMutation.mutate(currentConversationId)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          loading={deleteConversationMutation.isPending}
          loadingText="Deleting..."
        />
      )}
    </div>
  );
}
