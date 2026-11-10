'use client';

import { useState } from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { fetchProviders, providersQueryKey, type ProviderCapability } from '@/lib/api/providers';
import { ProviderCard } from './provider-card';

/** What each capability is for, as the section says it. */
const CAPABILITIES: Record<ProviderCapability, { switchLabel: string; heading: string; explain: string; tool: string }> = {
  speech_to_text: {
    switchLabel: 'Speech to text',
    heading: 'Auto caption',
    explain: "Speech to text with word timings, used by the app's Auto caption tool. Only one provider can be active.",
    tool: 'Auto caption',
  },
  text_to_speech: {
    switchLabel: 'Text to speech',
    heading: 'Text to speech',
    explain:
      "Voices made from the texts on the timeline, used by the app's Text to speech tool. Only one provider can be active; the voices it offers are on the Voices page.",
    tool: 'Text to speech',
  },
};

const CAPABILITY_OPTIONS = (Object.keys(CAPABILITIES) as ProviderCapability[]).map((capability) => ({
  value: capability,
  label: CAPABILITIES[capability].switchLabel,
}));

/**
 * The provider keys, one capability at a time. A key is kept per provider and
 * capability, and every card acts on the capability the server listed it under.
 */
export function ProvidersTab() {
  const [capability, setCapability] = useState<ProviderCapability>('speech_to_text');
  const shown = CAPABILITIES[capability];
  const query = useQuery({
    queryKey: providersQueryKey(capability),
    queryFn: () => fetchProviders(capability),
  });
  const providers = query.data;

  return (
    <section aria-labelledby="providers-heading" className="flex flex-col gap-4">
      <SegmentedControl label="Capability" options={CAPABILITY_OPTIONS} value={capability} onChange={setCapability} />

      <div>
        <h2 id="providers-heading" className="text-base font-semibold text-text">
          {shown.heading}
        </h2>
        <p className="mt-1 text-sm text-muted">{shown.explain}</p>
      </div>

      {query.isLoading ? (
        <LoadingRegion label="Loading providers" className="grid gap-3 md:grid-cols-2 md:gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-11 w-24 md:h-8" />
                <Skeleton className="h-11 w-20 md:h-8" />
              </div>
            </div>
          ))}
        </LoadingRegion>
      ) : null}

      {providers ? (
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {providers.map((status) => (
            <ProviderCard key={`${status.capability}:${status.provider}`} status={status} />
          ))}
        </div>
      ) : null}

      {providers && !providers.some((p) => p.active) ? (
        <p className="text-sm text-warning">{`No provider is active, so ${shown.tool} is off in the app.`}</p>
      ) : null}
    </section>
  );
}
