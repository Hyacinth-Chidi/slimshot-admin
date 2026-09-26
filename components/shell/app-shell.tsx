import type { ReactNode } from 'react';
import { BottomNav } from './bottom-nav';
import { MobileTopBar } from './mobile-top-bar';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        {/* pb-20 clears the fixed bottom nav on phones; md:pb-8 drops it. */}
        <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
