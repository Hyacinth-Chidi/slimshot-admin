'use client';

import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AuditEntry } from '@/lib/api/audit';
import { formatAuditTimestamp, shortId } from './format';

/**
 * Pretty-printed before/after JSON, in a <pre> on --elevated. `null` renders
 * as a literal "null" (not omitted) — for a `create` action `before` really
 * is null, and that's informative, not missing data.
 */
function AuditDetail({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-3 text-xs md:flex-row">
      <div className="min-w-0 flex-1">
        <p className="mb-1 font-medium text-muted">Before</p>
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-subtle">
          {JSON.stringify(entry.before, null, 2)}
        </pre>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 font-medium text-muted">After</p>
        <pre className="overflow-x-auto whitespace-pre-wrap wrap-break-word text-subtle">
          {JSON.stringify(entry.after, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ExpandToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? 'Hide details' : 'Show details'}
      aria-expanded={open}
      onClick={onToggle}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-text md:h-8 md:w-8"
    >
      <ChevronDown
        className={`size-4 transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="py-2 pr-3 font-medium">Timestamp</th>
          <th className="py-2 pr-3 font-medium">Actor</th>
          <th className="py-2 pr-3 font-medium">Action</th>
          <th className="py-2 pr-3 font-medium">Entity</th>
          <th className="w-10 py-2" />
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const open = expandedId === entry.id;
          return (
            <Fragment key={entry.id}>
              <tr className="border-b border-border last:border-0 hover:bg-elevated">
                <td className="py-2 pr-3 whitespace-nowrap text-muted">
                  {formatAuditTimestamp(entry.createdAt)}
                </td>
                <td className="py-2 pr-3">
                  <span className="text-text">{entry.actorType}</span>
                  <span className="text-subtle" title={entry.actorId ?? undefined}>
                    {' '}
                    · {shortId(entry.actorId)}
                  </span>
                </td>
                <td className="py-2 pr-3 font-medium text-text">{entry.action}</td>
                <td className="py-2 pr-3">
                  <span className="text-text">{entry.entityType}</span>
                  <span className="text-subtle" title={entry.entityId ?? undefined}>
                    {' '}
                    · {shortId(entry.entityId)}
                  </span>
                </td>
                <td className="py-2">
                  <ExpandToggle open={open} onToggle={() => setExpandedId(open ? null : entry.id)} />
                </td>
              </tr>
              {open && (
                <tr className="border-b border-border last:border-0">
                  <td colSpan={5} className="py-2">
                    <AuditDetail entry={entry} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function AuditCard({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="wrap-break-word font-medium text-text">{entry.action}</p>
          <p className="wrap-break-word text-sm text-muted">
            {entry.entityType} · {shortId(entry.entityId)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
            <span>{entry.actorType} · {shortId(entry.actorId)}</span>
            <span>{formatAuditTimestamp(entry.createdAt)}</span>
          </div>
        </div>
        <ExpandToggle open={open} onToggle={() => setOpen((v) => !v)} />
      </div>
      {open && <AuditDetail entry={entry} />}
    </div>
  );
}

export function AuditList({
  entries,
  hasActiveFilters = false,
}: {
  entries: AuditEntry[];
  /** Distinguishes an empty log from a filter set that matched nothing (spec-adjacent UX, per brief). */
  hasActiveFilters?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-subtle">
        {hasActiveFilters ? 'No entries match these filters.' : 'No audit entries yet.'}
      </p>
    );
  }

  return (
    <>
      <div data-testid="audit-table" className="hidden md:block">
        <AuditTable entries={entries} />
      </div>
      <div data-testid="audit-cards" className="flex flex-col gap-2 md:hidden">
        {entries.map((entry) => (
          <AuditCard key={entry.id} entry={entry} />
        ))}
      </div>
    </>
  );
}
