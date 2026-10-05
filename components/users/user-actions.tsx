'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { UserDetail } from '@/lib/api/users';
import { canManageUsers, type AdminRole } from '@/lib/auth/permissions';

export type UserActionDialog = 'adjust' | 'suspend' | 'unsuspend' | 'delete';

/**
 * Admins and the owner only, and never on a deleted account: nobody is shown
 * a button the server would refuse. The server enforces it regardless.
 */
export function UserActions({ user, role }: { user: UserDetail; role: AdminRole | undefined }) {
  const [, setOpen] = useState<UserActionDialog | null>(null);

  if (!canManageUsers(role) || user.accountStatus === 'deleted') return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => setOpen('adjust')}>
        Adjust credits
      </Button>
      {user.accountStatus === 'suspended' ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen('unsuspend')}>
          Unsuspend
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen('suspend')}>
          Suspend
        </Button>
      )}
      <Button variant="danger" size="sm" onClick={() => setOpen('delete')}>
        Delete user
      </Button>
    </div>
  );
}
