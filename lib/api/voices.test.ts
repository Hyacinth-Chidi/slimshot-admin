import { afterEach, describe, expect, it, vi } from 'vitest';
import * as client from '@/lib/api/client';
import { fetchVoices, makeVoiceSample, reorderVoices, syncVoices, updateVoice, voicesQueryKey } from './voices';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('@/lib/auth/session', () => ({ withRefresh: (fn: () => unknown) => fn() }));

afterEach(() => {
  vi.resetAllMocks();
});

describe('voices API', () => {
  it('lists every voice', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await fetchVoices();
    expect(client.apiFetch).toHaveBeenCalledWith('/voices');
    expect(voicesQueryKey).toEqual(['voices']);
  });

  it('syncs from the provider with POST', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await syncVoices();
    expect(client.apiFetch).toHaveBeenCalledWith('/voices/sync', { method: 'POST' });
  });

  it('renames or switches a voice with PATCH, sending only what changed', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({});
    await updateVoice('clx/1', { enabled: true });
    expect(client.apiFetch).toHaveBeenCalledWith('/voices/clx%2F1', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true }),
    });
  });

  it('saves the whole order with PUT', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue([]);
    await reorderVoices(['b', 'a']);
    expect(client.apiFetch).toHaveBeenCalledWith('/voices/order', {
      method: 'PUT',
      body: JSON.stringify({ ids: ['b', 'a'] }),
    });
  });

  it('makes a sample with POST', async () => {
    vi.mocked(client.apiFetch).mockResolvedValue({});
    await makeVoiceSample('v1');
    expect(client.apiFetch).toHaveBeenCalledWith('/voices/v1/sample', { method: 'POST' });
  });
});
