'use client';

import type { ReactNode } from 'react';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/lib/auth/profile';

/**
 * Owner-only content mounts only for the owner, so a non-owner never fires
 * its queries. The server refuses them anyway; this keeps the page honest.
 */
export function OwnerOnly({ what, children }: { what: string; children: ReactNode }) {
  const profile = useProfile();

  if (profile.isLoading) {
    return (
      <LoadingRegion label={`Loading ${what}`} className="flex flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </LoadingRegion>
    );
  }
  if (profile.isError) {
    return <p className="text-sm text-error">Could not load your profile. Reload the page to try again.</p>;
  }
  if (profile.data?.role !== 'owner') {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-text">Only the owner can manage {what}.</p>
      </div>
    );
  }
  return <>{children}</>;
}
