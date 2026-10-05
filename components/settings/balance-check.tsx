'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { checkBalances } from '@/lib/api/credits';

/** Runs the server's balance check on demand: never on mount, it reads every user. */
export function BalanceCheck() {
  const mutation = useMutation({ mutationFn: () => checkBalances() });
  const mismatches = mutation.data?.mismatches;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
      <div>
        <h3 className="text-sm font-semibold text-text">Balance check</h3>
        <p className="mt-1 text-sm text-muted">
          Compares every user&apos;s balance with the sum of their credit history. The server also runs this
          check daily and never corrects a mismatch by itself.
        </p>
      </div>

      <div>
        <Button variant="secondary" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Checking…' : 'Check balances'}
        </Button>
      </div>

      {mutation.isError ? (
        <p role="alert" className="text-sm text-error">
          {mutation.error instanceof Error ? mutation.error.message : 'The check could not run.'}
        </p>
      ) : mismatches === undefined ? null : mismatches.length === 0 ? (
        <p className="text-sm text-success">Every balance matches its history</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-error/30">
          {mismatches.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <Link href={`/users/${encodeURIComponent(m.userId)}`} className="truncate font-mono text-text underline">
                {m.userId}
              </Link>
              <span className="shrink-0 tabular-nums text-error">{`stored ${m.cached} · history ${m.ledger}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
