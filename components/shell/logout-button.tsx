'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { logout } from '@/lib/auth/session';

/**
 * The one place that knows how to log out: clear local state via
 * lib/auth/session's logout(), then a full navigation to /login so no
 * in-memory state (access token, query cache) survives into the next
 * session. Both the sidebar (md+) and the Settings page's mobile-only
 * button (R6a) render this rather than each calling logout() themselves.
 */
export async function performLogout(): Promise<void> {
  await logout();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation is intentional: it drops the in-memory token and query cache.
  window.location.assign('/login');
}

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button variant="ghost" size="sm" className={cn('justify-start', className)} onClick={performLogout}>
      <LogOut size={18} />
      Log out
    </Button>
  );
}
