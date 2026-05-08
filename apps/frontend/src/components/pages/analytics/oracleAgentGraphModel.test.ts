import { describe, expect, it } from 'vitest';

import {
  buildGraphEdges,
  buildGraphNodes,
  buildGraphViewBox,
  buildSelectedNodeInspection,
  resolveGraphTables,
  resolveProfileName,
  truncateGraphText,
  type GraphTableRef,
  type OracleGraphRenderNode,
  type OracleGraphResult,
} from './oracleAgentGraphModel';

function analyticsResult(overrides: Partial<OracleGraphResult> = {}): OracleGraphResult {
  return {
    run_id: 'run-1',
    conversation_id: 'conversation-1',
    answer: 'Deposits increased.',
    sql: 'select * from fin.transactions',
    columns: ['ACCOUNT_ID', 'AMOUNT'],
    rows: [
      { account_id: 1, amount: 10 },
      { account_id: 2, amount: 20 },
      { account_id: 3, amount: 30 },
      { account_id: 4, amount: 40 },
      { account_id: 5, amount: 50 },
      { account_id: 6, amount: 60 },
    ],
    row_count: 6,
    chart_spec: { type: 'bar', title: 'Deposit trend' },
    agent_trace: [
      {
        stage: 'select_ai.scope_profile',
        status: 'completed',
        profile_name: 'SELECT_AI_PROFILE',
        objects: [{ owner: 'fin', name: 'transactions', columns: ['account_id', 'amount'] }],
      },
      { stage: 'select_ai.showsql', status: 'completed' },
      { stage: 'select_ai.execute_select', status: 'completed', rows: 6 },
    ],
    ...overrides,
  };
}

function renderNode(node: Partial<OracleGraphRenderNode>): OracleGraphRenderNode {
  return {
    key: 'execute',
    label: 'SELECT executor',
    detail: '6 rows returned',
    kind: 'execute',
    status: 'completed',
    x: 0,
    y: 0,
    width: 160,
    height: 64,
    ...node,
  };
}

describe('oracleAgentGraphModel', () => {
  it('resolves trace object tables and enriches them from registered data sources', () => {
    const tables = resolveGraphTables(analyticsResult(), [
      {
        owner_name: 'FIN',
        table_name: 'TRANSACTIONS',
        row_count: 250,
        source_type: 'csv',
      },
    ]);

    expect(tables).toEqual([
      {
        owner: 'FIN',
        name: 'TRANSACTIONS',
        columns: ['ACCOUNT_ID', 'AMOUNT'],
        rowCount: 250,
        sourceType: 'csv',
      },
    ]);
  });

  it('falls back to SQL table references when trace objects are absent', () => {
    const tables = resolveGraphTables(
      analyticsResult({
        sql: 'select * from "hr"."employees" e join transactions t on t.account_id = e.id',
        agent_trace: [],
      }),
      []
    );

    expect(tables.map((table) => `${table.owner}.${table.name}`)).toEqual(['HR.EMPLOYEES', 'UNKNOWN.TRANSACTIONS']);
  });

  it('builds a compact graph flow with table nodes when object list is present', () => {
    const tables: GraphTableRef[] = [{ owner: 'FIN', name: 'TRANSACTIONS', columns: ['ACCOUNT_ID'] }];
    const nodes = buildGraphNodes(analyticsResult(), 'SELECT_AI_PROFILE', analyticsResult().agent_trace || [], tables);
    const edges = buildGraphEdges(tables);

    expect(nodes.map((node) => node.key)).toEqual(['request', 'profile', 'table_0', 'sql', 'execute', 'answer']);
    expect(edges).toContainEqual({ source: 'profile', target: 'table_0', label: 'object_list' });
    expect(edges).toContainEqual({ source: 'table_0', target: 'sql' });
  });

  it('returns execute inspection payloads with capped sample rows', () => {
    const result = analyticsResult();
    const table = { owner: 'FIN', name: 'TRANSACTIONS', columns: ['ACCOUNT_ID'] };
    const inspection = buildSelectedNodeInspection({
      selectedNode: renderNode({}),
      traceItems: result.agent_trace || [],
      graphTables: [table],
      graphTablesForFlow: [table],
      latestQuestion: 'How are deposits trending?',
      result,
      profileName: resolveProfileName(result.agent_trace || []),
    });

    expect(inspection?.inputPayload).toEqual({ sql: result.sql, read_only: true, max_rows: 500 });
    expect(inspection?.outputPayload).toMatchObject({
      row_count: 6,
      columns: ['ACCOUNT_ID', 'AMOUNT'],
      sample_rows: result.rows.slice(0, 5),
    });
  });

  it('keeps graph viewbox zoom constrained and text truncation centered', () => {
    const viewBox = buildGraphViewBox({ x: 0, y: 0, width: 700, height: 420 }, { x: 10, y: -5 }, 10);

    expect(viewBox.x).toBeCloseTo(200.909);
    expect(viewBox.y).toBeCloseTo(109.545);
    expect(viewBox.width).toBeCloseTo(318.182);
    expect(viewBox.height).toBeCloseTo(190.909);
    expect(truncateGraphText('TRANSACTIONS_BY_PRODUCT_AND_BRANCH', 15)).toBe('TRANSA...BRANCH');
  });
});
