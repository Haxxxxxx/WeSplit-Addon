import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { View, WalletState, Transaction, Contact, Split, UserProfile, SharedWallet } from '../types';

// Auth method type
export type AuthMethod = 'email' | 'google' | 'wallet' | 'passkey' | 'qr' | 'phantom' | null;

interface AppState {
  // Navigation
  currentView: View;
  setView: (view: View) => void;

  // User Authentication (synced with mobile app)
  user: UserProfile | null;
  authMethod: AuthMethod;
  setUser: (user: UserProfile | null, method?: AuthMethod) => void;
  clearUser: () => void;

  // Wallet
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;
  disconnectWallet: () => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;

  // Contacts
  contacts: Contact[];
  addContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
  toggleFavorite: (id: string) => void;

  // Splits
  splits: Split[];
  addSplit: (split: Split) => void;
  updateSplit: (id: string, updates: Partial<Split>) => void;

  // Shared Wallets
  sharedWallets: SharedWallet[];
  sharedWalletsLoading: boolean;
  setSharedWallets: (wallets: SharedWallet[]) => void;
  setSharedWalletsLoading: (loading: boolean) => void;

  // UI State
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const initialWalletState: WalletState = {
  isConnected: false,
  address: null,
  balance: 0,
  usdcBalance: 0,
  provider: 'none',
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentView: 'connect',
      setView: (view) => set({ currentView: view }),

      // User Authentication
      user: null,
      authMethod: null,
      setUser: (user, method) =>
        set((state) => ({
          user,
          authMethod: method ?? state.authMethod,
          currentView: user ? 'dashboard' : state.currentView,
        })),
      clearUser: () =>
        set({
          user: null,
          authMethod: null,
        }),

      // Wallet
      wallet: initialWalletState,
      setWallet: (walletUpdate) =>
        set((state) => ({
          wallet: { ...state.wallet, ...walletUpdate },
          currentView: walletUpdate.isConnected ? 'dashboard' : state.currentView,
        })),
      disconnectWallet: () =>
        set({
          wallet: initialWalletState,
          user: null,
          authMethod: null,
          currentView: 'connect',
        }),

      // Transactions
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [tx, ...state.transactions].slice(0, 50), // Keep last 50
        })),

      // Contacts
      contacts: [],
      addContact: (contact) =>
        set((state) => ({
          contacts: [...state.contacts, contact],
        })),
      removeContact: (id) =>
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
        })),
      toggleFavorite: (id) =>
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
          ),
        })),

      // Splits
      splits: [],
      addSplit: (split) =>
        set((state) => ({
          splits: [split, ...state.splits],
        })),
      updateSplit: (id, updates) =>
        set((state) => ({
          splits: state.splits.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      // Shared Wallets
      sharedWallets: [],
      sharedWalletsLoading: false,
      setSharedWallets: (wallets) => set({ sharedWallets: wallets }),
      setSharedWalletsLoading: (loading) => set({ sharedWalletsLoading: loading }),

      // UI State
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
      error: null,
      setError: (error) => set({ error }),
    }),
    {
      name: 'wesplit-storage',
      partialize: (state) => ({
        user: state.user,
        authMethod: state.authMethod,
        wallet: state.wallet,
        contacts: state.contacts,
        transactions: state.transactions,
        splits: state.splits,
        sharedWallets: state.sharedWallets,
      }),
    }
  )
);
