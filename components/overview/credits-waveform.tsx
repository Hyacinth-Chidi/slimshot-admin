'use client';

import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ledgerLabel, type CreditDay } from '@/lib/api/credits';
import { cn } from '@/lib/cn';

const PLACEHOLDER_DAYS = 30;
const NUMBER = new Intl.NumberFormat('en-GB');

function formatDay(isoDate: string, withWeekday = false): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function typeLines(day: CreditDay): Array<{ type: string; text: string }> {
  return Object.entries(day.byType)
    .filter(([, v]) => v.granted > 0 || v.spent > 0)
    .map(([type, v]) => ({
      type,
      text: [v.granted > 0 && `+${NUMBER.format(v.granted)}`, v.spent > 0 && `−${NUMBER.format(v.spent)}`]
        .filter(Boolean)
        .join(' '),
    }));
}

/**
 * Credits per day in the uploads waveform's style: each day one column on a
 * centre baseline, granted rising above it and spent falling below, both on
 * one shared scale so their heights compare. Purple (the dashboard's chart
 * hue) is granted, orange is spent — a pair validated for colour-blind
 * separation on --surface; position and the legend carry it too.
 */
export function CreditsWaveform({
  days: input,
  refreshing = false,
}: {
  /** Zero-filled days from creditDays, oldest first; `undefined` while loading. */
  days: CreditDay[] | undefined;
  refreshing?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const loading = input === undefined;
  const days = input ?? [];
  const count = loading ? PLACEHOLDER_DAYS : days.length;
  const granted = days.reduce((sum, d) => sum + d.granted, 0);
  const spent = days.reduce((sum, d) => sum + d.spent, 0);
  const peak = Math.max(0, ...days.map((d) => Math.max(d.granted, d.spent)));
  const quiet = !loading && peak === 0;

  function move(to: number) {
    if (days.length === 0) return;
    setActive(Math.min(days.length - 1, Math.max(0, to)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const at = active ?? days.length - 1;
    const next =
      e.key === 'ArrowLeft' ? at - 1
      : e.key === 'ArrowRight' ? at + 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? days.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    move(next);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    move(Math.floor(((e.clientX - rect.left) / rect.width) * days.length));
  }

  const activeDay = active === null ? undefined : days[active];
  const anchor =
    active === null ? '' : active < days.length * 0.2 ? 'left' : active > days.length * 0.8 ? 'right' : 'center';

  return (
    <section aria-labelledby="credits-heading" className="rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="credits-heading" className="text-lg font-semibold text-text">
            {`Credits, last ${count} days`}
          </h2>
          {quiet ? (
            <p className="mt-1 text-sm text-muted">{`No credits moved in the last ${days.length} days.`}</p>
          ) : null}
        </div>
        {!loading ? (
          <ul aria-label="Legend" className="flex gap-5 text-sm">
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-sm bg-chart-bar" />
              <span className="text-muted">Granted</span>
              <span className="font-semibold tabular-nums text-text">{NUMBER.format(granted)}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-sm bg-chart-spent" />
              <span className="text-muted">Spent</span>
              <span className="font-semibold tabular-nums text-text">{NUMBER.format(spent)}</span>
            </li>
          </ul>
        ) : null}
      </div>

      <div className="relative mt-8">
        {activeDay && active !== null ? (
          <div
            data-testid="credits-readout"
            aria-live="polite"
            className={cn(
              'pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md border border-border bg-elevated px-2.5 py-1.5 whitespace-nowrap',
              anchor === 'center' && '-translate-x-1/2',
              anchor === 'right' && '-translate-x-full',
            )}
            style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
          >
            <p className="text-sm font-semibold text-text">
              {`granted ${NUMBER.format(activeDay.granted)} · spent ${NUMBER.format(activeDay.spent)}`}
            </p>
            <p className="text-xs text-muted">{formatDay(activeDay.date, true)}</p>
            {typeLines(activeDay).map((line) => (
              <p key={line.type} className="text-xs text-muted">
                {`${ledgerLabel(line.type)} ${line.text}`}
              </p>
            ))}
          </div>
        ) : null}

        <div
          aria-busy={loading || undefined}
          role={loading ? undefined : 'group'}
          aria-label={loading ? undefined : 'Credits per day. Use the arrow keys to move between days.'}
          tabIndex={loading || quiet ? undefined : 0}
          onFocus={() => active === null && move(days.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
          onPointerMove={loading || quiet ? undefined : onPointerMove}
          onPointerLeave={(e) => {
            if (document.activeElement !== e.currentTarget) setActive(null);
          }}
          className={cn(
            'relative h-44 rounded-md outline-none md:h-52',
            'focus-visible:ring-2 focus-visible:ring-[var(--brand-from)] focus-visible:ring-offset-4 focus-visible:ring-offset-surface',
            refreshing && 'opacity-60',
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" />
          {active !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-muted/60"
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            />
          ) : null}

          <div className="flex h-full" aria-hidden>
            {Array.from({ length: count }, (_, i) => {
              const day = days[i];
              const lit = i === active;
              return (
                <div
                  key={day?.date ?? i}
                  data-testid={loading ? undefined : 'credits-day'}
                  data-granted={day?.granted}
                  data-spent={day?.spent}
                  className="flex h-full flex-1 flex-col"
                >
                  <div className="flex h-1/2 items-end justify-center pb-px">
                    {day && day.granted > 0 ? (
                      <span
                        data-testid="granted-bar"
                        className={cn(
                          'block w-[min(55%,10px)] min-w-[2px] rounded-t-[4px]',
                          lit ? 'bg-chart-bar-active' : 'bg-chart-bar',
                        )}
                        style={{ height: `${(day.granted / peak) * 100}%`, minHeight: 4 }}
                      />
                    ) : null}
                  </div>
                  <div className="flex h-1/2 items-start justify-center pt-px">
                    {day && day.spent > 0 ? (
                      <span
                        data-testid="spent-bar"
                        className={cn(
                          'block w-[min(55%,10px)] min-w-[2px] rounded-b-[4px]',
                          lit ? 'bg-chart-spent-active' : 'bg-chart-spent',
                        )}
                        style={{ height: `${(day.spent / peak) * 100}%`, minHeight: 4 }}
                      />
                    ) : !day || day.granted === 0 ? (
                      <span className="-mt-[2px] block size-[3px] rounded-full bg-border" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!loading && days.length > 0 ? (
          <div className="mt-2 flex justify-between text-xs tabular-nums text-muted">
            <span>{formatDay(days[0].date)}</span>
            <span>Today</span>
          </div>
        ) : null}
      </div>

      {!loading ? (
        <table className="sr-only">
          <caption>Credits granted and spent per day, last {days.length} days</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Granted</th>
              <th scope="col">Spent</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>{formatDay(d.date, true)}</td>
                <td>{d.granted}</td>
                <td>{d.spent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
