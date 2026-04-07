// ---------------------------------------------------------------------------
// Transactions list loading skeleton
// ---------------------------------------------------------------------------

export default function TransactionsLoading() {
  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div className="mb-6 h-8 w-40 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {[80, 64, 72, 60].map((w, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-full"
            style={{ width: w, backgroundColor: 'var(--color-white-10)' }}
          />
        ))}
      </div>

      {/* Transaction rows */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
              <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
            </div>
            <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
