import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';

/** The sound page while it loads: the header card (cover, title, pill, facts) and the edit form. */
export function AssetDetailSkeleton() {
  return (
    <LoadingRegion label="Loading sound" className="flex flex-col gap-4 md:gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:flex-row md:p-6">
        <Skeleton className="size-24 rounded-md" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-24 md:h-8" />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
        ))}
        <Skeleton className="h-11 w-20 md:h-10" />
      </section>
    </LoadingRegion>
  );
}
