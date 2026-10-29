'use client';

import { LogOut } from 'lucide-react';
import { BrandLogo } from './brand-logo';
import { performLogout } from './logout-button';

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors duration-150 ease-out hover:bg-elevated hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-from)]';

/** Phones only: logo and Log out. The bottom bar holds the four sections. */
export function MobileTopBar() {
  return (
    <header
      data-testid="mobile-top-bar"
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden"
    >
      <div className="flex items-center gap-2">
        <BrandLogo className="h-7" />
        <span className="font-semibold">SlimShot</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={performLogout} aria-label="Log out" className={ICON_BUTTON}>
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
