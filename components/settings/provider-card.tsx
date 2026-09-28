'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  activateProvider,
  deactivateProvider,
  PROVIDER_LABELS,
  type KeyCheck,
  type ProviderStatus,
  providersQueryKey,
  removeProviderKey,
  saveProviderKey,
  testProviderKey,
} from '@/lib/api/providers';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/use-toast';
import { ProviderKeyDialog } from './provider-key-dialog';
import { RemoveKeyDialog } from './remove-key-dialog';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function StatePill({ status }: { status: ProviderStatus }) {
  const state = status.active
    ? { label: 'Active', className: 'bg-success/10 text-success border-success/30' }
    : status.configured
      ? { label: 'Key saved', className: 'bg-elevated text-text border-border' }
      : { label: 'No key', className: 'bg-elevated text-subtle border-border' };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        state.className,
      )}
    >
      {state.label}
    </span>
  );
}

export function ProviderCard({ status }: { status: ProviderStatus }) {
  const queryClient = useQueryClient();
  const { provider, capability } = status;
  const label = PROVIDER_LABELS[provider];

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [check, setCheck] = useState<KeyCheck | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: providersQueryKey(capability) });

  const saveKey = useMutation({
    mutationFn: (apiKey: string) => saveProviderKey(provider, capability, apiKey),
    onSuccess: () => {
      setKeyDialogOpen(false);
      setCheck(null);
      toast(`${label} key saved.`, 'success');
      return refresh();
    },
  });

  const removeKey = useMutation({
    mutationFn: () => removeProviderKey(provider, capability),
    onSuccess: () => {
      setRemoveOpen(false);
      setCheck(null);
      toast(`${label} key removed.`, 'success');
      return refresh();
    },
    onError: (error) => toast(messageOf(error), 'error'),
  });

  const toggle = useMutation({
    mutationFn: () =>
      status.active ? deactivateProvider(provider, capability) : activateProvider(provider, capability),
    onSuccess: () => {
      toast(status.active ? `${label} turned off.` : `${label} is now the active provider.`, 'success');
      return refresh();
    },
    onError: (error) => toast(messageOf(error), 'error'),
  });

  const testKey = useMutation({
    mutationFn: () => testProviderKey(provider, capability),
    onSuccess: setCheck,
    onError: (error) => setCheck({ ok: false, message: messageOf(error) }),
  });

  return (
    <article
      data-testid={`provider-${provider}`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text">{label}</h3>
          <p className="mt-1 text-xs text-muted">
            {status.updatedAt
              ? `Key updated ${new Date(status.updatedAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}`
              : 'No key saved yet'}
          </p>
        </div>
        <StatePill status={status} />
      </div>

      {check ? (
        <p role="status" className={cn('text-sm', check.ok ? 'text-success' : 'text-error')}>
          {check.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            saveKey.reset();
            setKeyDialogOpen(true);
          }}
        >
          {status.configured ? 'Replace key' : 'Add key'}
        </Button>
        <Button size="sm" onClick={() => testKey.mutate()} disabled={!status.configured || testKey.isPending}>
          {testKey.isPending ? 'Testing…' : 'Test key'}
        </Button>
        <Button size="sm" onClick={() => toggle.mutate()} disabled={!status.configured || toggle.isPending}>
          {status.active ? 'Turn off' : 'Make active'}
        </Button>
        {status.configured ? (
          <Button size="sm" variant="danger" onClick={() => setRemoveOpen(true)}>
            Remove key
          </Button>
        ) : null}
      </div>

      <ProviderKeyDialog
        open={keyDialogOpen}
        providerLabel={label}
        replacing={status.configured}
        pending={saveKey.isPending}
        error={saveKey.error ? messageOf(saveKey.error) : null}
        onSave={(apiKey) => saveKey.mutate(apiKey)}
        onClose={() => setKeyDialogOpen(false)}
      />
      <RemoveKeyDialog
        open={removeOpen}
        providerLabel={label}
        active={status.active}
        pending={removeKey.isPending}
        onConfirm={() => removeKey.mutate()}
        onClose={() => setRemoveOpen(false)}
      />
    </article>
  );
}
