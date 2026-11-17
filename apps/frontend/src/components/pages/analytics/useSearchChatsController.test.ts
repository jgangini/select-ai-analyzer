import { describe, expect, it } from 'vitest';

import {
  buildConversationMarkdown,
  formatDateTime,
  getSafeFileName,
  normalizeForSearch,
  sortConversations,
} from './searchChatsUtils';

describe('useSearchChatsController helpers', () => {
  it('normalizes search text and formats valid timestamps', () => {
    expect(normalizeForSearch('  Credit Agile  ')).toBe('credit agile');
    expect(formatDateTime('2026-05-07T09:08:06Z')).toMatch(/^2026-05-07 \d{2}:08:06$/);
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('builds safe markdown filenames', () => {
    expect(getSafeFileName('Fraud / ATM: São Paulo?')).toBe('Fraud_ATM_So_Paulo');
    expect(getSafeFileName('   ')).toBe('chat');
  });

  it('exports a conversation transcript with SQL fences', () => {
    const conversation = {
      conversation_id: 'conversation-1',
      title: 'Daily balances',
      created_at: '2026-05-07T09:00:00Z',
      updated_at: '2026-05-07T09:30:00Z',
      messages: [
        {
          run_id: 'run-1',
          question: 'Show balances',
          created_at: '2026-05-07T09:01:00Z',
          result: {
            run_id: 'run-1',
            conversation_id: 'conversation-1',
            answer: 'Balances are stable.',
            sql: 'select * from balances',
            columns: ['BALANCE'],
            rows: [{ BALANCE: 100 }],
            row_count: 1,
            chart_spec: { type: 'metric', y: 'BALANCE' },
            agent_trace: [],
          },
        },
      ],
    };

    expect(buildConversationMarkdown(conversation)).toContain('# Daily balances');
    expect(buildConversationMarkdown(conversation)).toContain('```sql\nselect * from balances\n```');
  });

  it('sorts conversations newest update first without mutating the input', () => {
    const conversations = [
      { conversation_id: 'old', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { conversation_id: 'new', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-03T00:00:00Z' },
    ];

    expect(sortConversations(conversations).map((conversation) => conversation.conversation_id)).toEqual(['new', 'old']);
    expect(conversations.map((conversation) => conversation.conversation_id)).toEqual(['old', 'new']);
  });
});
