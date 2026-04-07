/**
 * Centralized State Management Types
 * Defines all state interfaces and types for the Zustand store
 * Adapted from mobile store — no MWA (mobile wallet adapter) references
 */

import type { User, NotificationData, Split, SplitWallet, WalletStatus, WalletType, Transaction } from '@/types';
import type {
  SplitState,
  SplitActions,
} from './slices/splitSlice';

// ============================================================================
// WALLET INFO TYPES
// ============================================================================

/** Individual wallet entry for multi-wallet support */
export interface WalletInfo {
  id: string;
  address: string;
  name: string;
  type: WalletType;
  status: WalletStatus;
  isPreferred: boolean;
  balance?: number;
  usdcBalance?: number;
  solBalance?: number;
  createdAt: string;
  lastUsedAt?: string;
  provider?: string; // 'phantom', 'solflare', etc.
}

// ============================================================================
// CORE STATE INTERFACES
// ============================================================================

export interface UserState {
  currentUser: User | null;
  isAuthenticated: boolean;
  authMethod: 'wallet' | 'email' | 'phone' | 'guest' | 'social' | 'telegram' | null;
  isLoading: boolean;
  error: string | null;
}

export interface WalletState {
  // External wallet (browser wallet adapter — Phantom, Solflare, etc.)
  isConnected: boolean;
  address: string | null;
  balance: number | null;
  walletName: string | null;
  chainId: string | null;

  // App wallet (WeSplit-managed custodial wallet)
  appWalletAddress: string | null;
  appWalletBalance: number | null;
  appWalletConnected: boolean;

  // Wallet status tracking (mirrors mobile)
  walletStatus: WalletStatus;
  walletType: WalletType | null;

  // Multi-wallet support
  wallets: WalletInfo[];
  preferredWalletId: string | null;

  // State
  isLoading: boolean;
  error: string | null;
  availableWallets: WalletInfo[];
  currentWalletId: string | null;
  // NOTE: preferredMWAProvider removed — MWA is mobile-only
}

export interface NotificationsState {
  notifications: NotificationData[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number;
  unreadCount: number;
}

export interface UIState {
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  language: string;
  networkStatus: 'online' | 'offline';
}

export interface TransactionsState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  lastFetch: number;
}

export interface MultiSignState {
  isEnabled: boolean;
  remainingDays: number;
  isActivating: boolean;
  isDeactivating: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// COMBINED STATE INTERFACE
// ============================================================================

export interface AppStoreState {
  user: UserState;
  wallet: WalletState;
  notifications: NotificationsState;
  ui: UIState;
  transactions: TransactionsState;
  multiSign: MultiSignState;
  split: SplitState;
}

// ============================================================================
// ACTION INTERFACES
// ============================================================================

export interface UserActions {
  setCurrentUser: (user: User | null) => void;
  authenticateUser: (user: User, method: 'wallet' | 'email' | 'phone' | 'guest' | 'social' | 'telegram') => void;
  logoutUser: () => void;
  updateUser: (updates: Partial<User>) => void;
  setUserLoading: (loading: boolean) => void;
  setUserError: (error: string | null) => void;
  clearUserError: () => void;
}

export interface WalletActions {
  connectWallet: (address: string, walletName: string, chainId?: string) => void;
  disconnectWallet: () => void;
  updateBalance: (balance: number) => void;
  setAppWallet: (address: string, balance: number) => void;
  updateAppWalletBalance: (balance: number) => void;
  setWalletLoading: (loading: boolean) => void;
  setWalletError: (error: string | null) => void;
  clearWalletError: () => void;
  setAvailableWallets: (wallets: WalletInfo[]) => void;
  setCurrentWalletId: (walletId: string | null) => void;

  // Wallet status tracking
  setWalletStatus: (status: WalletStatus) => void;
  setWalletType: (type: WalletType | null) => void;

  // Multi-wallet management
  setWallets: (wallets: WalletInfo[]) => void;
  addWallet: (wallet: WalletInfo) => void;
  removeWallet: (walletId: string) => void;
  updateWallet: (walletId: string, updates: Partial<WalletInfo>) => void;
  setPreferredWallet: (walletId: string | null) => void;
}

export interface NotificationsActions {
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  updateNotification: (id: string, updates: Partial<NotificationData>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setNotificationsLoading: (loading: boolean) => void;
  setNotificationsError: (error: string | null) => void;
  clearNotificationsError: () => void;
  refreshNotifications: () => Promise<void>;
}

export interface UIActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: string) => void;
  setNetworkStatus: (status: 'online' | 'offline') => void;
}

export interface TransactionsActions {
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  addPendingTransaction: (transaction: Transaction) => void;
  removePendingTransaction: (id: string) => void;
  setTransactionsLoading: (loading: boolean) => void;
  setTransactionsError: (error: string | null) => void;
  clearTransactionsError: () => void;
  refreshTransactions: () => Promise<void>;
  sendTransaction: (transactionData: Partial<Transaction>) => Promise<void>;
}

export interface MultiSignActions {
  setEnabled: (enabled: boolean) => void;
  setRemainingDays: (days: number) => void;
  setActivating: (activating: boolean) => void;
  setDeactivating: (deactivating: boolean) => void;
  setMultiSignLoading: (loading: boolean) => void;
  setMultiSignError: (error: string | null) => void;
  clearMultiSignError: () => void;
  loadMultiSignState: () => Promise<void>;
  activateMultiSign: () => Promise<void>;
  deactivateMultiSign: () => Promise<void>;
  refreshRemainingDays: () => Promise<void>;
}

export interface GlobalActions {
  resetStore: () => void;
  clearAllErrors: () => void;
}

// ============================================================================
// COMBINED STORE INTERFACE
// ============================================================================

export interface AppStore extends
  AppStoreState,
  UserActions,
  WalletActions,
  NotificationsActions,
  UIActions,
  TransactionsActions,
  MultiSignActions,
  SplitActions,
  GlobalActions {}

// ============================================================================
// SLICE CREATOR TYPES
// ============================================================================

export type SliceCreator<T> = (
  set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
  get: () => T,
  api: any,
) => T;
