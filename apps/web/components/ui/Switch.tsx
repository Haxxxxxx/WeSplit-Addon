'use client';

import * as React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  /** Position of the label relative to the switch */
  labelPosition?: 'left' | 'right';
  name?: string;
  id?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

const dimensions = {
  sm: { track: 'w-8 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3.5' },
  md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  SwitchProps
>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      disabled = false,
      label,
      description,
      labelPosition = 'right',
      name,
      id,
      className,
      size = 'md',
    },
    ref
  ) => {
    const generatedId = React.useId();
    const switchId = id ?? generatedId;
    const dim = dimensions[size];

    const switchElement = (
      <RadixSwitch.Root
        ref={ref}
        id={switchId}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex shrink-0 items-center cursor-pointer rounded-full',
          dim.track,
          // Track background — grey unchecked, gradient checked
          'bg-[var(--color-white-20)]',
          'transition-all duration-[var(--duration-slow)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          // Checked state — gradient background
          'data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[var(--color-gradient-start)] data-[state=checked]:to-[var(--color-gradient-end)]',
          'data-[state=checked]:shadow-[0_0_12px_rgba(165,234,21,0.35)]'
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block rounded-full',
            dim.thumb,
            'bg-[var(--color-white)]',
            'shadow-[0_1px_4px_rgba(0,0,0,0.30)]',
            'transition-transform duration-[var(--duration-slow)]',
            'will-change-transform',
            'translate-x-0.5',
            `data-[state=checked]:${dim.translate}`
          )}
        />
      </RadixSwitch.Root>
    );

    if (!label && !description) {
      return <span className={className}>{switchElement}</span>;
    }

    return (
      <label
        htmlFor={switchId}
        className={cn(
          'flex items-center gap-3',
          labelPosition === 'left' && 'flex-row-reverse',
          disabled && 'cursor-not-allowed opacity-60',
          !disabled && 'cursor-pointer',
          className
        )}
      >
        {switchElement}

        {(label || description) && (
          <div className="flex flex-col gap-0.5 min-w-0">
            {label && (
              <span className="text-sm font-medium text-[var(--color-text)] leading-tight">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-[var(--color-text-secondary)] leading-normal">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
