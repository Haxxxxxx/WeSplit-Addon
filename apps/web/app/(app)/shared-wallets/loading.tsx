// ---------------------------------------------------------------------------
// Shared wallets list loading skeleton
// ---------------------------------------------------------------------------

export default function SharedWalletsLoading() {
  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Header + CTA row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-9 w-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />
      </div>

      {/* Wallet cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-white-10)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-36 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
                <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-5 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
                <div className="h-3 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
              </div>
            </div>
            {/* Member avatars row */}
            <div className="mt-3 flex gap-1">
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="h-7 w-7 animate-pulse rounded-full"
                  style={{ backgroundColor: 'var(--color-white-10)' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
