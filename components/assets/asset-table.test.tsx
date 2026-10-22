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
