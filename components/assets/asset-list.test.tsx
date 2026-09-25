import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Asset } from '@/lib/api/assets';
import { AssetList } from './asset-list';

const ASSETS: Asset[] = [
  {
    id: 'a1',
    kind: 'audio',
    title: 'Rain Loop',
    author: 'Studio',
    status: 'published',
    categoryId: 'c1',
    durationMs: 65_000,
    createdAt: '2026-09-20T10:00:00Z',
  },
];

describe('AssetList', () => {
  it('renders a table for desktop and cards for mobile, both mounted', () => {
    render(<AssetList assets={ASSETS} />);
    // The core of the responsive claim: two genuinely different components,
    // not one table with different CSS. Both render; CSS picks one.
    expect(screen.getByTestId('asset-table')).toBeInTheDocument();
    expect(screen.getByTestId('asset-cards')).toBeInTheDocument();
  });

  it('hides the table below md and the cards at md and up', () => {
    render(<AssetList assets={ASSETS} />);
    expect(screen.getByTestId('asset-table')).toHaveClass('hidden', 'md:block');
    expect(screen.getByTestId('asset-cards')).toHaveClass('md:hidden');
  });

  it('uses a real table element on desktop', () => {
    render(<AssetList assets={ASSETS} />);
    expect(screen.getByTestId('asset-table').querySelector('table')).not.toBeNull();
  });

  it('does NOT use a table element in the mobile list', () => {
    // A card list built from a table is the exact failure this split exists to
    // avoid — it inherits table layout semantics and cannot reflow.
    render(<AssetList assets={ASSETS} />);
    expect(screen.getByTestId('asset-cards').querySelector('table')).toBeNull();
  });

  it('shows the title in both presentations', () => {
    render(<AssetList assets={ASSETS} />);
    expect(screen.getAllByText('Rain Loop')).toHaveLength(2);
  });

  it('renders an empty state when there are no assets', () => {
    render(<AssetList assets={[]} />);
    expect(screen.getByText(/no assets/i)).toBeInTheDocument();
  });
});
