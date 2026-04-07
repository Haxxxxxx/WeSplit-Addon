/**
 * Wallet State Slice
 * Manages wallet connection, balance, status, and multi-wallet support
 * Web adaptation — no MWA (Mobile Wallet Adapter), no AsyncStorage
 *
 * Mirrors mobile wallet management patterns from simplifiedWalletService.ts
 */

import { StateCreator } from 'zustand';
import type { WalletState, WalletActions, WalletInfo, AppStore } from '../types';
import type { WalletStatus, WalletType } from '@/types';

export const createWalletSlice: StateCreator<
  AppStore,
  [],
  [],
  WalletState & WalletActions
> = (set) => ({
  // Initial state
  isConnected: false,
  address: null,
  balance: null,
  walletName: null,
  chainId: null,
  appWalletAddress: null,
  appWalletBalance: null,
  appWalletConnected: false,

  // Wallet status tracking (mirrors mobile)
  walletStatus: 'no_wallet' as WalletStatus,
  walletType: null as WalletType | null,

  // Multi-wallet support
  wallets: [] as WalletInfo[],
  preferredWalletId: null as string | null,

  // State
  isLoading: false,
  error: null,
  availableWallets: [] as WalletInfo[],
  currentWalletId: null,

  // ---------------------------------------------------------------------------
  // Basic Wallet Actions
  // ---------------------------------------------------------------------------

  connectWallet: (address: string, walletName: string, chainId?: string) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        isConnected: true,
        address,
        walletName,
        chainId: chainId ?? null,
        walletStatus: 'healthy' as WalletStatus,
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet connected', { address, walletName, chainId });
  },

  disconnectWallet: () => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        isConnected: false,
        address: null,
        balance: null,
        walletName: null,
        chainId: null,
        walletStatus: 'no_wallet' as WalletStatus,
        walletType: null,
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet disconnected');
  },

  updateBalance: (balance: number) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        balance,
      },
    }));
  },

  setAppWallet: (address: string, balance: number) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        appWalletAddress: address,
        appWalletBalance: balance,
        appWalletConnected: true,
        walletStatus: 'healthy' as WalletStatus,
        walletType: 'app-generated' as WalletType,
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] App wallet set', { address, balance });
  },

  updateAppWalletBalance: (balance: number) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        appWalletBalance: balance,
      },
    }));
  },

  setWalletLoading: (loading: boolean) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        isLoading: loading,
      },
    }));
  },

  setWalletError: (error: string | null) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        error,
        walletStatus: error ? 'error' as WalletStatus : state.wallet.walletStatus,
      },
    }));
  },

  clearWalletError: () => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        error: null,
      },
    }));
  },

  setAvailableWallets: (wallets: WalletInfo[]) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        availableWallets: wallets,
      },
    }));
  },

  setCurrentWalletId: (walletId: string | null) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        currentWalletId: walletId,
      },
    }));
  },

  // ---------------------------------------------------------------------------
  // Wallet Status Tracking
  // ---------------------------------------------------------------------------

  setWalletStatus: (status: WalletStatus) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        walletStatus: status,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet status updated', { status });
  },

  setWalletType: (type: WalletType | null) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        walletType: type,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet type updated', { type });
  },

  // ---------------------------------------------------------------------------
  // Multi-Wallet Management
  // ---------------------------------------------------------------------------

  setWallets: (wallets: WalletInfo[]) => {
    set((state) => ({
      wallet: {
        ...state.wallet,
        wallets,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallets list updated', { count: wallets.length });
  },

  addWallet: (wallet: WalletInfo) => {
    set((state) => {
      // Prevent duplicates
      const exists = state.wallet.wallets.some((w) => w.id === wallet.id || w.address === wallet.address);
      if (exists) {
        if (process.env.NODE_ENV !== 'production') console.warn('[WalletSlice] Wallet already exists', { walletId: wallet.id });
        return state;
      }

      // If this is the first wallet or marked as preferred, set as preferred
      const isFirstWallet = state.wallet.wallets.length === 0;
      const newWallet = {
        ...wallet,
        isPreferred: wallet.isPreferred || isFirstWallet,
      };

      // If this wallet is preferred, unset preference on others
      const updatedWallets = newWallet.isPreferred
        ? state.wallet.wallets.map((w) => ({ ...w, isPreferred: false }))
        : state.wallet.wallets;

      return {
        wallet: {
          ...state.wallet,
          wallets: [...updatedWallets, newWallet],
          preferredWalletId: newWallet.isPreferred ? newWallet.id : state.wallet.preferredWalletId,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet added', { walletId: wallet.id, address: wallet.address });
  },

  removeWallet: (walletId: string) => {
    set((state) => {
      const walletToRemove = state.wallet.wallets.find((w) => w.id === walletId);
      if (!walletToRemove) {
        if (process.env.NODE_ENV !== 'production') console.warn('[WalletSlice] Wallet not found for removal', { walletId });
        return state;
      }

      const remainingWallets = state.wallet.wallets.filter((w) => w.id !== walletId);

      // If we removed the preferred wallet, set the first remaining as preferred
      let newPreferredId = state.wallet.preferredWalletId;
      const firstRemaining = remainingWallets[0];
      if (walletToRemove.isPreferred && firstRemaining) {
        firstRemaining.isPreferred = true;
        newPreferredId = firstRemaining.id;
      } else if (remainingWallets.length === 0) {
        newPreferredId = null;
      }

      return {
        wallet: {
          ...state.wallet,
          wallets: remainingWallets,
          preferredWalletId: newPreferredId,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet removed', { walletId });
  },

  updateWallet: (walletId: string, updates: Partial<WalletInfo>) => {
    set((state) => {
      const walletIndex = state.wallet.wallets.findIndex((w) => w.id === walletId);
      if (walletIndex === -1) {
        if (process.env.NODE_ENV !== 'production') console.warn('[WalletSlice] Wallet not found for update', { walletId });
        return state;
      }

      const updatedWallets = [...state.wallet.wallets];
      const existingWallet = updatedWallets[walletIndex];
      if (existingWallet) {
        updatedWallets[walletIndex] = {
          ...existingWallet,
          ...updates,
          lastUsedAt: updates.lastUsedAt ?? new Date().toISOString(),
        };
      }

      return {
        wallet: {
          ...state.wallet,
          wallets: updatedWallets,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Wallet updated', { walletId, updates });
  },

  setPreferredWallet: (walletId: string | null) => {
    set((state) => {
      if (walletId === null) {
        // Clear preference
        return {
          wallet: {
            ...state.wallet,
            wallets: state.wallet.wallets.map((w) => ({ ...w, isPreferred: false })),
            preferredWalletId: null,
          },
        };
      }

      const walletExists = state.wallet.wallets.some((w) => w.id === walletId);
      if (!walletExists) {
        if (process.env.NODE_ENV !== 'production') console.warn('[WalletSlice] Wallet not found for preference', { walletId });
        return state;
      }

      return {
        wallet: {
          ...state.wallet,
          wallets: state.wallet.wallets.map((w) => ({
            ...w,
            isPreferred: w.id === walletId,
          })),
          preferredWalletId: walletId,
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') console.log('[WalletSlice] Preferred wallet set', { walletId });
  },
});
