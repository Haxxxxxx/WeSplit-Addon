'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Subtle hover lift effect */
  hoverable?: boolean;
  /** Gradient border on hover */
  gradientBorder?: boolean;
  /** Always show gradient border */
  gradientBorderAlways?: boolean;
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Border radius preset */
  radius?: 'md' | 'lg' | 'xl' | '2xl';
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const radiusClasses: Record<NonNullable<CardProps['radius']>, string> = {
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  '2xl': 'rounded-[var(--radius-2xl)]',
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      hoverable = false,
      gradientBorder = false,
      gradientBorderAlways = false,
      padding = 'md',
      radius = 'xl',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const needsGradientBorder = gradientBorder || gradientBorderAlways;

    return (
      <div
        ref={ref}
        className={cn(
          'bg-[var(--color-surface)]',
          'border border-[var(--color-border)]',
          radiusClasses[radius],
          paddingClasses[padding],

          // Hover effects
          hoverable && [
            'cursor-pointer',
            'transition-all duration-[var(--duration-slow)]',
            'hover:border-[var(--color-border-strong)]',
            'hover:shadow-[var(--shadow-card-hover)]',
            'hover:-translate-y-0.5',
          ],

          // Gradient border via pseudo-element
          needsGradientBorder && 'gradient-border',
          gradientBorder && !gradientBorderAlways && 'hover:[&.gradient-border]:before:opacity-100 [&.gradient-border]:before:opacity-0',

          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ---------------------------------------------------------------------------
// Card sub-components
// ---------------------------------------------------------------------------

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 pb-4', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-bold text-[var(--color-text)] leading-tight', className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-[var(--color-text-secondary)] leading-normal', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 pt-4 mt-4',
        'border-t border-[var(--color-border)]',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

// ---------------------------------------------------------------------------
// Specialty: gradient hero card (used for wallet balance display)
// ---------------------------------------------------------------------------

export interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  radius?: CardProps['radius'];
}

const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  ({ radius = 'xl', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        radiusClasses[radius],
        // Gradient glow overlay top-right
        'before:absolute before:inset-0 before:rounded-[inherit]',
        'before:bg-[radial-gradient(ellipse_at_top_right,rgba(83,239,151,0.12),transparent_60%)]',
        'before:pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
HeroCard.displayName = 'HeroCard';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, HeroCard };
