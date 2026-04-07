'use client';

// ---------------------------------------------------------------------------
// TG sub-route error boundary — scoped to /tg/* routes
// Catches errors in nested TG pages (wallets, send, request, etc.)
// ---------------------------------------------------------------------------

export default function TgRouteError({
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

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
        style={{ backgroundColor: 'var(--color-error-20)' }}
      >
        ⚠️
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          {isNetworkError ? 'Connection Problem' : 'Something went wrong'}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isNetworkError
            ? 'Check your connection and try again.'
            : 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[200px]">
        <button
          onClick={reset}
          className="w-full rounded-xl py-3 text-sm font-semibold"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text-on-primary)' }}
        >
          Try Again
        </button>
        <button
          onClick={() => { window.location.href = '/tg'; }}
          className="w-full rounded-xl py-3 text-sm font-medium"
          style={{ backgroundColor: 'var(--color-white-10)', color: 'var(--color-text)' }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
