import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface LibraryCounts {
  total: number;
  published: number;
  processing: number;
  failed: number;
}

function figure(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString('en-GB');
}

/**
 * The library at a glance. Quiet when normal: every count is plain text, and
 * only failures take the error colour — with an icon, a label and a link to
 * the failed assets, never colour alone.
 */
export function LibraryFigures({ counts }: { counts: LibraryCounts | undefined }) {
  const failed = counts?.failed ?? 0;
  const rows = [
    { key: 'total', value: counts?.total, label: 'assets in the library' },
    { key: 'published', value: counts?.published, label: 'live in the app' },
    { key: 'processing', value: counts?.processing, label: 'processing' },
    { key: 'failed', value: counts?.failed, label: 'failed to process' },
  ];

  return (
    <section aria-labelledby="library-heading">
      <h2 id="library-heading" className="text-base font-semibold text-text">
        Library
      </h2>
      <dl className="mt-2">
        {rows.map((row) => {
          const alarming = row.key === 'failed' && failed > 0;
          return (
            <div
              key={row.key}
              data-testid={`figure-${row.key}`}
              data-tone={alarming ? 'error' : 'default'}
              className="flex items-baseline gap-4 border-b border-border py-3 last:border-b-0"
            >
              <dd className="order-1 min-w-[5ch] text-right text-[28px] font-semibold leading-none tabular-nums text-text">
                {figure(row.value)}
              </dd>
              <dt className="order-2 flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm text-muted">
                {alarming ? <CircleAlert size={16} className="shrink-0 self-center text-error" aria-hidden /> : null}
                <span className={cn(alarming && 'text-text')}>{row.label}</span>
                {alarming ? (
                  <Link
                    href="/assets?status=failed"
                    className="inline-flex h-11 items-center font-medium text-text underline underline-offset-4 md:h-auto"
                  >
                    Review failed assets
                  </Link>
                ) : null}
              </dt>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
