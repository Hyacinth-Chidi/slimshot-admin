'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ledgerLabel } from '@/lib/api/credits';
import { fetchUserLedger } from '@/lib/api/users';
import { cn } from '@/lib/cn';
import { formatCredits, formatDateTime, formatSigned } from './format';

const PAGE_LIMIT = 20;

/** A user's ledger, newest first: every credit added or taken, with the balance it left. */
export function CreditHistory({ userId }: { userId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['users', 'ledger', userId],
    queryFn: ({ pageParam }) => fetchUserLedger(userId, { cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = (query.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <section className="rounded-xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text md:px-6">Credit history</h2>

      {query.isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-subtle">Loading history…</p>
      ) : query.isLoadingError ? (
        <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-sm text-muted">Couldn’t load the credit history.</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-subtle">No credit history yet</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm text-text">{ledgerLabel(entry.type)}</p>
                <p className="text-xs text-subtle">{formatDateTime(entry.createdAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    'text-sm font-medium tabular-nums',
                    entry.amount > 0 ? 'text-success' : 'text-text',
                  )}
                >
                  {formatSigned(entry.amount)}
                </p>
                <p className="text-xs tabular-nums text-subtle">Balance {formatCredits(entry.balanceAfter)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center border-t border-border py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  );
}
