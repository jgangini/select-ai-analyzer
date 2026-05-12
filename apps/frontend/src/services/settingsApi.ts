import api from './httpClient';
import { normalizeSuggestedQuestions } from '../config/suggestedQuestions';

export const settingsQueryKeys = {
  publicBranding: ['settings', 'public-branding'] as const,
};

const DEFAULT_APP_DISPLAY_NAME = 'Select AI Analytics';
const DEFAULT_AGENT_DISPLAY_NAME = 'Nadia Analytics';

export const setupQueryKeys = {
  check: ['setup', 'check'] as const,
};

function readAppSetting(payload: unknown, key: 'name' | 'agent_name'): string {
  const app = payload && typeof payload === 'object' ? (payload as { app?: unknown }).app : null;
  const value = app && typeof app === 'object' ? (app as Record<string, unknown>)[key] : '';
  return String(value || '').trim();
}

export function resolveApplicationName(payload: unknown): string {
  const configuredName = readAppSetting(payload, 'name');
  return configuredName || DEFAULT_APP_DISPLAY_NAME;
}

export function resolveAgentName(payload: unknown): string {
  const configuredName = readAppSetting(payload, 'agent_name');
  return configuredName || DEFAULT_AGENT_DISPLAY_NAME;
}

export function resolveSuggestedQuestions(payload: unknown): string[] {
  return normalizeSuggestedQuestions(payload);
}

export async function checkSetupComplete() {
  try {
    const response = await api.get<{ completed?: boolean }>('/setup/check', { timeout: 10000 });
    return response.data.completed === true;
  } catch {
    return false;
  }
}

export const settingsApi = {
  getPublic: () => api.get('/settings/public'),
  get: () => api.get('/settings'),
  update: (updates: Record<string, unknown>) => api.put('/settings', { updates }),
  uploadAgentAvatar: (file: File) => {
    const payload = new FormData();
    payload.append('file', file);
    return api.post('/settings/agent-avatar', payload);
  },
  deleteAgentAvatar: () => api.delete('/settings/agent-avatar'),
};
