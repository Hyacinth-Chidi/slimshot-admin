'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MoreHorizontal, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import {
  coverage,
  describeCoverage,
  describeLength,
  describePrice,
  priceFor,
  SAMPLE_SECONDS,
  type RuleLike,
} from '@/components/settings/pricing-format';
import {
  fetchCreditSettings,
  fetchCreditStats,
  fetchPricingRules,
  type CreditStatsRow,
  type PricingRule,
} from '@/lib/api/credits';
import { formatDate } from '@/lib/format';
import { ChangePriceSheet } from './change-price-sheet';
import { CreditsHeader } from './credits-header';
import { MakeLiveDialog } from './make-live-dialog';

const NUMBER = new Intl.NumberFormat('en-GB');
const STATS_DAYS = 30;

/** "pays for up to 1 min of captions", or the any-length / none forms. */
function adSentence(rule: RuleLike, credits: number): string {
  const covers = coverage(rule, credits);
  if (covers === Infinity) return `One rewarded ad (${credits} credits) pays for captions of any length.`;
  if (covers === null) return `One rewarded ad (${credits} credits) doesn't cover a caption job.`;
  return `One rewarded ad (${credits} credits) pays for up to ${describeCoverage(covers)} of captions.`;
}

function bonusSentence(rule: RuleLike, credits: number): string {
  const covers = coverage(rule, credits);
  if (covers === Infinity) return `The ${credits}-credit sign-up bonus covers captions of any length.`;
  if (covers === null) return `The ${credits}-credit sign-up bonus doesn't cover a caption job.`;
  return `The ${credits}-credit sign-up bonus covers ${describeCoverage(covers)}.`;
}

function captionTotals(rows: CreditStatsRow[]): { charged: number; refunded: number } {
  let charged = 0;
  let refunded = 0;
  for (const row of rows) {
    if (row.type === 'feature_charge') charged += row.spent;
    if (row.type === 'feature_refund') refunded += row.granted;
  }
  return { charged, refunded };
}

