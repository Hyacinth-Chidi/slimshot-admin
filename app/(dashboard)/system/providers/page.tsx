'use client';

import { ProvidersTab } from '@/components/settings/providers-tab';
import { OwnerOnly } from '@/components/system/owner-only';
import { SystemHeader } from '@/components/system/system-header';

export default function ProvidersPage() {
  return (
    <div className="flex flex-col gap-6">
      <SystemHeader title="AI providers" />
      <OwnerOnly what="AI providers">
        <ProvidersTab />
      </OwnerOnly>
    </div>
  );
}
