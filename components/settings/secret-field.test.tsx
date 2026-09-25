import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MaskedSetting } from '@/lib/api/settings';
import { SecretField } from './secret-field';

vi.mock('@/lib/api/settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/settings')>('@/lib/api/settings');
  return {
    ...actual,
    revealSecret: vi.fn(async () => ({ value: 'super-secret-value', grant: 'g-1', expiresIn: 120 })),
    updateSetting: vi.fn(async () => undefined),
  };
});

const SETTING: MaskedSetting = {
  key: 'cloudinary.apiSecret',
  group: 'storage',
  type: 'string',
  isSecret: true,
  configured: true,
  description: 'Cloudinary API secret',
  value: 'clo••••4f2a',
};

let client: QueryClient;

function renderField(setting: MaskedSetting = SETTING) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SecretField setting={setting} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

// The tab-hidden test shadows document.visibilityState with an own property
// and does not restore it. Deleting that own property lets the jsdom
// prototype getter ('visible') show through again for every later test.
afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('SecretField', () => {
  it('shows a constant placeholder, never the API mask', async () => {
    renderField();
    const input = screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement;
    expect(input.value).toBe('••••••••••');
    // The API mask reveals a prefix and suffix. Rendering it leaks more than
    // the lock implies.
    expect(input.value).not.toContain('clo');
    expect(input.value).not.toContain('4f2a');
  });

  it('renders an empty field when the setting is not configured', () => {
    renderField({ ...SETTING, configured: false, value: null });
    const input = screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('is read-only until unlocked', () => {
    renderField();
    expect(screen.getByLabelText(/cloudinary api secret/i)).toHaveAttribute('readonly');
  });

  it('reveals the true value after a correct password and becomes editable', async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      const input = screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement;
      expect(input.value).toBe('super-secret-value');
      expect(input).not.toHaveAttribute('readonly');
    });
  });

  it('NEVER writes the password or the revealed value into the query cache', async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );

    const dump = JSON.stringify(client.getQueryCache().getAll().map((q) => q.state.data));
    expect(dump).not.toContain('owner-password');
    expect(dump).not.toContain('super-secret-value');
  });

  it('never writes the password or revealed value to storage', async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );

    expect(JSON.stringify(localStorage)).not.toContain('super-secret-value');
    expect(JSON.stringify(sessionStorage)).not.toContain('super-secret-value');
    expect(JSON.stringify(localStorage)).not.toContain('owner-password');
  });

  it('re-locks when the tab is hidden', async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        '••••••••••',
      ),
    );
  });

  it('re-locks on unmount, so leaving the route drops the value', async () => {
    const user = userEvent.setup();
    const { unmount } = renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );

    unmount();
    const dump = JSON.stringify(client.getQueryCache().getAll().map((q) => q.state.data));
    expect(dump).not.toContain('super-secret-value');
  });

  it('does not retry automatically when the password is wrong', async () => {
    const settings = await import('@/lib/api/settings');
    vi.mocked(settings.revealSecret).mockRejectedValueOnce(new Error('Password is incorrect.'));

    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => expect(screen.getByText(/password is incorrect/i)).toBeInTheDocument());
    // A retry spends a second lockout attempt the user never made.
    expect(settings.revealSecret).toHaveBeenCalledTimes(1);
  });

  it('treats an expired grant as an ordinary re-prompt rather than an error', async () => {
    const settings = await import('@/lib/api/settings');
    vi.mocked(settings.updateSetting).mockRejectedValueOnce(
      Object.assign(new Error('That authorisation has expired.'), { status: 403 }),
    );

    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );

    await user.clear(screen.getByLabelText(/cloudinary api secret/i));
    await user.type(screen.getByLabelText(/cloudinary api secret/i), 'new-value');
    await user.click(screen.getByRole('button', { name: /save/i }));

    // The server grant is 120s and the UI lock is 2min: independent clocks
    // that drift. An expired grant must re-open the password modal, not show
    // a failure the user cannot act on.
    await waitFor(() => expect(screen.getByLabelText(/password/i)).toBeInTheDocument());
  });
});

