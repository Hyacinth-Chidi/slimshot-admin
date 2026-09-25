'use client';

import { useProfile } from '@/lib/auth/profile';
import { LogoutButton } from '@/components/shell/logout-button';
import { SettingsGroup, SETTINGS_GROUPS } from '@/components/settings/settings-group';

export default function SettingsPage() {
  const profile = useProfile();
  // Owner-only: while the profile loads, show a quiet loading state rather
  // than flashing the no-access panel or firing settings queries early.
  const isOwner = profile.data?.role === 'owner';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text">Settings</h1>

      {profile.isLoading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : isOwner ? (
        <div className="flex flex-col gap-4">
          {SETTINGS_GROUPS.map((group) => (
            <SettingsGroup key={group} group={group} enabled={isOwner} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text">You do not have access to this page.</p>
        </div>
      )}

      {/* R6a: mobile-only logout, shown to owners and non-owners alike. */}
      <div className="md:hidden">
        <LogoutButton />
      </div>
    </div>
  );
}
