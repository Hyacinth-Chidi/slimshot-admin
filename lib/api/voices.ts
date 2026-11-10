import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';
import type { ProviderKind } from './providers';

/**
 * The owner-only /voices routes for text to speech
 * (../slimshot_server/docs/admin-voices-api.md). A voice comes from the
 * provider switched off, and is switched on only once it has a sample.
 */
export interface Voice {
  id: string;
  provider: ProviderKind;
  providerVoiceId: string;
  /** The name the app shows. */
  label: string;
  sortOrder: number;
  enabled: boolean;
  sampleStorageId: string | null;
  sampleStorageKey: string | null;
  /** The sample's MP3 ("Hi! This is how I sound in your video."); null until one is made. */
  sampleUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceChange {
  label?: string;
  enabled?: boolean;
}

export const voicesQueryKey = ['voices'] as const;

/** Every voice, switched on or not, in the order the app lists them. */
export function fetchVoices(): Promise<Voice[]> {
  return withRefresh(() => apiFetch<Voice[]>('/voices'));
}

/** Adds the provider's voices not yet known, switched off; answers the whole list. */
export function syncVoices(): Promise<Voice[]> {
  return withRefresh(() => apiFetch<Voice[]>('/voices/sync', { method: 'POST' }));
}

/** Only what changed is sent. Switching on a voice without a sample is refused (409). */
export function updateVoice(id: string, change: VoiceChange): Promise<Voice> {
  return withRefresh(() =>
    apiFetch<Voice>(`/voices/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(change) }),
  );
}

/** `ids` is every voice, in the new order: the server refuses anything else. */
export function reorderVoices(ids: string[]): Promise<Voice[]> {
  return withRefresh(() => apiFetch<Voice[]>('/voices/order', { method: 'PUT', body: JSON.stringify({ ids }) }));
}

/** Speaks the sample sentence through the provider (the owner's spend) and replaces the old sample. */
export function makeVoiceSample(id: string): Promise<Voice> {
  return withRefresh(() => apiFetch<Voice>(`/voices/${encodeURIComponent(id)}/sample`, { method: 'POST' }));
}
