import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RuleLike } from '@/components/settings/pricing-format';
import { CostComparison } from './cost-comparison';

const v3: RuleLike = { mode: 'per_second', blockSeconds: 30, blockCredits: 2, minCredits: 4, perJobCredits: null, tiers: null };
const v4: RuleLike = { ...v3, blockCredits: 3 };

function row(name: string) {
  const table = screen.getByRole('table', { name: 'What clips will cost' });
  return within(table).getByRole('row', { name: new RegExp(`^${name} `) });
}

// The clip name is the row's header; the two prices are its cells.
const cells = (name: string) => [...row(name).querySelectorAll('th, td')].map((c) => c.textContent);

describe('CostComparison', () => {
  it('lists the six lengths with now and new costs, marking rises', () => {
    render(<CostComparison now={v3} nowLabel="Now (v3)" next={v4} nextLabel="New (v4)" adRewardCredits={5} />);
    const table = screen.getByRole('table', { name: 'What clips will cost' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Clip', 'Now (v3)', 'New (v4)']);
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(cells('15 s')).toEqual(['15 s', '4', '4']);
    expect(cells('1 min')).toEqual(['1 min', '4', '6 ↑']);
    expect(cells('10 min')).toEqual(['10 min', '40', '60 ↑']);
  });

  it('marks falls', () => {
    render(<CostComparison now={v4} nowLabel="Now (v4)" next={v3} nextLabel="New (v5)" adRewardCredits={5} />);
    expect(cells('1 min')).toEqual(['1 min', '6', '4 ↓']);
  });

  it('warns with the largest rise and what an ad pays for', () => {
    render(<CostComparison now={v3} nowLabel="Now (v3)" next={v4} nextLabel="New (v4)" adRewardCredits={5} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Clips cost up to 50% more. One rewarded ad would pay for 30 s of captions instead of 1 min.',
    );
  });

  it('says plainly when an ad would no longer cover a caption job', () => {
    // A minimum of 6 is more than the 5 credits an ad gives.
    render(<CostComparison now={v3} nowLabel="Now (v3)" next={{ ...v3, minCredits: 6 }} nextLabel="New (v4)" adRewardCredits={5} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Clips cost up to 50% more. One rewarded ad would no longer cover a caption job; today it pays for 1 min of captions.',
    );
  });

  it('leaves out the ad sentence when the ad amount is unknown', () => {
    render(<CostComparison now={v3} nowLabel="Now (v3)" next={v4} nextLabel="New (v4)" adRewardCredits={null} />);
    expect(screen.getByRole('status').textContent).toBe('Clips cost up to 50% more.');
  });

  it('shows no warning when nothing costs more', () => {
    render(<CostComparison now={v4} nowLabel="Now (v4)" next={v3} nextLabel="New (v5)" adRewardCredits={5} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "—" for Now when there is no live price, and no warning', () => {
    render(<CostComparison now={null} nowLabel="Now" next={v3} nextLabel="New (v1)" adRewardCredits={5} />);
    expect(cells('1 min')).toEqual(['1 min', '—', '4']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows "—" for New while the draft is invalid', () => {
    render(<CostComparison now={v3} nowLabel="Now (v3)" next={null} nextLabel="New (v4)" adRewardCredits={5} />);
    expect(cells('3 min')).toEqual(['3 min', '12', '—']);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
