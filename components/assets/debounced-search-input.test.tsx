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

  it('keeps focus and accepts further typing across its own debounce commit — the fix for the round-2 regression: typing "rain", pausing past the debounce, then typing " loop" must land in the same input as "rain loop", not lose focus mid-word', async () => {
    // The parent passes the new `value` back in once the URL updates, exactly
    // as assets-page-content.tsx would after its own history.replaceState —
    // simulated here by feeding the committed URL back through `value` on
    // rerender, the same shape the real parent uses.
    let committedUrl = '/assets';
    function Wrapper() {
      const params = new URLSearchParams(committedUrl.split('?')[1] ?? '');
      return (
        <DebouncedSearchInput
          value={params.get('search') ?? ''}
          buildUrl={(s) => {
            committedUrl = s ? `/assets?search=${s}` : '/assets';
            return committedUrl;
          }}
        />
      );
    }

    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(<Wrapper />);

    const input = screen.getByRole('textbox', { name: /search/i });
    await user.click(input);
    await user.type(input, 'rain');
    act(() => vi.advanceTimersByTime(300));
    // The debounce committed — rerender with the value the parent would now
    // pass back in (mirroring searchParams reflecting the replaceState call).
    rerender(<Wrapper />);

    // The SAME element must still have focus — a remount would swap in a new
    // DOM node and drop it.
    expect(document.activeElement).toBe(input);

    await user.type(input, ' loop');
    expect(input).toHaveValue('rain loop');
  });

  it('does NOT resync the draft on a rerender caused by its own commit round-tripping back through `value` — only a genuinely different external value resyncs it', () => {
    const { rerender } = render(
      <DebouncedSearchInput value="rain" buildUrl={(s) => `/assets?search=${s}`} />,
    );
    const input = screen.getByRole('textbox', { name: /search/i });

    // Same `value` as before (as if this were the round-trip after this
    // component's own commit) — draft must be untouched.
    rerender(<DebouncedSearchInput value="rain" buildUrl={(s) => `/assets?search=${s}`} />);
    expect(input).toHaveValue('rain');
  });

  it('resyncs the draft on a plain rerender (no remount, no key) when the committed value changes for an external reason — Back/Forward, the category notice\'s Clear button, or another filter control', () => {
    const { rerender } = render(
      <DebouncedSearchInput value="rain" buildUrl={(s) => `/assets?search=${s}`} />,
    );
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('rain');

    // A DIFFERENT value than what this input itself would have committed —
    // e.g. Back navigation landed on a URL with no search term at all.
    rerender(<DebouncedSearchInput value="" buildUrl={(s) => `/assets?search=${s}`} />);
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
  });
});
