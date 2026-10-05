'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/use-toast';

/** A 422 is the dialog's to show next to its fields; it stays open. */
export function isValidationError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 422;
}

/**
 * One user action. Success: toast, refresh everything under ['users'] (list,
 * detail, history) and close. A 404 or 409 means someone else changed the user
 * first: show the server's message, refresh and close. A 401 is left to the
 * global mutation handler, which sends the admin back to sign in.
 */
export function useUserMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  { success, onDone }: { success: string; onDone: () => void },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      toast(success);
      onDone();
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: async (error) => {
      if (isValidationError(error)) return;
      if (error instanceof ApiError && error.status === 401) return;

      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      if (error instanceof ApiError) {
        // Ties a report to the server's log line.
        console.error(`API error traceId: ${error.traceId}`);
        if (error.status === 404 || error.status === 409) {
          onDone();
          await queryClient.invalidateQueries({ queryKey: ['users'] });
        }
      }
    },
  });
}
