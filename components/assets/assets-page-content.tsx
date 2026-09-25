'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { AssetTable } from './asset-table';
import { AssetCard } from './asset-card';
import { AssetFiltersBar } from './asset-filters';
import { BulkActionBar } from './bulk-action-bar';
import { AssetPager } from './asset-pager';
import { InfiniteScrollSentinel } from './infinite-scroll-sentinel';
import { filtersFromSearchParams, searchParamsFromFilters } from './filters-url';
import { useAssetActions } from './use-asset-actions';
import { fetchAssets, type AssetFilters } from '@/lib/api/assets';
import { Button } from '@/components/ui/button';
import { UploadDrawer } from '@/components/upload/upload-drawer';

const PAGE_LIMIT = 25;

/**
 * pageIndex and selected rows reset whenever the filter set changes (a
 * filter edit, or Back/Forward, or anything else that changes the URL's
 * filter params) — but NOT on every render, and NOT by remounting this
 * component. An earlier version keyed this whole component on
 * `searchParams.toString()`, which reset both for free on any URL change,
 * but also remounted it on the search input's OWN debounced commit —
 * dropping focus and any keystrokes typed during the remount window, and
 * giving useInfiniteQuery a fresh observer with no previous data for
 * `keepPreviousData` to keep, so every committed search flashed "Loading…"
 * too.
 *
 * Instead, `filterKey` is compared against the previous render's value
 * during render (React's "adjust state during render" pattern —
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 * — not a `[filterKey]` effect, which `react-hooks/set-state-in-effect`
 * forbids, and not a ref read/write during render, which `react-hooks/refs`
 * forbids). This component never remounts on a filter change; only
 * pageIndex/selected reset, and the DOM nodes underneath (including the
 * search input) stay mounted throughout.
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
  const filterKey = searchParamsFromFilters(filters).toString();
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPageIndex(0);
    setSelected(new Set());
  }

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
  const [uploadOpen, setUploadOpen] = useState(false);

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  function setFilters(next: AssetFilters) {
    const params = searchParamsFromFilters(next);
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">Assets</h1>
        {/* Upload entry point: a primary button here at md+; below md the
            same drawer opens from the FAB rendered after this header (R9b). */}
        <Button variant="primary" className="hidden md:inline-flex" onClick={() => setUploadOpen(true)}>
          <Plus className="size-4" />
          Upload
        </Button>
      </div>

      {/* Not keyed on the URL — AssetsPageBody resets pageIndex/selected
          itself (via the "adjust state during render" pattern) whenever the
          filter set changes, without remounting, so the search input inside
          it (and its in-flight debounce/focus) survives a filter change,
          including its own committed search. */}
      <AssetsPageBody
        filters={filters}
        pathname={pathname}
        onFiltersChange={setFilters}
      />

      {/* Fixed FAB below md, clear of the bottom nav bar. This is a Button
          variant="primary" itself, so the brand gradient here is the one
          permitted "primary button" instance — not a second, separate use of
          it (spec: gradient in exactly four places). */}
      <Button
        variant="primary"
        className="fixed right-4 bottom-20 z-50 h-14 w-14 rounded-full p-0 md:hidden"
        aria-label="Upload"
        onClick={() => setUploadOpen(true)}
      >
        <Plus className="size-6" />
      </Button>

      <UploadDrawer open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
