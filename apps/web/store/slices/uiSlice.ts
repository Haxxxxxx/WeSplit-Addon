/**
 * UI State Slice
 * Manages UI-related state like loading, errors, theme, language, network status
 * Web adaptation — theme toggle updates document.documentElement.dataset.theme
 * for CSS variable switching (e.g. [data-theme="dark"] { --bg: #000; })
 */

import { StateCreator } from 'zustand';
import type { UIState, UIActions, AppStore } from '../types';

export const createUISlice: StateCreator<
  AppStore,
  [],
  [],
  UIState & UIActions
> = (set) => ({
  // Initial state
  isLoading: false,
  error: null,
  theme: 'dark', // Default to dark theme for WeSplit
  language: 'en',
  networkStatus: 'online',

  // Actions
  setLoading: (loading: boolean) => {
    set((state) => ({
      ui: {
        ...state.ui,
        isLoading: loading,
      },
    }));
  },

  setError: (error: string | null) => {
    set((state) => ({
      ui: {
        ...state.ui,
        error,
      },
    }));

    if (error) {
      console.error('[UISlice] UI Error set', { error });
    }
  },

  clearError: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        error: null,
      },
    }));
  },

  setTheme: (theme: 'light' | 'dark') => {
    // Update CSS theme attribute on the root element for CSS variable switching
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
      // Also set class for Tailwind dark mode if using class strategy
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    set((state) => ({
      ui: {
        ...state.ui,
        theme,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[UISlice] Theme changed', { theme });
  },

  setLanguage: (language: string) => {
    // Update html lang attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }

    set((state) => ({
      ui: {
        ...state.ui,
        language,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[UISlice] Language changed', { language });
  },

  setNetworkStatus: (status: 'online' | 'offline') => {
    set((state) => ({
      ui: {
        ...state.ui,
        networkStatus: status,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[UISlice] Network status changed', { status });
  },
});
