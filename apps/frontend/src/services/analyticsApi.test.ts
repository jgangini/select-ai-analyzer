import { describe, expect, it } from 'vitest';

import { sortConversations } from './analyticsApi';

type ConversationSummary = {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  turns: number;
  last_message_preview: string;
};

function conversation(
  conversationId: string,
  createdAt: string,
  updatedAt?: string
): ConversationSummary {
  return {
    conversation_id: conversationId,
    title: conversationId,
    created_at: createdAt,
    updated_at: updatedAt || createdAt,
    turns: 1,
    last_message_preview: '',
  };
}

describe('sortConversations', () => {
  it('sorts newest updated conversations first without mutating the input list', () => {
    const conversations = [
      conversation('old', '2026-01-01T00:00:00Z'),
      conversation('new', '2026-01-02T00:00:00Z', '2026-01-04T00:00:00Z'),
      conversation('middle', '2026-01-03T00:00:00Z'),
    ];

    const sorted = sortConversations(conversations);

    expect(sorted.map((item) => item.conversation_id)).toEqual(['new', 'middle', 'old']);
    expect(conversations.map((item) => item.conversation_id)).toEqual(['old', 'new', 'middle']);
  });
});
