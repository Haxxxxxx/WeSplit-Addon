'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'orange'
  | 'primary'
  | 'outline';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a dot indicator before the label */
  dot?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Variant styles
// ---------------------------------------------------------------------------

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-white-10)] text-[var(--color-text-secondary)] border-transparent',
  primary: 'bg-[var(--color-primary-dim)] text-[var(--color-primary)] border-transparent',
  success: 'bg-[var(--color-success-20)] text-[var(--color-success)] border-transparent',
  warning: 'bg-[var(--color-warning-20)] text-[var(--color-warning)] border-transparent',
  error: 'bg-[var(--color-error-20)] text-[var(--color-error)] border-transparent',
  info: 'bg-[var(--color-info-20)] text-[var(--color-info)] border-transparent',
  orange: 'bg-[var(--color-orange-20)] text-[var(--color-orange)] border-transparent',
  outline: 'bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)]',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-error)]',
  info: 'bg-[var(--color-info)]',
  orange: 'bg-[var(--color-orange)]',
  outline: 'bg-[var(--color-text-secondary)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      dot = false,
      leftIcon,
      rightIcon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium',
          'border rounded-full',
          'leading-none whitespace-nowrap',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('rounded-full shrink-0', dotColors[variant], size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5')}
            aria-hidden="true"
          />
        )}
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
