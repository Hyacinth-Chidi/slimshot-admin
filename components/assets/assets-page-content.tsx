'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AssetTable } from './asset-table';
import { AssetCard } from './asset-card';
import { AssetFiltersBar } from './asset-filters';
import { BulkActionBar } from './bulk-action-bar';
import { AssetPager } from './asset-pager';
import { InfiniteScrollSentinel } from './infinite-scroll-sentinel';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';
import { useAssetActions } from './use-asset-actions';
import { fetchAssets, type AssetFilters } from '@/lib/api/assets';

const PAGE_LIMIT = 25;

/**
 * The stateful part — pageIndex and selected rows — is keyed on the filter
 * string (searchParams.toString(), passed down as `filterKey`) by the parent
 * below. Remounting on any URL change (a filter edit, but also Back/Forward,
 * which setFilters alone never caught) resets both for free, instead of
 * leaving a stale pageIndex pointing past the new filtered set's page count,
 * or a stale selection full of rows that are no longer even rendered.
 */
function AssetsPageBody({
  filters,
  pathname,
  onFiltersChange,
}: {
  filters: AssetFilters;
  pathname: string;
  onFiltersChange: (next: AssetFilters) => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { pendingId, runAction, bulkPending, runBulk } = useAssetActions();

  const query = useInfiniteQuery({
    queryKey: ['assets', filters],
    queryFn: ({ pageParam }) => fetchAssets({ ...filters, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
    // Keeps the previous page's rows on screen while a filter change
    // refetches, instead of flashing "Loading…" over content that was
    // already correct a moment ago.
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages ?? [];
  const allAssets = pages.flatMap((p) => p.data);
  // The desktop pager shows one loaded page's worth at a time; mobile shows
  // the full accumulated list, which is what infinite scroll means.
  const currentPageAssets = allAssets.slice(pageIndex * PAGE_LIMIT, (pageIndex + 1) * PAGE_LIMIT);

  function goToPage(index: number) {
    setPageIndex(index);
    setSelected(new Set());
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

  async function handleNext() {
    if (pageIndex + 1 < pages.length) {
      goToPage(pageIndex + 1);
      return;
    }
    if (!query.hasNextPage) return;
    const result = await query.fetchNextPage();
    // Only advance if the fetch actually succeeded — an errored fetch must
    // not move the pager onto a page that never loaded.
    if (!result.isError) goToPage(pageIndex + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <AssetFiltersBar filters={filters} onChange={onFiltersChange} pathname={pathname} />

      <BulkActionBar
        count={selected.size}
        statusFilter={filters.status}
        pending={bulkPending}
        onPublish={() => runBulk('publish', [...selected])}
        onUnpublish={() => runBulk('unpublish', [...selected])}
        onDelete={() => runBulk('delete', [...selected])}
      />

      {query.isLoading ? (
        <p className="py-12 text-center text-sm text-subtle">Loading assets…</p>
      ) : allAssets.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">No assets yet.</p>
      ) : (
        <>
          {/* md+: one page at a time, matching the explicit pager below.
              Below md: the full accumulated list, matching infinite scroll.
              AssetTable/AssetCard are used directly (rather than the shared
              AssetList wrapper) because the two breakpoints need genuinely
              different slices of data here — mounting AssetList twice would
              also mount its internal table+cards blocks twice, leaving two
              data-testid="asset-table" nodes in the DOM. */}
          <div data-testid="asset-cards" className="flex flex-col gap-2 md:hidden">
            {allAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onPublish={(id) => runAction('publish', id)}
                onUnpublish={(id) => runAction('unpublish', id)}
                onDelete={(id) => runAction('delete', id)}
                pending={pendingId === asset.id}
              />
            ))}
          </div>
          <div data-testid="asset-table" className="hidden md:block">
            <AssetTable
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
        onPrevious={() => goToPage(Math.max(0, pageIndex - 1))}
        onNext={handleNext}
      />
    </div>
  );
}

export function AssetsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  function setFilters(next: AssetFilters) {
    const params = searchParamsFromFilters(next);
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Assets</h1>
        {/* Upload entry point lands here in Task 9 (FAB below md, button here at md+). */}
      </div>

      {/* Keyed on the filter string: any URL change — a filter edit here,
          but also Back/Forward navigation, which setFilters alone never
          caught — remounts this and resets pageIndex/selected together. */}
      <AssetsPageBody
        key={searchParams.toString()}
        filters={filters}
        pathname={pathname}
        onFiltersChange={setFilters}
      />
    </div>
  );
}
