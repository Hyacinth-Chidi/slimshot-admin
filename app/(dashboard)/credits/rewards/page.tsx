'use client';

import { RewardsPage } from '@/components/credits/rewards-page';
import { OwnerOnly } from '@/components/system/owner-only';

export default function CreditsRewardsRoute() {
  return (
    <OwnerOnly what="rewards">
      <RewardsPage />
    </OwnerOnly>
  );
}
