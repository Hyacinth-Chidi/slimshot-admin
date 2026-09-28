import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import {
  activateProvider,
  deactivateProvider,
  fetchProviders,
  removeProviderKey,
  saveProviderKey,
  testProviderKey,
} from './providers';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('providers API', () => {
  it('lists providers for a capability', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await fetchProviders('speech_to_text');
    expect(client.apiFetch).toHaveBeenCalledWith('/providers?capability=speech_to_text');
  });

  it('saves a key with PUT', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ configured: true });
    await saveProviderKey('deepgram', 'speech_to_text', 'dg-key-123');
    expect(client.apiFetch).toHaveBeenCalledWith('/providers/deepgram/key', {
      method: 'PUT',
      body: JSON.stringify({ capability: 'speech_to_text', apiKey: 'dg-key-123' }),
    });
  });

  it('removes a key with DELETE and the capability in the query', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({ configured: false });
    await removeProviderKey('elevenlabs', 'speech_to_text');
    expect(client.apiFetch).toHaveBeenCalledWith('/providers/elevenlabs/key?capability=speech_to_text', {
      method: 'DELETE',
    });
  });

  it.each([
    ['activate', activateProvider],
    ['deactivate', deactivateProvider],
    ['test', testProviderKey],
  ] as const)('posts to %s', async (action, fn) => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await fn('deepgram', 'speech_to_text');
    expect(client.apiFetch).toHaveBeenCalledWith(`/providers/deepgram/${action}`, {
      method: 'POST',
      body: JSON.stringify({ capability: 'speech_to_text' }),
    });
  });
});
