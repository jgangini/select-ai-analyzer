import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildGraphBounds,
  buildGraphEdges,
  buildGraphNodes,
  buildGraphViewBox,
  buildOracleGraphWithDagre,
  buildSelectedNodeInspection,
  formatJsonForDisplay,
  resolveGraphTables,
  resolveNodeClassName,
  resolveProfileName,
  truncateGraphText,
  type GraphBounds,
  type OracleGraphEdgePath,
  type OracleGraphDataSource,
  type OracleGraphResult,
  type OracleGraphRenderNode,
} from './oracleAgentGraphModel';

function OracleGraphHeader({
  result,
  onClose,
}: {
  result?: OracleGraphResult;
  onClose: () => void;
}) {
  return (
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
      <button type="button" className="ml-auto rounded-md p-1.5 text-oracle-medium-gray transition-colors hover:bg-black/5" onClick={onClose} aria-label="Close agent graph">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function OracleGraphToolbar({
  graphZoom,
  adjustGraphZoom,
  resetGraphZoom,
}: {
  graphZoom: number;
  adjustGraphZoom: (delta: number) => void;
  resetGraphZoom: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-oracle-dark-gray">Graph flow</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 text-[10px] text-oracle-medium-gray">
          <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--idle" />Idle</span>
          <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--completed" />Completed</span>
          <span className="inline-flex items-center gap-1"><span className="graph-status-dot graph-status-dot--failed" />Failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" onClick={() => adjustGraphZoom(-0.1)} title="Zoom out" aria-label="Zoom out">-</button>
          <button type="button" className="h-6 rounded border border-gray-300 bg-white px-2 text-[10px] text-gray-700 hover:bg-gray-50" onClick={resetGraphZoom} title="Reset zoom" aria-label="Reset zoom">{`${Math.round(graphZoom * 100)}%`}</button>
          <button type="button" className="h-6 w-6 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50" onClick={() => adjustGraphZoom(0.1)} title="Zoom in" aria-label="Zoom in">+</button>
        </div>
      </div>
    </div>
  );
}

function OracleGraphCanvas({
  renderNodes,
  edgePaths,
  selectedNodeKey,
  graphPanning,
  graphZoom,
  graphCanvasHeight,
  graphEffectiveViewBox,
  graphContainerRef,
  onPanStart,
  onSelectNode,
}: {
  renderNodes: OracleGraphRenderNode[];
  edgePaths: OracleGraphEdgePath[];
  selectedNodeKey: string;
  graphPanning: boolean;
  graphZoom: number;
  graphCanvasHeight: number;
  graphEffectiveViewBox: GraphBounds;
  graphContainerRef: React.RefObject<HTMLDivElement>;
  onPanStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSelectNode: (nodeKey: string) => void;
}) {
  return (
    <div
      ref={graphContainerRef}
      className={`h-[420px] select-none rounded-md border border-gray-200 bg-oracle-bg-gray [scrollbar-width:thin] [scrollbar-color:#9CA3AF_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent ${graphZoom === 1 ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'}`}
      onMouseDown={onPanStart}
      style={{ cursor: graphPanning ? 'grabbing' : 'grab' }}
    >
      <div style={{ width: '100%', height: graphCanvasHeight, minHeight: graphCanvasHeight, margin: '0 auto' }}>
        <svg width="100%" height={graphCanvasHeight} viewBox={`${graphEffectiveViewBox.x} ${graphEffectiveViewBox.y} ${graphEffectiveViewBox.width} ${graphEffectiveViewBox.height}`} preserveAspectRatio="xMidYMin meet" className="block" role="img" aria-label="Oracle 26ai runtime graph">
          <OracleGraphMarkers />
          {edgePaths.map((edge, index) => <OracleGraphEdge key={`${edge.source}-${edge.target}-${index}`} edge={edge} renderNodes={renderNodes} />)}
          {renderNodes.map((node) => (
            <OracleGraphNodeShape
              key={node.key}
              node={node}
              selected={selectedNodeKey === node.key}
              onSelectNode={onSelectNode}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function OracleGraphMarkers() {
  return (
    <defs>
      <marker id="oracleGraphArrowGray" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#9CA3AF" /></marker>
      <marker id="oracleGraphArrowGreen" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#10B981" /></marker>
      <marker id="oracleGraphArrowRose" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#E11D48" /></marker>
    </defs>
  );
}

function OracleGraphEdge({ edge, renderNodes }: { edge: OracleGraphEdgePath; renderNodes: OracleGraphRenderNode[] }) {
  const pathD = edge.points.length >= 2 ? `M ${edge.points[0].x} ${edge.points[0].y} ${edge.points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ')}` : '';
  const sourceNode = renderNodes.find((node) => node.key === edge.source);
  const targetNode = renderNodes.find((node) => node.key === edge.target);
  const isFailed = sourceNode?.status === 'failed' || targetNode?.status === 'failed';
  const isCompleted = sourceNode?.status === 'completed' && targetNode?.status === 'completed';
  const labelPoint = edge.points[Math.max(0, Math.floor(edge.points.length / 2))];
  return (
    <g>
      <path d={pathD} fill="none" className={`${isFailed ? 'stroke-rose-500' : isCompleted ? 'stroke-emerald-500' : 'stroke-gray-300'} transition-colors`} strokeWidth={2} markerEnd={isFailed ? 'url(#oracleGraphArrowRose)' : isCompleted ? 'url(#oracleGraphArrowGreen)' : 'url(#oracleGraphArrowGray)'} />
      {edge.label && labelPoint ? <text x={labelPoint.x} y={labelPoint.y - 8} textAnchor="middle" className="fill-oracle-medium-gray text-[10px]">{edge.label}</text> : null}
    </g>
  );
}

function OracleGraphNodeShape({
  node,
  selected,
  onSelectNode,
}: {
  node: OracleGraphRenderNode;
  selected: boolean;
  onSelectNode: (nodeKey: string) => void;
}) {
  const selectNode = () => onSelectNode(node.key);
  return (
    <g role="button" tabIndex={0} aria-label={`${node.label}: ${node.detail}`} onMouseDown={(event) => event.stopPropagation()} onClick={selectNode} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectNode(); } }} className="group cursor-pointer outline-none">
      <rect x={node.x - node.width / 2} y={node.y - node.height / 2} width={node.width} height={node.height} rx={10} className={`${resolveNodeClassName(node, selected)} transition-all duration-200 group-hover:opacity-70`} strokeWidth={1.8} />
      <text x={node.x} y={node.y - 5} textAnchor="middle" className="fill-current text-[12px] font-semibold">{truncateGraphText(node.label, 23)}</text>
      <text x={node.x} y={node.y + 13} textAnchor="middle" className="fill-current text-[10px] opacity-80">{truncateGraphText(node.detail, 25)}</text>
    </g>
  );
}

function OracleGraphInspector({
  selectedNodeKey,
  selectedNodeKind,
  inspection,
}: {
  selectedNodeKey: string;
  selectedNodeKind?: string;
  inspection: ReturnType<typeof buildSelectedNodeInspection>;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-oracle-dark-gray">Node inspector</p>
        {inspection ? <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-oracle-medium-gray">{selectedNodeKey}</span> : null}
      </div>
      {!inspection ? (
        <p className="text-[11px] text-oracle-light-gray">Select a node in the graph to inspect input and output.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-oracle-medium-gray">Status: <span className="font-semibold text-oracle-dark-gray">{inspection.status}</span></span>
            <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-oracle-medium-gray">Kind: <span className="font-semibold text-oracle-dark-gray">{selectedNodeKind || '-'}</span></span>
          </div>
          {inspection.responseText ? <OracleGraphInspectorBlock title="Response" text={inspection.responseText} /> : null}
          <div className="grid grid-cols-1 gap-2">
            <OracleGraphInspectorPayload title="Input" payload={inspection.inputPayload} maxHeightClassName="max-h-[170px]" emptyText="No input payload available." />
            <OracleGraphInspectorPayload title="Output" payload={inspection.outputPayload} maxHeightClassName="max-h-[190px]" emptyText="No output payload available." />
          </div>
        </>
      )}
    </div>
  );
}

function OracleGraphInspectorBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-oracle-dark-gray">{title}</p>
      <div className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-oracle-medium-gray">{text}</div>
    </div>
  );
}

function OracleGraphInspectorPayload({
  title,
  payload,
  maxHeightClassName,
  emptyText,
}: {
  title: string;
  payload: unknown;
  maxHeightClassName: string;
  emptyText: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-oracle-dark-gray">{title}</p>
      {payload === undefined ? (
        <p className="text-[11px] text-oracle-light-gray">{emptyText}</p>
      ) : (
        <pre className={`${maxHeightClassName} overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-oracle-medium-gray`}>
          {formatJsonForDisplay(payload)}
        </pre>
      )}
    </div>
  );
}

export function OracleAgentGraphPanel({
  result,
  dataSources,
  latestQuestion,
  onClose,
}: {
  result?: OracleGraphResult;
  dataSources: OracleGraphDataSource[];
  latestQuestion: string;
  onClose: () => void;
}) {
  const graphTables = useMemo(() => resolveGraphTables(result, dataSources), [result, dataSources]);
  const graphTablesForFlow = graphTables.slice(0, 6);
  const traceItems = result?.agent_trace || [];
  const profileName = resolveProfileName(traceItems);
  const graphNodes = useMemo(() => buildGraphNodes(result, profileName, traceItems, graphTables), [graphTables, profileName, result, traceItems]);
  const graphEdges = useMemo(() => buildGraphEdges(graphTablesForFlow), [graphTablesForFlow]);
  const { nodes: renderNodes, edgePaths } = useMemo(() => buildOracleGraphWithDagre(graphNodes, graphEdges), [graphNodes, graphEdges]);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('profile');
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [graphPanning, setGraphPanning] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphPanRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const selectedNode = renderNodes.find((node) => node.key === selectedNodeKey);
  const graphBounds = useMemo(() => buildGraphBounds(renderNodes, edgePaths), [renderNodes, edgePaths]);
  const graphCanvasHeight = Math.max(420, graphBounds.height);
  const graphEffectiveViewBox = useMemo(() => buildGraphViewBox(graphBounds, graphPan, graphZoom), [graphBounds, graphPan, graphZoom]);
  const selectedNodeInspection = useMemo(
    () => buildSelectedNodeInspection({ selectedNode, traceItems, graphTables, graphTablesForFlow, latestQuestion, result, profileName }),
    [graphTables, graphTablesForFlow, latestQuestion, profileName, result, selectedNode, traceItems]
  );
  const adjustGraphZoom = useCallback((delta: number) => setGraphZoom((prev) => Math.max(0.7, Math.min(2.2, Math.round((prev + delta) * 100) / 100))), []);
  const resetGraphZoom = useCallback(() => { setGraphZoom(1); setGraphPan({ x: 0, y: 0 }); }, []);
  const handleGraphWheel = useCallback((event: WheelEvent) => { if (!event.ctrlKey) return; event.preventDefault(); adjustGraphZoom(event.deltaY > 0 ? -0.1 : 0.1); }, [adjustGraphZoom]);

  useEffect(() => {
    if (!renderNodes.some((node) => node.key === selectedNodeKey)) setSelectedNodeKey(renderNodes[0]?.key || 'profile');
  }, [renderNodes, selectedNodeKey]);
  useEffect(() => {
    const element = graphContainerRef.current;
    if (!element) return;
    element.addEventListener('wheel', handleGraphWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleGraphWheel);
  }, [handleGraphWheel]);
  useEffect(() => resetGraphZoom(), [resetGraphZoom, result?.conversation_id]);
  useEffect(() => {
    if (!graphPanning) return;
    const onMove = (event: MouseEvent) => {
      if (!graphPanRef.current) return;
      setGraphPan({ x: graphPanRef.current.panX - (event.clientX - graphPanRef.current.startX), y: graphPanRef.current.panY - (event.clientY - graphPanRef.current.startY) });
    };
    const onUp = () => { graphPanRef.current = null; setGraphPanning(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [graphPanning]);

  const handleGraphPanStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    graphPanRef.current = { startX: event.clientX, startY: event.clientY, panX: graphPan.x, panY: graphPan.y };
    setGraphPanning(true);
  };

  return (
    <aside className="chat-graph-panel absolute inset-y-0 right-0 z-10 flex w-1/2 min-w-[520px] flex-col border-l border-oracle-border bg-white shadow-2xl">
      <OracleGraphHeader result={result} onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-oracle-bg-gray p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <OracleGraphToolbar graphZoom={graphZoom} adjustGraphZoom={adjustGraphZoom} resetGraphZoom={resetGraphZoom} />
          <OracleGraphCanvas renderNodes={renderNodes} edgePaths={edgePaths} selectedNodeKey={selectedNodeKey} graphPanning={graphPanning} graphZoom={graphZoom} graphCanvasHeight={graphCanvasHeight} graphEffectiveViewBox={graphEffectiveViewBox} graphContainerRef={graphContainerRef} onPanStart={handleGraphPanStart} onSelectNode={setSelectedNodeKey} />
        </div>
        <OracleGraphInspector selectedNodeKey={selectedNodeKey} selectedNodeKind={selectedNode?.kind} inspection={selectedNodeInspection} />
      </div>
    </aside>
  );
}
