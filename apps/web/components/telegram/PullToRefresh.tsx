'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Pull-to-refresh wrapper for Telegram Mini App pages
//
// Uses native touch events to detect pull-down gesture at the top of scroll.
// Shows a spinner indicator and calls `onRefresh` which should return a promise.
// ---------------------------------------------------------------------------

const THRESHOLD = 60; // px to pull before triggering refresh
const MAX_PULL = 100; // max visual pull distance
const SPINNER_SIZE = 24;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      // Only activate if scrolled to top
      const el = containerRef.current;
      if (el && el.scrollTop <= 0) {
        startY.current = touch.clientY;
        pulling.current = true;
      }
    },
    [refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta > 0) {
        // Apply resistance — diminishing returns as you pull further
        const distance = Math.min(delta * 0.5, MAX_PULL);
        setPullDistance(distance);
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6); // Keep indicator visible during refresh
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{
          height: showIndicator ? `${Math.max(pullDistance, refreshing ? 40 : 0)}px` : '0px',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            opacity: progress,
            transform: `rotate(${progress * 360}deg)`,
            transition: refreshing ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {refreshing ? (
            <div
              className="animate-spin rounded-full border-2 border-t-transparent"
              style={{
                width: SPINNER_SIZE,
                height: SPINNER_SIZE,
                borderColor: 'var(--color-primary)',
                borderTopColor: 'transparent',
              }}
            />
          ) : (
            <svg
              width={SPINNER_SIZE}
              height={SPINNER_SIZE}
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: 'var(--color-primary)' }}
            >
              <path
                d="M12 4v8m0 0l-3-3m3 3l3-3M6 20h12"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={progress}
              />
            </svg>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
