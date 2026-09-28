import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * Wraps the server's owner-only /providers endpoints
 * (slimshot_server/src/modules/admin/admin-providers.controller.ts). No call
 * here ever receives an API key back: the server only says whether one is saved.
 */
export type ProviderKind = 'deepgram' | 'elevenlabs';
export type ProviderCapability = 'speech_to_text';

export interface ProviderStatus {
  provider: ProviderKind;
  capability: ProviderCapability;
  configured: boolean;
  active: boolean;
  updatedAt: string | null;
}

export interface KeyCheck {
  ok: boolean;
  message: string;
}

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  deepgram: 'Deepgram',
  elevenlabs: 'ElevenLabs',
};

export function providersQueryKey(capability: ProviderCapability) {
  return ['providers', capability] as const;
}

export function fetchProviders(capability: ProviderCapability): Promise<ProviderStatus[]> {
  return withRefresh(() =>
    apiFetch<ProviderStatus[]>(`/providers?capability=${encodeURIComponent(capability)}`),
  );
}

export function saveProviderKey(
  provider: ProviderKind,
  capability: ProviderCapability,
  apiKey: string,
): Promise<{ configured: true }> {
  return withRefresh(() =>
    apiFetch<{ configured: true }>(`/providers/${provider}/key`, {
      method: 'PUT',
      body: JSON.stringify({ capability, apiKey }),
    }),
  );
}

export function removeProviderKey(
  provider: ProviderKind,
  capability: ProviderCapability,
): Promise<{ configured: false }> {
  return withRefresh(() =>
    apiFetch<{ configured: false }>(
      `/providers/${provider}/key?capability=${encodeURIComponent(capability)}`,
      { method: 'DELETE' },
    ),
  );
}

function post<T>(provider: ProviderKind, action: string, capability: ProviderCapability): Promise<T> {
  return withRefresh(() =>
    apiFetch<T>(`/providers/${provider}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ capability }),
    }),
  );
}

export function activateProvider(provider: ProviderKind, capability: ProviderCapability) {
  return post<ProviderStatus[]>(provider, 'activate', capability);
}

export function deactivateProvider(provider: ProviderKind, capability: ProviderCapability) {
  return post<ProviderStatus[]>(provider, 'deactivate', capability);
}

export function testProviderKey(provider: ProviderKind, capability: ProviderCapability) {
  return post<KeyCheck>(provider, 'test', capability);
}
