'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// Spinner (internal)
// ---------------------------------------------------------------------------

function ButtonSpinner({ size }: { size: ButtonSize }) {
  const dimension = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <span
      className="animate-spin rounded-full border-2 border-current border-t-transparent shrink-0"
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Variant base classes (non-primary)
// ---------------------------------------------------------------------------

const variantClasses: Record<ButtonVariant, string> = {
  primary: '', // handled separately with gradient
  secondary: [
    'bg-[var(--color-white-10)]',
    'text-[var(--color-text)]',
    'border border-[var(--color-border)]',
    'hover:bg-[var(--color-white-20)]',
    'active:bg-[var(--color-white-10)]',
  ].join(' '),
  outline: [
    'bg-transparent',
    'text-[var(--color-primary)]',
    'border border-[var(--color-primary)]',
    'hover:bg-[var(--color-primary-dim)]',
    'active:bg-transparent',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'text-[var(--color-text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--color-white-10)]',
    'hover:text-[var(--color-text)]',
    'active:bg-[var(--color-white-5)]',
  ].join(' '),
  danger: [
    'bg-[var(--color-error-20)]',
    'text-[var(--color-error)]',
    'border border-[var(--color-error)]',
    'hover:bg-[var(--color-error)]',
    'hover:text-[var(--color-white)]',
    'active:opacity-90',
  ].join(' '),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[var(--height-button-sm)] px-4 text-sm gap-1.5 rounded-[var(--radius-md)]',
  md: 'h-[var(--height-button)] px-6 text-lg gap-2 rounded-[var(--radius-lg)]',
  lg: 'h-[var(--height-button-lg)] px-8 text-lg gap-2.5 rounded-[var(--radius-xl)]',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseClasses = [
      'inline-flex items-center justify-center',
      'font-medium font-[family-name:var(--font-family-body)]',
      'transition-all duration-[var(--duration-normal)]',
      'select-none cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      fullWidth ? 'w-full' : '',
      sizeClasses[size],
    ].join(' ');

    if (variant === 'primary') {
      return (
        <button
          ref={ref}
          disabled={isDisabled}
          className={cn(
            baseClasses,
            // gradient background via inline style for reliability
            'text-[var(--color-black)] relative overflow-hidden',
            'before:absolute before:inset-0 before:bg-[var(--color-white-20)] before:opacity-0',
            'hover:before:opacity-100 before:transition-opacity before:duration-[var(--duration-normal)]',
            'active:scale-[0.98]',
            'shadow-[var(--shadow-primary-glow)]',
            'disabled:shadow-none',
            className
          )}
          style={{
            background: isDisabled
              ? 'rgba(165, 234, 21, 0.4)'
              : 'linear-gradient(90deg, #A5EA15, #53EF97)',
          }}
          {...props}
        >
          {loading ? (
            <ButtonSpinner size={size} />
          ) : (
            <>
              {leftIcon && <span className="shrink-0">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="shrink-0">{rightIcon}</span>}
            </>
          )}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          baseClasses,
          variantClasses[variant],
          'active:scale-[0.98]',
          className
        )}
        {...props}
      >
        {loading ? (
          <ButtonSpinner size={size} />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
