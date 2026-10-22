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
  coverUrl: null,
  originalUrl: null,
  previewUrl: null,
  keptForGood: false,
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

describe('AssetCard link', () => {
  it("links the title to the sound's page", () => {
    render(<AssetCard asset={ASSET} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('link', { name: 'Rain Loop' })).toHaveAttribute('href', '/audio/a1');
  });
});

describe('AssetCard play button', () => {
  it('puts a play button next to the duration', () => {
    render(
      <AssetCard
        asset={{ ...ASSET, originalUrl: 'https://cdn.test/a1.mp3' }}
        onPublish={() => {}}
        onUnpublish={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Play Rain Loop' })).toBeInTheDocument();
  });
});

describe('AssetCard for a font', () => {
  const FONT: Asset = {
    ...ASSET,
    id: 'f1',
    kind: 'font',
    title: 'Lato Regular',
    author: null,
    durationMs: null,
    originalUrl: 'https://cdn.test/slimshot/fonts/f1.ttf',
    previewUrl: 'https://cdn.test/slimshot/fonts/previews/p1.png',
  };

  it('shows the preview tile instead of a cover, with no author, duration or play button', () => {
    render(<AssetCard asset={FONT} onPublish={noop} onUnpublish={noop} onDelete={noop} />);
    expect(screen.getByRole('img', { name: 'Lato Regular preview' })).toHaveAttribute(
      'src',
      'https://cdn.test/slimshot/fonts/previews/p1.png',
    );
    expect(screen.getByRole('link', { name: 'Lato Regular' })).toHaveAttribute('href', '/fonts/f1');
    expect(screen.queryByRole('button', { name: /^Play/ })).toBeNull();
    expect(screen.queryByText('0:00')).toBeNull();
  });
});
