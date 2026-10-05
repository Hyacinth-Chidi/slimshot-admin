'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusPill } from '@/components/ui/status-pill';
import type { UserSummary } from '@/lib/api/users';
import { cn } from '@/lib/cn';
import { displayName, formatCredits, formatDate, userHref } from './format';

/** md and up. The whole row opens the user; the name is the real link for keyboards and screen readers. */
export function UserTable({ users, q }: { users: UserSummary[]; q?: string }) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Balance</th>
            <th className="px-4 py-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const href = userHref(user.id, q);
            return (
              <tr
                key={user.id}
                onClick={() => router.push(href)}
                className="cursor-pointer border-b border-border transition-colors duration-150 last:border-0 hover:bg-elevated"
              >
                <td className="px-4 py-3">
                  <Link href={href} className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <span className={cn('font-medium', user.username ? 'text-text' : 'text-muted')}>
                      {displayName(user)}
                    </span>
                    <span className="text-xs text-subtle">{user.email ?? '—'}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={user.accountStatus} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text">{formatCredits(user.creditBalance)}</td>
                <td className="px-4 py-3 text-muted">{formatDate(user.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
