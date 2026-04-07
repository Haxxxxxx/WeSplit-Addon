'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  inputSize?: 'sm' | 'md' | 'lg';
  /** Fills 100% width — default true */
  fullWidth?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onRightIconClick,
      inputSize = 'md',
      fullWidth = true,
      className,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const heightClass =
      inputSize === 'sm'
        ? 'h-[var(--height-input-sm)]'
        : inputSize === 'lg'
        ? 'h-[var(--height-input-lg)]'
        : 'h-[var(--height-input)]'; // 48px — matches spacing.inputHeight

    const paddingClass =
      inputSize === 'sm' ? 'px-3 text-sm' : inputSize === 'lg' ? 'px-5 text-lg' : 'px-4 text-base';

    const hasError = Boolean(error);

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth ? 'w-full' : '')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text-secondary)] leading-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {/* Left icon */}
          {leftIcon && (
            <span className="absolute left-3.5 flex items-center justify-center text-[var(--color-text-tertiary)] pointer-events-none z-10">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              // Base layout
              'w-full flex items-center',
              heightClass,
              paddingClass,

              // Typography
              'font-[family-name:var(--font-family-body)]',
              'text-[var(--color-text)]',
              'placeholder:text-[var(--color-text-disabled)]',

              // Appearance
              'bg-[var(--color-white-10)]',
              'rounded-[var(--radius-lg)]',
              'border border-[var(--color-border)]',

              // Transitions
              'transition-all duration-[var(--duration-normal)]',
              'outline-none',

              // Focus
              'focus:border-[var(--color-primary)]',
              'focus:bg-[var(--color-white-10)]',
              'focus:ring-1 focus:ring-[var(--color-primary)]',
              'focus:shadow-[0_0_0_3px_var(--color-primary-dim)]',

              // Error state
              hasError && 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)] focus:shadow-[0_0_0_3px_var(--color-error-20)]',

              // Disabled
              'disabled:opacity-40 disabled:cursor-not-allowed',

              // Icon padding adjustments
              leftIcon ? 'pl-10' : '',
              rightIcon ? 'pr-10' : '',

              className
            )}
            {...props}
          />

          {/* Right icon */}
          {rightIcon && (
            <span
              className={cn(
                'absolute right-3.5 flex items-center justify-center text-[var(--color-text-tertiary)] z-10',
                onRightIconClick
                  ? 'cursor-pointer hover:text-[var(--color-text)] transition-colors duration-[var(--duration-fast)]'
                  : 'pointer-events-none'
              )}
              onClick={onRightIconClick}
              role={onRightIconClick ? 'button' : undefined}
              tabIndex={onRightIconClick ? 0 : undefined}
            >
              {rightIcon}
            </span>
          )}
        </div>

        {/* Error / hint text */}
        {(error || hint) && (
          <p
            className={cn(
              'text-xs leading-normal',
              hasError
                ? 'text-[var(--color-error)]'
                : 'text-[var(--color-text-tertiary)]'
            )}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
