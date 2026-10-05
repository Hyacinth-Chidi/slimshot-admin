'use client';

import Link from 'next/link';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { UploadPoint } from '@/lib/api/stats';
import { cn } from '@/lib/cn';

const PLACEHOLDER_DAYS = 30;

function formatDay(isoDate: string, withWeekday = false): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function uploads(n: number): string {
  if (n === 0) return 'No uploads';
  return `${n.toLocaleString('en-GB')} ${n === 1 ? 'upload' : 'uploads'}`;
}

/**
 * Uploads per day, drawn the way an audio clip's waveform looks: one thin
 * column per day, quiet days as small "silence" marks, and a playhead that
 * follows the pointer or the arrow keys. `points` is the zero-filled series,
 * oldest first and ending today; `undefined` means it is still loading.
 */
export function UploadWaveform({
  points,
  refreshing = false,
}: {
  points: UploadPoint[] | undefined;
  /** A refetch is in flight: keep the last render, dimmed, instead of a skeleton. */
  refreshing?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const loading = points === undefined;
  const days = points ?? [];
  const count = loading ? PLACEHOLDER_DAYS : days.length;
  const total = days.reduce((sum, p) => sum + p.count, 0);
  const peak = Math.max(0, ...days.map((p) => p.count));

  const heading = loading
    ? `Uploads, last ${PLACEHOLDER_DAYS} days`
    : total === 0
      ? `No uploads in the last ${days.length} days`
      : `${uploads(total)} in the last ${days.length} days`;

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
  // Keep the readout inside the panel near either edge.
  const anchor =
    active === null ? '' : active < days.length * 0.2 ? 'left' : active > days.length * 0.8 ? 'right' : 'center';

  return (
    <section
      aria-labelledby="uploads-heading"
      className="rounded-xl border border-border bg-surface p-4 md:p-6"
    >
      <h2
        id="uploads-heading"
        className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text md:text-[28px]"
      >
        {heading}
      </h2>

      {!loading && total === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Uploaded audio shows up here, one column per day.{' '}
          <Link
            href="/assets"
            className="inline-flex h-11 items-center font-medium text-text underline underline-offset-4 md:h-auto"
          >
            Upload audio
          </Link>
        </p>
      ) : null}

      <div className="relative mt-8">
        {activeDay && active !== null ? (
          <div
            data-testid="waveform-tooltip"
            aria-live="polite"
            className={cn(
              'pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md border border-border bg-elevated px-2.5 py-1.5 whitespace-nowrap',
              anchor === 'center' && '-translate-x-1/2',
              anchor === 'right' && '-translate-x-full',
            )}
            style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
          >
            <p className="text-sm font-semibold text-text">{uploads(activeDay.count)}</p>
            <p className="text-xs text-muted">{formatDay(activeDay.date, true)}</p>
          </div>
        ) : null}

        <div
          data-testid="waveform-plot"
          aria-busy={loading || undefined}
          role={loading ? undefined : 'group'}
          aria-label={loading ? undefined : 'Uploads per day. Use the arrow keys to move between days.'}
          tabIndex={loading || total === 0 ? undefined : 0}
          onFocus={() => active === null && move(days.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
          onPointerMove={loading || total === 0 ? undefined : onPointerMove}
          onPointerLeave={(e) => {
            if (document.activeElement !== e.currentTarget) setActive(null);
          }}
          className={cn(
            'relative h-36 rounded-md outline-none md:h-44',
            'focus-visible:ring-2 focus-visible:ring-[var(--brand-from)] focus-visible:ring-offset-4 focus-visible:ring-offset-surface',
            refreshing && 'opacity-60',
          )}
        >
          {/* The peak, labelled once: every other value is in the tooltip and the table. */}
          {peak > 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border">
              {/* Above the line, never on it: the peak bar ends exactly here. */}
              <span className="absolute -top-5 right-0 text-xs tabular-nums text-muted">
                {peak.toLocaleString('en-GB')}
              </span>
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" />

          {active !== null ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-muted/60"
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            />
          ) : null}

          <div className="flex h-full items-end" aria-hidden>
            {Array.from({ length: count }, (_, i) => {
              const day = days[i];
              const silent = !day || day.count === 0;
              return (
                <div
                  key={day?.date ?? i}
                  data-testid={loading ? undefined : 'waveform-day'}
                  data-silent={silent || undefined}
                  className="flex h-full flex-1 items-end justify-center pb-px"
                >
                  {silent ? (
                    <span className="mb-[3px] block size-[3px] rounded-full bg-border" />
                  ) : (
                    <span
                      data-bar
                      className={cn(
                        'block w-[min(55%,10px)] min-w-[2px] rounded-t-[4px]',
                        i === active ? 'bg-chart-bar-active' : 'bg-chart-bar',
                      )}
                      style={{ height: `${(day.count / peak) * 100}%`, minHeight: 4 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {!loading && days.length > 0 ? (
          <div
            data-testid="waveform-axis"
            className="mt-2 flex justify-between text-xs tabular-nums text-muted"
          >
            <span>{formatDay(days[0].date)}</span>
            <span>Today</span>
          </div>
        ) : null}
      </div>

      {!loading ? (
        // sr-only on a div, not the table: a table can't shrink below its rows'
        // height, so it would leave an invisible ~600px box that lengthens the page.
        <div className="sr-only">
          <table>
            <caption>Uploads per day, last {days.length} days</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Uploads</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{formatDay(d.date, true)}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
