import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function renderSettings(showToast = vi.fn()) {
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
      createElement(Settings, { showToast })
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
    expect(payload.suggested_questions).toMatchObject({ items: [] });
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

  it('renders an empty starter question list until questions are configured', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));

    expect(screen.getByText('Starter Questions')).toBeInTheDocument();
    expect(screen.getByText('Global question library for all users')).toBeInTheDocument();
    expect(screen.queryByText('Los nuevos chats muestran aleatoriamente tres preguntas de esta lista.')).not.toBeInTheDocument();
    expect(screen.getByText('No starter questions')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox', { name: /Starter question \d+/i })).toHaveLength(0);
  });

  it('lets administrators add and remove starter questions before saving', async () => {
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    const questionInputs = screen.getAllByRole('textbox', { name: /Starter question \d+/i });
    expect(questionInputs).toHaveLength(1);

    fireEvent.change(questionInputs[0], { target: { value: '¿Qué clientes tienen mayor actividad fuera de horario?' } });
    expect(questionInputs[0]).toHaveValue('¿Qué clientes tienen mayor actividad fuera de horario?');

    fireEvent.click(screen.getByRole('button', { name: 'Remove starter question 1' }));
    expect(screen.queryAllByRole('textbox', { name: /Starter question \d+/i })).toHaveLength(0);
  });

  it('imports starter questions from a dropped CSV file', async () => {
    const showToast = vi.fn();
    vi.mocked(settingsApi.get).mockResolvedValue({ data: {} } as never);

    renderSettings(showToast);
    fireEvent.click(await screen.findByRole('button', { name: 'Questions' }));

    const csv = new File(['question\n"¿Qué clientes crecieron más este mes?"\n"¿Qué productos lideran transacciones?"\n'], 'questions.csv', {
      type: 'text/csv',
    });
    fireEvent.drop(screen.getByLabelText('Starter questions table'), {
      dataTransfer: { files: [csv] },
    });

    await waitFor(() => {
      expect(screen.getAllByRole('textbox', { name: /Starter question \d+/i })).toHaveLength(2);
    });
    expect(screen.getByDisplayValue('¿Qué clientes crecieron más este mes?')).toBeInTheDocument();
    expect(screen.getByDisplayValue('¿Qué productos lideran transacciones?')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Imported 2 questions from CSV.', 'success');
  });
});
