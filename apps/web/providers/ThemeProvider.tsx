'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useAppStore } from '@/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'wesplit-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.ui.theme);
  const setStoreTheme = useAppStore((s) => s.setTheme);

  // -------------------------------------------------------------------
  // Hydrate from localStorage on mount (client only)
  // -------------------------------------------------------------------

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && (stored === 'light' || stored === 'dark')) {
        setStoreTheme(stored);
      }
    } catch {
      // localStorage unavailable (SSR or incognito) — use default
    }
  }, [setStoreTheme]);

  // -------------------------------------------------------------------
  // Sync data-theme attribute on <html> whenever theme changes
  // -------------------------------------------------------------------

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    // Also toggle a class for Tailwind dark mode (class strategy)
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Persist choice
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Silently ignore write failures
    }
  }, [theme]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const toggleTheme = useCallback(() => {
    setStoreTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setStoreTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setStoreTheme(next);
    },
    [setStoreTheme],
  );

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
