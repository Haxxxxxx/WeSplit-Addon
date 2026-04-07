'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ---------------------------------------------------------------------------
// Query client defaults — aligned with mobile app patterns
// ---------------------------------------------------------------------------

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data considered fresh for 30 s — avoids redundant refetches on tab focus
        staleTime: 30 * 1000,
        // Unused cache entries are garbage-collected after 5 min
        gcTime: 5 * 60 * 1000,
        // Retry transient failures twice before surfacing the error
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        // Refetch when the user comes back to the tab
        refetchOnWindowFocus: true,
        // Don't refetch on mount if data is still fresh
        refetchOnMount: true,
      },
      mutations: {
        // Mutations should not auto-retry — let the caller decide
        retry: false,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Singleton for SSR — avoid creating a new client on every render on the server
// ---------------------------------------------------------------------------

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new client (prevents cross-request leakage)
    return makeQueryClient();
  }
  // Browser: reuse a single instance
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
