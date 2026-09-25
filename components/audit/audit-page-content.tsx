'use client';

import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { fetchAuditLogs } from '@/lib/api/audit';
import { Button } from '@/components/ui/button';
import { AuditList } from './audit-list';
import { AuditFiltersBar } from './audit-filters';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';
import type { AuditFilters } from './audit-filters-types';

const PAGE_LIMIT = 25;

export function AuditPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const hasActiveFilters = Object.keys(filters).length > 0;

  function setFilters(next: AuditFilters) {
    const params = searchParamsFromFilters(next);
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
  }

  const query = useInfiniteQuery({
    queryKey: ['audit', 'list', filters],
    queryFn: ({ pageParam }) => fetchAuditLogs({ ...filters, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    // last.meta.nextCursor is a SIBLING of last.data in the envelope
    // (apiFetchEnvelope, not apiFetch) — see lib/api/audit.ts. Reading
    // anything else here is how "Load more" silently stops after page one.
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const entries = (query.data?.pages ?? []).flatMap((p) => p.data);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text">Audit log</h1>

      <AuditFiltersBar filters={filters} onChange={setFilters} pathname={pathname} />

      {query.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading audit log…</p>
      ) : (
        <AuditList entries={entries} hasActiveFilters={hasActiveFilters} />
      )}

      {query.hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
