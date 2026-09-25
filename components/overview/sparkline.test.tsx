import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { zeroFill } from '@/lib/api/stats';
import { Sparkline } from './sparkline';

describe('zeroFill', () => {
  it('pads missing days with zero', () => {
    const today = new Date('2026-09-23T00:00:00Z');
    const filled = zeroFill([{ date: '2026-09-23', count: 5 }], 3, today);
    expect(filled).toEqual([
      { date: '2026-09-21', count: 0 },
      { date: '2026-09-22', count: 0 },
      { date: '2026-09-23', count: 5 },
    ]);
  });

  it('returns all zeroes for an empty series', () => {
    const filled = zeroFill([], 7, new Date('2026-09-23T00:00:00Z'));
    expect(filled).toHaveLength(7);
    expect(filled.every((p) => p.count === 0)).toBe(true);
  });
});

describe('Sparkline', () => {
  it('renders an empty state rather than NaN for no data', () => {
    // A brand-new install has zero assets. Dividing by a zero range produces
    // NaN in the path's d attribute and the chart disappears silently.
    const { container } = render(<Sparkline points={[]} />);
    expect(container.querySelector('path')).toBeNull();
    expect(container.textContent).toContain('No uploads yet');
  });

  it('renders a flat line without NaN when every value is identical', () => {
    const { container } = render(<Sparkline points={[3, 3, 3]} />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d).not.toContain('NaN');
  });

  it('draws one point per value', () => {
    const { container } = render(<Sparkline points={[1, 5, 2]} />);
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.split('L').length).toBe(3);
  });
});
