import Link from 'next/link';
import type { AuditEntry } from '@/lib/api/audit';
import { describeActivity } from '@/lib/activity-copy';
import { cn } from '@/lib/cn';

function formatRelativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Recent audit events, newest first, as a timeline: the rail and dots are
 * there because these events are a sequence in time.
 */
export function ActivityTimeline({ entries }: { entries: AuditEntry[] | undefined }) {
  return (
    <section aria-labelledby="activity-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-heading" className="text-base font-semibold text-text">
          Activity
        </h2>
        <Link
          href="/audit"
          className="flex h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-text hover:underline md:h-auto"
        >
          View all
        </Link>
      </div>

      {entries?.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing has happened yet. Uploads, edits and sign-ins will show up here.
        </p>
      ) : null}

      {entries && entries.length > 0 ? (
        <ol className="relative mt-3 before:absolute before:bottom-3 before:left-[3.5px] before:top-3 before:w-px before:bg-border">
          {entries.map((entry) => {
            const copy = describeActivity(entry.action);
            return (
              <li
                key={entry.id}
                data-testid="activity-item"
                data-tone={copy.tone}
                className="relative flex items-baseline gap-4 py-2.5 pl-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-[1.05rem] size-2 rounded-full ring-4 ring-bg',
                    copy.tone === 'error' ? 'bg-error' : 'bg-muted',
                  )}
                />
                <span className="min-w-0 flex-1 text-sm text-text">
                  {copy.text}
                  {copy.tone === 'error' ? <span className="sr-only"> (needs attention)</span> : null}
                </span>
                <time
                  dateTime={entry.createdAt}
                  title={formatAbsolute(entry.createdAt)}
                  className="shrink-0 text-xs tabular-nums text-muted"
                >
                  {formatRelativeTime(entry.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
