import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAssets } from './assets';
import { setAccessToken } from './client';

function mockFetch(body: unknown, status = 200) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function lastRequestUrl(fetchMock: ReturnType<typeof mockFetch>): string {
  return String(fetchMock.mock.calls[0][0]);
}

const EMPTY_PAGE = { success: true, data: [], meta: { nextCursor: null } };

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('fetchAssets param mapping', () => {
  it('translates `search` to the server\'s `q` param', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ search: 'rain' });

    const url = lastRequestUrl(fetchMock);
    expect(url).toContain('q=rain');
    expect(url).not.toContain('search=');
  });

  it('R8f: never sends categoryId — the server 400s on it (ValidationPipe forbidNonWhitelisted, main.ts:19-24; ListAssetsDto has no categoryId field)', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ categoryId: 'c1' });

    const url = lastRequestUrl(fetchMock);
    expect(url).not.toContain('categoryId');
  });

  it('sends a valid kind (audio|font|template, the server AssetKind enum)', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ kind: 'audio' });

    expect(lastRequestUrl(fetchMock)).toContain('kind=audio');
  });

  it('drops an invalid kind rather than sending it (server @IsEnum would 400)', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ kind: 'bogus' });

    expect(lastRequestUrl(fetchMock)).not.toContain('kind=');
  });

  it('sends status, cursor, and limit unchanged', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ status: 'published', cursor: 'abc', limit: 10 });

    const url = lastRequestUrl(fetchMock);
    expect(url).toContain('status=published');
    expect(url).toContain('cursor=abc');
    expect(url).toContain('limit=10');
  });
});

describe('fetchAssets status mapping (R8e)', () => {
  it('fills every row\'s status from an active status filter — the server already filtered on it, so it is true', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        success: true,
        data: [{ id: 'a1', slug: 's1', kind: 'audio', title: 'Rain', author: 'Studio', tags: [], files: {}, detail: {}, stats: { downloadCount: 0 } }],
        meta: { nextCursor: null },
      }),
    );

    const page = await fetchAssets({ status: 'published' });
    expect(page.data[0].status).toBe('published');
  });

  it('leaves status null when the list is unfiltered — it is genuinely unknown', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        success: true,
        data: [{ id: 'a1', slug: 's1', kind: 'audio', title: 'Rain', author: 'Studio', tags: [], files: {}, detail: {}, stats: { downloadCount: 0 } }],
        meta: { nextCursor: null },
      }),
    );

    const page = await fetchAssets({});
    expect(page.data[0].status).toBeNull();
  });

  it('never fabricates createdAt or categoryId — both stay null regardless of filters', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        success: true,
        data: [{ id: 'a1', slug: 's1', kind: 'audio', title: 'Rain', author: 'Studio', tags: [], files: {}, detail: {}, stats: { downloadCount: 0 } }],
        meta: { nextCursor: null },
      }),
    );

    const page = await fetchAssets({ status: 'published' });
    expect(page.data[0].createdAt).toBeNull();
    expect(page.data[0].categoryId).toBeNull();
  });

  it('maps detail.durationMs onto the flat Asset shape', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        success: true,
        data: [{ id: 'a1', slug: 's1', kind: 'audio', title: 'Rain', author: 'Studio', tags: [], files: {}, detail: { durationMs: 65_000 }, stats: { downloadCount: 0 } }],
        meta: { nextCursor: null },
      }),
    );

    const page = await fetchAssets({});
    expect(page.data[0].durationMs).toBe(65_000);
  });
});
