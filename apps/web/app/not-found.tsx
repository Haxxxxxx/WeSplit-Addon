import Link from 'next/link';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// 404 — Not found page
// ---------------------------------------------------------------------------

export default function NotFound() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* Big 404 number */}
        <div className="flex flex-col items-center gap-2">
          <span
            className="text-[120px] font-bold leading-none tracking-tighter"
            style={{
              background: 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </span>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--color-white-10)' }}
          >
            <MagnifyingGlass size={28} weight="regular" color="var(--color-text-secondary)" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text)' }}
          >
            Page not found
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <Link href="/dashboard" className="w-full max-w-xs">
          <Button variant="primary" fullWidth>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
