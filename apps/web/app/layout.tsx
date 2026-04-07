import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from '@/providers';
import NavigationProgress from '@/components/layout/NavigationProgress';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'WeSplit',
  description: 'Decentralized social payments on Solana',
  keywords: ['payments', 'solana', 'crypto', 'split', 'web3'],
  icons: {
    icon: '/favicon.png',
    apple: '/wesplit-logo.png',
  },
  openGraph: {
    title: 'WeSplit',
    description: 'Decentralized social payments on Solana',
    type: 'website',
  },
};

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="var(--color-bg)" />
        {/* Fonts — loaded via globals.css @import for Tailwind v4 compat */}
      </head>
      <body className="min-h-screen antialiased" style={{ fontFamily: 'var(--font-family-body)' }}>
        <Providers>
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </Providers>
      </body>
    </html>
  );
}
