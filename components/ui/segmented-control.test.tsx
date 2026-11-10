import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const;

describe('SegmentedControl', () => {
  it('is a radio group whose checked option is the value, and a click chooses another', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Feature" options={OPTIONS} value="a" onChange={onChange} />);

    const group = screen.getByRole('radiogroup', { name: 'Feature' });
    expect(within(group).getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(within(group).getByRole('radio', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
