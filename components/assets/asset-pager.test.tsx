import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssetPager } from './asset-pager';

describe('AssetPager', () => {
  it('disables Previous on the first page', () => {
    render(
      <AssetPager
        page={0}
        pageCount={3}
        hasNextPage
        isFetchingNextPage={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('disables Next on the last loaded page when there is no more data', () => {
    render(
      <AssetPager
        page={2}
        pageCount={3}
        hasNextPage={false}
        isFetchingNextPage={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('disables Next while a page is being fetched, even mid-set (finding 4)', () => {
    render(
      <AssetPager
        page={0}
        pageCount={2}
        hasNextPage
        isFetchingNextPage
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
  });

  it('enables Next when more pages are loaded or available and nothing is in flight', () => {
    render(
      <AssetPager
        page={0}
        pageCount={2}
        hasNextPage
        isFetchingNextPage={false}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });
});
