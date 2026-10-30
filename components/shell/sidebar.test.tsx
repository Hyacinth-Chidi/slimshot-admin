import { act, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';
import { SIDEBAR_STORAGE_KEY } from '@/lib/use-sidebar-collapsed';
import { OPEN_SECTIONS_KEY } from '@/lib/use-open-sections';

let currentPath = '/audio';
vi.mock('next/navigation', () => ({ usePathname: () => currentPath }));
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
  currentPath = '/audio';
});

function sidebar() {
  return screen.getByTestId('sidebar');
}

// Before the collapse tests: their last one leaves the rail collapsed in memory.
describe('Sidebar sections', () => {
  const systemHeading = () => screen.getByRole('button', { name: 'System' });

  it('folds System at first, and leaves the other sections open with no fold', () => {
    render(<Sidebar />);
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Backups' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Audio' })).toBeInTheDocument();
    for (const heading of ['Library', 'People', 'Credits']) {
      expect(screen.queryByRole('button', { name: heading })).toBeNull();
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });

  it('unfolds and folds System when its heading is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(systemHeading());
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Backups' })).toHaveAttribute('href', '/system/backups');
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeInTheDocument();

    await user.click(systemHeading());
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Backups' })).toBeNull();
  });

  it('brings the unfolded pages into view, for a window too short to show them', async () => {
    const user = userEvent.setup();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<Sidebar />);

    scroll.mockClear(); // the menu also scrolls to the current page when it mounts
    await user.click(systemHeading());

    await vi.waitFor(() =>
      expect(scroll.mock.contexts.some((el) => (el as Element).textContent?.includes('Backups'))).toBe(true),
    );
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    scroll.mockRestore();
  });

  it('remembers an unfolded System across reloads', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Sidebar />);
    await user.click(systemHeading());
    expect(JSON.parse(localStorage.getItem(OPEN_SECTIONS_KEY) ?? '[]')).toEqual(['System']);
    unmount();

    render(<Sidebar />);
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens System by itself on its own pages, so the current page shows', () => {
    currentPath = '/system/backups';
    render(<Sidebar />);
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('nav-active')).toHaveAttribute('href', '/system/backups');
  });

  it('scrolls the menu to the current page, so a short window never hides it', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    currentPath = '/system/backups';
    render(<Sidebar />);

    await vi.waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: 'nearest' }));
    expect(scroll.mock.contexts).toContain(screen.getByTestId('nav-active'));
    scroll.mockRestore();
  });

  it('can be folded on its own page, and opens again on the next System page', async () => {
    const user = userEvent.setup();
    currentPath = '/system/backups';
    const { rerender } = render(<Sidebar />);

    await user.click(systemHeading());
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'false');

    currentPath = '/system/audit';
    rerender(<Sidebar />);
    expect(systemHeading()).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts the menu in its own scroll area between the pinned logo and Log out', () => {
    render(<Sidebar />);
    const menu = screen.getByRole('navigation', { name: 'Main' });
    expect(menu).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    // It scrolls, but shows no scrollbar.
    expect(menu).toHaveClass('[scrollbar-width:none]', '[&::-webkit-scrollbar]:hidden');
    expect(sidebar()).toHaveClass('sticky', 'top-0', 'h-screen');
  });
});

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

  it('shows the SlimShot logo, named for screen readers only when the word is hidden', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const logo = document.querySelector('[data-testid="sidebar"] img');
    expect(logo).toHaveAttribute('src', '/logo.png');
    // Expanded, "SlimShot" is written beside it, so the image itself is decorative.
    expect(logo).toHaveAttribute('alt', '');

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.getByRole('img', { name: 'SlimShot' })).toHaveAttribute('src', '/logo.png');
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
