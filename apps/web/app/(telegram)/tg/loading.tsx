// ---------------------------------------------------------------------------
// TG root loading skeleton — shown during TG dashboard route transition
// ---------------------------------------------------------------------------

export default function TgLoading() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Balance hero */}
      <div className="flex flex-col items-center gap-3 px-4 pt-10 pb-6">
        <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-10 w-40 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-white-10)' }} />
      </div>

      {/* Action buttons row */}
      <div className="mb-6 flex justify-center gap-4 px-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }} />
            <div className="h-3 w-10 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="flex-1 rounded-t-3xl px-4 pt-4" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="mb-4 h-5 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }} />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
                <div className="h-3 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-8)' }} />
              </div>
              <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--color-white-10)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
