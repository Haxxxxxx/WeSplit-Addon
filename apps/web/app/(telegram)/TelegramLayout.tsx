'use client';

import type { ReactNode } from 'react';
import { TelegramProvider, useTelegram } from '@/providers/TelegramProvider';
import { PageTransition } from '@/components/telegram/PageTransition';
import TgBottomNav from '@/components/telegram/TgBottomNav';

// ---------------------------------------------------------------------------
// Client-side Telegram layout shell
//
// Handles SDK initialization loading state + provides the TWA chrome.
// Separated from layout.tsx because Next.js server components can't use hooks.
// ---------------------------------------------------------------------------

function TelegramContent({ children }: { children: ReactNode }) {
  const { loading, error, retry, telegramUser, isInTelegram } = useTelegram();

  // Loading state while SDK + auth initialize
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Loading WeSplit...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-error)]/10">
            <span className="text-2xl">!</span>
          </div>
          <p className="text-base font-medium text-[var(--color-text)]">
            Something went wrong
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
          <button
            onClick={retry}
            className="mt-2 rounded-xl px-6 py-3 text-sm font-semibold"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-bg)',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Dev mode: show notice if not in actual Telegram
  const devBanner =
    process.env.NODE_ENV === 'development' && !isInTelegram ? (
      <div className="sticky top-0 z-50 bg-yellow-500/90 px-3 py-1.5 text-center text-xs font-medium text-black">
        Dev Mode — Not inside Telegram WebView
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      {devBanner}
      <div className="mx-auto w-full max-w-[430px]">
        <PageTransition>{children}</PageTransition>
      </div>
      <TgBottomNav />
    </div>
  );
}

export function TelegramLayout({ children }: { children: ReactNode }) {
  return (
    <TelegramProvider>
      <TelegramContent>{children}</TelegramContent>
    </TelegramProvider>
  );
}
