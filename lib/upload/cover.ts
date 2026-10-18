import { apiFetch } from '@/lib/api/client';
import { withRefresh } from '@/lib/auth/session';
import { putToStorage, type FinalizeResponse, type TicketResponse } from './queue';

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * The type a cover is declared as, from its extension: browsers report "" or
 * octet-stream for some images. The server checks the real bytes anyway, and
 * refuses a file whose content doesn't match.
 */
export function declaredImageMime(file: File): string {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return IMAGE_MIME[ext] ?? file.type;
}

/**
 * Sets a sound's cover: the same ticket -> R2 PUT -> finalize flow as audio,
 * with role "thumbnail". A new cover replaces the old one on the server.
 */
export async function uploadCover(assetId: string, file: File): Promise<void> {
  const ticket = await withRefresh(() =>
    apiFetch<TicketResponse>('/assets/upload-ticket', {
      method: 'POST',
      body: JSON.stringify({
        role: 'thumbnail',
        assetId,
        filename: file.name,
        mimeType: declaredImageMime(file),
        byteSize: file.size,
      }),
    }),
  );

  await putToStorage(ticket, file);

  await withRefresh(() =>
    apiFetch<FinalizeResponse>('/assets/finalize', {
      method: 'POST',
      body: JSON.stringify({ sessionId: ticket.sessionId }),
    }),
  );
}
