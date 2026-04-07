'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { WalletProvider } from './WalletProvider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';

// ---------------------------------------------------------------------------
// Root providers — wrap <body> children in app/layout.tsx
//
// Order matters:
// 1. QueryProvider  — TanStack Query available everywhere
// 2. ThemeProvider   — theme attribute on <html> before paint
// 3. WalletProvider  — Solana wallet context
// 4. AuthProvider    — Firebase auth + Firestore user sync
// ---------------------------------------------------------------------------

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <WalletProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </WalletProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

// Re-export hooks for convenience
export { useAuth } from './AuthProvider';
export { useTheme } from './ThemeProvider';
