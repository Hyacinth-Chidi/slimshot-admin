import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { toast } from '@/lib/use-toast';
import { Toaster } from './toast';

describe('Toaster', () => {
  it('shows a toast with an action that runs once and closes the toast', async () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() => toast('Unblocked tempmail.dev', 'default', { label: 'Undo', onClick: undo }));

    expect(screen.getByRole('status')).toHaveTextContent('Unblocked tempmail.dev');
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Unblocked tempmail.dev')).toBeNull();
  });

  it('shows a plain toast with no button', () => {
    render(<Toaster />);
    act(() => toast('Saved'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
