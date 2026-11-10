'use client';

import { AlertTriangle } from 'lucide-react';
import {
  costRows,
  coverage,
  describeCoverage,
  FEATURE_PRICING,
  largestIncreasePct,
  type RuleLike,
} from '@/components/settings/pricing-format';
import type { CreditFeature } from '@/lib/api/credits';
import { cn } from '@/lib/cn';

const NUMBER = new Intl.NumberFormat('en-GB');

/**
 * What the six sample sizes — clip lengths, or request sizes in characters —
 * cost now and under another price, with rises and falls marked, and a
 * warning when anything costs more. Used wherever a price is about to go
 * live, so no price goes live unseen.
 */
export function CostComparison({
  feature = 'auto_captions',
  now,
  nowLabel,
  next,
  nextLabel,
  adRewardCredits,
}: {
  feature?: CreditFeature;
  now: RuleLike | null;
  nowLabel: string;
  next: RuleLike | null;
  nextLabel: string;
  adRewardCredits: number | null;
}) {
  const profile = FEATURE_PRICING[feature];
  const rows = costRows(now, next, profile.samples);
  const rise = largestIncreasePct(rows);
  const amountOf = (n: number | null) => describeCoverage(n, profile.describeAmount);

  let adLine = '';
  if (rise !== null && now && next && adRewardCredits !== null) {
    const before = coverage(now, adRewardCredits);
    const after = coverage(next, adRewardCredits);
    if (after === null && before !== null) {
      const today = before === Infinity ? `${profile.covered} of any length` : `${amountOf(before)} of ${profile.covered}`;
      adLine = ` One rewarded ad would no longer cover ${profile.aJob}; today it pays for ${today}.`;
    } else if (before !== after) {
      adLine = ` One rewarded ad would pay for ${amountOf(after)} of ${profile.covered} instead of ${amountOf(before)}.`;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-left text-xs text-subtle">{`What ${profile.Jobs.toLowerCase()} will cost`}</caption>
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                {profile.job.charAt(0).toUpperCase() + profile.job.slice(1)}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {nowLabel}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {nextLabel}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const change =
                row.now === null || row.next === null ? 'none' : row.next > row.now ? 'up' : row.next < row.now ? 'down' : 'same';
              return (
                <tr key={row.amount}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-text">
                    {profile.describeAmount(row.amount)}
                  </th>
                  <td className="px-4 py-2 text-right tabular-nums text-text">
                    {row.now === null ? '—' : NUMBER.format(row.now)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      change === 'up' && 'font-semibold text-[#FDBA74]',
                      change === 'down' && 'font-semibold text-success',
                      (change === 'same' || change === 'none') && 'text-muted',
                    )}
                  >
                    {row.next === null ? '—' : NUMBER.format(row.next)}
                    {change === 'up' && ' ↑'}
                    {change === 'down' && ' ↓'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rise !== null && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#FDE68A]"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{`${profile.Jobs} cost up to ${rise}% more.${adLine}`}</p>
        </div>
      )}
    </div>
  );
}
