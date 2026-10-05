import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { HistoryRowsSkeleton } from './credit-history';

/** The user page while the user loads: the header card, the action buttons and the history. */
export function UserDetailSkeleton() {
  return (
    <LoadingRegion label="Loading user" className="flex flex-col gap-4 md:gap-6">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 md:h-8" />
        <Skeleton className="h-11 w-24 md:h-8" />
        <Skeleton className="h-11 w-28 md:h-8" />
      </div>

      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3 md:px-6">
          <Skeleton className="h-4 w-28" />
        </div>
        <HistoryRowsSkeleton />
      </section>
    </LoadingRegion>
  );
}
