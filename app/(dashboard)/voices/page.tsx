'use client';

import { PageHeader } from '@/components/shell/page-header';
import { OwnerOnly } from '@/components/system/owner-only';
import { VoicesPage } from '@/components/voices/voices-page';

export default function VoicesRoute() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader crumbs={[{ label: 'Library' }]} title="Voices" subtitle="The voices the app's Text to speech offers." />
      <OwnerOnly what="voices">
        <VoicesPage />
      </OwnerOnly>
    </div>
  );
}
