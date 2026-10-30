'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { creditDays, fetchCreditStats, type CreditDay } from '@/lib/api/credits';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const DAYS = 30;
const NUMBER = new Intl.NumberFormat('en-GB');

/**
 * Four distinct hues, not shades of one: these are identities, not amounts.
 * Ads keep the dashboard's chart purple. Validated with the dataviz palette
 * check against --surface (#18181B), all pairs: CVD ΔE ≥ 8.4, normal ≥ 16.1,
 * every hue ≥ 3:1. Orange is left out: elsewhere it means credits spent.
 */
const SOURCES = [
  { key: 'ads', label: 'Ads', color: '#A855F7', types: ['rewarded_ad'] },
  { key: 'signup', label: 'Sign-up', color: '#199e70', types: ['signup_bonus'] },
  { key: 'referrals', label: 'Referrals', color: '#c98500', types: ['referral_inviter', 'referral_invitee'] },
  { key: 'daily', label: 'Daily', color: '#2F9AD6', types: ['daily_reward'] },
] as const;

type SourceKey = (typeof SOURCES)[number]['key'];
type SourceDay = { date: string } & Record<SourceKey, number>;

function bySource(day: CreditDay): SourceDay {
  const out = { date: day.date } as SourceDay;
  for (const source of SOURCES) {
    out[source.key] = source.types.reduce((sum, type) => sum + (day.byType[type]?.granted ?? 0), 0);
  }
  return out;
}

const dayLabel = (date: string) => formatDate(`${date}T00:00:00Z`, 'UTC');

/** Credits given to users each day of the last 30, stacked by where they came from. */
export function CreditsBySource() {
  const query = useQuery({ queryKey: ['stats', 'credits', DAYS], queryFn: () => fetchCreditStats(DAYS) });
  const [active, setActive] = useState<number | null>(null);

  const days = query.data ? creditDays(query.data, DAYS).map(bySource) : [];
  const totals = Object.fromEntries(
    SOURCES.map((s) => [s.key, days.reduce((sum, d) => sum + d[s.key], 0)]),
  ) as Record<SourceKey, number>;
  const peak = Math.max(0, ...days.map((d) => SOURCES.reduce((sum, s) => sum + d[s.key], 0)));

  const move = (to: number) => days.length > 0 && setActive(Math.min(days.length - 1, Math.max(0, to)));
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = active ?? days.length - 1;
    const next =
      e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? days.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    move(next);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) move(Math.floor(((e.clientX - rect.left) / rect.width) * days.length));
  }
  const activeDay = active === null ? undefined : days[active];

  return (
    <section aria-labelledby="by-source" className="rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="by-source" className="text-[15px] font-semibold text-text">
            Last 30 days
          </h2>
          <p className="mt-0.5 text-xs text-muted">Credits given to users, by where they came from.</p>
        </div>
        {query.data && (
          <ul aria-label="Sources" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {SOURCES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                {`${s.label} ${NUMBER.format(totals[s.key])}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 py-4">
        {query.isLoading ? (
          <LoadingRegion label="Loading credits by source">
            <Skeleton className="h-28 w-full" />
          </LoadingRegion>
        ) : query.isError ? (
          <p className="text-sm text-muted">Couldn’t load where credits came from.</p>
        ) : (
          <>
            <p className="sr-only">
              {`Over the last 30 days users got ${NUMBER.format(totals.ads)} credits from ads, ${NUMBER.format(totals.signup)} from sign-up bonuses, ${NUMBER.format(totals.referrals)} from referrals and ${NUMBER.format(totals.daily)} from daily credits.`}
            </p>

            <div className="relative">
              <div
                role="group"
                aria-label="Credits given each day"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onFocus={() => active === null && move(days.length - 1)}
                onBlur={() => setActive(null)}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setActive(null)}
                className="flex h-28 items-end gap-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]"
              >
                {days.map((day, i) => {
                  const total = SOURCES.reduce((sum, s) => sum + day[s.key], 0);
                  const present = SOURCES.filter((s) => day[s.key] > 0);
                  return (
                    <div
                      key={day.date}
                      data-testid="source-day"
                      className={cn('flex h-full flex-1 flex-col items-center justify-end', active === i && 'rounded-sm bg-elevated/60')}
                    >
                      {/* Stacked from the baseline: square at the bottom, 4px round at the top, 2px of surface between segments. */}
                      <div
                        className="flex w-full max-w-6 flex-col-reverse gap-0.5"
                        style={{ height: peak > 0 ? `${(total / peak) * 100}%` : 0 }}
                      >
                        {present.map((s, j) => (
                          <div
                            key={s.key}
                            className={cn('w-full', j === present.length - 1 && 'rounded-t')}
                            style={{ flexGrow: day[s.key], flexBasis: 0, background: s.color, minHeight: 2 }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-subtle">
                <span>{days[0] ? dayLabel(days[0].date) : ''}</span>
                <span>Today</span>
              </div>

              {activeDay && (
                <div
                  data-testid="source-readout"
                  aria-live="polite"
                  className="pointer-events-none absolute -top-2 right-0 min-w-40 rounded-lg border border-border bg-elevated px-3 py-2 text-xs shadow-none"
                >
                  <p className="mb-1 text-subtle">
                    {dayLabel(activeDay.date)}
                    <span className="sr-only">: </span>
                  </p>
                  {SOURCES.map((s) => (
                    <p key={s.key} className="flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                      <strong className="font-semibold tabular-nums text-text">{NUMBER.format(activeDay[s.key])}</strong>{' '}
                      <span className="text-muted">{s.label}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* sr-only on a div, not the table: a table can't shrink below its rows' height,
                so it would leave an invisible ~770px box below the page and the window would scroll into it. */}
            <div className="sr-only">
              <table>
                <caption>Credits given each day, by source</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    {SOURCES.map((s) => (
                      <th key={s.key} scope="col">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{dayLabel(day.date)}</th>
                      {SOURCES.map((s) => (
                        <td key={s.key}>{NUMBER.format(day[s.key])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
