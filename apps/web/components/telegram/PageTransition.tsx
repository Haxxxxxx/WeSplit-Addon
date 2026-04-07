'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Page transition wrapper for Telegram Mini App
//
// Animates page content in on route change with a slide-up + fade effect,
// matching the feel of React Navigation's stack push transition in the
// mobile app. Lightweight — pure CSS animations, no external deps.
// ---------------------------------------------------------------------------

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Determine direction: going deeper = slide-up, going back = fade-in
      const prevDepth = prevPathname.current.split('/').length;
      const nextDepth = pathname.split('/').length;

      if (nextDepth > prevDepth) {
        // Navigating deeper → slide up (like stack push)
        setAnimationClass('tg-page-enter-push');
      } else if (nextDepth < prevDepth) {
        // Navigating back → slide down (like stack pop)
        setAnimationClass('tg-page-enter-pop');
      } else {
        // Same depth → fade
        setAnimationClass('tg-page-enter-fade');
      }

      prevPathname.current = pathname;

      // Clear animation class after it completes so it can re-trigger
      const timer = setTimeout(() => setAnimationClass(''), 300);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div className={animationClass}>
      {children}
    </div>
  );
}
