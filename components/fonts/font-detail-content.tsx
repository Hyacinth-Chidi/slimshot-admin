'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { formatBytes, formatDownloads } from '@/components/assets/format';
import { useAssetActions } from '@/components/assets/use-asset-actions';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { fetchAsset, type AssetDetail } from '@/lib/api/assets';
import { ApiError } from '@/lib/api/client';
import { librarySection } from '@/lib/library/kinds';
import { FontEditForm, FontLicenseForm, FontVersionUpload } from './font-forms';

const PUBLISHABLE = new Set(['ready', 'archived']);

/** The preview at its own 3:1 shape, on the darkest tile: the server draws white text. */
function PreviewPanel({ src, title }: { src: string | null; title: string }) {
  return (
    <div className="flex aspect-[3/1] w-full max-w-[480px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg md:w-[360px] lg:w-[480px]">
      {src ? (
        // A plain img: the preview comes from the storage CDN at its final size.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${title} preview`} width={480} height={160} className="h-full w-full object-contain" />
      ) : (
        <span className="text-sm text-subtle">No preview yet</span>
      )}
    </div>
  );
}

function Facts({ asset }: { asset: AssetDetail }) {
  const font = asset.font;
  const items: [string, string][] = [
    ['Family', font?.familyName ?? '—'],
    ['Style', font?.styleName ?? '—'],
    ['Version', String(font?.version ?? 1)],
    ['Format', asset.format ? asset.format.toUpperCase() : '—'],
    ['Size', formatBytes(asset.byteSize)],
  ];
  return (
    <ul aria-label="Font details" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {items.map(([label, value]) => (
        <li key={label}>
          <span className="text-subtle">{label}</span> <span className="text-text">{value}</span>
        </li>
      ))}
      <li>{formatDownloads(asset.downloadCount)}</li>
    </ul>
  );
}

function FontDetailSkeleton() {
  return (
    <LoadingRegion label="Loading font" className="flex flex-col gap-4 md:gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:flex-row md:p-6">
        <Skeleton className="aspect-[3/1] w-full max-w-[480px] rounded-lg md:w-[360px] lg:w-[480px]" />
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-24 md:h-8" />
            <Skeleton className="h-11 w-36 md:h-8" />
          </div>
        </div>
      </section>
      {Array.from({ length: 2 }, (_, i) => (
        <section key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full md:h-10" />
          </div>
          <Skeleton className="h-11 w-24 md:h-10" />
        </section>
      ))}
    </LoadingRegion>
  );
}

/**
 * One font: its preview, what the server read from the file, its lifecycle,
 * a new version, and the fields the owner edits. Once published it is kept
 * for good, so the page offers neither Unpublish nor Delete.
 */
export function FontDetailContent({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['assets', 'detail', id], queryFn: () => fetchAsset(id) });
  const { runAction, pendingId } = useAssetActions();
  const section = librarySection('font')!;

  const back = (
    <Link href={section.href} className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-text">
      <ArrowLeft size={16} aria-hidden="true" />
      Back to fonts
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        {back}
        <FontDetailSkeleton />
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
            {missing ? 'This font does not exist' : 'Could not load this font. Reload the page to try again.'}
          </p>
        </div>
      </div>
    );
  }

  const pending = pendingId === asset.id;
  const canPublish = !asset.keptForGood && asset.status !== null && PUBLISHABLE.has(asset.status);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {back}
      <PageHeader crumbs={[{ label: 'Library' }, { label: section.label, href: section.href }]} title={asset.title} />
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:flex-row md:p-6">
        <PreviewPanel src={asset.previewUrl} title={asset.title} />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-semibold text-text">{asset.title}</p>
            {asset.status && <StatusPill status={asset.status} />}
          </div>
          <Facts asset={asset} />
          <div className="flex flex-wrap items-start gap-2">
            {canPublish && (
              <Button
                className="h-11 md:h-8"
                size="sm"
                disabled={pending || !asset.previewUrl}
                aria-describedby={asset.previewUrl ? undefined : 'font-publish-reason'}
                onClick={() => runAction('publish', asset.id)}
              >
                Publish
              </Button>
            )}
            {asset.originalUrl && (
              <a
                href={asset.originalUrl}
                download
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-elevated px-3 text-sm font-medium text-text hover:bg-border md:h-8"
              >
                <Download className="size-4" aria-hidden="true" />
                Download file
              </a>
            )}
            <FontVersionUpload assetId={asset.id} />
          </div>
          {canPublish && !asset.previewUrl && (
            <p id="font-publish-reason" className="text-sm text-subtle">
              No preview yet, so it can’t be published. Upload the file again as a new version to draw it.
            </p>
          )}
          {asset.keptForGood && (
            <p className="text-sm text-subtle">
              This font stays available for the projects that use it, so it can’t be unpublished or deleted. To take
              it out of the app’s list, move it out of Trending.
            </p>
          )}
        </div>
      </section>
      <FontEditForm key={`${asset.id}:${asset.title}:${asset.categoryId}`} asset={asset} />
      <FontLicenseForm key={`${asset.id}:${asset.font?.license ?? ''}`} asset={asset} />
    </div>
  );
}
