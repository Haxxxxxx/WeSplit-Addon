import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { TelegramLayout as TelegramShell } from './TelegramLayout';

// ---------------------------------------------------------------------------
// Telegram Mini App route group layout
//
// Wraps all /tg/* routes. Mobile-optimized, no sidebar, no bottom nav.
// TelegramProvider handles SDK init + Telegram → Firebase auth bridge.
//
// The root layout's Providers (Query, Theme, Wallet, Auth) are still active.
// signInWithCustomToken triggers onAuthStateChanged, so AuthProvider auto-syncs.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'WeSplit — Telegram',
  description: 'WeSplit payments inside Telegram',
};

// Telegram Mini Apps need these viewport settings
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function Layout({ children }: { children: ReactNode }) {
  return <TelegramShell>{children}</TelegramShell>;
}
