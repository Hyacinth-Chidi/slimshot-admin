'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Below md: an IntersectionObserver sentinel triggers fetchNextPage, with a
 * visible "Load more" button as a fallback for jsdom (no IntersectionObserver
 * there — see the guard below) and for anyone who scrolls past the sentinel
 * without a trailing frame (e.g. very fast flicks, or an observer that never
 * fires for a not-yet-widely-supported reason).
 */
export function InfiniteScrollSentinel({
  onIntersect,
  hasMore,
  isFetching,
}: {
  onIntersect: () => void;
  hasMore: boolean;
  isFetching: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    if (typeof IntersectionObserver === 'undefined') return; // jsdom guard
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onIntersect]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-4 md:hidden">
      <Button variant="secondary" size="sm" onClick={onIntersect} disabled={isFetching}>
        {isFetching ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  );
}
