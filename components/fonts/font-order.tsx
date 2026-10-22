'use client';

import Link from 'next/link';
import { useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { FontTile } from '@/components/assets/artwork';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError } from '@/lib/api/client';
import { fetchTree } from '@/lib/api/categories';
import { validationSummary } from '@/lib/api/field-errors';
import { fetchFontOrder, reorderFonts, type FontOrderRow } from '@/lib/api/fonts';
import { toast } from '@/lib/use-toast';

const TRENDING = 'trending';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 422) return validationSummary(error);
  return error instanceof Error ? error.message : fallback;
}

/** `ids` with `id` moved to where `targetId` was. */
function moved(ids: string[], id: string, targetId: string): string[] {
  const next = ids.filter((x) => x !== id);
  next.splice(ids.indexOf(targetId), 0, id);
  return next;
}

function OrderSkeleton() {
  return (
    <LoadingRegion label="Loading Trending order" className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-10 w-30" />
          <Skeleton className={i % 2 ? 'h-4 w-36' : 'h-4 w-44'} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/**
 * The order the app lists Trending in. The server takes the whole list of ids
 * each time, so a move is saved as the full new order; it shows at once and
 * goes back if the server refuses it. Moves wait for the previous save, so
 * two saves never race.
 */
export function FontOrder() {
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  // Same key as the Categories tab, so the two share one copy of the tree.
  const treeQuery = useQuery({ queryKey: ['categories', 'font'], queryFn: () => fetchTree('font') });
  const trending = treeQuery.data?.find((c) => c.parentId === null && c.slug === TRENDING);
  const orderKey = ['fonts', 'order', trending?.id];

  const orderQuery = useQuery({
    queryKey: orderKey,
    queryFn: () => fetchFontOrder(trending!.id),
    enabled: Boolean(trending),
  });

  const save = useMutation({
    mutationFn: (ids: string[]) => reorderFonts(trending!.id, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: orderKey });
      const previous = queryClient.getQueryData<FontOrderRow[]>(orderKey);
      if (previous) {
        const byId = new Map(previous.map((r) => [r.id, r]));
        queryClient.setQueryData(orderKey, ids.map((id) => byId.get(id)!));
      }
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(orderKey, context.previous);
      toast(errorMessage(error, 'Couldn’t save the order.'), 'error');
      queryClient.invalidateQueries({ queryKey: orderKey });
    },
  });

  const rows = orderQuery.data ?? [];
  const ids = rows.map((r) => r.id);

  function move(id: string, by: -1 | 1) {
    const i = ids.indexOf(id);
    const target = ids[i + by];
    if (target !== undefined) save.mutate(moved(ids, id, target));
  }

  function drop(targetId: string) {
    if (dragId && dragId !== targetId && !save.isPending) save.mutate(moved(ids, dragId, targetId));
    setDragId(null);
  }

  if (treeQuery.isLoading || (trending && orderQuery.isLoading)) return <OrderSkeleton />;

  if (treeQuery.isError || orderQuery.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-muted">Couldn’t load the Trending order.</p>
        <Button variant="secondary" onClick={() => (treeQuery.isError ? treeQuery.refetch() : orderQuery.refetch())}>
          Retry
        </Button>
      </div>
    );
  }

  if (!trending) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-text">There is no Trending category yet.</p>
        <p className="max-w-md text-sm text-subtle">
          The app lists fonts from a top-level category named &quot;Trending&quot;. Create it, then file fonts under it.
        </p>
        <Link
          href="/fonts/categories"
          className="inline-flex h-11 items-center rounded-lg border border-border bg-elevated px-4 text-sm font-medium text-text hover:bg-border md:h-10"
        >
          Go to Categories
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {!trending.isActive && (
        <p role="note" className="rounded-lg border border-border bg-surface p-3 text-sm text-warning">
          Trending is hidden, so the app shows no fonts. Show it again on the Categories tab.
        </p>
      )}
      <p className="text-sm text-subtle">
        The app lists published fonts in this order. Drag a font, or use its arrows, to move it.
      </p>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-subtle">
          No fonts in Trending yet. Choose Trending as a font’s category to list it in the app.
        </p>
      ) : (
        <ol aria-label="Trending order" className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li
              key={row.id}
              data-testid={`font-row-${row.id}`}
              draggable={!save.isPending}
              onDragStart={() => setDragId(row.id)}
              onDragOver={(e: DragEvent) => e.preventDefault()}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                drop(row.id);
              }}
              onDragEnd={() => setDragId(null)}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <GripVertical className="hidden size-4 shrink-0 cursor-grab text-subtle md:block" aria-hidden="true" />
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-subtle">{i + 1}</span>
              <FontTile src={row.previewUrl} title={row.title} width={120} />
              <div className="min-w-0 flex-1">
                <p data-testid="font-title" className="truncate text-sm font-medium text-text">
                  {row.title}
                </p>
                <p className="truncate text-xs text-subtle">{row.styleName}</p>
              </div>
              <div className="hidden sm:block">
                <StatusPill status={row.status} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 p-0 md:h-8 md:w-8"
                  aria-label={`Move ${row.title} up`}
                  disabled={i === 0 || save.isPending}
                  onClick={() => move(row.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 p-0 md:h-8 md:w-8"
                  aria-label={`Move ${row.title} down`}
                  disabled={i === rows.length - 1 || save.isPending}
                  onClick={() => move(row.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
