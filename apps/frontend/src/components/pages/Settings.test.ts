import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { STARTER_SUGGESTED_QUESTIONS } from '../../config/suggestedQuestions';
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
      items: [...STARTER_SUGGESTED_QUESTIONS],
    });
    expect((payload.suggested_questions as { items: string[] }).items[0]).toBe('¿Cuál es el saldo actual por moneda y sucursal?');
  });

  it('reads configured field values with string conversion and supplied empty values', () => {
    const payload = {
      app: {
        name: 'Finance Console',
        session_timeout_minutes: 120,
      },
    };

    expect(fieldValue(payload, 'app', 'name')).toBe('Finance Console');
    expect(fieldValue(payload, 'app', 'session_timeout_minutes')).toBe('120');
    expect(fieldValue(payload, 'app', 'missing', 'empty')).toBe('empty');
    expect(fieldValue(null, 'app', 'name', 'empty')).toBe('empty');
  });

  it('keeps configured suggested questions and fills missing items', () => {
    const payload = normalizeSettingsPayload({
      suggested_questions: {
        items: ['¿Qué clientes crecieron más este mes?', '', '¿Qué clientes crecieron más este mes?'],
      },
    });

    expect((payload.suggested_questions as { items: string[] }).items).toEqual(['¿Qué clientes crecieron más este mes?']);
  });

  it('renders starter questions as a dynamic one-line list', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));

    const questionInputs = screen.getAllByRole('textbox', { name: /Starter question \d+/i });

    expect(screen.getByText('Starter Questions')).toBeInTheDocument();
    expect(screen.getByText('Global question library for all users')).toBeInTheDocument();
    expect(screen.queryByText('Los nuevos chats muestran aleatoriamente tres preguntas de esta lista.')).not.toBeInTheDocument();
    expect(questionInputs).toHaveLength(10);
    expect(questionInputs[0].tagName).toBe('INPUT');
    expect(questionInputs[0]).toHaveAttribute('type', 'text');
    expect(questionInputs[0]).toHaveValue('¿Cuál es el saldo actual por moneda y sucursal?');
  });

  it('lets administrators add and remove starter questions before saving', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    const questionInputs = screen.getAllByRole('textbox', { name: /Starter question \d+/i });
    expect(questionInputs).toHaveLength(11);

    fireEvent.change(questionInputs[10], { target: { value: '¿Qué clientes tienen mayor actividad fuera de horario?' } });
    expect(questionInputs[10]).toHaveValue('¿Qué clientes tienen mayor actividad fuera de horario?');

    fireEvent.click(screen.getByRole('button', { name: 'Remove starter question 11' }));
    expect(screen.getAllByRole('textbox', { name: /Starter question \d+/i })).toHaveLength(10);
  });
});
