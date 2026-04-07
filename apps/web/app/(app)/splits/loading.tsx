// ---------------------------------------------------------------------------
// Splits list loading skeleton
// ---------------------------------------------------------------------------

export default function SplitsLoading() {
  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Header + CTA row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-9 w-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />
      </div>

      {/* Split cards */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
                <div className="h-3 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }} />
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-8)' }} />
            <div className="mt-2 flex justify-between">
              <div className="h-3 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
              <div className="h-3 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
