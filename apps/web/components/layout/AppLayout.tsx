'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

// ---------------------------------------------------------------------------
// Breakpoint
// ---------------------------------------------------------------------------

const BREAKPOINT_MOBILE = 768;

// ---------------------------------------------------------------------------
// AppLayout
// ---------------------------------------------------------------------------

export interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Detect mobile vs non-mobile; auto-collapse only on initial load
  useEffect(() => {
    function update() {
      setIsMobile(window.innerWidth < BREAKPOINT_MOBILE);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const sidebarWidth = collapsed ? 56 : 240;

  return (
    <div className="relative min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Sidebar — non-mobile */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      )}

      {/* Main content */}
      <main
        className={cn(
          'flex min-h-screen flex-col',
          'transition-[margin-left] duration-300 ease-in-out',
          isMobile && 'pb-14'
        )}
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
        id="main-content"
      >
        <div className="flex flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Bottom nav — mobile only */}
      {isMobile && <BottomNav />}
    </div>
  );
}
