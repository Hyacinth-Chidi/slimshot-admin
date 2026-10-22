import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as kindsApi from '@/lib/api/kinds';
import { UploadDrawer } from './upload-drawer';

vi.mock('@/lib/api/categories', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/categories')>('@/lib/api/categories')),
  fetchTree: vi.fn(async () => [
    {
      id: 'ui',
      kind: 'audio',
      parentId: null,
      slug: 'ui',
      name: 'UI',
      description: null,
      sortOrder: 0,
      isActive: true,
      children: [],
    },
  ]),
}));

vi.mock('@/lib/api/kinds', () => ({
  fetchKinds: vi.fn(async () => [
    { kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] },
  ]),
}));

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UploadDrawer open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

async function dropFile(name = 'loop.mp3') {
  const file = new File(['x'], name, { type: 'audio/mpeg' });
  const input = await screen.findByText('Choose files').then(
    () => document.querySelector('input[type="file"]') as HTMLInputElement,
  );
  await userEvent.upload(input, file);
  return file;
}

describe('UploadDrawer (R9f)', () => {
  it('leaves a newly added file queued rather than starting it immediately', async () => {
    renderDrawer();
    await dropFile();

    expect(await screen.findByText('Queued')).toBeInTheDocument();
    // No "Upload" button click happened, so no fetch should have fired at all.
  });

  it('sends the edited title and author, not the add-time filename default, when Upload is clicked', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'a1',
              sessionId: 's1',
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/slimshot-audio/slimshot/audio/abc.mp3?X-Amz-Signature=sig',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/mpeg' },
              storageKey: 'slimshot/audio/a',
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderDrawer();
    await dropFile('loop.mp3');

    const titleInput = await screen.findByLabelText('Title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Edited Title');

    const authorInput = screen.getByLabelText('Author');
    await userEvent.clear(authorInput);
    await userEvent.type(authorInput, 'Edited Author');

    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await screen.findByText('Done');

    const ticketCall = calls.find((c) => c.url.includes('upload-ticket'))!;
    const ticketBody = JSON.parse(ticketCall.init!.body as string);
    expect(ticketBody.title).toBe('Edited Title');
    expect(ticketBody.author).toBe('Edited Author');
  });

  it('keeps title and author editable while a row is queued or failed, but not once it is running', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('upload-ticket')) {
          // Never resolves during this test — keeps the row in `ticketing`.
          return new Promise(() => {});
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderDrawer();
    await dropFile();

    const titleInput = await screen.findByLabelText('Title');
    expect(titleInput).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await screen.findByText('Requesting upload…');
    expect(screen.getByLabelText('Title')).toBeDisabled();
  });
});

describe('UploadDrawer loading', () => {
  it('shows a skeleton drop zone while the upload kinds load', async () => {
    vi.mocked(kindsApi.fetchKinds).mockReturnValueOnce(new Promise(() => {}));
    renderDrawer();
    expect(await screen.findByRole('status', { name: 'Loading upload kinds' })).toBeInTheDocument();
    expect(screen.queryByText('Loading upload kinds…')).toBeNull();
  });
});

describe('UploadDrawer category', () => {
  it('files the batch under the category chosen before adding the files', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'a1',
              sessionId: 's1',
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/b/k?X-Amz-Signature=s',
              method: 'PUT',
              headers: { 'Content-Type': 'audio/mpeg' },
              storageKey: 'k',
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        return new Response(null, { status: 200 });
      }),
    );

    renderDrawer();
    const picker = await screen.findByRole('combobox', { name: 'Category for these uploads' });
    await vi.waitFor(() => expect(picker).toBeEnabled());
    await userEvent.click(picker);
    await userEvent.click(await screen.findByRole('option', { name: 'UI' }));

    await dropFile('loop.mp3');
    await userEvent.click(await screen.findByRole('button', { name: /^upload$/i }));

    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('upload-ticket'))).toBe(true));
    const ticket = calls.find((c) => c.url.includes('upload-ticket'))!;
    expect(JSON.parse(ticket.init!.body as string).categoryId).toBe('ui');
  });
});

describe('UploadDrawer for one kind', () => {
  it('uploads to the kind of the page it was opened from, with no kind picker', async () => {
    vi.mocked(kindsApi.fetchKinds).mockResolvedValueOnce([
      { kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] },
      { kind: 'font', label: 'Font', extensions: ['.ttf'], fileRoles: [] },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UploadDrawer open onOpenChange={() => {}} kind="audio" />
      </QueryClientProvider>,
    );
    await screen.findByText('Choose files');
    expect(screen.queryByRole('combobox', { name: 'Kind' })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept', '.mp3');
  });
});

describe('UploadDrawer for fonts', () => {
  function renderFontDrawer() {
    vi.mocked(kindsApi.fetchKinds).mockResolvedValueOnce([
      { kind: 'audio', label: 'Audio', extensions: ['.mp3'], fileRoles: [] },
      { kind: 'font', label: 'Font', extensions: ['.ttf', '.otf'], fileRoles: [] },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UploadDrawer open onOpenChange={() => {}} kind="font" />
      </QueryClientProvider>,
    );
  }

  it('asks for no title or author: the server names a font from its file', async () => {
    renderFontDrawer();
    await dropFile('Lato-Regular.ttf');

    expect(await screen.findByText('Lato-Regular.ttf')).toBeInTheDocument();
    expect(screen.getByText('Named from the font file')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByLabelText('Author')).toBeNull();
  });

  it('sends a font with its declared type and no title or author', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes('upload-ticket')) {
          return jsonResponse({
            success: true,
            data: {
              assetId: 'f1',
              sessionId: 's1',
              uploadUrl: 'https://acct.r2.cloudflarestorage.com/b/slimshot/fonts/f.ttf?X-Amz-Signature=sig',
              method: 'PUT',
              headers: { 'Content-Type': 'font/ttf', 'If-None-Match': '*' },
              storageKey: 'slimshot/fonts/f.ttf',
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) return jsonResponse({ success: true, data: { assetId: 'f1', status: 'ready' } });
        return new Response(null, { status: 200 });
      }),
    );

    renderFontDrawer();
    await dropFile('Lato-Regular.ttf');
    await userEvent.click(await screen.findByRole('button', { name: 'Upload' }));
    await screen.findByText('Done');

    const body = JSON.parse(calls.find((c) => c.url.includes('upload-ticket'))!.init!.body as string);
    expect(body).toMatchObject({ kind: 'font', filename: 'Lato-Regular.ttf', mimeType: 'font/ttf' });
    expect(body).not.toHaveProperty('title');
    expect(body).not.toHaveProperty('author');
  });
});
