'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Global navigation progress bar — shows instantly on link click,
 * before Next.js starts compiling/fetching the target page.
 * Hides automatically when the route transition completes.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Route changed → hide bar
  useEffect(() => {
    setVisible(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [pathname, searchParams]);

  // Intercept internal link clicks → show bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;

      // Skip if modifier keys (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Skip if same page
      if (href === pathname) return;

      // Show progress bar immediately
      setVisible(true);
      setProgress(20);

      // Simulate progress ticking up (slows down as it approaches 90%)
      if (timerRef.current) clearInterval(timerRef.current);
      let current = 20;
      timerRef.current = setInterval(() => {
        current += (90 - current) * 0.08;
        setProgress(current);
        if (current > 88) {
          clearInterval(timerRef.current);
        }
      }, 100);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-end))',
          boxShadow: '0 0 8px var(--color-primary)',
        }}
      />
    </div>
  );
}
