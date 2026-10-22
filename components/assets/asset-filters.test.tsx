import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AssetFilters } from '@/lib/api/assets';
import { fetchTree } from '@/lib/api/categories';
import { AssetFiltersBar } from './asset-filters';

vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(async () => []),
}));

function renderBar(filters: AssetFilters = {}) {
  const onChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <AssetFiltersBar filters={filters} onChange={onChange} pathname="/assets" />
    </QueryClientProvider>,
  );
  return { onChange, ...utils };
}

describe('AssetFiltersBar status segmented control (R8h)', () => {
  it('renders all seven segments — All plus the server\'s six AssetStatus values', () => {
    renderBar();
    const group = screen.getByRole('radiogroup', { name: /status/i });
    const options = within(group).getAllByRole('radio');
    expect(options).toHaveLength(7);
    expect(options.map((o) => o.textContent)).toEqual([
      'All',
      'Draft',
      'Processing',
      'Ready',
      'Published',
      'Archived',
      'Failed',
    ]);
  });

  it('marks "All" checked when no status filter is active', () => {
    renderBar();
    const group = screen.getByRole('radiogroup', { name: /status/i });
    expect(within(group).getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });

  it('marks the matching segment checked when a status filter is active', () => {
    renderBar({ status: 'published' });
    const group = screen.getByRole('radiogroup', { name: /status/i });
    expect(within(group).getByRole('radio', { name: 'Published' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('calls onChange with the status when a segment is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar();
    const group = screen.getAllByRole('radiogroup', { name: /status/i })[0];
    await user.click(within(group).getByRole('radio', { name: 'Ready' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
  });

  it('calls onChange with status undefined when "All" is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar({ status: 'draft' });
    const group = screen.getAllByRole('radiogroup', { name: /status/i })[0];
    await user.click(within(group).getByRole('radio', { name: 'All' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });
});

describe('AssetFiltersBar category filter', () => {
  it('no longer says filtering by category is unsupported', () => {
    renderBar({ categoryId: 'c1' });
    expect(screen.queryByText(/isn.t supported by the API yet/i)).not.toBeInTheDocument();
  });

  it('counts an active category in the mobile Filters button', () => {
    renderBar({ categoryId: 'c1' });
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
  });

  it('clears the category filter with "All categories"', async () => {
    vi.mocked(fetchTree).mockResolvedValue([
      {
        id: 'ui',
        kind: 'audio',
        parentId: null,
        slug: 'ui',
        name: 'UI',
        description: null,
        sortOrder: 0,
        isActive: true,
        children: [],
      },
    ]);
    const { onChange } = renderBar({ kind: 'audio', categoryId: 'ui' });
    const trigger = screen.getAllByRole('combobox', { name: 'Category' })[0];
    await vi.waitFor(() => expect(trigger).toBeEnabled());
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'All categories' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categoryId: undefined }));
  });
});

describe('AssetFiltersBar for fonts', () => {
  it('has no category filter: fonts have no categories', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AssetFiltersBar filters={{ kind: 'font' }} onChange={vi.fn()} pathname="/fonts" kind="font" />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('combobox', { name: 'Category' })).toBeNull();
  });
});
