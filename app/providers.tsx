'use client';

import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toast';
import { handleMutationError, handleQueryError, shouldRetryQuery } from '@/lib/query-errors';
import { toast } from '@/lib/use-toast';

export function Providers({ children }: { children: ReactNode }) {
  // Created in state, not at module scope: a module-level client is shared
  // across requests on the server and would leak one user's cached data into
  // another's response.
  const [client] = useState(
    () =>
      new QueryClient({
        // Global handling per spec §9: a 401 (refresh already failed) sends
        // the user to /login; everything else surfaces as a toast (queries)
        // or is left to the component (mutations — 409 dialogs, 422 field
        // mapping already own their own error UI).
        queryCache: new QueryCache({
          onError: (error) => handleQueryError(error, toast),
        }),
        mutationCache: new MutationCache({
          onError: (error) => handleMutationError(error),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: shouldRetryQuery,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
