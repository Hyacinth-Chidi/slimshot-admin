import { CircleAlert, Hourglass, Library, Radio, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface OverviewStats {
  total: number;
  published: number;
  processing: number;
  failed: number;
  totalBytes: number;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value < 10 && unit > 0 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded} ${UNITS[unit]}`;
}

function figure(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString('en-GB');
}

/** Each accent is a fixed identity per card; text never wears it. */
const ACCENTS = {
  violet: { chip: 'bg-accent-violet/15 text-accent-violet', fill: 'bg-accent-violet' },
  emerald: { chip: 'bg-accent-emerald/15 text-accent-emerald', fill: 'bg-accent-emerald' },
  amber: { chip: 'bg-accent-amber/15 text-accent-amber', fill: 'bg-accent-amber' },
  rose: { chip: 'bg-accent-rose/15 text-accent-rose', fill: 'bg-accent-rose' },
  quiet: { chip: 'bg-elevated text-subtle', fill: 'bg-subtle' },
} as const;

function StatCard({
  id,
  label,
  value,
  icon: Icon,
  accent,
  alarming = false,
  children,
}: {
  id: string;
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  alarming?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      data-testid={`stat-${id}`}
      data-tone={alarming ? 'error' : 'default'}
      className={cn(
        'flex min-w-0 flex-col rounded-xl border bg-surface p-4 md:p-5',
        alarming ? 'border-accent-rose/50' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span
          aria-hidden
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', ACCENTS[accent].chip)}
        >
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-text md:text-[32px]">
        {figure(value)}
      </p>
      <div className="mt-3 min-h-5 text-xs text-muted">{value === undefined ? null : children}</div>
    </div>
  );
}

/**
 * The library at a glance, above the uploads chart. Each card carries one
 * accent as its identity; the Failed card stays quiet until something fails,
 * then gains the rose accent and a link to the failed assets.
 */
export function StatCards({ stats }: { stats: OverviewStats | undefined }) {
  const share = stats && stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
  const failed = stats?.failed ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard id="total" label="Total assets" value={stats?.total} icon={Library} accent="violet">
        {stats && stats.totalBytes > 0 ? `${formatBytes(stats.totalBytes)} stored` : 'No files stored yet'}
      </StatCard>

      <StatCard id="published" label="Live in the app" value={stats?.published} icon={Radio} accent="emerald">
        {stats && stats.published > 0 ? (
          <div className="flex flex-col gap-2">
            <span>{share}% of the library</span>
            <div
              role="meter"
              aria-label="Live in the app, share of the library"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share}
              className="h-1.5 overflow-hidden rounded-full bg-elevated"
            >
              <div className={cn('h-full rounded-full', ACCENTS.emerald.fill)} style={{ width: `${share}%` }} />
            </div>
          </div>
        ) : (
          'Nothing published yet'
        )}
      </StatCard>

      <StatCard id="processing" label="Processing" value={stats?.processing} icon={Hourglass} accent="amber">
        {stats && stats.processing > 0 ? 'In progress now' : 'Nothing in progress'}
      </StatCard>

      <StatCard
        id="failed"
        label="Failed"
        value={stats?.failed}
        icon={CircleAlert}
        accent={failed > 0 ? 'rose' : 'quiet'}
        alarming={failed > 0}
      >
        {failed > 0 ? (
          <Link
            href="/assets?status=failed"
            className="-my-3 inline-flex h-11 items-center font-medium text-text underline underline-offset-4 md:my-0 md:h-auto"
          >
            Review failed assets
          </Link>
        ) : (
          'Nothing failed'
        )}
      </StatCard>
    </div>
  );
}
