'use client';

import { Button } from '@/components/ui/Button';

interface TransactionErrorBannerProps {
  error: string;
  onRetry?: () => void;
}

/**
 * Inline error banner for transaction failures.
 * Shows error message with optional retry button.
 */
export function TransactionErrorBanner({ error, onRetry }: TransactionErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
    >
      <span className="text-sm flex-1">{error}</span>
      {onRetry && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRetry}
          style={{ color: 'var(--color-error)' }}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
