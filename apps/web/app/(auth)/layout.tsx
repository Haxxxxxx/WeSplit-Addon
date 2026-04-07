import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Auth group layout — centered card, no sidebar
// ---------------------------------------------------------------------------

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Ambient glow blobs */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: 'var(--color-primary)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full opacity-[0.04] blur-3xl"
        style={{ background: 'var(--color-green-blue)' }}
        aria-hidden="true"
      />

      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5 outline-none">
        <Image
          src="/wesplit-logo.png"
          alt="WeSplit"
          width={40}
          height={40}
          className="rounded-xl"
          priority
        />
        <span
          className="text-2xl font-bold tracking-tight"
          style={{
            background: 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          WeSplit
        </span>
      </Link>

      {/* Page content (the form card) */}
      <div className="w-full max-w-sm animate-slide-up">
        {children}
      </div>
    </div>
  );
}
