import { LoadingRegion, Skeleton, skeletonWidth } from '@/components/ui/skeleton';

const ROWS = 8;

/** The Assets list while its first page loads: cards below md, table rows at md+. */
export function AssetsListSkeleton() {
  return (
    <LoadingRegion label="Loading assets">
      <div data-testid="assets-skeleton-cards" className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <Skeleton className="size-12 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="size-11 shrink-0" />
          </div>
        ))}
      </div>

      <div data-testid="assets-skeleton-table" className="hidden md:block">
        <div className="flex items-center gap-4 border-b border-border py-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="ml-24 h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
        </div>
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
            <Skeleton className="size-4" />
            <div className="flex w-56 items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto size-8" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
