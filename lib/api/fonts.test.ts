import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from './client';
import { fetchFontOrder, reorderFonts, updateFontLicense } from './fonts';

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

function stub(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fonts client', () => {
  it("reads every published font in the app's order", async () => {
    const rows = [
      { id: 'f2', title: 'Oswald Regular', styleName: 'Regular', previewUrl: 'https://cdn.test/p2.png', status: 'published' },
      { id: 'f1', title: 'Lato Bold', styleName: 'Bold', previewUrl: null, status: 'ready' },
    ];
    const fetchMock = stub({ success: true, data: rows });

    await expect(fetchFontOrder()).resolves.toEqual(rows);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/fonts\/order$/);
  });

  it('saves a new order as the full list of ids, and accepts the empty 204', async () => {
    const fetchMock = stub(null, 204);

    await expect(reorderFonts(['f2', 'f1'])).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/fonts\/reorder$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ ids: ['f2', 'f1'] });
  });

  it('sets a licence note, and clears it with null', async () => {
    const fetchMock = stub({ success: true, data: { id: 'f1' } });

    await updateFontLicense('f 1', 'OFL 1.1');
    await updateFontLicense('f 1', null);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/fonts\/f%201$/);
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe('{"license":"OFL 1.1"}');
    expect(fetchMock.mock.calls[1][1]?.body).toBe('{"license":null}');
  });
});
