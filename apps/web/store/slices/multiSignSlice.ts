/**
 * Multi-Signature State Slice
 * Manages multi-signature wallet state and operations
 * Web adaptation — simplified stubs that update state; actual multi-sign
 * logic will be wired to backend services later
 */

import { StateCreator } from 'zustand';
import type { MultiSignState, MultiSignActions, AppStore } from '../types';

export const createMultiSignSlice: StateCreator<
  AppStore,
  [],
  [],
  MultiSignState & MultiSignActions
> = (set, get) => ({
  // Initial state
  isEnabled: false,
  remainingDays: 0,
  isActivating: false,
  isDeactivating: false,
  isLoading: false,
  error: null,

  // Actions
  setEnabled: (enabled: boolean) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isEnabled: enabled,
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[MultiSignSlice] Multi-signature status changed', { enabled });
  },

  setRemainingDays: (days: number) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        remainingDays: days,
      },
    }));
  },

  setActivating: (activating: boolean) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isActivating: activating,
      },
    }));
  },

  setDeactivating: (deactivating: boolean) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isDeactivating: deactivating,
      },
    }));
  },

  setMultiSignLoading: (loading: boolean) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isLoading: loading,
      },
    }));
  },

  setMultiSignError: (error: string | null) => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        error,
      },
    }));
  },

  clearMultiSignError: () => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        error: null,
      },
    }));
  },

  loadMultiSignState: async () => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isLoading: true,
        error: null,
      },
    }));

    try {
      // TODO: Wire to backend MultiSignStateService when ready
      // For now, just mark as loaded with defaults
      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isEnabled: false,
          remainingDays: 0,
          isLoading: false,
          error: null,
        },
      }));

      if (process.env.NODE_ENV !== 'production') console.log('[MultiSignSlice] Multi-signature state loaded (stub)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load multi-signature state';

      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isLoading: false,
          error: errorMessage,
        },
      }));

      console.error('[MultiSignSlice] Failed to load multi-signature state', { error: errorMessage });
    }
  },

  activateMultiSign: async () => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isActivating: true,
        error: null,
      },
    }));

    try {
      // TODO: Wire to backend MultiSignStateService.activateMultiSign()
      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isEnabled: true,
          isActivating: false,
          remainingDays: 7, // Default activation period
          error: null,
        },
      }));

      if (process.env.NODE_ENV !== 'production') console.log('[MultiSignSlice] Multi-signature activated (stub)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate multi-signature';

      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isActivating: false,
          error: errorMessage,
        },
      }));

      console.error('[MultiSignSlice] Failed to activate multi-signature', { error: errorMessage });
    }
  },

  deactivateMultiSign: async () => {
    set((state) => ({
      multiSign: {
        ...state.multiSign,
        isDeactivating: true,
        error: null,
      },
    }));

    try {
      // TODO: Wire to backend MultiSignStateService.deactivateMultiSign()
      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isEnabled: false,
          isDeactivating: false,
          remainingDays: 0,
          error: null,
        },
      }));

      if (process.env.NODE_ENV !== 'production') console.log('[MultiSignSlice] Multi-signature deactivated (stub)');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate multi-signature';

      set((state) => ({
        multiSign: {
          ...state.multiSign,
          isDeactivating: false,
          error: errorMessage,
        },
      }));

      console.error('[MultiSignSlice] Failed to deactivate multi-signature', { error: errorMessage });
    }
  },

  refreshRemainingDays: async () => {
    const currentState = get().multiSign;
    if (!currentState.isEnabled) {
      return;
    }

    try {
      // TODO: Wire to backend MultiSignStateService.getRemainingDays()
      if (process.env.NODE_ENV !== 'production') console.log('[MultiSignSlice] refreshRemainingDays called (stub)');
    } catch (error) {
      console.error('[MultiSignSlice] Failed to refresh remaining days', { error });
    }
  },
});
