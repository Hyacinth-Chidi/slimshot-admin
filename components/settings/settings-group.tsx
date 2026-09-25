'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '@/lib/api/settings';
import { SecretField } from './secret-field';
import { SettingRow } from './setting-row';

const GROUP_LABELS: Record<string, string> = {
  upload: 'Upload',
  auth: 'Auth',
  security: 'Security',
  infrastructure: 'Infrastructure',
};

/**
 * One card per group. Every setting maps to a row: a secret one to the
 * locked SecretField (R12a), anything else to the inline-editing SettingRow.
 * The masked value the API returns for a secret is passed along but never
 * rendered — SecretField shows a constant placeholder instead.
 */
export function SettingsGroup({ group, enabled }: { group: string; enabled: boolean }) {
  const query = useQuery({
    queryKey: ['settings', group],
    queryFn: () => fetchSettings(group),
    enabled,
  });

  if (!enabled) return null;
  if (query.isLoading) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-subtle">Loading…</p>
      </section>
    );
  }
  if (query.isError || !query.data) return null;
  // Only a group with no settings at all is omitted; a secrets-only group
  // (e.g. infrastructure's redis.url) still renders.
  if (query.data.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-text">{GROUP_LABELS[group] ?? group}</h2>
      <div className="flex flex-col">
        {query.data.map((setting) =>
          // SecretField invalidates ['settings', group] itself after a save.
          setting.isSecret ? (
            <SecretField key={setting.key} setting={setting} />
          ) : (
            <SettingRow key={setting.key} setting={setting} />
          ),
        )}
      </div>
    </section>
  );
}

/**
 * R11c: the server's real groups (verified against
 * ../slimshot_server/src/core/settings/setting-definitions.ts — cors.allowedOrigins is
 * `group: 'security'`, and no `storage` group exists there or in
 * admin-settings.controller.ts:43). docs/api-reference.md's `storage` was not a
 * captured response and is wrong; following it as shipped would leave
 * cors.allowedOrigins permanently unreachable from this screen.
 */
export const SETTINGS_GROUPS = ['upload', 'auth', 'security', 'infrastructure'] as const;
