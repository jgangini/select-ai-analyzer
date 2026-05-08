import dagre from '@dagrejs/dagre';

export type OracleGraphTraceItem = {
  stage: string;
  status: string;
  rows?: number;
  profile_name?: string;
  objects?: Array<{ owner?: string; name?: string; columns?: string[] }>;
};

export type OracleGraphResult = {
  run_id: string;
  conversation_id: string;
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  row_count: number;
  chart_spec?: { type?: string; title?: string; [key: string]: unknown };
  agent_trace?: OracleGraphTraceItem[];
};

export type OracleGraphDataSource = {
  owner_name: string;
  table_name: string;
  row_count?: number;
  source_type?: string;
};

export type GraphTableRef = {
  owner: string;
  name: string;
  columns: string[];
  rowCount?: number;
  sourceType?: string;
};

export type OracleGraphNodeStatus = 'idle' | 'completed' | 'failed';

export type OracleGraphNode = {
  key: string;
  label: string;
  detail: string;
  kind: 'input' | 'profile' | 'table' | 'sql' | 'execute' | 'answer';
  status: OracleGraphNodeStatus;
};

export type OracleGraphEdge = {
  source: string;
  target: string;
  label?: string;
};

export type OracleGraphRenderNode = OracleGraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OracleGraphEdgePath = OracleGraphEdge & {
  points: Array<{ x: number; y: number }>;
};

export type GraphBounds = { x: number; y: number; width: number; height: number };

export type OracleNodeInspection = {
  title: string;
  subtitle: string;
  status: OracleGraphNodeStatus;
  inputPayload: unknown;
  outputPayload: unknown;
  responseText: string;
};

type OracleInspectionContext = {
  selectedNode: OracleGraphRenderNode;
  traceItems: OracleGraphTraceItem[];
  graphTables: GraphTableRef[];
  graphTablesForFlow: GraphTableRef[];
  latestQuestion: string;
  result?: OracleGraphResult;
  profileName: string;
};

const GRAPH_NODE_HEIGHT = 64;
const GRAPH_NODE_WIDTH_MIN = 150;
const GRAPH_NODE_WIDTH_MAX = 220;
const GRAPH_CHAR_WIDTH = 7;
const GRAPH_NODE_CLASS_NAMES: Record<'selected' | 'default', Record<OracleGraphNodeStatus, string>> = {
  selected: {
    completed: 'fill-emerald-200 stroke-emerald-600 text-emerald-800',
    failed: 'fill-rose-200 stroke-rose-600 text-rose-800',
    idle: 'fill-gray-200 stroke-gray-500 text-oracle-dark-gray',
  },
  default: {
    completed: 'fill-emerald-50 stroke-emerald-500 text-emerald-700',
    failed: 'fill-rose-50 stroke-rose-500 text-rose-700',
    idle: 'fill-white stroke-gray-300 text-oracle-medium-gray',
  },
};

export function formatJsonForDisplay(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function truncateGraphText(value: string, maxLength = 30): string {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  const head = Math.ceil((maxLength - 3) / 2);
  const tail = Math.floor((maxLength - 3) / 2);
  return `${text.slice(0, head)}...${text.slice(text.length - tail)}`;
}

function normalizeSqlIdentifier(value: string): string {
  return String(value || '').replace(/"/g, '').trim().toUpperCase();
}

function qualifiedTableKey(owner: string, name: string): string {
  return `${normalizeSqlIdentifier(owner)}.${normalizeSqlIdentifier(name)}`;
}

function graphNodeWidth(node: OracleGraphNode): number {
  const maxLen = Math.max(node.label.length, node.detail.length);
  return Math.max(GRAPH_NODE_WIDTH_MIN, Math.min(GRAPH_NODE_WIDTH_MAX, 52 + maxLen * GRAPH_CHAR_WIDTH));
}

function appendUniqueTableRef(
  refs: GraphTableRef[],
  seen: Set<string>,
  owner: string,
  name: string,
  columns: string[] = []
): void {
  const normalizedOwner = normalizeSqlIdentifier(owner);
  const normalizedName = normalizeSqlIdentifier(name);
  if (!normalizedName) return;
  const key = qualifiedTableKey(normalizedOwner || '?', normalizedName);
  if (seen.has(key)) return;
  seen.add(key);
  refs.push({ owner: normalizedOwner, name: normalizedName, columns });
}

export function buildOracleGraphWithDagre(
  nodes: OracleGraphNode[],
  edges: OracleGraphEdge[]
): { nodes: OracleGraphRenderNode[]; edgePaths: OracleGraphEdgePath[] } {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const safeEdges = edges.filter((edge) => nodeKeys.has(edge.source) && nodeKeys.has(edge.target));
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 70, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({ points: [] }));

  nodes.forEach((node) => g.setNode(node.key, { width: graphNodeWidth(node), height: GRAPH_NODE_HEIGHT }));
  safeEdges.forEach((edge) => g.setEdge(edge.source, edge.target, {}));
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
    if (points.length >= 2) return { ...edge, points };
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
    appendUniqueTableRef(refs, seen, owner, name);
  }
  return refs;
}

