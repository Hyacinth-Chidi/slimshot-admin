'use client';

import { ProvidersTab } from '@/components/settings/providers-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfile } from '@/lib/auth/profile';

export default function SettingsPage() {
  const profile = useProfile();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Settings</h1>

      {profile.isLoading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : profile.isError ? (
        <p className="text-sm text-error">Could not load your profile. Reload the page to try again.</p>
      ) : profile.data?.role === 'owner' ? (
        // Owner-only content mounts only here, so a non-owner never fires its queries.
        <Tabs defaultValue="providers">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>
          <TabsContent value="providers">
            <ProvidersTab />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text">Only the owner can manage settings.</p>
        </div>
      )}
    </div>
  );
}
