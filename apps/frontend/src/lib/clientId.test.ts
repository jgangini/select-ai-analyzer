import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClientId } from './clientId';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createClientId', () => {
  it('uses crypto.randomUUID when the browser exposes it', () => {
    const randomUUID = vi.fn(() => 'browser-uuid');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createClientId('message')).toBe('browser-uuid');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('creates a stable client id when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(7);
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    const id = createClientId('message');

    expect(id).toMatch(/^message-[a-z0-9]+-[a-z0-9]+-070707/);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });
});