function traceTableRefs(result: OracleGraphResult | undefined): GraphTableRef[] {
  const refs: GraphTableRef[] = [];
  const seen = new Set<string>();
  for (const traceItem of result?.agent_trace || []) {
    for (const item of traceItem.objects || []) {
      appendUniqueTableRef(
        refs,
        seen,
        String(item.owner || ''),
        String(item.name || ''),
        Array.isArray(item.columns) ? item.columns.map((column) => normalizeSqlIdentifier(column)) : []
      );
    }
  }
  return refs;
}

export function resolveGraphTables(
  result: OracleGraphResult | undefined,
  dataSources: OracleGraphDataSource[]
): GraphTableRef[] {
  const refs = traceTableRefs(result);
  if (refs.length === 0) refs.push(...parseSqlTableRefs(result?.sql || ''));
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

function traceStatus(
  traceItems: OracleGraphTraceItem[],
  stagePart: string,
  fallback: OracleGraphNodeStatus
): OracleGraphNodeStatus {
  const status = String(traceItems.find((item) => item.stage.includes(stagePart))?.status || fallback).toLowerCase();
  return status === 'failed' ? 'failed' : status === 'completed' ? 'completed' : 'idle';
}

export function resolveProfileName(traceItems: OracleGraphTraceItem[]): string {
  return (
    traceItems.find((item) => item.profile_name)?.profile_name ||
    traceItems.find((item) => item.stage === 'select_ai.scope_profile')?.stage ||
    'Scoped Select AI profile'
  );
}

export function buildGraphNodes(
  result: OracleGraphResult | undefined,
  profileName: string,
  traceItems: OracleGraphTraceItem[],
  graphTables: GraphTableRef[]
): OracleGraphNode[] {
  const graphTablesForFlow = graphTables.slice(0, 6);
  return [
    { key: 'request', label: 'Question', detail: 'Natural-language request', kind: 'input', status: result ? 'completed' : 'idle' },
    {
      key: 'profile',
      label: 'DBMS_CLOUD_AI',
      detail: profileName,
      kind: 'profile',
      status: traceStatus(traceItems, 'scope_profile', result ? 'completed' : 'idle'),
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
      status: traceStatus(traceItems, 'showsql', result?.sql ? 'completed' : 'idle'),
    },
    {
      key: 'execute',
      label: 'SELECT executor',
      detail: `${result?.row_count ?? 0} rows returned`,
      kind: 'execute',
      status: traceStatus(traceItems, 'execute_select', result ? 'completed' : 'idle'),
    },
    {
      key: 'answer',
      label: 'Answer and chart',
      detail: result?.chart_spec?.type ? `${result.chart_spec.type} visualization` : 'Waiting for result',
      kind: 'answer',
      status: result ? 'completed' : 'idle',
    },
  ];
}

export function buildGraphEdges(graphTablesForFlow: GraphTableRef[]): OracleGraphEdge[] {
  const tableNodeKeys = graphTablesForFlow.map((_table, index) => `table_${index}`);
  return [
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
}

export function buildGraphBounds(renderNodes: OracleGraphRenderNode[], edgePaths: OracleGraphEdgePath[]): GraphBounds {
  if (!renderNodes.length) return { x: 0, y: 0, width: 460, height: 420 };
  const edgePoints = edgePaths.flatMap((edge) => edge.points);
  const minX = Math.min(...renderNodes.map((node) => node.x - node.width / 2), ...edgePoints.map((point) => point.x));
  const minY = Math.min(...renderNodes.map((node) => node.y - node.height / 2), ...edgePoints.map((point) => point.y));
  const maxX = Math.max(...renderNodes.map((node) => node.x + node.width / 2), ...edgePoints.map((point) => point.x));
  const maxY = Math.max(...renderNodes.map((node) => node.y + node.height / 2), ...edgePoints.map((point) => point.y));
  return { x: minX - 36, y: minY - 36, width: Math.max(460, maxX - minX + 72), height: Math.max(420, maxY - minY + 72) };
}

export function buildGraphViewBox(graphBounds: GraphBounds, graphPan: { x: number; y: number }, graphZoom: number): GraphBounds {
  const zoom = Math.max(0.7, Math.min(2.2, graphZoom));
  const width = graphBounds.width / zoom;
  const height = graphBounds.height / zoom;
  return {
    x: graphBounds.x + (graphBounds.width - width) / 2 + graphPan.x,
    y: graphBounds.y + (graphBounds.height - height) / 2 + graphPan.y,
    width,
    height,
  };
}

export function resolveNodeClassName(node: OracleGraphRenderNode, selected: boolean): string {
  return GRAPH_NODE_CLASS_NAMES[selected ? 'selected' : 'default'][node.status];
}

function baseInspection(selectedNode: OracleGraphRenderNode): OracleNodeInspection {
  return {
    title: selectedNode.label,
    subtitle: selectedNode.detail,
    status: selectedNode.status,
    inputPayload: undefined,
    outputPayload: undefined,
    responseText: '',
  };
}

function traceForStage(traceItems: OracleGraphTraceItem[], stagePart: string) {
  return traceItems.find((item) => item.stage.toLowerCase().includes(stagePart.toLowerCase()));
}

function buildRequestInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, latestQuestion, result } = context;
  return {
    ...baseInspection(selectedNode),
    inputPayload: { question: latestQuestion || result?.chart_spec?.title || '' },
    outputPayload: { conversation_id: result?.conversation_id || '', run_id: result?.run_id || '' },
  };
}

function buildProfileInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, traceItems, graphTables, profileName } = context;
  return {
    ...baseInspection(selectedNode),
    inputPayload: { package: 'DBMS_CLOUD_AI', profile_name: profileName, action: 'showsql', enforce_object_list: true },
    outputPayload: {
      profile_name: profileName,
      object_list: graphTables.map((table) => ({ owner: table.owner, name: table.name, columns: table.columns })),
      trace: traceForStage(traceItems, 'scope_profile') || null,
    },
  };
}

function buildTableInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, graphTablesForFlow } = context;
  const table = graphTablesForFlow[Number(selectedNode.key.replace('table_', ''))];
  return {
    ...baseInspection(selectedNode),
    inputPayload: { source: 'Select AI object_list', owner: table?.owner || '', table_name: table?.name || '' },
    outputPayload: {
      row_count: table?.rowCount ?? null,
      source_type: table?.sourceType || '',
      columns: table?.columns || [],
    },
  };
}

function buildSqlInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, traceItems, latestQuestion, result, profileName } = context;
  return {
    ...baseInspection(selectedNode),
    inputPayload: {
      question: latestQuestion || result?.chart_spec?.title || '',
      profile_name: profileName,
      action: 'DBMS_CLOUD_AI.GENERATE showsql',
    },
    outputPayload: { generated_sql: result?.sql || '', trace: traceForStage(traceItems, 'showsql') || null },
  };
}

function buildExecuteInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, traceItems, result } = context;
  return {
    ...baseInspection(selectedNode),
    inputPayload: { sql: result?.sql || '', read_only: true, max_rows: 500 },
    outputPayload: {
      row_count: result?.row_count ?? 0,
      columns: result?.columns || [],
      sample_rows: (result?.rows || []).slice(0, 5),
      trace: traceForStage(traceItems, 'execute_select') || null,
    },
  };
}

function buildAnswerInspection(context: OracleInspectionContext): OracleNodeInspection {
  const { selectedNode, result } = context;
  return {
    ...baseInspection(selectedNode),
    responseText: result?.answer || '',
    inputPayload: {
      columns: result?.columns || [],
      row_count: result?.row_count ?? 0,
      chart_type: result?.chart_spec?.type || 'table',
    },
    outputPayload: { answer: result?.answer || '', chart_spec: result?.chart_spec || {} },
  };
}

export function buildSelectedNodeInspection({
  selectedNode,
  traceItems,
  graphTables,
  graphTablesForFlow,
  latestQuestion,
  result,
  profileName,
}: {
  selectedNode?: OracleGraphRenderNode;
  traceItems: OracleGraphTraceItem[];
  graphTables: GraphTableRef[];
  graphTablesForFlow: GraphTableRef[];
  latestQuestion: string;
  result?: OracleGraphResult;
  profileName: string;
}) {
  if (!selectedNode) return null;
  const context = { selectedNode, traceItems, graphTables, graphTablesForFlow, latestQuestion, result, profileName };
  if (selectedNode.key === 'request') return buildRequestInspection(context);
  if (selectedNode.key === 'profile') return buildProfileInspection(context);
  if (selectedNode.key.startsWith('table_')) return buildTableInspection(context);
  if (selectedNode.key === 'sql') return buildSqlInspection(context);
  if (selectedNode.key === 'execute') return buildExecuteInspection(context);
  if (selectedNode.key === 'answer') return buildAnswerInspection(context);
  return baseInspection(selectedNode);
}
