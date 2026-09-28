'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchProviders, providersQueryKey } from '@/lib/api/providers';
import { ProviderCard } from './provider-card';

const CAPABILITY = 'speech_to_text' as const;

export function ProvidersTab() {
  const query = useQuery({
    queryKey: providersQueryKey(CAPABILITY),
    queryFn: () => fetchProviders(CAPABILITY),
  });
  const providers = query.data;

  return (
    <section aria-labelledby="auto-caption-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="auto-caption-heading" className="text-base font-semibold text-text">
          Auto caption
        </h2>
        <p className="mt-1 text-sm text-muted">
          Speech to text with word timings, used by the app&apos;s Auto caption tool. Only one provider can be
          active.
        </p>
      </div>

      {query.isLoading ? <p className="text-sm text-subtle">Loading…</p> : null}

      {providers ? (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {providers.map((status) => (
            <ProviderCard key={status.provider} status={status} />
          ))}
        </div>
      ) : null}

      {providers && !providers.some((p) => p.active) ? (
        <p className="text-sm text-warning">No provider is active, so Auto caption is off in the app.</p>
      ) : null}
    </section>
  );
}
