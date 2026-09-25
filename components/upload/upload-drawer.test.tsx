import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadDrawer } from './upload-drawer';

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
              uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
              storageKey: 'slimshot/audio/a',
              fields: {},
              expiresAt: new Date(Date.now() + 900_000).toISOString(),
            },
          });
        }
        if (String(url).includes('finalize')) {
          return jsonResponse({ success: true, data: { assetId: 'a1', status: 'ready' } });
        }
        return new Response(JSON.stringify({ public_id: 'x' }), { status: 200 });
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
