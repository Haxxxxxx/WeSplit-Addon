// ---------------------------------------------------------------------------
// Rewards page loading skeleton
// ---------------------------------------------------------------------------

export default function RewardsLoading() {
  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Header */}
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />

      {/* Points hero card */}
      <div
        className="mb-6 rounded-2xl p-6"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
          <div className="h-12 w-32 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--color-white-10)' }} />
          <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
            <div className="mt-2 h-6 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
          </div>
        ))}
      </div>

      {/* Badge section header */}
      <div className="mb-3 h-5 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
      {/* Badge grid */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl p-3"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="h-12 w-12 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }} />
            <div className="h-3 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
