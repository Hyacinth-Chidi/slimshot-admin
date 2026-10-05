import { LoadingRegion, Skeleton, skeletonWidth } from '@/components/ui/skeleton';

const ROWS = 8;

/** The Users list while its first page loads: cards below md, table rows at md+. */
export function UsersListSkeleton() {
  return (
    <LoadingRegion label="Loading users">
      <div data-testid="users-skeleton-cards" className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div
        data-testid="users-skeleton-table"
        className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block"
      >
        <div className="flex items-center gap-6 border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3 last:border-0">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
