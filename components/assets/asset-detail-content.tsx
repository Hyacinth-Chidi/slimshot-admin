'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { fetchAsset } from '@/lib/api/assets';
import { ApiError } from '@/lib/api/client';
import { librarySection } from '@/lib/library/kinds';
import { PageHeader } from '@/components/shell/page-header';
import { AssetDetailSkeleton } from './asset-detail-skeleton';
import { AssetEditForm } from './asset-edit-form';
import { CoverPanel } from './cover-panel';
import { formatBytes, formatDuration } from './format';
import { useAssetActions } from './use-asset-actions';

const PUBLISHABLE = new Set(['ready', 'archived']);

/** One sound: its cover, details and lifecycle, and the fields the owner edits. */
export function AssetDetailContent({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['assets', 'detail', id], queryFn: () => fetchAsset(id) });
  const { runAction, pendingId } = useAssetActions();

  const section = librarySection(query.data?.kind ?? 'audio') ?? librarySection('audio')!;
  const back = (
    <Link href={section.href} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={16} aria-hidden="true" />
      Back to {section.label.toLowerCase()}
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        {back}
        <AssetDetailSkeleton />
      </div>
    );
  }

  const asset = query.data;
  if (!asset) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text">
            {missing ? 'This sound does not exist' : 'Could not load this sound. Reload the page to try again.'}
          </p>
        </div>
      </div>
    );
  }

  const pending = pendingId === asset.id;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {back}
      <PageHeader crumbs={[{ label: 'Library' }, { label: section.label, href: section.href }]} title={asset.title} />
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:flex-row md:p-6">
        <CoverPanel assetId={asset.id} coverUrl={asset.coverUrl} />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-semibold text-text">{asset.title}</p>
            {asset.status && <StatusPill status={asset.status} />}
          </div>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted">
            <span>{formatDuration(asset.durationMs)}</span>
            <span>{formatBytes(asset.byteSize)}</span>
            {asset.format && <span>{asset.format.toUpperCase()}</span>}
          </p>
          <div className="flex gap-2">
            {asset.status && PUBLISHABLE.has(asset.status) && (
              <Button className="h-11 md:h-8" size="sm" disabled={pending} onClick={() => runAction('publish', asset.id)}>
                Publish
              </Button>
            )}
            {asset.status === 'published' && (
              <Button
                variant="secondary"
                size="sm"
                className="h-11 md:h-8"
                disabled={pending}
                onClick={() => runAction('unpublish', asset.id)}
              >
                Unpublish
              </Button>
            )}
          </div>
        </div>
      </section>
      <AssetEditForm key={`${asset.id}:${asset.title}:${asset.author}:${asset.categoryId}`} asset={asset} />
    </div>
  );
}
