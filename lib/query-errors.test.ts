import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { handleQueryError, handleMutationError, shouldRetryQuery } from './query-errors';

describe('shouldRetryQuery', () => {
  it('does not retry an ApiError 4xx', () => {
    const err = new ApiError({ code: 'BAD', message: 'nope', traceId: 't1' }, 422);
    expect(shouldRetryQuery(0, err)).toBe(false);
    expect(shouldRetryQuery(1, err)).toBe(false);
  });

  it('does not retry a 401 or 403 or 404 ApiError', () => {
    for (const status of [401, 403, 404]) {
      const err = new ApiError({ code: 'X', message: 'x', traceId: 't' }, status);
      expect(shouldRetryQuery(0, err)).toBe(false);
    }
  });

  it('retries a non-ApiError at most once', () => {
    const err = new Error('network blip');
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(1, err)).toBe(false);
  });

  it('retries a 5xx ApiError at most once', () => {
    const err = new ApiError({ code: 'SERVER', message: 'oops', traceId: 't2' }, 500);
    expect(shouldRetryQuery(0, err)).toBe(true);
    expect(shouldRetryQuery(1, err)).toBe(false);
  });
});

type ToastMock = ReturnType<typeof vi.fn<(message: string, variant?: 'default' | 'error' | 'success') => void>>;

describe('handleQueryError', () => {
  let assignMock: ReturnType<typeof vi.fn>;
  let toastMock: ToastMock;
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    assignMock = vi.fn();
    vi.stubGlobal('window', { location: { assign: assignMock } });
    consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorMock.mockRestore();
  });

  it('redirects to /login on a 401 ApiError without toasting', () => {
    toastMock = vi.fn<(message: string, variant?: 'default' | 'error' | 'success') => void>();
    const err = new ApiError({ code: 'UNAUTHORIZED', message: 'nope', traceId: 't3' }, 401);
    handleQueryError(err, toastMock);
    expect(assignMock).toHaveBeenCalledWith('/login');
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('toasts the message and logs the traceId for a non-401 ApiError', () => {
    toastMock = vi.fn<(message: string, variant?: 'default' | 'error' | 'success') => void>();
    const err = new ApiError({ code: 'SERVER', message: 'server exploded', traceId: 't4' }, 500);
    handleQueryError(err, toastMock);
    expect(assignMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith('server exploded', 'error');
    expect(consoleErrorMock).toHaveBeenCalledWith(expect.stringContaining('t4'));
  });

  it('toasts a generic message for a non-ApiError without logging a traceId', () => {
    toastMock = vi.fn<(message: string, variant?: 'default' | 'error' | 'success') => void>();
    const err = new Error('boom');
    handleQueryError(err, toastMock);
    expect(assignMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith('boom', 'error');
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });
});

describe('handleMutationError', () => {
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignMock = vi.fn();
    vi.stubGlobal('window', { location: { assign: assignMock } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects to /login on a 401 ApiError', () => {
    const err = new ApiError({ code: 'UNAUTHORIZED', message: 'nope', traceId: 't5' }, 401);
    handleMutationError(err);
    expect(assignMock).toHaveBeenCalledWith('/login');
  });

  it('does nothing for a non-401 error, leaving it to the component', () => {
    const err = new ApiError({ code: 'CONFLICT', message: 'conflict', traceId: 't6' }, 409);
    handleMutationError(err);
    expect(assignMock).not.toHaveBeenCalled();
  });
});
