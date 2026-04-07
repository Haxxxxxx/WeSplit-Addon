'use client';

import type { ReactElement } from 'react';

interface TgPageHeaderProps {
  icon: ReactElement;
  title: string;
  subtitle?: string;
}

/**
 * Standard page header for TG Mini App pages.
 * Renders a gradient icon box + title/subtitle.
 */
export function TgPageHeader({ icon, title, subtitle }: TgPageHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
      >
        {icon}
      </div>
      <div>
        <h1
          className="font-bold"
          style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
