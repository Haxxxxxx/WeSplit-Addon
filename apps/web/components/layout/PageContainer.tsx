'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PageContainer
//
// Wraps page-level content with a capped max-width (1200px), consistent
// horizontal padding, and vertical spacing.
// ---------------------------------------------------------------------------

export interface PageContainerProps {
  children: React.ReactNode;
  /** Override the default max-width (default: 1200px) */
  maxWidth?: string | number;
  /** Extra className applied to the outer wrapper */
  className?: string;
  /** Remove horizontal padding — useful for full-bleed sections */
  noPadding?: boolean;
  /** Add extra vertical padding at the top */
  topSpacing?: 'none' | 'sm' | 'md' | 'lg';
}

const topSpacingMap: Record<NonNullable<PageContainerProps['topSpacing']>, string> = {
  none: 'pt-0',
  sm:   'pt-4',
  md:   'pt-6',
  lg:   'pt-10',
};

export default function PageContainer({
  children,
  maxWidth = 1200,
  className,
  noPadding = false,
  topSpacing = 'md',
}: PageContainerProps) {
  const maxWidthValue = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;

  return (
    <div
      className={cn(
        'mx-auto w-full flex-1',
        !noPadding && 'px-4 sm:px-6 lg:px-8',
        topSpacingMap[topSpacing],
        'pb-8',
        className
      )}
      style={{ maxWidth: maxWidthValue }}
    >
      {children}
    </div>
  );
}
