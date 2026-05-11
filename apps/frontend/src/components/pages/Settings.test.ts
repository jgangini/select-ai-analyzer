import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SUGGESTED_QUESTIONS } from '../../config/suggestedQuestions';
import { settingsApi } from '../../services/settingsApi';
import { fieldValue, normalizeSettingsPayload } from './Settings';
import { Settings } from './Settings';

vi.mock('../../services/settingsApi', () => ({
  settingsApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
  settingsQueryKeys: {
    publicBranding: ['settings', 'publicBranding'],
  },
}));

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Settings, { showToast: vi.fn() })
    )
  );
}

describe('Settings helpers', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

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
    expect(payload.suggested_questions?.question_1).toBe('¿Cuál es el saldo actual por moneda y sucursal?');
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

  it('renders suggested questions with English labels and one-line Spanish inputs', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));

    const questionInputs = screen.getAllByLabelText(/Pregunta \d+/i);

    expect(screen.getByText('Suggested Questions')).toBeInTheDocument();
    expect(screen.getByText('Maintain the representative prompts shown when a new chat starts')).toBeInTheDocument();
    expect(screen.queryByText('Los nuevos chats muestran aleatoriamente tres preguntas de esta lista.')).not.toBeInTheDocument();
    expect(questionInputs).toHaveLength(10);
    expect(questionInputs[0].tagName).toBe('INPUT');
    expect(questionInputs[0]).toHaveAttribute('type', 'text');
    expect(questionInputs[0]).toHaveValue('¿Cuál es el saldo actual por moneda y sucursal?');
  });
});
