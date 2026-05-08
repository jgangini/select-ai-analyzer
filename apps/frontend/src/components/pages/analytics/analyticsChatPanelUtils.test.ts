import { describe, expect, it } from 'vitest';

import {
  buildConversationMessages,
  buildDashboardDraftItem,
  findLatestAssistantMessage,
  findLatestUserQuestion,
  getAnalyticsErrorMessage,
  getDefaultDashboardName,
  getUserInitials,
} from './analyticsChatPanelUtils';

describe('analytics chat panel utilities', () => {
  it('prefers API detail messages over generic errors', () => {
    const error = {
      response: { data: { detail: 'Invalid Select AI request.' } },
      message: 'Network Error',
    };

    expect(getAnalyticsErrorMessage(error)).toBe('Invalid Select AI request.');
  });

  it('falls back to error message and default copy', () => {
    expect(getAnalyticsErrorMessage(new Error('Request failed.'))).toBe('Request failed.');
    expect(getAnalyticsErrorMessage(null)).toBe('The question could not be executed.');
  });

  it('normalizes default dashboard names from chat titles', () => {
    expect(getDefaultDashboardName('New analytics chat')).toBe('Analytics dashboard');
    expect(getDefaultDashboardName('  Deposit trends  ')).toBe('Deposit trends');
    expect(getDefaultDashboardName('')).toBe('Analytics dashboard');
  });

  it('derives user initials from the first two name parts', () => {
    expect(getUserInitials('Ada Lovelace')).toBe('AL');
    expect(getUserInitials('  Grace Brewster Hopper')).toBe('GB');
    expect(getUserInitials('')).toBe('U');
  });

  it('builds dashboard draft items from analytics results', () => {
    const result = {
      run_id: 'run-1',
      conversation_id: 'chat-1',
      answer: 'Done',
      sql: 'select 1 from dual',
      columns: ['VALUE'],
      rows: [{ VALUE: 1 }],
      row_count: 1,
      chart_spec: { type: 'bar' as const, title: 'Balance by product', x: 'PRODUCT', y: 'BALANCE' },
      agent_trace: [],
    };

    expect(buildDashboardDraftItem(result, 'What is the balance by product?')).toEqual({
      draft_id: 'run-1',
      run_id: 'run-1',
      title: 'Balance by product',
      question: 'What is the balance by product?',
      sql: 'select 1 from dual',
      chart_spec: result.chart_spec,
    });
  });

  it('uses a bounded question fallback for untitled chart drafts', () => {
    const question = 'x'.repeat(130);
    const result = {
      run_id: 'run-2',
      conversation_id: 'chat-1',
      answer: 'Done',
      sql: 'select 1 from dual',
      columns: ['VALUE'],
      rows: [{ VALUE: 1 }],
      row_count: 1,
      chart_spec: { type: 'metric' as const },
      agent_trace: [],
    };

    expect(buildDashboardDraftItem(result, question).title).toBe('x'.repeat(120));
  });

  it('builds paired user and assistant messages from stored conversations', () => {
    const conversation = {
      conversation_id: 'chat-1',
      title: 'Balances',
      created_at: '2026-05-08T10:00:00Z',
      updated_at: '2026-05-08T10:01:00Z',
      messages: [
        {
          run_id: 'run-1',
          question: 'Saldo por producto',
          created_at: '2026-05-08T10:01:00Z',
          result: {
            run_id: 'run-1',
            conversation_id: 'chat-1',
            answer: 'El saldo total es 1200.',
            sql: 'select 1200 as balance from dual',
            columns: ['BALANCE'],
            rows: [{ BALANCE: 1200 }],
            row_count: 1,
            chart_spec: { type: 'metric' as const, title: 'Saldo' },
            agent_trace: [],
          },
        },
      ],
    };

    expect(buildConversationMessages(conversation)).toMatchObject([
      { id: 'run-1-user', role: 'user', content: 'Saldo por producto' },
      {
        id: 'run-1-assistant',
        role: 'assistant',
        content: 'El saldo total es 1200.',
        question: 'Saldo por producto',
      },
    ]);
  });

  it('finds latest assistant result and latest user question', () => {
    const olderResult = {
      run_id: 'run-1',
      conversation_id: 'chat-1',
      answer: 'Old answer',
      sql: 'select 1 from dual',
      columns: ['VALUE'],
      rows: [{ VALUE: 1 }],
      row_count: 1,
      chart_spec: { type: 'metric' as const },
      agent_trace: [],
    };
    const latestResult = { ...olderResult, run_id: 'run-2', answer: 'Latest answer' };
    const messages = [
      { id: 'u1', role: 'user' as const, content: 'Old question', timestamp: new Date('2026-05-08T10:00:00Z') },
      {
        id: 'a1',
        role: 'assistant' as const,
        content: olderResult.answer,
        timestamp: new Date('2026-05-08T10:00:01Z'),
        result: olderResult,
        question: 'Old question',
      },
      { id: 'u2', role: 'user' as const, content: 'Latest question', timestamp: new Date('2026-05-08T10:01:00Z') },
      {
        id: 'a2',
        role: 'assistant' as const,
        content: latestResult.answer,
        timestamp: new Date('2026-05-08T10:01:01Z'),
        result: latestResult,
        question: 'Latest question',
      },
    ];

    expect(findLatestAssistantMessage(messages)?.result).toBe(latestResult);
    expect(findLatestUserQuestion(messages)).toBe('Latest question');
  });
});
