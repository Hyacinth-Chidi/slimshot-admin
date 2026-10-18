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
};

describe('AssetTable', () => {
  it("links each title to the sound's page", () => {
    render(<AssetTable assets={[ASSET]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('link', { name: 'Rain Loop' })).toHaveAttribute('href', '/assets/a1');
  });
});
