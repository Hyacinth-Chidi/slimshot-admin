import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { AssetCard } from './asset-card';

const ASSET: Asset = {
  id: 'a1',
  kind: 'audio',
  title: 'Rain Loop',
  author: 'Studio',
  status: 'published',
  categoryId: null,
  durationMs: 65_000,
  createdAt: '2026-09-20T10:00:00Z',
};

function noop() {}

describe('AssetCard', () => {
  it('shows the created date — the table and card must show the same fields (spec ruling 10)', () => {
    render(<AssetCard asset={ASSET} onPublish={noop} onUnpublish={noop} onDelete={noop} />);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows an em dash for the created date when createdAt is null', () => {
    render(
      <AssetCard
        asset={{ ...ASSET, createdAt: null }}
        onPublish={noop}
        onUnpublish={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('still shows title, author, duration, and status alongside created', () => {
    render(<AssetCard asset={ASSET} onPublish={noop} onUnpublish={noop} onDelete={noop} />);
    expect(screen.getByText('Rain Loop')).toBeInTheDocument();
    expect(screen.getByText('Studio')).toBeInTheDocument();
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
  });
});
