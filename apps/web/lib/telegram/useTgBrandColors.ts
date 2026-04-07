'use client';

import { useMemo } from 'react';

/**
 * Returns the brand colors for Telegram MainButton styling.
 * Reads CSS custom properties from the document root.
 */
export function useTgBrandColors() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { color: '#A5EA15', textColor: 'var(--color-bg)' };
    }
    const style = getComputedStyle(document.documentElement);
    return {
      color: style.getPropertyValue('--color-primary').trim() || '#A5EA15',
      textColor: style.getPropertyValue('--color-bg').trim() || 'var(--color-bg)',
    };
  }, []);
}
