import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ---------------------------------------------------------------------------
// Class name utility
// ---------------------------------------------------------------------------

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

export function formatCurrency(
  amount: number,
  currency: 'USD' | 'USDC' | 'SOL' = 'USDC',
  options?: {
    decimals?: number;
    showSymbol?: boolean;
    compact?: boolean;
  }
): string {
  const { decimals = 2, showSymbol = true, compact = false } = options ?? {};

  if (currency === 'SOL') {
    const formatted = compact
      ? compactNumber(amount, decimals)
      : amount.toFixed(decimals);
    return showSymbol ? `${formatted} SOL` : formatted;
  }

  if (currency === 'USDC') {
    const formatted = compact
      ? compactNumber(amount, decimals)
      : amount.toFixed(decimals);
    return showSymbol ? `$${formatted}` : formatted;
  }

  // USD fallback via Intl
  return new Intl.NumberFormat('en-US', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
  }).format(amount);
}

function compactNumber(value: number, decimals: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Solana address formatting
// ---------------------------------------------------------------------------

export function formatAddress(
  address: string,
  options?: { chars?: number; separator?: string }
): string {
  const { chars = 4, separator = '...' } = options ?? {};
  if (!address || address.length <= chars * 2 + separator.length) return address;
  return `${address.slice(0, chars)}${separator}${address.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

export function formatDate(
  date: Date | string | number,
  options?: {
    format?: 'short' | 'long' | 'relative' | 'time';
    locale?: string;
  }
): string {
  const { format = 'short', locale = 'en-US' } = options ?? {};
  const d = date instanceof Date ? date : new Date(date);

  if (format === 'relative') {
    return formatRelativeDate(d);
  }

  if (format === 'time') {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  if (format === 'long') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }

  // short (default)
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date, { format: 'short' });
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Convert a hex color (#RRGGBB or #RGB) to rgba() with the given opacity (0–1). */
export function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Round USDC amount to 2 decimal places to avoid floating point precision issues
 * Matches mobile's roundUsdcAmount utility
 */
export function roundUsdcAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Sanitize amount input: block negatives and cap decimal places.
 * Returns the sanitized value, or `null` if the input should be rejected.
 */
export function sanitizeAmountInput(value: string, maxDecimals = 6): string | null {
  if (value.startsWith('-')) return null;
  const dot = value.indexOf('.');
  if (dot !== -1 && value.length - dot - 1 > maxDecimals) return null;
  return value;
}

/**
 * Blur active element when tapping outside inputs (keyboard dismiss).
 * Attach to `onPointerDown` on form container divs.
 */
export function dismissKeyboard(e: React.PointerEvent) {
  const tag = (e.target as HTMLElement).tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
    (document.activeElement as HTMLElement)?.blur();
  }
}

/** Convert Firestore Timestamp, Date, or date string/number to a JS Date */
export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}
