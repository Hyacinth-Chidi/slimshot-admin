import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, ApiError } from '@/lib/api/client';
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

// The §9 session-expired redirect. Mocked so a test can see it was taken
// (jsdom cannot navigate).
vi.mock('@/lib/query-errors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/query-errors')>('@/lib/query-errors');
  return { ...actual, handleMutationError: vi.fn() };
});

vi.mock('@/lib/use-toast', async () => {
  const actual = await vi.importActual<typeof import('@/lib/use-toast')>('@/lib/use-toast');
  return { ...actual, toast: vi.fn() };
});

const ME = { id: 'a-1', email: 'owner@example.com', name: 'Owner', role: 'owner' };

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const UNAUTHENTICATED = {
  success: false,
  error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired access token.', traceId: 't-1' },
};

/**
 * The real fetchMe + withRefresh run against this stub (R12d): the session
 * pre-check before a reveal is only meaningful if its refresh path is real.
 * Default: the access token is valid, so GET /auth/me succeeds first time.
 */
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url === `${API_BASE}/auth/me`) return jsonResponse(200, { success: true, data: ME });
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
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

// Fix round 1 (R12d): an expired access token must not turn every unlock into
// a failure, and a dead session must redirect rather than strand the secret.
describe('SecretField session expiry', () => {
  function secretInput() {
    return screen.getByLabelText(/cloudinary api secret/i) as HTMLInputElement;
  }

  async function submitPassword(user: ReturnType<typeof userEvent.setup>, password: string) {
    await user.click(screen.getByRole('button', { name: /reveal/i }));
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole('button', { name: /unlock/i }));
  }

  it('refreshes an expired access token before sending the password, so the first attempt succeeds', async () => {
    const settings = await import('@/lib/api/settings');
    let meCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${API_BASE}/auth/me`) {
        meCalls += 1;
        return meCalls === 1
          ? jsonResponse(401, UNAUTHENTICATED)
          : jsonResponse(200, { success: true, data: ME });
      }
      if (url === '/api/auth/refresh') {
        return jsonResponse(200, { success: true, data: { accessToken: 'fresh-token' } });
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    const user = userEvent.setup();
    renderField();

    await submitPassword(user, 'owner-password');

    await waitFor(() => expect(secretInput().value).toBe('super-secret-value'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' });
    // One user attempt, one reveal: the refresh happened on the cheap
    // pre-check, never by retrying the password-bearing request.
    expect(settings.revealSecret).toHaveBeenCalledTimes(1);
    expect(settings.revealSecret).toHaveBeenCalledWith('cloudinary.apiSecret', 'owner-password');
  });

  it('never sends the password when the session is dead: locks, closes, and redirects', async () => {
    const settings = await import('@/lib/api/settings');
    const { handleMutationError } = await import('@/lib/query-errors');
    fetchMock.mockImplementation(async (url: string) => {
      if (url === `${API_BASE}/auth/me`) return jsonResponse(401, UNAUTHENTICATED);
      if (url === '/api/auth/refresh') return jsonResponse(401, { success: false });
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    const user = userEvent.setup();
    renderField();

    await submitPassword(user, 'owner-password');

    await waitFor(() => expect(handleMutationError).toHaveBeenCalledTimes(1));
    const [redirectedWith] = vi.mocked(handleMutationError).mock.calls[0];
    expect(redirectedWith).toBeInstanceOf(ApiError);
    expect((redirectedWith as ApiError).status).toBe(401);
    expect(settings.revealSecret).not.toHaveBeenCalled();
    // The password never went over the wire in any request.
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('owner-password');
    await waitFor(() => expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument());
    expect(secretInput().value).toBe('••••••••••');
    expect(secretInput()).toHaveAttribute('readonly');
  });

  it('shows a wrong-password 401 in the modal without retrying or redirecting', async () => {
    const settings = await import('@/lib/api/settings');
    const { handleMutationError } = await import('@/lib/query-errors');
    vi.mocked(settings.revealSecret).mockRejectedValueOnce(
      new ApiError(
        { code: 'UNAUTHENTICATED', message: 'Password is incorrect.', traceId: 't-2' },
        401,
      ),
    );
    const user = userEvent.setup();
    renderField();

    await submitPassword(user, 'wrong-password');

    await waitFor(() => expect(screen.getByText(/password is incorrect/i)).toBeInTheDocument());
    expect(settings.revealSecret).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/refresh', expect.anything());
    expect(handleMutationError).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('does not send the password when the field re-locks during the session pre-check', async () => {
    const settings = await import('@/lib/api/settings');
    let releaseMe: () => void = () => {};
    fetchMock.mockImplementation(
      (url: string) =>
        new Promise<Response>((resolve, reject) => {
          if (url !== `${API_BASE}/auth/me`) {
            reject(new Error(`Unexpected fetch in test: ${url}`));
            return;
          }
          releaseMe = () => resolve(jsonResponse(200, { success: true, data: ME }));
        }),
    );
    const user = userEvent.setup();
    renderField();

    await submitPassword(user, 'owner-password');
    // Still one in-flight attempt: the pre-check is part of it.
    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      releaseMe();
    });

    await waitFor(() =>
      expect(screen.getByText(/locked again while unlocking/i)).toBeInTheDocument(),
    );
    expect(settings.revealSecret).not.toHaveBeenCalled();
    expect(secretInput().value).toBe('••••••••••');
  });

  it('on a 401 while saving, locks the field and redirects, with no toast', async () => {
    const settings = await import('@/lib/api/settings');
    const { handleMutationError } = await import('@/lib/query-errors');
    const { toast } = await import('@/lib/use-toast');
    const sessionExpired = new ApiError(
      { code: 'UNAUTHENTICATED', message: 'Invalid or expired access token.', traceId: 't-3' },
      401,
    );
    vi.mocked(settings.updateSetting).mockRejectedValueOnce(sessionExpired);
    const user = userEvent.setup();
    renderField();

    await submitPassword(user, 'owner-password');
    await waitFor(() => expect(secretInput().value).toBe('super-secret-value'));
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(handleMutationError).toHaveBeenCalledWith(sessionExpired));
    expect(secretInput().value).toBe('••••••••••');
    expect(document.body.innerHTML).not.toContain('super-secret-value');
    expect(toast).not.toHaveBeenCalled();
  });
});
