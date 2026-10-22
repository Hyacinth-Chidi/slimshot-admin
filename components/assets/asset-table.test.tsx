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
  previewUrl: null,
  face: null,
  version: null,
  downloadCount: 0,
};

describe('AssetTable', () => {
  it("links each title to the sound's page", () => {
    render(<AssetTable assets={[ASSET]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.getByRole('link', { name: 'Rain Loop' })).toHaveAttribute('href', '/audio/a1');
  });
});

describe('AssetTable play button', () => {
  it('puts the play button in its own centred column, between duration and status', () => {
    render(
      <AssetTable
        assets={[{ ...ASSET, originalUrl: 'https://cdn.test/a1.mp3' }]}
        onPublish={() => {}}
        onUnpublish={() => {}}
        onDelete={() => {}}
      />,
    );
    const cell = screen.getByRole('button', { name: 'Play Rain Loop' }).closest('td')!;
    expect(cell).toHaveClass('text-center');
    expect(cell).not.toHaveTextContent('1:05');
    expect(cell.previousElementSibling).toHaveTextContent('1:05');
    expect(cell.nextElementSibling).toHaveTextContent('Ready');
    // The header row keeps one cell per column.
    const headers = screen.getAllByRole('columnheader');
    const rowCells = cell.parentElement!.children;
    expect(headers).toHaveLength(rowCells.length);
  });

  it('has no play button when the sound has no file', () => {
    render(<AssetTable assets={[ASSET]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Play Rain Loop' })).toBeNull();
  });
});

describe('AssetTable for fonts', () => {
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

  it('shows the preview on a dark tile, and no sound columns', () => {
    render(<AssetTable kind="font" assets={[FONT]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />);

    const preview = screen.getByRole('img', { name: 'Lato Regular preview' });
    expect(preview).toHaveAttribute('src', 'https://cdn.test/slimshot/fonts/previews/p1.png');
    expect(preview.parentElement).toHaveClass('bg-bg');
    expect(screen.getByRole('link', { name: 'Lato Regular' })).toHaveAttribute('href', '/fonts/f1');
    for (const header of ['Author', 'Duration']) expect(screen.queryByRole('columnheader', { name: header })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Font' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play/ })).toBeNull();
  });

  it('shows family and style, version and downloads, so renamed faces stay apart', () => {
    render(
      <AssetTable
        kind="font"
        assets={[{ ...FONT, face: 'Lato · Bold', version: 3, downloadCount: 1204 }]}
        onPublish={() => {}}
        onUnpublish={() => {}}
        onDelete={() => {}}
      />,
    );
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Font', 'Family and style', 'Version', 'Status', 'Downloads']));
    const row = screen.getAllByRole('row')[1];
    expect(row).toHaveTextContent('Lato · Bold');
    expect(row).toHaveTextContent('v3');
    expect(row).toHaveTextContent('1,204');
  });

  it('says so when the preview is not drawn yet', () => {
    render(
      <AssetTable kind="font" assets={[{ ...FONT, previewUrl: null }]} onPublish={() => {}} onUnpublish={() => {}} onDelete={() => {}} />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });
});
