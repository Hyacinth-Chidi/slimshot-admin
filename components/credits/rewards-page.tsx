'use client';

import { useQuery } from '@tanstack/react-query';
import { BalanceCheck } from '@/components/settings/balance-check';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { fetchCreditSettings, fetchPricingRules } from '@/lib/api/credits';
import { CreditsBySource } from './credits-by-source';
import { CreditsHeader } from './credits-header';
import { SettingCard } from './setting-card';
import { REWARD_CARDS } from './setting-cards';

/**
 * Credits › Rewards: the free credits users get (sign-up bonus, ads, referrals),
 * one card per way, each saving on its own. Not "Earnings": that name is kept
 * for revenue, once payments exist.
 */
export function RewardsPage() {
  const settingsQuery = useQuery({ queryKey: ['credits', 'settings'], queryFn: fetchCreditSettings });
  const rulesQuery = useQuery({ queryKey: ['pricing', 'auto_captions'], queryFn: () => fetchPricingRules('auto_captions') });
  const live = rulesQuery.data?.find((r) => r.isActive) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <CreditsHeader
        title="Rewards"
        subtitle="Free credits users get from the sign-up bonus, ads and referrals. Each card saves on its own."
      />

      {settingsQuery.isLoading ? (
        <LoadingRegion label="Loading credit settings" className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="mt-4 h-8 w-full" />
            </div>
          ))}
        </LoadingRegion>
      ) : settingsQuery.data ? (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          {REWARD_CARDS.map((spec) => (
            <SettingCard key={spec.id} spec={spec} settings={settingsQuery.data} live={live} />
          ))}
        </div>
      ) : (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
          <p className="text-sm text-muted">Couldn’t load the credit settings.</p>
          <Button variant="secondary" size="sm" onClick={() => settingsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <CreditsBySource />

      <BalanceCheck />
    </div>
  );
}
