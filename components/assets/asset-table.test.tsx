import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { AssetTable } from './asset-table';

const ASSET: Asset = {
  id: 'a1',
  kind: 'audio',
  title: 'Rain Loop',
  author: 'Studio',
  status: 'ready',
  categoryId: null,
  durationMs: 65_000,
  createdAt: null,
  coverUrl: null,
  originalUrl: null,
};

describe('AssetTable', () => {
  it("links each title to the sound's page", () => {
    render(<AssetTable assets={[ASSET]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('link', { name: 'Rain Loop' })).toHaveAttribute('href', '/assets/a1');
  });
});

describe('AssetTable play button', () => {
  it('puts a play button right after the duration', () => {
    render(
      <AssetTable
        assets={[{ ...ASSET, originalUrl: 'https://cdn.test/a1.mp3' }]}
        onPublish={() => {}}
        onUnpublish={() => {}}
        onDelete={() => {}}
      />,
    );
    const button = screen.getByRole('button', { name: 'Play Rain Loop' });
    expect(button.closest('td')).toHaveTextContent('1:05');
  });

  it('has no play button when the sound has no file', () => {
    render(<AssetTable assets={[ASSET]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Play Rain Loop' })).toBeNull();
  });
});
