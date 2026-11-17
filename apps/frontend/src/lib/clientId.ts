let clientIdSequence = 0;

export function createClientId(prefix = 'id'): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  clientIdSequence = (clientIdSequence + 1) % Number.MAX_SAFE_INTEGER;

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    const randomPart = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${prefix}-${Date.now().toString(36)}-${clientIdSequence.toString(36)}-${randomPart}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${clientIdSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
