'use client';

import { useEffect } from 'react';
import { WarningCircle, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Global error boundary — catches unhandled errors in route segments
// ---------------------------------------------------------------------------

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="flex w-full max-w-md flex-col items-center gap-6 rounded-[var(--radius-2xl)] p-8 text-center"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--color-error-20)' }}
        >
          <WarningCircle size={32} weight="fill" color="var(--color-error)" />
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text)' }}
          >
            Something went wrong
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            An unexpected error occurred. Try refreshing or going back to the
            dashboard.
          </p>
          {error.digest && (
            <p
              className="mt-1 font-mono text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={reset}
            leftIcon={<ArrowCounterClockwise size={18} weight="bold" />}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => { window.location.href = '/dashboard'; }}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
