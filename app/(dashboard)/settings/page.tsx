'use client';

import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { CreditsTab } from '@/components/settings/credits-tab';
import { PricingTab } from '@/components/settings/pricing-tab';
import { ProvidersTab } from '@/components/settings/providers-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProfile } from '@/lib/auth/profile';

export default function SettingsPage() {
  const profile = useProfile();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Settings</h1>

      {profile.isLoading ? (
        <LoadingRegion label="Loading settings" className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </LoadingRegion>
      ) : profile.isError ? (
        <p className="text-sm text-error">Could not load your profile. Reload the page to try again.</p>
      ) : profile.data?.role === 'owner' ? (
        // Owner-only content mounts only here, so a non-owner never fires its queries.
        <Tabs defaultValue="providers">
          <TabsList aria-label="Settings sections">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>
          <TabsContent value="providers">
            <ProvidersTab />
          </TabsContent>
          <TabsContent value="credits">
            <CreditsTab />
          </TabsContent>
          <TabsContent value="pricing">
            <PricingTab />
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
