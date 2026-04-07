'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** If true, renders a gradient spinner (uses SVG). Default: false (CSS-only). */
  gradient?: boolean;
  className?: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Size maps
// ---------------------------------------------------------------------------

const sizePx: Record<SpinnerSize, number> = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 32,
  xl: 48,
};

const strokeWidth: Record<SpinnerSize, number> = {
  xs: 2,
  sm: 2,
  md: 2.5,
  lg: 3,
  xl: 3.5,
};

// ---------------------------------------------------------------------------
// CSS-only spinner (border trick)
// ---------------------------------------------------------------------------

function CssSpinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  const px = sizePx[size];
  return (
    <span
      className={cn('inline-block animate-spin rounded-full shrink-0', className)}
      style={{
        width: px,
        height: px,
        borderWidth: strokeWidth[size],
        borderStyle: 'solid',
        borderColor: 'var(--color-white-20)',
        borderTopColor: 'var(--color-primary)',
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Gradient SVG spinner
// ---------------------------------------------------------------------------

function GradientSpinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  const px = sizePx[size];
  const sw = strokeWidth[size];
  const r = (px - sw) / 2;
  const cx = px / 2;
  const cy = px / 2;
  // Arc: 3/4 of circumference
  const circumference = 2 * Math.PI * r;
  const dashArray = `${circumference * 0.75} ${circumference * 0.25}`;

  const gradId = React.useId();

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      className={cn('animate-spin shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A5EA15" />
          <stop offset="100%" stopColor="#53EF97" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={sw}
      />
      {/* Arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={`url(#${gradId})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const Spinner = React.forwardRef<
  HTMLSpanElement,
  SpinnerProps & React.HTMLAttributes<HTMLSpanElement>
>(({ size = 'md', gradient = false, className, label = 'Loading…', ...props }, ref) => {
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      {gradient ? (
        <GradientSpinner size={size} />
      ) : (
        <CssSpinner size={size} />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
});

Spinner.displayName = 'Spinner';

export { Spinner };
