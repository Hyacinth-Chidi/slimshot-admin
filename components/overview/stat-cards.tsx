import { Coins, Library, Radio, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface OverviewStats {
  total: number;
  published: number;
  failed: number;
  totalBytes: number;
}

/** The accounts that exist, deleted ones left out, and how many joined in the last 7 days. */
export interface OverviewUsers {
  total: number;
  thisWeek: number;
}

/** Credits used on paid features and free credits handed out, over the last [days] days. */
export interface OverviewCredits {
  spent: number;
  given: number;
  days: number;
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
  sky: { chip: 'bg-accent-sky/15 text-accent-sky', fill: 'bg-accent-sky' },
  amber: { chip: 'bg-accent-amber/15 text-accent-amber', fill: 'bg-accent-amber' },
} as const;

function StatCard({
  id,
  label,
  value,
  icon: Icon,
  accent,
  alarming = false,
  href,
  children,
}: {
  id: string;
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  alarming?: boolean;
  /** The whole card opens this page. A card holding a link of its own must not take one. */
  href?: string;
  children?: ReactNode;
}) {
  const className = cn(
    'flex min-w-0 flex-col rounded-xl border bg-surface p-4 md:p-5',
    alarming ? 'border-accent-rose/50' : 'border-border',
    href &&
      'transition-colors hover:border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]',
  );
  const body = (
    <>
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
    </>
  );
  const tone = alarming ? 'error' : 'default';

  return href ? (
    <Link href={href} data-testid={`stat-${id}`} data-tone={tone} className={className}>
      {body}
    </Link>
  ) : (
    <div data-testid={`stat-${id}`} data-tone={tone} className={className}>
      {body}
    </div>
  );
}

/**
 * The app at a glance, above the uploads chart: the library, what of it is
 * live, the users, and the credits spent. Each card carries one accent as its
 * identity. Users and Credits spent open their pages. Total assets stays calm
 * until an upload fails, then takes the rose border and links to the failed
 * assets: the Failed card that used to say so sat at 0 nearly always.
 */
export function StatCards({
  stats,
  users,
  credits,
}: {
  stats: OverviewStats | undefined;
  users?: OverviewUsers;
  credits?: OverviewCredits;
}) {
  const share = stats && stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
  const failed = stats?.failed ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatCard id="total" label="Total assets" value={stats?.total} icon={Library} accent="violet" alarming={failed > 0}>
        <span>{stats && stats.totalBytes > 0 ? `${formatBytes(stats.totalBytes)} stored` : 'No files stored yet'}</span>
        {failed > 0 ? (
          <>
            {' · '}
            <Link
              href="/audio?status=failed"
              aria-label={`Review ${figure(failed)} failed ${failed === 1 ? 'asset' : 'assets'}`}
              className="-my-3 inline-flex h-11 items-center font-medium text-text underline underline-offset-4 md:my-0 md:h-auto"
            >
              {figure(failed)} failed
            </Link>
          </>
        ) : null}
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

      <StatCard id="users" label="Users" value={users?.total} icon={Users} accent="sky" href="/users">
        {users && users.thisWeek > 0 ? `+${figure(users.thisWeek)} this week` : 'No sign-ups this week'}
      </StatCard>

      <StatCard
        id="credits"
        label="Credits spent"
        value={credits?.spent}
        icon={Coins}
        accent="amber"
        href="/credits/pricing"
      >
        {credits
          ? credits.given > 0
            ? `Last ${credits.days} days · ${figure(credits.given)} given`
            : `Last ${credits.days} days`
          : null}
      </StatCard>
    </div>
  );
}
