'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { activatePricingRule, type PricingRule } from '@/lib/api/credits';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/lib/use-toast';
import { CostComparison } from './cost-comparison';

/**
 * Make a version from the price history live, showing what it does to real
 * clip lengths first, as the Change price panel does: no price goes live unseen.
 */
export function MakeLiveDialog({
  rule,
  live,
  adRewardCredits,
  onClose,
}: {
  rule: PricingRule | null;
  live: PricingRule | null;
  adRewardCredits: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (target: PricingRule) => activatePricingRule(target.id),
    onSuccess: (rules, target) => {
      queryClient.setQueryData(['pricing', 'auto_captions'], rules);
      toast(`Price v${target.version} is live`);
      onClose();
    },
    onError: async (error) => {
      if (!(error instanceof ApiError && error.status === 401)) {
        toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
      }
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['pricing'] });
    },
  });

  return (
    <Dialog open={rule !== null} onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent role="alertdialog" showCloseButton={false} className="md:max-w-md">
        {rule ? (
          <>
            <DialogHeader>
              <DialogTitle>{rule.activatedAt ? `Make v${rule.version} live again?` : `Make v${rule.version} live?`}</DialogTitle>
              <DialogDescription>Jobs already charged keep their price.</DialogDescription>
            </DialogHeader>
            <CostComparison
              now={live}
              nowLabel={live ? `Now (v${live.version})` : 'Now'}
              next={rule}
              nextLabel={`v${rule.version}`}
              adRewardCredits={adRewardCredits}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={mutation.isPending} onClick={() => mutation.mutate(rule)}>
                {mutation.isPending ? 'Saving…' : 'Make live'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
