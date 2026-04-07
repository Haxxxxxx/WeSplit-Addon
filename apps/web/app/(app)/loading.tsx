// ---------------------------------------------------------------------------
// App group loading skeleton — shown instantly during route transitions
// ---------------------------------------------------------------------------

export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
        style={{
          borderTopColor: 'var(--color-primary)',
          borderRightColor: 'var(--color-green-blue)',
        }}
      />
    </div>
  );
}
