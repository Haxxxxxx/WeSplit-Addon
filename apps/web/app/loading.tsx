// ---------------------------------------------------------------------------
// Global loading fallback — shown while route segments are resolving
// ---------------------------------------------------------------------------

export default function GlobalLoading() {
  return (
    <div
      className="flex flex-1 items-center justify-center py-20"
      aria-label="Loading"
      role="status"
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderTopColor: 'var(--color-primary)',
          borderRightColor: 'var(--color-green-blue)',
        }}
      />
    </div>
  );
}
