import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';
import type { AssetStatus } from '@/components/ui/status-pill';

/**
 * The admin routes fonts need beyond the generic asset ones
 * (../slimshot_server/src/modules/admin/admin-fonts.controller.ts).
 */

/** One published font, as FontsService.order lists it. */
export interface FontOrderRow {
  id: string;
  title: string;
  styleName: string;
  previewUrl: string | null;
  status: AssetStatus;
}

/** Every published font, in the order the app shows them. */
export function fetchFontOrder(): Promise<FontOrderRow[]> {
  return withRefresh(() => apiFetch<FontOrderRow[]>('/fonts/order'));
}

/** `ids` is every published font, in the new order: the server refuses anything else. */
export function reorderFonts(ids: string[]): Promise<void> {
  return withRefresh(async () => {
    await apiFetch<undefined>('/fonts/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
  });
}

/** `null` clears the note. */
export function updateFontLicense(id: string, license: string | null): Promise<void> {
  return withRefresh(async () => {
    await apiFetch(`/fonts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ license }) });
  });
}
