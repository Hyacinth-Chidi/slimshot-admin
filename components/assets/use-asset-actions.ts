import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAsset, publishAsset, unpublishAsset } from '@/lib/api/assets';
import { toast } from '@/lib/use-toast';
import { summarizeBulkResult } from './bulk-summary';

type ActionKind = 'publish' | 'unpublish' | 'delete';

const ACTION_FN: Record<ActionKind, (id: string) => Promise<unknown>> = {
  publish: publishAsset,
  unpublish: unpublishAsset,
  delete: deleteAsset,
};

const SUCCESS_MESSAGE: Record<ActionKind, string> = {
  publish: 'Asset published.',
  unpublish: 'Asset unpublished.',
  delete: 'Asset deleted.',
};

const BULK_VERB: Record<ActionKind, 'published' | 'unpublished' | 'deleted'> = {
  publish: 'published',
  unpublish: 'unpublished',
  delete: 'deleted',
};

/**
 * Real useMutation calls, not hand-rolled try/catch — a mutation error
 * (including a 401 after a failed refresh) has to go through the
 * QueryClient's MutationCache for app/providers.tsx's global
 * handleMutationError to see it and redirect to /login (spec §9). A plain
 * async/await handler bypasses that cache entirely, which is why the first
 * round of this task got flagged.
 */
export function useAssetActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  }

  const single = useMutation({
    mutationFn: ({ kind, id }: { kind: ActionKind; id: string }) => ACTION_FN[kind](id),
    onSuccess: (_data, { kind }) => toast(SUCCESS_MESSAGE[kind], 'success'),
    onError: (err: Error) => toast(err.message, 'error'),
    // Invalidate on success AND failure: even a rejected single-item mutation
    // may have partially succeeded server-side by the time the client sees
    // an error (e.g. a timeout after the write committed), so the list and
    // the stats tiles should still be refreshed to reflect reality.
    onSettled: invalidate,
  });

  const bulk = useMutation({
    mutationFn: async ({ kind, ids }: { kind: ActionKind; ids: string[] }) => {
      const results = await Promise.allSettled(ids.map(ACTION_FN[kind]));
      return { kind, results };
    },
    onSuccess: ({ kind, results }) => {
      const summary = summarizeBulkResult(BULK_VERB[kind], results);
      toast(summary, results.some((r) => r.status === 'rejected') ? 'error' : 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
    // Same reasoning as the single-item mutation above — a bulk run is a
    // Promise.allSettled internally, so its own mutationFn essentially never
    // rejects, but onSettled is still the correct, uniform place to
    // invalidate rather than duplicating it in onSuccess only.
    onSettled: invalidate,
  });

  return {
    /** id of the row with an in-flight single-item mutation, if any. */
    pendingId: single.isPending ? single.variables.id : null,
    runAction: (kind: ActionKind, id: string) => single.mutate({ kind, id }),
    bulkPending: bulk.isPending,
    runBulk: (kind: ActionKind, ids: string[]) => bulk.mutate({ kind, ids }),
  };
}
