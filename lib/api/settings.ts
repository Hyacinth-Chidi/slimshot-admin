import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * `type` matches the server's real union (verified against
 * ../slimshot_server/src/core/settings/setting-registry.ts:1 — SettingType),
 * not the brief's `'string' | 'number' | 'boolean' | 'json'`: the server has
 * no `'number'` type (integers are `'int'`) and also has `'string[]'`, which
 * the brief's Step 1 omitted. `int` and `string[]` are rendered as the
 * closest matching row (numeric input; textarea) rather than gaining bespoke
 * row types in this task.
 */
export interface MaskedSetting {
  key: string;
  group: string;
  type: 'string' | 'int' | 'boolean' | 'string[]' | 'json';
  isSecret: boolean;
  /** False when the setting has never been set. Render an empty field, not a mask. */
  configured: boolean;
  description: string;
  value: unknown;
}

export interface RevealResult {
  value: string;
  grant: string;
  expiresIn: number;
}

export function fetchSettings(group: string): Promise<MaskedSetting[]> {
  return withRefresh(() => apiFetch<MaskedSetting[]>(`/settings?group=${encodeURIComponent(group)}`));
}

/**
 * WARNING: withRefresh-wrapped. Never send a `{ password }` proof through it —
 * a wrong-password 401 would trigger a refresh and a resend, spending a second
 * lockout attempt the user never made. Secret writes use `{ grant }` only.
 */
export function updateSetting(
  key: string,
  value: unknown,
  proof: { password?: string; grant?: string } = {},
): Promise<void> {
  return withRefresh(() =>
    apiFetch<void>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value, ...proof }),
    }),
  );
}

/**
 * Deliberately NOT wrapped in withRefresh's retry and never cached. A failed
 * reveal feeds the account lockout counter, so an automatic retry spends a
 * second attempt the user did not make.
 */
export function revealSecret(key: string, password: string): Promise<RevealResult> {
  return apiFetch<RevealResult>(`/settings/${encodeURIComponent(key)}/reveal`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
