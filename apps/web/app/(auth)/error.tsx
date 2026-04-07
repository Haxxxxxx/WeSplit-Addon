'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { WarningCircle, ArrowCounterClockwise, ArrowLeft } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Auth route group error boundary
// Catches errors in login/signup flows and provides recovery options
// ---------------------------------------------------------------------------

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console (in production, send to error tracking service)
    console.error('[AuthError]', error);
  }, [error]);

  // Check for specific Firebase Auth errors
  const isFirebaseError = error.message?.includes('Firebase');
  const isNetworkError =
    error.message?.includes('network') ||
    error.message?.includes('Failed to fetch');

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/wesplit-logo.png"
              alt="WeSplit"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span
              className="text-xl font-bold"
              style={{
                background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-end) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              WeSplit
            </span>
          </Link>
        </div>

        {/* Error card */}
        <Card className="text-center">
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Error icon */}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-error-20)' }}
            >
              <WarningCircle size={28} weight="fill" color="var(--color-error)" />
            </div>

            {/* Error message */}
            <div className="flex flex-col gap-2">
              <h1
                className="text-lg font-bold"
                style={{ color: 'var(--color-text)' }}
              >
                {isNetworkError
                  ? 'Connection Problem'
                  : isFirebaseError
                    ? 'Authentication Error'
                    : 'Login Failed'}
              </h1>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {isNetworkError
                  ? 'Please check your internet connection and try again.'
                  : 'We couldn\'t complete your request. Please try again.'}
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
              <Link href="/login" className="w-full">
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<ArrowLeft size={18} />}
                >
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {/* Help text */}
        <p
          className="mt-6 text-center text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Need help?{' '}
          <a
            href="mailto:support@wesplit.app"
            className="underline transition-colors hover:text-[var(--color-primary)]"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
