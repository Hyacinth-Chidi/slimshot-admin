import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';
import { SIDEBAR_STORAGE_KEY } from '@/lib/use-sidebar-collapsed';

vi.mock('next/navigation', () => ({ usePathname: () => '/assets' }));

afterEach(() => {
  localStorage.clear();
});

function sidebar() {
  return screen.getByTestId('sidebar');
}

describe('Sidebar collapse', () => {
  it('starts expanded with visible labels', () => {
    render(<Sidebar />);
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('Assets')).toBeVisible();
  });

  it('collapses to an icon rail and back when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
    expect(sidebar()).toHaveClass('w-16');
    // Labels leave the layout, but every link keeps an accessible name.
    expect(screen.queryByText('Assets')).toBeNull();
    expect(screen.getByRole('link', { name: 'Assets' })).toHaveAttribute('href', '/assets');
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('Assets')).toBeVisible();
  });

  it('keeps Settings reachable, with its name, when collapsed', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('remembers the choice across reloads', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    unmount();

    render(<Sidebar />);
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
  });

  it('toggles with Ctrl+B / Cmd+B', () => {
    render(<Sidebar />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    });
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    });
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');
  });

  it('ignores Ctrl+B while typing in a field', () => {
    render(
      <>
        <input aria-label="search" />
        <Sidebar />
      </>,
    );
    const input = screen.getByLabelText('search');
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }));
    });
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');
  });

  it('still works when storage is unavailable', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
    spy.mockRestore();
  });
});
