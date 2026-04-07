import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// PageHeader — consistent page title + optional subtitle + right slot
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, rightElement, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="flex flex-col gap-0.5">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightElement && (
        <div className="shrink-0">{rightElement}</div>
      )}
    </div>
  );
}
