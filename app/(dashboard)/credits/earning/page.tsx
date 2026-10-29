'use client';

import { EarningPage } from '@/components/credits/earning-page';
import { OwnerOnly } from '@/components/system/owner-only';

export default function CreditsEarningRoute() {
  return (
    <OwnerOnly what="earning">
      <EarningPage />
    </OwnerOnly>
  );
}
