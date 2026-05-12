import { describe, expect, it } from 'vitest';

import { resolveAgentName, resolveApplicationName, resolveSuggestedQuestions } from './settingsApi';

describe('settingsApi name resolvers', () => {
  it('uses configured branding names when present', () => {
    const payload = { app: { name: 'Finance Studio', agent_name: 'Nadia Ops' } };

    expect(resolveApplicationName(payload)).toBe('Finance Studio');
    expect(resolveAgentName(payload)).toBe('Nadia Ops');
  });

  it('uses product names when branding is missing or blank', () => {
    const payload = { app: { name: '   ', agent_name: '' } };

    expect(resolveApplicationName(payload)).toBe('Select AI Analytics');
    expect(resolveAgentName(payload)).toBe('Nadia Analytics');
    expect(resolveApplicationName(null)).toBe('Select AI Analytics');
    expect(resolveAgentName(undefined)).toBe('Nadia Analytics');
  });

  it('resolves configured starter questions and starter seed when missing', () => {
    const payload = {
      suggested_questions: {
        items: [
          '¿Qué clientes crecieron más este mes?',
          '¿Qué productos concentran más transacciones?',
          '¿Qué transacciones están pendientes?',
        ],
      },
    };

    expect(resolveSuggestedQuestions(payload)).toEqual([
      '¿Qué clientes crecieron más este mes?',
      '¿Qué productos concentran más transacciones?',
      '¿Qué transacciones están pendientes?',
    ]);
    expect(resolveSuggestedQuestions(null)).toHaveLength(10);
  });

});
