import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { AssetActionsMenu, canPublish, canUnpublish } from './asset-actions-menu';

describe('canPublish', () => {
  it('is true from ready and archived — the server\'s PUBLISHABLE_FROM (asset.service.ts:19-22)', () => {
    expect(canPublish('ready')).toBe(true);
    expect(canPublish('archived')).toBe(true);
  });

  it('is false from draft, processing, published, and failed', () => {
    expect(canPublish('draft')).toBe(false);
    expect(canPublish('processing')).toBe(false);
    expect(canPublish('published')).toBe(false);
    expect(canPublish('failed')).toBe(false);
  });

  it('is true when status is unknown (null) — the server\'s own check is the backstop', () => {
    expect(canPublish(null)).toBe(true);
  });
});

describe('canUnpublish', () => {
  it('is true only from published', () => {
    expect(canUnpublish('published')).toBe(true);
  });

  it('is false from every other known status', () => {
    expect(canUnpublish('draft')).toBe(false);
    expect(canUnpublish('processing')).toBe(false);
    expect(canUnpublish('ready')).toBe(false);
    expect(canUnpublish('archived')).toBe(false);
    expect(canUnpublish('failed')).toBe(false);
  });

  it('is false when status is unknown (null) — unpublish has no server-side status guard (asset.service.ts:129-152), so offering it on an unknown status could silently move a draft/processing/failed/archived asset to ready', () => {
    expect(canUnpublish(null)).toBe(false);
  });
});

const BASE_ASSET: Asset = {
  id: 'a1',
  kind: 'audio',
  title: 'Rain Loop',
  author: 'Studio',
  status: null,
  categoryId: null,
  durationMs: 65_000,
  createdAt: null,
  coverUrl: null,
  originalUrl: null,
  previewUrl: null,
  keptForGood: false,
  face: null,
  version: null,
  downloadCount: 0,
};

function noop() {}

describe('AssetActionsMenu pointer-events regression (Radix dialog-after-menu)', () => {
  it('does not leave body pointer-events locked after choosing Delete then cancelling', async () => {
    const user = userEvent.setup();
    render(
      <AssetActionsMenu
        asset={BASE_ASSET}
        onPublish={noop}
        onUnpublish={noop}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /actions for rain loop/i }));
    await user.click(await screen.findByText('Delete'));
    expect(await screen.findByText('Delete asset?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(document.body.style.pointerEvents).not.toBe('none');
  });
});

describe('AssetActionsMenu for fonts', () => {
  async function openMenu(asset: Asset) {
    render(<AssetActionsMenu asset={asset} onPublish={noop} onUnpublish={noop} onDelete={noop} />);
    await userEvent.click(screen.getByRole('button', { name: `Actions for ${asset.title}` }));
  }

  it('offers no Unpublish or Delete for a font that was ever published, and says why', async () => {
    await openMenu({ ...BASE_ASSET, kind: 'font', title: 'Lato Regular', status: 'published', keptForGood: true });
    expect(screen.queryByRole('menuitem', { name: 'Unpublish' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Kept for good/ })).toHaveAttribute('data-disabled');
  });

  it('still lets a never-published font be deleted', async () => {
    await openMenu({ ...BASE_ASSET, kind: 'font', title: 'Lato Regular', status: 'ready', keptForGood: false });
    expect(screen.getByRole('menuitem', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it("leaves a sound's menu as it was", async () => {
    await openMenu({ ...BASE_ASSET, status: 'published' });
    expect(screen.getByRole('menuitem', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Kept for good/ })).toBeNull();
  });
});
