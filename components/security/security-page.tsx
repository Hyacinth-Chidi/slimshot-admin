'use client';

import { useQuery } from '@tanstack/react-query';
import { SettingCard } from '@/components/credits/setting-card';
import { SIGN_IN_CODES_CARD } from '@/components/credits/setting-cards';
import { OwnerOnly } from '@/components/system/owner-only';
import { SystemHeader } from '@/components/system/system-header';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { fetchCreditSettings } from '@/lib/api/credits';
import { BlockedDomainsCard } from './blocked-domains-card';

/** System › Sign-in security: limits on email sign-in codes, and the blocked email domains. */
export function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <SystemHeader title="Sign-in security" subtitle="Limits on email sign-in codes, to stop abuse." />
      <OwnerOnly what="sign-in security">
        <SecurityCards />
      </OwnerOnly>
    </div>
  );
}

function SecurityCards() {
  const query = useQuery({ queryKey: ['credits', 'settings'], queryFn: fetchCreditSettings });

  if (query.isLoading) {
    return (
      <LoadingRegion label="Loading sign-in security" className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ))}
      </LoadingRegion>
    );
  }
  if (!query.data) {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
        <p className="text-sm text-muted">Couldn’t load the sign-in settings.</p>
        <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingCard spec={SIGN_IN_CODES_CARD} settings={query.data} live={null} />
      <BlockedDomainsCard settings={query.data} />
    </div>
  );
}
