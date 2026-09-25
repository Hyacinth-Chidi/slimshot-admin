import { act, renderHook, waitFor } from '@testing-library/react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useAssetActions } from './use-asset-actions';
import * as assetsApi from '@/lib/api/assets';

vi.mock('@/lib/api/assets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/assets')>('@/lib/api/assets');
  return { ...actual, publishAsset: vi.fn(), unpublishAsset: vi.fn(), deleteAsset: vi.fn() };
});

function makeWrapper(onMutationError: (err: unknown) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    mutationCache: new MutationCache({ onError: onMutationError }),
  });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, invalidateSpy };
}

describe('useAssetActions single-item action', () => {
  it('derives pendingId from the in-flight mutation\'s variables, not a separate useState', async () => {
    vi.mocked(assetsApi.publishAsset).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50)),
    );
    const { Wrapper } = makeWrapper(() => {});
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    expect(result.current.pendingId).toBeNull();

    act(() => result.current.runAction('publish', 'a1'));
    await waitFor(() => expect(result.current.pendingId).toBe('a1'));
    await waitFor(() => expect(result.current.pendingId).toBeNull());
  });

  it('invalidates assets and stats on settle — success', async () => {
    vi.mocked(assetsApi.publishAsset).mockResolvedValue(undefined);
    const { Wrapper, invalidateSpy } = makeWrapper(() => {});
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    act(() => result.current.runAction('publish', 'a1'));

    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
      expect(keys).toContain('assets');
      expect(keys).toContain('stats');
    });
  });

  it('invalidates assets and stats on settle — failure too (R3: on success/settled)', async () => {
    vi.mocked(assetsApi.publishAsset).mockRejectedValue(new Error('cannot be published'));
    const { Wrapper, invalidateSpy } = makeWrapper(() => {});
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    act(() => result.current.runAction('publish', 'a1'));

    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
      expect(keys).toContain('assets');
      expect(keys).toContain('stats');
    });
  });

  it('routes a mutation error through the QueryClient\'s MutationCache, so app/providers.tsx\'s global 401 handler sees it — a hand-rolled try/catch bypassed this, which is what the first review round flagged', async () => {
    vi.mocked(assetsApi.publishAsset).mockRejectedValue(new Error('boom'));
    const onMutationError = vi.fn();
    const { Wrapper } = makeWrapper(onMutationError);
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    act(() => result.current.runAction('publish', 'a1'));

    await waitFor(() => expect(onMutationError).toHaveBeenCalled());
  });
});

describe('useAssetActions bulk action', () => {
  it('sets bulkPending while the batch is in flight', async () => {
    vi.mocked(assetsApi.publishAsset).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    const { Wrapper } = makeWrapper(() => {});
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    expect(result.current.bulkPending).toBe(false);
    act(() => result.current.runBulk('publish', ['a1', 'a2']));
    await waitFor(() => expect(result.current.bulkPending).toBe(true));
  });

  it('clears bulkPending and invalidates assets/stats once the batch settles', async () => {
    vi.mocked(assetsApi.publishAsset).mockResolvedValue(undefined);
    const { Wrapper, invalidateSpy } = makeWrapper(() => {});
    const { result } = renderHook(() => useAssetActions(), { wrapper: Wrapper });

    act(() => result.current.runBulk('publish', ['a1', 'a2']));
    await waitFor(() => expect(result.current.bulkPending).toBe(false));

    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey?.[0]);
    expect(keys).toContain('assets');
    expect(keys).toContain('stats');
  });
});
