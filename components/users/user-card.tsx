import Link from 'next/link';
import { StatusPill } from '@/components/ui/status-pill';
import type { UserSummary } from '@/lib/api/users';
import { cn } from '@/lib/cn';
import { displayName, formatCredits, userHref } from './format';

/** Below md: the whole card is the link, a 44px+ target. */
export function UserCard({ user, q }: { user: UserSummary; q?: string }) {
  return (
    <Link
      href={userHref(user.id, q)}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 active:bg-elevated"
    >
      <div className="min-w-0">
        <p className={cn('truncate text-sm font-medium', user.username ? 'text-text' : 'text-muted')}>
          {displayName(user)}
        </p>
        <p className="truncate text-xs text-subtle">{user.email ?? '—'}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm tabular-nums text-text">{formatCredits(user.creditBalance)}</span>
        <StatusPill status={user.accountStatus} />
      </div>
    </Link>
  );
}
