'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '@/lib/api/settings';
import { SettingRow } from './setting-row';

const GROUP_LABELS: Record<string, string> = {
  upload: 'Upload',
  auth: 'Auth',
  security: 'Security',
  infrastructure: 'Infrastructure',
};

/**
 * R11b: this is the seam Task 12 plugs SecretField into. Every setting in
 * the group maps to a row; a secret one is skipped here rather than getting
 * placeholder UI, so Task 12 only has to change this one filter.
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

  const visible = query.data.filter((s) => !s.isSecret);
  // A group with no non-secret settings is omitted for now — Task 12 fills
  // secrets in, at which point this group may become non-empty.
  if (visible.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-2 text-sm font-semibold text-text">{GROUP_LABELS[group] ?? group}</h2>
      <div className="flex flex-col">
        {visible.map((setting) => (
          <SettingRow key={setting.key} setting={setting} />
        ))}
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
