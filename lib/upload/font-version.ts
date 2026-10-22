import { apiFetch } from '@/lib/api/client';
import { withRefresh } from '@/lib/auth/session';
import { declaredMimeType, putToStorage, type FinalizeResponse, type TicketResponse } from './queue';

/**
 * A fixed file for a font the app already uses: the same ticket -> R2 PUT ->
 * finalize flow, with role "original" and the font's id. The server checks
 * the file is the same face, keeps the old version and makes this one
 * current; the font keeps its id, so projects that use it get the fix.
 */
export async function uploadFontVersion(assetId: string, file: File): Promise<void> {
  const ticket = await withRefresh(() =>
    apiFetch<TicketResponse>('/assets/upload-ticket', {
      method: 'POST',
      body: JSON.stringify({
        role: 'original',
        assetId,
        filename: file.name,
        mimeType: declaredMimeType(file),
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
