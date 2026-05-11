import { describe, expect, it } from 'vitest';

import { resolveAgentName, resolveApplicationName, resolveSuggestedQuestions } from './settingsApi';

describe('settingsApi name resolvers', () => {
  it('uses configured branding names when present', () => {
    const payload = { app: { name: 'Finance Studio', agent_name: 'Nadia Ops' } };

    expect(resolveApplicationName(payload)).toBe('Finance Studio');
    expect(resolveAgentName(payload)).toBe('Nadia Ops');
  });

  it('falls back to defaults for missing or blank names', () => {
    const payload = { app: { name: '   ', agent_name: '' } };

    expect(resolveApplicationName(payload)).toBe('Select AI Analytics');
    expect(resolveAgentName(payload)).toBe('Nadia Analytics');
    expect(resolveApplicationName(null)).toBe('Select AI Analytics');
    expect(resolveAgentName(undefined)).toBe('Nadia Analytics');
  });

  it('resolves configured suggested questions with defaults when missing', () => {
    const payload = {
      suggested_questions: {
        question_1: 'Which customers grew the most this month?',
        question_2: 'Which products concentrate the most transactions?',
        question_3: 'Which transactions are pending?',
      },
    };

    expect(resolveSuggestedQuestions(payload)).toEqual([
      'Which customers grew the most this month?',
      'Which products concentrate the most transactions?',
      'Which transactions are pending?',
    ]);
    expect(resolveSuggestedQuestions(null)).toHaveLength(10);
  });
});
