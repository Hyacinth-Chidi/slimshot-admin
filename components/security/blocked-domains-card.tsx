'use client';

import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import {
  CREDIT_SETTINGS_KEY,
  CREDIT_SETTINGS_WRITES,
  updateCreditSettings,
  type CreditSettings,
} from '@/lib/api/credits';
import { toast } from '@/lib/use-toast';

const SEARCH_FROM = 20;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A lowercase hostname with at least one dot: labels of a–z, 0–9 and inner hyphens, a letters-only ending. */
export function isBlockableDomain(text: string): boolean {
  return DOMAIN.test(text);
}

type Change = { op: 'add' | 'remove'; domain: string };

const reverse = ({ op, domain }: Change): Change => ({ op: op === 'add' ? 'remove' : 'add', domain });

/** The list after one change, applied to whatever the list is now. */
function apply(list: string[], { op, domain }: Change): string[] {
  if (op === 'remove') return list.filter((d) => d !== domain);
  return list.includes(domain) ? list : [...list, domain];
}

/**
 * Throwaway-mail domains that email sign-in refuses. Each add or remove sends
 * the whole list (the server stores it whole), built at send time from the
 * newest saved list, never from what this screen showed when the button was
 * pressed. Undo reverses only its own change, applied to the list as it is then.
 */
export function BlockedDomainsCard({ settings }: { settings: CreditSettings }) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const domains = settings.disposableEmailDomains;
  const mutation = useMutation({
    // Runs after any earlier settings write has landed (shared scope), so the cache holds the newest list.
    mutationFn: (change: Change) => {
      const current = queryClient.getQueryData<CreditSettings>(CREDIT_SETTINGS_KEY)?.disposableEmailDomains ?? domains;
      return updateCreditSettings({ disposableEmailDomains: apply(current, change) });
    },
    scope: CREDIT_SETTINGS_WRITES,
    onSuccess: async (saved) => {
      await queryClient.cancelQueries({ queryKey: CREDIT_SETTINGS_KEY });
      queryClient.setQueryData(CREDIT_SETTINGS_KEY, saved);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      toast(error instanceof Error ? error.message : 'Something went wrong.', 'error');
    },
  });

  const save = (change: Change) => {
    mutation.mutate(change, {
      onSuccess: () =>
        toast(`${change.op === 'add' ? 'Blocked' : 'Unblocked'} ${change.domain}`, 'default', {
          label: 'Undo',
          onClick: () => mutation.mutate(reverse(change)),
        }),
    });
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const domain = text.trim().toLowerCase().replace(/^@/, '');
    if (!isBlockableDomain(domain)) return setProblem('Enter a domain like tempmail.com');
    if (domains.includes(domain)) return setProblem(`${domain} is already blocked`);
    setProblem(null);
    setText('');
    save({ op: 'add', domain });
  };

  const shown = search ? domains.filter((d) => d.includes(search.trim().toLowerCase())) : domains;

  return (
    <section aria-labelledby={headingId} className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id={headingId} className="text-[15px] font-semibold text-text">
            Blocked email domains
          </h2>
          <p className="mt-0.5 text-xs text-muted">Email sign-in is refused for these throwaway-mail services.</p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {domains.length === 1 ? '1 domain' : `${domains.length} domains`}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <form onSubmit={add} className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Plus size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
              <Input
                aria-label="Domain to block"
                aria-invalid={problem ? true : undefined}
                placeholder="Add a domain, e.g. tempmail.com"
                className="pl-9"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setProblem(null);
                }}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={mutation.isPending}>
              Add
            </Button>
          </div>
          {problem && (
            <p role="alert" className="text-sm text-error">
              {problem}
            </p>
          )}
        </form>

        {domains.length > SEARCH_FROM && (
          <Input type="search" aria-label="Search domains" placeholder="Search domains" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}

        {domains.length === 0 ? (
          <p className="text-sm text-subtle">No domains blocked.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((domain) => (
              <li
                key={domain}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated py-1 pr-1 pl-3 text-[13px] text-text"
              >
                {domain}
                <button
                  type="button"
                  aria-label={`Remove ${domain}`}
                  disabled={mutation.isPending}
                  onClick={() => save({ op: 'remove', domain })}
                  className="grid h-7 w-7 place-items-center rounded-full text-subtle hover:bg-border hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)] max-md:h-9 max-md:w-9"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-5 py-3 text-xs text-subtle">Saved as you add or remove.</div>
    </section>
  );
}