/** Credits › Pricing: what Auto captions costs, in words, and every price it has had. */
export function PricingPage() {
  const rulesQuery = useQuery({ queryKey: ['pricing', 'auto_captions'], queryFn: () => fetchPricingRules('auto_captions') });
  const settingsQuery = useQuery({ queryKey: ['credits', 'settings'], queryFn: fetchCreditSettings });
  const statsQuery = useQuery({ queryKey: ['stats', 'credits', STATS_DAYS], queryFn: () => fetchCreditStats(STATS_DAYS) });

  const [sheet, setSheet] = useState<{ open: boolean; startFrom: PricingRule | null }>({ open: false, startFrom: null });
  const [confirming, setConfirming] = useState<PricingRule | null>(null);

  const rules = rulesQuery.data ?? [];
  const live = rules.find((r) => r.isActive) ?? null;
  const nextVersion = rules.reduce((max, r) => Math.max(max, r.version), 0) + 1;
  const adRewardCredits = settingsQuery.data?.adRewardCredits ?? null;

  return (
    <div className="flex flex-col gap-6">
      <CreditsHeader
        title="Pricing"
        subtitle="What each paid feature costs in the app."
        actions={
          rulesQuery.isSuccess ? (
            <Button variant="primary" onClick={() => setSheet({ open: true, startFrom: null })}>
              {live ? 'Change price' : 'Set a price'}
            </Button>
          ) : null
        }
      />

      {rulesQuery.isLoading ? (
        <PricingSkeleton />
      ) : rulesQuery.isLoadingError ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
          <p className="text-sm text-muted">Couldn’t load the prices.</p>
          <Button variant="secondary" size="sm" onClick={() => rulesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="live-price" className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-4 md:px-6">
              <div className="flex items-center gap-2">
                <h2 id="live-price" className="text-[15px] font-semibold text-text">
                  Auto captions
                </h2>
                {live && (
                  <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Live
                  </span>
                )}
              </div>
              {live && (
                <p className="mt-1 text-xs text-muted">
                  {[
                    `Version ${live.version}`,
                    `live since ${formatDate(live.activatedAt ?? live.createdAt)}`,
                    live.createdBy ? `set by ${live.createdBy.email}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>

            {live ? (
              <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
                <p className="text-[17px] font-medium text-text">{describePrice(live)}</p>
                <div>
                  <p className="mb-2 text-xs text-subtle">What a clip costs</p>
                  <ul
                    aria-label="What a clip costs"
                    className="grid grid-cols-3 overflow-hidden rounded-xl border border-border md:grid-cols-6"
                  >
                    {SAMPLE_SECONDS.map((seconds) => (
                      <li
                        key={seconds}
                        className="flex flex-col items-center gap-1 border-border px-2 py-3 not-last:border-r max-md:[&:nth-child(3)]:border-r-0 max-md:[&:nth-child(-n+3)]:border-b"
                      >
                        <span className="text-xs text-muted">{describeLength(seconds)}</span>
                        <span className="text-xl font-semibold tabular-nums text-text">
                          {NUMBER.format(priceFor(live, seconds))}
                          <small className="ml-0.5 text-[11px] font-normal text-subtle"> cr</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {settingsQuery.data && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-[var(--brand-from)]/25 bg-[var(--brand-from)]/[0.08] px-3.5 py-3 text-sm text-[#E9D5FF]">
                    <Scale size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      <span>
                        {`${adSentence(live, settingsQuery.data.adRewardCredits)} ${bonusSentence(live, settingsQuery.data.signupBonusCredits)}`}
                      </span>{' '}
                      <Link href="/credits/rewards" className="text-[#D8B4FE] underline-offset-2 hover:underline">
                        Change the rewards →
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2.5 px-4 py-5 text-sm text-warning md:px-6">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>No price is live, so Auto captions is off in the app.</p>
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-border px-4 py-3 text-xs text-subtle md:flex-row md:justify-between md:px-6">
              {statsQuery.data ? (
                <span>
                  {(() => {
                    const { charged, refunded } = captionTotals(statsQuery.data);
                    return `Last 30 days: ${NUMBER.format(charged)} credits charged · ${NUMBER.format(refunded)} refunded for failed jobs`;
                  })()}
                </span>
              ) : (
                <span />
              )}
              <span>Prices are versioned: a change never alters past charges.</span>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-4 md:px-6">
              <h2 className="text-[15px] font-semibold text-text">Price history</h2>
              <p className="mt-0.5 text-xs text-muted">Every price, newest first.</p>
            </div>
            {rules.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-subtle">No prices yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table aria-label="Price history" className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-subtle">
                      <th scope="col" className="px-4 py-2.5 font-medium md:px-6">
                        Version
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Price
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                        Reason
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                        Made live
                      </th>
                      <th scope="col" className="w-12 px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-text md:px-6">
                          {`v${rule.version}`}
                          {rule.isActive && (
                            <span className="ml-2 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              Live
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text">{describePrice(rule)}</td>
                        <td className="hidden px-4 py-3 text-muted md:table-cell">{rule.note || '—'}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-muted md:table-cell">
                          {rule.activatedAt ? formatDate(rule.activatedAt) : 'Never live'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!rule.isActive && (
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label={`Actions for v${rule.version}`}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setConfirming(rule)}>
                                  {rule.activatedAt ? 'Make live again…' : 'Make live…'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSheet({ open: true, startFrom: rule })}>
                                  Start a new price from this
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <ChangePriceSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
        live={live}
        startFrom={sheet.startFrom}
        nextVersion={nextVersion}
        adRewardCredits={adRewardCredits}
      />
      <MakeLiveDialog rule={confirming} live={live} adRewardCredits={adRewardCredits} onClose={() => setConfirming(null)} />
    </div>
  );
}

function PricingSkeleton() {
  return (
    <LoadingRegion label="Loading prices" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-96 max-w-full" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </LoadingRegion>
  );
}
