'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width — accepts any CSS value or a number (treated as px) */
  width?: string | number;
  /** Height — accepts any CSS value or a number (treated as px) */
  height?: string | number;
  /** Use shimmer animation instead of pulse */
  shimmer?: boolean;
  /** Border radius override */
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// ---------------------------------------------------------------------------
// Radius map
// ---------------------------------------------------------------------------

const radiusClass: Record<NonNullable<SkeletonProps['radius']>, string> = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  full: 'rounded-full',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      width,
      height,
      shimmer = false,
      radius = 'md',
      className,
      style,
      ...props
    },
    ref
  ) => {
    const resolvedStyle: React.CSSProperties = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn(
          shimmer ? 'skeleton-shimmer' : 'skeleton',
          radiusClass[radius],
          className
        )}
        style={resolvedStyle}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// ---------------------------------------------------------------------------
// Composed presets for common patterns
// ---------------------------------------------------------------------------

/** A skeleton that mimics a text line (full width, h-4) */
function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
          radius="sm"
        />
      ))}
    </div>
  );
}

/** A skeleton that mimics a circular avatar */
function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} radius="full" />;
}

/** A skeleton card placeholder */
function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-4 flex flex-col gap-3',
        className
      )}
    >
      {children ?? (
        <>
          <div className="flex items-center gap-3">
            <SkeletonAvatar size={40} />
            <div className="flex-1">
              <SkeletonText lines={2} />
            </div>
          </div>
          <SkeletonText lines={3} />
        </>
      )}
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard };
