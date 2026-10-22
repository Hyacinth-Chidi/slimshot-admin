'use client';

import { CreditsTab } from '@/components/settings/credits-tab';
import { PricingTab } from '@/components/settings/pricing-tab';
import { OwnerOnly } from '@/components/system/owner-only';
import { SystemHeader } from '@/components/system/system-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Credit rules and what features cost, together: pricing is what spends credits. */
export default function CreditsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SystemHeader title="Credits" />
      <OwnerOnly what="credits">
        <Tabs defaultValue="rules">
          <TabsList aria-label="Credits sections">
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>
          <TabsContent value="rules">
            <CreditsTab />
          </TabsContent>
          <TabsContent value="pricing">
            <PricingTab />
          </TabsContent>
        </Tabs>
      </OwnerOnly>
    </div>
  );
}
