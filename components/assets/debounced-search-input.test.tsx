import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebouncedSearchInput } from './debounced-search-input';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.history.replaceState(null, '', '/assets');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DebouncedSearchInput', () => {
  it('never drops a keystroke — the input reflects every character immediately, not just the committed URL value', async () => {
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<DebouncedSearchInput value="" buildUrl={(s) => `/assets?search=${s}`} />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.type(input, 'rain');

    expect(input).toHaveValue('rain');
  });

  it('does not write to history until the debounce delay elapses', async () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<DebouncedSearchInput value="" buildUrl={(s) => `/assets?search=${s}`} />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'r');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('writes the debounced value to history via replaceState (no new history entry)', async () => {
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    render(<DebouncedSearchInput value="" buildUrl={(s) => `/assets?search=${s}`} delayMs={300} />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'rain');
    act(() => vi.advanceTimersByTime(300));

    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/assets?search=rain');
  });

  it('takes the committed value as its initial draft on mount', () => {
    render(<DebouncedSearchInput value="rain" buildUrl={(s) => `/assets?search=${s}`} />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('rain');
  });

  it('does NOT resync on its own when `value` changes via rerender without remounting — the caller must key it (e.g. assets-page-content.tsx keys its whole filtered view on searchParams.toString(), so this component remounts, rather than rerenders, whenever the committed value changes externally)', () => {
    const { rerender } = render(
      <DebouncedSearchInput value="rain" buildUrl={(s) => `/assets?search=${s}`} />,
    );
    rerender(<DebouncedSearchInput value="" buildUrl={(s) => `/assets?search=${s}`} />);
    // Same component instance, no key change: local draft state is untouched.
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('rain');
  });

  it('resyncs when the caller remounts it with a new key, e.g. after an external URL change', () => {
    function Wrapper({ committed }: { committed: string }) {
      return (
        <DebouncedSearchInput
          key={committed}
          value={committed}
          buildUrl={(s) => `/assets?search=${s}`}
        />
      );
    }
    const { rerender } = render(<Wrapper committed="rain" />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('rain');

    rerender(<Wrapper committed="" />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });
});