// Beyond the brief's ten: the triggers and leak paths it states but does not pin.
describe('SecretField re-lock and leak paths', () => {
  async function unlock(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement).value).toBe(
        'super-secret-value',
      ),
    );
  }

  function secretInput() {
    return screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement;
  }

  it('never renders the API mask anywhere in the DOM, attributes included', () => {
    const { container } = renderField();
    // Covers title, aria-*, data-* and hidden text, not just the input value.
    expect(container.innerHTML).not.toContain('clo••••4f2a');
    expect(container.innerHTML).not.toContain('4f2a');
  });

  it('leaves no timer (idle or otherwise) alive after a re-lock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderField();
      await unlock(user);

      // Flush any short-lived UI timers (dialog focus, etc.) without reaching
      // the 2-minute idle lock, so the count below is the idle timer alone.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(vi.getTimerCount()).toBe(1);

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(secretInput().value).toBe('••••••••••');
      // A timer outliving the lock would hold a closure from the unlocked
      // render — the one place the revealed value could survive a re-lock.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-locks after two minutes idle, and each keystroke restarts the clock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderField();
      await unlock(user);

      act(() => {
        vi.advanceTimersByTime(100_000);
      });
      await user.type(secretInput(), 'x');
      act(() => {
        vi.advanceTimersByTime(100_000);
      });
      // 200s since unlock, but only 100s since the last keystroke.
      expect(secretInput().value).toBe('super-secret-valuex');

      act(() => {
        vi.advanceTimersByTime(20_001);
      });
      expect(secretInput().value).toBe('••••••••••');
      expect(secretInput()).toHaveAttribute('readonly');
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-locks when the window loses focus', async () => {
    const user = userEvent.setup();
    renderField();
    await unlock(user);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(secretInput().value).toBe('••••••••••');
  });

  it('can be locked again by hand', async () => {
    const user = userEvent.setup();
    renderField();
    await unlock(user);

    await user.click(screen.getByRole('button', { name: /^lock/i }));

    expect(secretInput().value).toBe('••••••••••');
    expect(secretInput()).toHaveAttribute('readonly');
  });

  it('saves with the grant, re-locks immediately, and refreshes the group', async () => {
    const settings = await import('@/lib/api/settings');
    const user = userEvent.setup();
    renderField();
    await unlock(user);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await user.clear(secretInput());
    await user.type(secretInput(), 'new-value');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(secretInput().value).toBe('••••••••••'));
    expect(settings.updateSetting).toHaveBeenCalledWith('cloudinary.apiSecret', 'new-value', {
      grant: 'g-1',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['settings', 'storage'] });
    // The save must not go through useMutation either: its cache keeps the
    // variables — here, the new secret and the grant.
    const mutations = JSON.stringify(client.getMutationCache().getAll().map((m) => m.state));
    expect(mutations).not.toContain('new-value');
    expect(mutations).not.toContain('g-1');
  });

  it('allows only one reveal request in flight, so a double click cannot spend two attempts', async () => {
    const settings = await import('@/lib/api/settings');
    let resolve: (v: { value: string; grant: string; expiresIn: number }) => void = () => {};
    vi.mocked(settings.revealSecret).mockImplementationOnce(
      () => new Promise((r) => { resolve = r; }),
    );
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    const unlockButton = screen.getByRole('button', { name: /unlock/i });
    await user.click(unlockButton);

    expect(unlockButton).toBeDisabled();
    await user.click(unlockButton);
    expect(settings.revealSecret).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ value: 'super-secret-value', grant: 'g-1', expiresIn: 120 });
    });
    await waitFor(() => expect(secretInput().value).toBe('super-secret-value'));
  });

  it('clears the password from the modal after a failed attempt', async () => {
    const settings = await import('@/lib/api/settings');
    vi.mocked(settings.revealSecret).mockRejectedValueOnce(new Error('Password is incorrect.'));
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => expect(screen.getByText(/password is incorrect/i)).toBeInTheDocument());
    expect((screen.getByLabelText(/password/i) as HTMLInputElement).value).toBe('');
  });

  it('discards a reveal that resolves after the tab was hidden mid-request', async () => {
    const settings = await import('@/lib/api/settings');
    let resolve: (v: { value: string; grant: string; expiresIn: number }) => void = () => {};
    vi.mocked(settings.revealSecret).mockImplementationOnce(
      () => new Promise((r) => { resolve = r; }),
    );
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), 'owner-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      resolve({ value: 'super-secret-value', grant: 'g-1', expiresIn: 120 });
    });

    expect(secretInput().value).toBe('••••••••••');
    expect(document.body.innerHTML).not.toContain('super-secret-value');
  });
});
