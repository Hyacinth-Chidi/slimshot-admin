import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAsset, fetchAssets, removeCover, updateAsset } from './assets';
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

  it('sends categoryId so the server filters by that category and everything under it', async () => {
    const fetchMock = mockFetch(EMPTY_PAGE);
    vi.stubGlobal('fetch', fetchMock);

    await fetchAssets({ categoryId: 'c1' });

    expect(lastRequestUrl(fetchMock)).toContain('categoryId=c1');
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

const ADMIN_ROW = {
  id: 'a1',
  slug: 'rain-1a2b3c4d',
  kind: 'audio',
  title: 'Rain',
  author: 'Studio',
  tags: [],
  files: {
    original: { url: 'https://cdn.test/slimshot/audio/a1.mp3', byteSize: 81_234, format: 'mp3', durationMs: 412 },
    thumbnail: { url: 'https://cdn.test/slimshot/covers/c.png', byteSize: 2_000, format: 'png' },
  },
  detail: { durationMs: 412 },
  stats: { downloadCount: 3 },
  status: 'ready',
  visibility: 'public',
  categoryId: 'c1',
  createdAt: '2026-10-01T10:00:00.000Z',
  publishedAt: null,
};

describe('admin asset view', () => {
  it('takes status, category, created date and cover from the server', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true, data: [ADMIN_ROW], meta: { nextCursor: null } }));

    const page = await fetchAssets({});
    expect(page.data[0]).toMatchObject({
      status: 'ready',
      categoryId: 'c1',
      createdAt: '2026-10-01T10:00:00.000Z',
      coverUrl: 'https://cdn.test/slimshot/covers/c.png',
      originalUrl: 'https://cdn.test/slimshot/audio/a1.mp3',
    });
  });

  it('has no cover when the server sends no thumbnail', async () => {
    const row = { ...ADMIN_ROW, files: { original: ADMIN_ROW.files.original } };
    vi.stubGlobal('fetch', mockFetch({ success: true, data: [row], meta: { nextCursor: null } }));

    const page = await fetchAssets({});
    expect(page.data[0].coverUrl).toBeNull();
  });

  it('fetches one sound with its original file details', async () => {
    const fetchMock = mockFetch({ success: true, data: ADMIN_ROW });
    vi.stubGlobal('fetch', fetchMock);

    const asset = await fetchAsset('a1');
    expect(lastRequestUrl(fetchMock)).toMatch(/\/assets\/a1$/);
    expect(asset).toMatchObject({
      id: 'a1',
      slug: 'rain-1a2b3c4d',
      title: 'Rain',
      status: 'ready',
      categoryId: 'c1',
      durationMs: 412,
      byteSize: 81_234,
      format: 'mp3',
      originalUrl: 'https://cdn.test/slimshot/audio/a1.mp3',
      coverUrl: 'https://cdn.test/slimshot/covers/c.png',
      publishedAt: null,
    });
  });

  it('saves edits with PATCH, sending a null category to clear it', async () => {
    const fetchMock = mockFetch({ success: true, data: { ...ADMIN_ROW, categoryId: null } });
    vi.stubGlobal('fetch', fetchMock);

    const saved = await updateAsset('a1', { categoryId: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/assets\/a1$/);
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe('{"categoryId":null}');
    expect(saved.categoryId).toBeNull();
  });

  it('removes a cover with DELETE and accepts the empty 204', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(removeCover('a1')).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toMatch(/\/assets\/a1\/cover$/);
    expect(init.method).toBe('DELETE');
  });
});
