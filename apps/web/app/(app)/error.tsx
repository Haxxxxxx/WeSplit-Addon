'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { WarningCircle, ArrowCounterClockwise, House } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// App route group error boundary
// Catches errors in authenticated routes and provides recovery options
// ---------------------------------------------------------------------------

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console (in production, send to error tracking service)
    console.error('[AppError]', error);
  }, [error]);

  // Determine if this is a network/Firebase error
  const isNetworkError =
    error.message?.includes('network') ||
    error.message?.includes('offline') ||
    error.message?.includes('Failed to fetch');

  const isAuthError =
    error.message?.includes('auth') ||
    error.message?.includes('permission') ||
    error.message?.includes('unauthorized');

  return (
    <PageContainer>
      <div className="flex flex-1 items-center justify-center py-12">
        <Card className="w-full max-w-md text-center">
          <div className="flex flex-col items-center gap-5 py-6">
            {/* Error icon */}
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-error-20)' }}
            >
              <WarningCircle size={32} weight="fill" color="var(--color-error)" />
            </div>

            {/* Error message */}
            <div className="flex flex-col gap-2">
              <h1
                className="text-xl font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {isNetworkError
                  ? 'Connection Problem'
                  : isAuthError
                    ? 'Access Denied'
                    : 'Something went wrong'}
              </h1>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {isNetworkError
                  ? 'Please check your internet connection and try again.'
                  : isAuthError
                    ? 'You may not have permission to access this page.'
                    : 'An unexpected error occurred. Our team has been notified.'}
              </p>
              {error.digest && (
                <p
                  className="mt-2 font-mono text-xs"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  Error ID: {error.digest}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex w-full flex-col gap-3 mt-2">
              <Button
                variant="primary"
                fullWidth
                onClick={reset}
                leftIcon={<ArrowCounterClockwise size={18} weight="bold" />}
              >
                Try again
              </Button>
              <Link href="/dashboard" className="w-full">
                <Button
                  variant="secondary"
                  fullWidth
                  leftIcon={<House size={18} />}
                >
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
