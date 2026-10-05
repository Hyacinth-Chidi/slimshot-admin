import type { AdminProfile } from './session';

export type AdminRole = AdminProfile['role'];

/**
 * The two rules the UI needs to hide what a role cannot do. They mirror the
 * server's permissions (users.manage: admin and up; credits.manage: owner),
 * which stay the real boundary: the server refuses regardless.
 */
export function canManageUsers(role: AdminRole | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

export function canManageCredits(role: AdminRole | undefined): boolean {
  return role === 'owner';
}
