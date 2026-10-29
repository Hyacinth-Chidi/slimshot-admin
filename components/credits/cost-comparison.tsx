'use client';

import { AlertTriangle } from 'lucide-react';
import {
  costRows,
  coverage,
  describeCoverage,
  describeLength,
  largestIncreasePct,
  type RuleLike,
} from '@/components/settings/pricing-format';
import { cn } from '@/lib/cn';

const NUMBER = new Intl.NumberFormat('en-GB');

/**
 * What the six sample clip lengths cost now and under another price, with
 * rises and falls marked, and a warning when anything costs more. Used
 * wherever a price is about to go live, so no price goes live unseen.
 */
export function CostComparison({
  now,
  nowLabel,
  next,
  nextLabel,
  adRewardCredits,
}: {
  now: RuleLike | null;
  nowLabel: string;
  next: RuleLike | null;
  nextLabel: string;
  adRewardCredits: number | null;
}) {
  const rows = costRows(now, next);
  const rise = largestIncreasePct(rows);

  let adLine = '';
  if (rise !== null && now && next && adRewardCredits !== null) {
    const before = coverage(now, adRewardCredits);
    const after = coverage(next, adRewardCredits);
    if (before !== after) {
      adLine = ` One rewarded ad would pay for ${describeCoverage(after)} of captions instead of ${describeCoverage(before)}.`;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-left text-xs text-subtle">What clips will cost</caption>
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Clip
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
                <tr key={row.seconds}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-text">
                    {describeLength(row.seconds)}
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
          <p>{`Clips cost up to ${rise}% more.${adLine}`}</p>
        </div>
      )}
    </div>
  );
}
