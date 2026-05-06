import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Layout } from '../common/Layout';
import { useToast } from '../../context/ToastContext';
import { agentBuilderApi, type AgentObjectType } from '../../services/api';

type BuilderNodeData = {
  label: string;
  objectType: AgentObjectType;
  instruction?: string;
  role?: string;
  profileName?: string;
  toolType?: string;
};

type BuilderNode = Node<BuilderNodeData>;

const INITIAL_NODES: BuilderNode[] = [
  {
    id: 'tool-sql',
    type: 'default',
    position: { x: 60, y: 120 },
    data: {
      label: 'APP_AGENT_ANALYTICS_SQL_TOOL',
      objectType: 'TOOL',
      toolType: 'SQL',
      profileName: 'APP_AGENT_ANALYTICS',
      instruction: 'Use Select AI showsql and execute only read-only analytical queries.',
    },
  },
  {
    id: 'task-answer',
    type: 'default',
    position: { x: 360, y: 80 },
    data: {
      label: 'APP_AGENT_ANSWER_TASK',
      objectType: 'TASK',
      instruction: 'Answer {query} in Spanish using registered SQL tools and include business insights.',
    },
  },
  {
    id: 'agent-analyst',
    type: 'default',
    position: { x: 60, y: 300 },
    data: {
      label: 'APP_AGENT_ANALYST',
      objectType: 'AGENT',
      profileName: 'APP_AGENT_ANALYTICS',
      role: 'Senior banking analytics agent. Never invent data and use only registered tools.',
    },
  },
  {
    id: 'team-main',
    type: 'default',
    position: { x: 680, y: 180 },
    data: {
      label: 'APP_AGENT_ANALYTICS_TEAM',
      objectType: 'TEAM',
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'tool-task', source: 'tool-sql', target: 'task-answer' },
  { id: 'agent-task', source: 'agent-analyst', target: 'task-answer' },
];

function getErrorMessage(error: unknown): string {
  const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
  return maybeError.response?.data?.detail || maybeError.message || 'Operacion fallida.';
}

function normalizeName(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_$#]/g, '_').replace(/_+/g, '_');
}

function getNodeById(nodes: BuilderNode[], nodeId: string): BuilderNode | undefined {
  return nodes.find((node) => node.id === nodeId);
}

function canConnect(nodes: BuilderNode[], connection: Connection | Edge): boolean {
  const source = connection.source ? getNodeById(nodes, connection.source) : undefined;
  const target = connection.target ? getNodeById(nodes, connection.target) : undefined;
  if (!source || !target || source.id === target.id) return false;
  const pair = `${source.data.objectType}->${target.data.objectType}`;
  return pair === 'TOOL->TASK' || pair === 'AGENT->TASK';
}

function buildAttributes(node: BuilderNode, nodes: BuilderNode[], edges: Edge[]): Record<string, unknown> {
  if (node.data.objectType === 'TOOL') {
    return {
      tool_type: node.data.toolType || 'SQL',
      profile_name: node.data.profileName || 'APP_AGENT_ANALYTICS',
      instruction: node.data.instruction || '',
      description: 'SQL tool backed by APP_AGENT Select AI profile',
    };
  }
  if (node.data.objectType === 'TASK') {
    const tools = edges
      .filter((edge) => edge.target === node.id)
      .map((edge) => getNodeById(nodes, edge.source))
      .filter((candidate): candidate is BuilderNode => candidate?.data.objectType === 'TOOL')
      .map((tool) => normalizeName(tool.data.label));
    return {
      instruction: node.data.instruction || '',
      tools,
      input: 'query',
      description: 'Analytical task generated from React Flow',
    };
  }
  if (node.data.objectType === 'AGENT') {
    return {
      profile_name: node.data.profileName || 'APP_AGENT_ANALYTICS',
      role: node.data.role || '',
      enable_human_tool: 'False',
    };
  }
  const agentTaskPairs = edges
    .map((edge) => ({
      agent: getNodeById(nodes, edge.source),
      task: getNodeById(nodes, edge.target),
    }))
    .filter((pair) => pair.agent?.data.objectType === 'AGENT' && pair.task?.data.objectType === 'TASK')
    .map((pair) => ({
      name: normalizeName(pair.agent?.data.label || ''),
      task: normalizeName(pair.task?.data.label || ''),
    }));
  return {
    agents: agentTaskPairs,
    process: 'sequential',
  };
}

export function AgentBuilder() {
  const { showToast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState(INITIAL_NODES[0].id);
  const [script, setScript] = useState('');
  const [runTeamName, setRunTeamName] = useState('APP_AGENT_ANALYTICS_TEAM');
  const [runPrompt, setRunPrompt] = useState('Resume saldos por sucursal y moneda con los principales hallazgos.');
  const [runResponse, setRunResponse] = useState('');
  const [runConversationId, setRunConversationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'script' | 'create' | 'run' | null>(null);

  const selectedNode = useMemo(() => getNodeById(nodes, selectedNodeId), [nodes, selectedNodeId]);
  const selectedAttributes = useMemo(
    () => (selectedNode ? buildAttributes(selectedNode, nodes, edges) : {}),
    [selectedNode, nodes, edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canConnect(nodes, connection)) {
        showToast('Conexion no permitida. Usa TOOL -> TASK o AGENT -> TASK.', 'error');
        return;
      }
      setEdges((current) => addEdge(connection, current));
    },
    [nodes, setEdges, showToast]
  );

  const addBuilderNode = (objectType: AgentObjectType) => {
    const id = `${objectType.toLowerCase()}-${Date.now()}`;
    const label = normalizeName(`APP_AGENT_${objectType}_${nodes.length + 1}`);
    const position = { x: 120 + nodes.length * 30, y: 120 + nodes.length * 35 };
    const nextNode: BuilderNode = {
      id,
      type: 'default',
      position,
      data: {
        label,
        objectType,
        profileName: objectType === 'AGENT' || objectType === 'TOOL' ? 'APP_AGENT_ANALYTICS' : undefined,
        toolType: objectType === 'TOOL' ? 'SQL' : undefined,
        instruction: objectType === 'TASK' ? 'Answer {query} using the attached tools.' : undefined,
        role: objectType === 'AGENT' ? 'Banking analytics specialist.' : undefined,
      },
    };
    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(id);
  };

  const updateSelectedData = (field: keyof BuilderNodeData, value: string) => {
    if (!selectedNode) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? { ...node, data: { ...node.data, [field]: field === 'label' ? normalizeName(value) : value } }
          : node
      )
    );
  };

  const buildPayload = () => {
    if (!selectedNode) throw new Error('Selecciona un nodo.');
    if (
      selectedNode.data.objectType === 'TEAM' &&
      (!Array.isArray(selectedAttributes.agents) || selectedAttributes.agents.length === 0)
    ) {
      throw new Error('El TEAM necesita al menos una conexion AGENT -> TASK.');
    }
    return {
      object_type: selectedNode.data.objectType,
      name: normalizeName(selectedNode.data.label),
      attributes: selectedAttributes,
    };
  };

  const generateScript = async () => {
    setBusyAction('script');
    try {
      const response = await agentBuilderApi.script(buildPayload());
      setScript(response.data.script);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const createObject = async () => {
    setBusyAction('create');
    try {
      const response = await agentBuilderApi.createObject(buildPayload());
      setScript(response.data.script);
      showToast(`${response.data.object_name || 'Objeto'} creado en DBMS_CLOUD_AI_AGENT.`, 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const runTeam = async () => {
    if (!runTeamName.trim() || !runPrompt.trim()) return;
    setBusyAction('run');
    setRunResponse('');
    try {
      const response = await agentBuilderApi.runTeam({
        team_name: runTeamName,
        prompt: runPrompt,
        conversation_id: runConversationId || undefined,
      });
      setRunConversationId(response.data.conversation_id);
      setRunResponse(response.data.response);
      showToast(`RUN_TEAM completado: ${response.data.run_id}`, 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Layout contentContainerClassName="max-w-none px-5 py-5">
      <div className="grid min-h-[calc(100vh-130px)] gap-5 lg:grid-cols-[minmax(0,1fr)_410px]">
        <section className="app-light-surface min-h-[620px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oracle-red">Agent Builder</p>
              <h1 className="text-lg font-semibold text-gray-900">DBMS_CLOUD_AI_AGENT flow</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['TOOL', 'TASK', 'AGENT', 'TEAM'] as AgentObjectType[]).map((type) => (
                <button key={type} type="button" className="btn-secondary px-3 py-2 text-sm" onClick={() => addBuilderNode(type)}>
                  + {type}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[calc(100%-65px)] min-h-[555px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={(connection) => canConnect(nodes, connection)}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              fitView
            >
              <Background />
              <MiniMap />
              <Controls />
            </ReactFlow>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="app-light-surface rounded-lg border border-gray-200 bg-white p-5 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Nodo seleccionado</h2>
            {selectedNode ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800">Tipo</label>
                  <input value={selectedNode.data.objectType} className="input-oracle mt-1 bg-gray-100" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800">Nombre</label>
                  <input
                    value={selectedNode.data.label}
                    onChange={(event) => updateSelectedData('label', event.target.value)}
                    className="input-oracle mt-1 font-mono"
                  />
                </div>
                {(selectedNode.data.objectType === 'TOOL' || selectedNode.data.objectType === 'AGENT') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800">Perfil Select AI</label>
                    <input
                      value={selectedNode.data.profileName || ''}
                      onChange={(event) => updateSelectedData('profileName', event.target.value)}
                      className="input-oracle mt-1"
                    />
                  </div>
                )}
                {selectedNode.data.objectType === 'TOOL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800">Tool type</label>
                    <select
                      value={selectedNode.data.toolType || 'SQL'}
                      onChange={(event) => updateSelectedData('toolType', event.target.value)}
                      className="input-oracle mt-1"
                    >
                      <option value="SQL">SQL</option>
                      <option value="CUSTOM">CUSTOM</option>
                    </select>
                  </div>
                )}
                {(selectedNode.data.objectType === 'TASK' || selectedNode.data.objectType === 'TOOL') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800">Instruccion</label>
                    <textarea
                      value={selectedNode.data.instruction || ''}
                      onChange={(event) => updateSelectedData('instruction', event.target.value)}
                      className="input-oracle mt-1 min-h-24"
                    />
                  </div>
                )}
                {selectedNode.data.objectType === 'AGENT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800">Rol</label>
                    <textarea
                      value={selectedNode.data.role || ''}
                      onChange={(event) => updateSelectedData('role', event.target.value)}
                      className="input-oracle mt-1 min-h-24"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-800">Attributes JSON</label>
                  <pre className="mt-1 max-h-52 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                    {JSON.stringify(selectedAttributes, null, 2)}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary px-3 py-2 text-sm" onClick={generateScript} disabled={busyAction !== null}>
                    {busyAction === 'script' ? 'Generando...' : 'Generar PL/SQL'}
                  </button>
                  <button type="button" className="btn-primary px-3 py-2 text-sm" onClick={createObject} disabled={busyAction !== null}>
                    {busyAction === 'create' ? 'Creando...' : 'Crear objeto'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Selecciona un nodo en el canvas.</p>
            )}
          </section>

          <section className="app-light-surface rounded-lg border border-gray-200 bg-white p-5 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Ejecutar equipo</h2>
            <div className="mt-4 space-y-3">
              <input
                value={runTeamName}
                onChange={(event) => setRunTeamName(normalizeName(event.target.value))}
                className="input-oracle font-mono"
                placeholder="APP_AGENT_ANALYTICS_TEAM"
              />
              <textarea
                value={runPrompt}
                onChange={(event) => setRunPrompt(event.target.value)}
                className="input-oracle min-h-24"
                placeholder="Pregunta para RUN_TEAM"
              />
              <button type="button" className="btn-primary" onClick={runTeam} disabled={busyAction !== null || !runTeamName.trim() || !runPrompt.trim()}>
                {busyAction === 'run' ? 'Ejecutando...' : 'RUN_TEAM'}
              </button>
              {runResponse && (
                <div className="space-y-2">
                  {runConversationId && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                      <span className="font-semibold uppercase tracking-[0.12em] text-gray-500">Conversation</span>
                      <p className="mt-1 break-all font-mono">{runConversationId}</p>
                    </div>
                  )}
                  <pre className="max-h-56 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                    {runResponse}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {script && (
            <section className="app-light-surface rounded-lg border border-gray-200 bg-white p-5 shadow">
              <h2 className="text-lg font-semibold text-gray-900">PL/SQL generado</h2>
              <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
                {script}
              </pre>
            </section>
          )}
        </aside>
      </div>
    </Layout>
  );
}
