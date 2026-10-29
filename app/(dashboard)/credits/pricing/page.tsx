'use client';

import { PricingPage } from '@/components/credits/pricing-page';
import { OwnerOnly } from '@/components/system/owner-only';

/** Credits › Pricing. Owner only: the page's header carries its Change price action. */
export default function CreditsPricingRoute() {
  return (
    <OwnerOnly what="pricing">
      <PricingPage />
    </OwnerOnly>
  );
}
