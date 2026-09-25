'use client';

import { Button } from '@/components/ui/button';

/**
 * Explicit pager at md+ (spec §6.2/§7): Previous/Next over the pages
 * useInfiniteQuery has already loaded, fetching the next page on demand
 * rather than reflowing into a fully separate offset-based scheme.
 */
export function AssetPager({
  page,
  pageCount,
  hasNextPage,
  isFetchingNextPage,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="hidden items-center justify-between md:flex">
      <span className="text-sm text-muted">
        Page {page + 1} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrevious} disabled={page === 0}>
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={page === pageCount - 1 && !hasNextPage}
        >
          {isFetchingNextPage && page === pageCount - 1 ? 'Loading…' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
