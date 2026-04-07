'use client';

import { WarningCircle, ArrowCounterClockwise, House } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Telegram route group error boundary
// Catches errors in Telegram Mini App routes and provides recovery options
// ---------------------------------------------------------------------------

export default function TelegramError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // TODO: Send to error tracking service (Sentry/LogRocket) when integrated

  const isNetworkError =
    error.message?.includes('network') ||
    error.message?.includes('offline') ||
    error.message?.includes('Failed to fetch');

  const isWalletError =
    error.message?.toLowerCase().includes('wallet') ||
    error.message?.toLowerCase().includes('decrypt') ||
    error.message?.toLowerCase().includes('pin');

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        <Card className="text-center">
          <div className="flex flex-col items-center gap-5 py-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-error-20)' }}
            >
              <WarningCircle size={28} weight="fill" color="var(--color-error)" />
            </div>

            <div className="flex flex-col gap-2">
              <h1
                className="text-lg font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {isNetworkError
                  ? 'Connection Problem'
                  : isWalletError
                    ? 'Wallet Error'
                    : 'Something went wrong'}
              </h1>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {isNetworkError
                  ? 'Please check your internet connection and try again.'
                  : isWalletError
                    ? 'There was a problem with your wallet. Please try again.'
                    : 'An unexpected error occurred. Please try again.'}
              </p>
              {error.digest && (
                <p
                  className="mt-1 font-mono text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Ref: {error.digest}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 mt-2">
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
                onClick={() => { window.location.href = '/tg'; }}
                leftIcon={<House size={18} />}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
