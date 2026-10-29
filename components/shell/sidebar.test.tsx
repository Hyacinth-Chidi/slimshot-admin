import { act, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';
import { SIDEBAR_STORAGE_KEY } from '@/lib/use-sidebar-collapsed';

vi.mock('next/navigation', () => ({ usePathname: () => '/audio' }));
vi.mock('@/lib/auth/profile', () => ({ useProfile: () => ({ data: { role: 'owner' }, isLoading: false }) }));
vi.mock('@/lib/api/kinds', () => ({
  fetchKinds: vi.fn(async () => [{ kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] }]),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper });
}

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
    expect(screen.getByText('Audio')).toBeVisible();
    expect(screen.getByText('Library')).toBeVisible();
  });

  it('collapses to an icon rail and back when the toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
    expect(sidebar()).toHaveClass('w-16');
    // Labels leave the layout, but every link keeps an accessible name.
    expect(screen.queryByText('Audio')).toBeNull();
    // Group headings give way to dividers on the rail.
    expect(screen.queryByText('Library')).toBeNull();
    expect(screen.getByRole('link', { name: 'Audio' })).toHaveAttribute('href', '/audio');
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand sidebar/i }));
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByText('Audio')).toBeVisible();
  });

  it('keeps the Credits and System pages reachable, with their names, when collapsed', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/credits/pricing');

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/credits/pricing');
    expect(screen.getByRole('link', { name: 'Rewards' })).toHaveAttribute('href', '/credits/rewards');
    expect(screen.getByRole('link', { name: 'AI providers' })).toHaveAttribute('href', '/system/providers');
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
