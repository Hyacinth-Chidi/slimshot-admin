import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AssetFilters } from '@/lib/api/assets';
import { AssetFiltersBar } from './asset-filters';

function renderBar(filters: AssetFilters = {}) {
  const onChange = vi.fn();
  const utils = render(<AssetFiltersBar filters={filters} onChange={onChange} pathname="/assets" />);
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

describe('AssetFiltersBar categoryId notice (R8f)', () => {
  it('shows nothing when categoryId is absent', () => {
    renderBar();
    expect(screen.queryByText(/isn.t supported by the API yet/i)).not.toBeInTheDocument();
  });

  it('shows the unsupported-filter notice when categoryId is present', () => {
    renderBar({ categoryId: 'c1' });
    expect(screen.getAllByText(/isn.t supported by the API yet/i)[0]).toBeInTheDocument();
  });

  it('clears categoryId when the notice\'s Clear button is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderBar({ categoryId: 'c1' });
    await user.click(screen.getAllByRole('button', { name: /clear/i })[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categoryId: undefined }));
  });
});
