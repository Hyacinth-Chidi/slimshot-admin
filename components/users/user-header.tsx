import { StatusPill } from '@/components/ui/status-pill';
import type { UserDetail } from '@/lib/api/users';
import { cn } from '@/lib/cn';
import { displayName, formatCredits, formatDate } from './format';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="truncate text-sm text-text">{children}</dd>
    </div>
  );
}

export function UserHeader({ user }: { user: UserDetail }) {
  const methods = [
    ...(user.signInMethods.google ? ['Google'] : []),
    ...(user.signInMethods.email ? ['Email'] : []),
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={cn('truncate text-xl font-semibold', user.username ? 'text-text' : 'text-muted')}>
              {displayName(user)}
            </h1>
            <StatusPill status={user.accountStatus} />
          </div>
          <p className="mt-1 truncate text-sm text-muted">{user.email ?? '—'}</p>
          {methods.length > 0 && (
            <ul aria-label="Sign-in methods" className="mt-3 flex gap-2">
              {methods.map((method) => (
                <li
                  key={method}
                  className="rounded-full border border-border bg-elevated px-2 py-0.5 text-xs text-muted"
                >
                  {method}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:text-right">
          <p className="text-xs text-subtle">Balance</p>
          <p className="text-3xl font-semibold tabular-nums text-text">{formatCredits(user.creditBalance)}</p>
          <p className="text-xs text-subtle">credits</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
        <Fact label="Joined">{formatDate(user.createdAt)}</Fact>
        <Fact label="Claimed">{user.claimedAt ? formatDate(user.claimedAt) : 'Not yet'}</Fact>
        <Fact label="Referral code">
          <span className="font-mono">{user.referralCode ?? '—'}</span>
        </Fact>
        {user.deletedAt && <Fact label="Deleted">Deleted on {formatDate(user.deletedAt)}</Fact>}
      </dl>
    </section>
  );
}
