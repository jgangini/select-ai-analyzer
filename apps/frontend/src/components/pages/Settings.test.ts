import { describe, expect, it } from 'vitest';

import { DEFAULT_SUGGESTED_QUESTIONS } from '../../config/suggestedQuestions';
import { fieldValue, normalizeSettingsPayload } from './Settings';

describe('Settings helpers', () => {
  it('normalizes missing settings to runtime defaults', () => {
    const payload = normalizeSettingsPayload({});

    expect(payload.app).toMatchObject({
      name: 'Select AI Analytics',
      agent_name: 'Nadia Analytics',
      session_timeout_minutes: 480,
      timezone: 'America/Lima',
      language: 'en',
    });
    expect(payload.select_ai).toMatchObject({
      profile_name: 'APP_AGENT_ANALYTICS',
      credential_name: 'APP_AGENT_OCI_CRED',
    });
    expect(payload.genai).toMatchObject({ model: 'google.gemini-2.5-flash' });
    expect(payload.suggested_questions).toMatchObject({
      question_1: DEFAULT_SUGGESTED_QUESTIONS[0],
      question_10: DEFAULT_SUGGESTED_QUESTIONS[9],
    });
  });

  it('reads configured field values with string conversion and fallbacks', () => {
    const payload = {
      app: {
        name: 'Finance Console',
        session_timeout_minutes: 120,
      },
    };

    expect(fieldValue(payload, 'app', 'name')).toBe('Finance Console');
    expect(fieldValue(payload, 'app', 'session_timeout_minutes')).toBe('120');
    expect(fieldValue(payload, 'app', 'missing', 'fallback')).toBe('fallback');
    expect(fieldValue(null, 'app', 'name', 'fallback')).toBe('fallback');
  });

  it('keeps configured suggested questions and fills missing items', () => {
    const payload = normalizeSettingsPayload({
      suggested_questions: {
        question_1: '¿Qué clientes crecieron más este mes?',
        question_2: '',
      },
    });

    expect(payload.suggested_questions?.question_1).toBe('¿Qué clientes crecieron más este mes?');
    expect(payload.suggested_questions?.question_2).toBe(DEFAULT_SUGGESTED_QUESTIONS[1]);
    expect(Object.keys(payload.suggested_questions || {})).toHaveLength(10);
  });
});
