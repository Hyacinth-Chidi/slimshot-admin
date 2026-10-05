import { LoadingRegion, Skeleton, skeletonWidth } from '@/components/ui/skeleton';

const ROWS = 10;

/** The Audit log while it loads: cards below md, table rows at md+. */
export function AuditListSkeleton() {
  return (
    <LoadingRegion label="Loading audit log">
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
            <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-44" />
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="flex items-center gap-6 border-b border-border py-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-border py-3 last:border-0">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className={`h-4 ${skeletonWidth(i)}`} />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto size-6" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
