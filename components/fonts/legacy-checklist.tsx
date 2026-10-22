'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, CircleDashed, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { fetchLegacyFamilies, type LegacyFamily } from '@/lib/api/fonts';
import { assetHref } from '@/lib/library/kinds';
import { cn } from '@/lib/cn';

const LEGACY_COUNT = 19;

function state(row: LegacyFamily): { label: string; icon: typeof Check; className: string } {
  if (row.fontId && row.published) return { label: 'Ready', icon: Check, className: 'text-success' };
  if (row.fontId) return { label: 'Not published', icon: CircleDashed, className: 'text-warning' };
  return { label: 'Missing', icon: Minus, className: 'text-subtle' };
}

function Family({ row }: { row: LegacyFamily }) {
  const { label, icon: Icon, className } = state(row);
  const body = (
    <>
      <Icon className={cn('size-3.5 shrink-0', className)} aria-hidden="true" />
      <span data-testid="family" className="text-text">
        {row.familyName}
      </span>
      <span className={cn('text-xs', className)}>{label}</span>
    </>
  );
  const chip = 'flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm';

  return (
    <li>
      {row.fontId ? (
        <Link href={assetHref('font', row.fontId)} className={cn(chip, 'hover:bg-elevated')}>
          {body}
        </Link>
      ) : (
        <div className={chip}>{body}</div>
      )}
    </li>
  );
}

/**
 * Projects made before fonts had ids store only a family name, from a fixed
 * list of 19, and always use its Regular face. This shows which of them the
 * library can already answer, so the owner knows what is left to upload.
 */
export function LegacyChecklist() {
  const query = useQuery({ queryKey: ['fonts', 'legacy-families'], queryFn: fetchLegacyFamilies });
  const rows = query.data ?? [];
  const ready = rows.filter((r) => r.fontId && r.published).length;

  return (
    <section aria-labelledby="legacy-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="legacy-heading" className="text-sm font-medium text-text">
          Fonts in older projects
        </h2>
        {query.data && (
          <span className="text-xs text-subtle">
            {ready} of {rows.length} ready
          </span>
        )}
      </div>
      <p className="text-xs text-subtle">
        Projects made before font ids name one of these families and use its Regular face. Upload that face and
        publish it, and those projects find it by name.
      </p>

      {query.isLoading ? (
        <LoadingRegion label="Loading older project fonts" className="flex flex-wrap gap-2">
          {Array.from({ length: LEGACY_COUNT }, (_, i) => (
            <Skeleton key={i} className={cn('h-9', i % 3 === 0 ? 'w-36' : i % 3 === 1 ? 'w-28' : 'w-32')} />
          ))}
        </LoadingRegion>
      ) : query.isError ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-sm text-muted">Couldn’t load the checklist.</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <ul aria-label="Families in older projects" className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <Family key={row.familyName} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
