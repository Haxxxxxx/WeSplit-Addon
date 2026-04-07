'use client';

import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-side slot: buttons, dropdowns, etc. */
  actions?: React.ReactNode;
  /** Breadcrumb trail rendered above the title */
  breadcrumb?: BreadcrumbItem[];
  /** Extra className on the root element */
  className?: string;
  /** Add a visible bottom border / divider */
  divider?: boolean;
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export default function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  className,
  divider = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-1',
        divider && 'border-b border-white/[0.08] pb-5',
        className
      )}
    >
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumb.map((crumb, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <li key={index} className="flex items-center gap-1">
                  {/* Separator — rendered before every item except the first */}
                  {index > 0 && (
                    <CaretRight
                      size={12}
                      weight="bold"
                      className="flex-shrink-0 text-[var(--color-text-secondary)]/50"
                      aria-hidden="true"
                    />
                  )}

                  {isLast || !crumb.href ? (
                    // Last item or no href → plain text, not a link
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isLast
                          ? 'text-[var(--color-text-secondary)]'
                          : 'text-[var(--color-text-secondary)]/60'
                      )}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className={cn(
                        'text-xs font-medium transition-colors duration-150',
                        'text-[var(--color-text-secondary)]/60',
                        'hover:text-[var(--color-text-secondary)]',
                        'outline-none focus-visible:underline'
                      )}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: title + subtitle */}
        <div className="flex flex-col gap-1 min-w-0">
          <h1
            className={cn(
              'text-2xl font-bold leading-tight tracking-tight text-[var(--color-text)]',
              'sm:text-3xl'
            )}
          >
            {title}
          </h1>

          {subtitle && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-prose">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: actions slot */}
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
