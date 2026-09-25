import { apiFetch } from './client';
import { withRefresh } from '@/lib/auth/session';

/**
 * AdminKindsController.list (../slimshot_server/src/modules/admin/admin-kinds.controller.ts:14-26)
 * — "Describes the upload contract so a dashboard can render a form per
 * kind." Only `audio` is registered today (docs/api-reference.md, "GET
 * /kinds"), so the upload form must be built from this array rather than
 * hardcoding `audio`.
 */
export interface FileRoleDescriptor {
  role: string;
  required: boolean;
  multiple: boolean;
}

export interface Kind {
  kind: string;
  label: string;
  extensions: string[];
  fileRoles: FileRoleDescriptor[];
}

export function fetchKinds(): Promise<Kind[]> {
  return withRefresh(() => apiFetch<Kind[]>('/kinds'));
}
