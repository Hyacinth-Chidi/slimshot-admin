'use client';

import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AssetList } from './asset-list';
import { AssetFiltersBar } from './asset-filters';
import { BulkActionBar } from './bulk-action-bar';
import { AssetPager } from './asset-pager';
import { InfiniteScrollSentinel } from './infinite-scroll-sentinel';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';
import { summarizeBulkResult } from './bulk-summary';
import { deleteAsset, fetchAssets, publishAsset, unpublishAsset, type AssetFilters } from '@/lib/api/assets';
import { toast } from '@/lib/use-toast';

const PAGE_LIMIT = 25;

const ACTION_LABEL = {
  publish: { fn: publishAsset, success: 'Asset published.', failure: 'Publish failed.' },
  unpublish: { fn: unpublishAsset, success: 'Asset unpublished.', failure: 'Unpublish failed.' },
  delete: { fn: deleteAsset, success: 'Asset deleted.', failure: 'Delete failed.' },
} as const;

export function AssetsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  }, [queryClient]);

  function setFilters(next: AssetFilters) {
    const params = searchParamsFromFilters(next);
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
    setPageIndex(0);
    setSelected(new Set());
  }

  const query = useInfiniteQuery({
    queryKey: ['assets', filters],
    queryFn: ({ pageParam }) => fetchAssets({ ...filters, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const pages = query.data?.pages ?? [];
  const allAssets = pages.flatMap((p) => p.data);
  // The desktop pager shows one loaded page's worth at a time; mobile shows
  // the full accumulated list, which is what infinite scroll means. Slicing
  // the same accumulated array (rather than reading pages[pageIndex]
  // directly) keeps the math stable even if a page ever came back shorter
  // than PAGE_LIMIT.
  const currentPageAssets = allAssets.slice(pageIndex * PAGE_LIMIT, (pageIndex + 1) * PAGE_LIMIT);

  // One asset, one action — the row/card's own publish/unpublish/delete.
  const runAction = useCallback(
    async (kind: keyof typeof ACTION_LABEL, id: string) => {
      const { fn, success, failure } = ACTION_LABEL[kind];
      setPendingId(id);
      try {
        await fn(id);
        invalidate();
        toast(success, 'success');
      } catch (err) {
        toast(err instanceof Error ? err.message : failure, 'error');
      } finally {
        setPendingId(null);
      }
    },
    [invalidate],
  );

  // Every selected row, one action, one summary toast — the bulk bar.
  async function runBulk(kind: keyof typeof ACTION_LABEL, verb: 'published' | 'unpublished' | 'deleted') {
    setBulkPending(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(ACTION_LABEL[kind].fn));
    setBulkPending(false);
    invalidate();
    setSelected(new Set());
    const summary = summarizeBulkResult(verb, results);
    toast(summary, results.some((r) => r.status === 'rejected') ? 'error' : 'success');
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllSelected(checked: boolean) {
    setSelected(checked ? new Set(currentPageAssets.map((a) => a.id)) : new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Assets</h1>
        {/* Upload entry point lands here in Task 9 (FAB below md, button here at md+). */}
      </div>

      <AssetFiltersBar filters={filters} onChange={setFilters} />

      <BulkActionBar
        count={selected.size}
        pending={bulkPending}
        onPublish={() => runBulk('publish', 'published')}
        onUnpublish={() => runBulk('unpublish', 'unpublished')}
        onDelete={() => runBulk('delete', 'deleted')}
      />

      {query.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading assets…</p>
      ) : (
        <>
          {/* md+: one page at a time, matching the explicit pager below.
              Below md: the full accumulated list, matching infinite scroll. */}
          <div className="md:hidden">
            <AssetList
              assets={allAssets}
              onPublish={(id) => runAction('publish', id)}
              onUnpublish={(id) => runAction('unpublish', id)}
              onDelete={(id) => runAction('delete', id)}
              pendingId={pendingId}
            />
          </div>
          <div className="hidden md:block">
            <AssetList
              assets={currentPageAssets}
              selected={selected}
              onToggle={toggleSelected}
              onToggleAll={toggleAllSelected}
              onPublish={(id) => runAction('publish', id)}
              onUnpublish={(id) => runAction('unpublish', id)}
              onDelete={(id) => runAction('delete', id)}
              pendingId={pendingId}
            />
          </div>
        </>
      )}

      <InfiniteScrollSentinel
        hasMore={query.hasNextPage ?? false}
        isFetching={query.isFetchingNextPage}
        onIntersect={() => query.fetchNextPage()}
      />

      <AssetPager
        page={pageIndex}
        pageCount={pages.length}
        hasNextPage={query.hasNextPage ?? false}
        isFetchingNextPage={query.isFetchingNextPage}
        onPrevious={() => setPageIndex((p) => Math.max(0, p - 1))}
        onNext={() => {
          if (pageIndex + 1 < pages.length) {
            setPageIndex((p) => p + 1);
          } else if (query.hasNextPage) {
            query.fetchNextPage().then(() => setPageIndex((p) => p + 1));
          }
        }}
      />
    </div>
  );
}
