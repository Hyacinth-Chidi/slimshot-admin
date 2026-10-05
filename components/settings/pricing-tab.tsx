'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/components/users/format';
import { ApiError } from '@/lib/api/client';
import { activatePricingRule, fetchPricingRules, type CreditFeature, type PricingRule } from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';
import { PriceDialog } from './price-dialog';
import { describeRule } from './pricing-format';

const FEATURE: CreditFeature = 'auto_captions';
const RULES_KEY = ['pricing', FEATURE] as const;

function ActivateDialog({ rule, onClose }: { rule: PricingRule | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (target: PricingRule) => activatePricingRule(target.id),
    onSuccess: (rules, target) => {
      toast(`Price v${target.version} is active`);
      queryClient.setQueryData(RULES_KEY, rules);
      onClose();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      if (error instanceof ApiError) console.error(`API error traceId: ${error.traceId}`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  return (
    <Dialog open={rule !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {rule ? (
          <>
            <DialogHeader>
              <DialogTitle>{`Activate v${rule.version}?`}</DialogTitle>
              <DialogDescription>
                {`New caption jobs will be charged at v${rule.version}. Jobs already charged keep their price.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(rule)}
              >
                {`Activate v${rule.version}`}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function PricingTab() {
  const query = useQuery({ queryKey: RULES_KEY, queryFn: () => fetchPricingRules(FEATURE) });
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<PricingRule | null>(null);

  const rules = query.data ?? [];
  const active = rules.find((rule) => rule.isActive);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Current price"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between md:p-6"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">Auto caption price</h3>
          {query.isLoading ? (
            <p className="mt-1 text-sm text-subtle">Loading…</p>
          ) : query.isLoadingError ? (
            // No list to judge from: "no price is active" would be a false alarm.
            <div role="alert" className="mt-1 flex items-center gap-3">
              <p className="text-sm text-muted">Couldn’t load the prices.</p>
              <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
                Retry
              </Button>
            </div>
          ) : active ? (
            <p className="mt-1 text-sm text-text">{describeRule(active)}</p>
          ) : (
            <p className="mt-1 text-sm text-warning">
              No price is active, so Auto caption is switched off in the app.
            </p>
          )}
          <p className="mt-1 text-xs text-subtle">Prices are never edited: a change is a new version.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New price
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-text md:px-6">Versions</h3>
        {query.isLoading || query.isLoadingError ? null : rules.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-subtle">No prices yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
                <div className="min-w-0">
                  <p className="text-sm text-text">{describeRule(rule)}</p>
                  <p className="truncate text-xs text-subtle">
                    {[rule.note, `created ${formatDate(rule.createdAt)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {rule.isActive ? (
                  <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Active
                  </span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setConfirming(rule)}>
                    Activate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PriceDialog open={creating} onOpenChange={setCreating} />
      <ActivateDialog rule={confirming} onClose={() => setConfirming(null)} />
    </div>
  );
}
