import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleTimer } from './use-idle-timer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useIdleTimer', () => {
  it('fires after the timeout when active', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer(1000, onIdle, true));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does not fire when inactive', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer(1000, onIdle, false));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('restarts when reset is called, so active typing never locks mid-type', () => {
    // This is the trigger the spec calls most important. A timer that resets
    // on render instead of on input looks identical until someone types slowly.
    const onIdle = vi.fn();
    const { result } = renderHook(() => useIdleTimer(1000, onIdle, true));

    act(() => { vi.advanceTimersByTime(800); });
    act(() => { result.current.reset(); });
    act(() => { vi.advanceTimersByTime(800); });
    expect(onIdle).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('clears its timer on unmount', () => {
    const onIdle = vi.fn();
    const { unmount } = renderHook(() => useIdleTimer(1000, onIdle, true));
    unmount();
    act(() => { vi.advanceTimersByTime(2000); });
    // A timer firing after unmount would call a setter on a dead component and
    // keep the closure — and whatever it captured — alive.
    expect(onIdle).not.toHaveBeenCalled();
  });
});
