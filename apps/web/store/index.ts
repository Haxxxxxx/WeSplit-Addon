/**
 * Main Store Configuration
 * Combines all slices into a single Zustand store
 * Web adaptation — uses localStorage (built-in persist) instead of AsyncStorage
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import type { AppStore, AppStoreState } from './types';
import { createUserSlice } from './slices/userSlice';
import { createWalletSlice } from './slices/walletSlice';
import { createNotificationsSlice } from './slices/notificationsSlice';
import { createUISlice } from './slices/uiSlice';
import { createTransactionsSlice } from './slices/transactionsSlice';
import { createMultiSignSlice } from './slices/multiSignSlice';
import { createSplitSlice, initialSplitState } from './slices/splitSlice';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AppStoreState = {
  user: {
    currentUser: null,
    isAuthenticated: false,
    authMethod: null,
    isLoading: false,
    error: null,
  },
  wallet: {
    isConnected: false,
    address: null,
    balance: null,
    walletName: null,
    chainId: null,
    appWalletAddress: null,
    appWalletBalance: null,
    appWalletConnected: false,
    walletStatus: 'no_wallet',
    walletType: null,
    wallets: [],
    preferredWalletId: null,
    isLoading: false,
    error: null,
    availableWallets: [],
    currentWalletId: null,
  },
  notifications: {
    notifications: [],
    isLoading: false,
    error: null,
    lastFetch: 0,
    unreadCount: 0,
  },
  ui: {
    isLoading: false,
    error: null,
    theme: 'dark',
    language: 'en',
    networkStatus: 'online',
  },
  transactions: {
    transactions: [],
    pendingTransactions: [],
    isLoading: false,
    error: null,
    lastFetch: 0,
  },
  multiSign: {
    isEnabled: false,
    remainingDays: 0,
    isActivating: false,
    isDeactivating: false,
    isLoading: false,
    error: null,
  },
  split: initialSplitState,
};

// ============================================================================
// GLOBAL ACTIONS
// ============================================================================

const globalActions = {
  resetStore: () => {
    useAppStore.setState(initialState);
    if (process.env.NODE_ENV !== 'production') console.log('[Store] Store reset to initial state');
  },

  clearAllErrors: () => {
    useAppStore.setState((state) => ({
      user: { ...state.user, error: null },
      wallet: { ...state.wallet, error: null },
      notifications: { ...state.notifications, error: null },
      ui: { ...state.ui, error: null },
      transactions: { ...state.transactions, error: null },
      multiSign: { ...state.multiSign, error: null },
      split: { ...state.split, error: null },
    }));
    if (process.env.NODE_ENV !== 'production') console.log('[Store] All errors cleared');
  },
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      subscribeWithSelector(
        (set, get, api) => ({
          ...initialState,
          ...globalActions,
          ...createUserSlice(set, get, api),
          ...createWalletSlice(set, get, api),
          ...createNotificationsSlice(set, get, api),
          ...createUISlice(set, get, api),
          ...createTransactionsSlice(set, get, api),
          ...createMultiSignSlice(set, get, api),
          ...createSplitSlice(set, get, api),
        } as unknown as AppStore),
      ),
      {
        name: 'wesplit-store',
        // Only persist certain parts of the state — same partialize as mobile
        partialize: (state) => ({
          user: {
            currentUser: state.user.currentUser,
            isAuthenticated: state.user.isAuthenticated,
            authMethod: state.user.authMethod,
          },
          wallet: {
            isConnected: state.wallet.isConnected,
            address: state.wallet.address,
            walletName: state.wallet.walletName,
            chainId: state.wallet.chainId,
            appWalletAddress: state.wallet.appWalletAddress,
            appWalletConnected: state.wallet.appWalletConnected,
            currentWalletId: state.wallet.currentWalletId,
          },
          ui: {
            theme: state.ui.theme,
            language: state.ui.language,
          },
        }),
        // Zustand v5 persist uses localStorage by default on web — no custom
        // storage adapter needed (unlike mobile which requires AsyncStorage)
      },
    ),
    {
      name: 'wesplit-store',
      // Only enable devtools in development
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ============================================================================
// SELECTORS
// ============================================================================

// User selectors
export const useCurrentUser = () => useAppStore((state) => state.user.currentUser);
export const useIsAuthenticated = () => useAppStore((state) => state.user.isAuthenticated);
export const useAuthMethod = () => useAppStore((state) => state.user.authMethod);

// Wallet selectors (useShallow prevents re-renders when values haven't changed)
export const useWalletInfo = () =>
  useAppStore(
    useShallow((state) => ({
      isConnected: state.wallet.isConnected,
      address: state.wallet.address,
      balance: state.wallet.balance,
      walletName: state.wallet.walletName,
    })),
  );

export const useAppWalletInfo = () =>
  useAppStore(
    useShallow((state) => ({
      address: state.wallet.appWalletAddress,
      balance: state.wallet.appWalletBalance,
      isConnected: state.wallet.appWalletConnected,
    })),
  );

// Notifications selectors
export const useNotifications = () => useAppStore((state) => state.notifications.notifications);
export const useUnreadCount = () => useAppStore((state) => state.notifications.unreadCount);

// UI selectors
export const useError = () =>
  useAppStore(
    (state) =>
      state.user.error ||
      state.wallet.error ||
      state.notifications.error ||
      state.ui.error ||
      state.transactions.error ||
      state.multiSign.error ||
      state.split.error,
  );

export const useTheme = () => useAppStore((state) => state.ui.theme);
export const useLanguage = () => useAppStore((state) => state.ui.language);
export const useNetworkStatus = () => useAppStore((state) => state.ui.networkStatus);

// Transactions selectors
export const useTransactions = () => useAppStore((state) => state.transactions.transactions);
export const usePendingTransactions = () => useAppStore((state) => state.transactions.pendingTransactions);

// Multi-Signature selectors
export const useMultiSign = () => useAppStore((state) => state.multiSign);
export const useIsMultiSignEnabled = () => useAppStore((state) => state.multiSign.isEnabled);
export const useMultiSignRemainingDays = () => useAppStore((state) => state.multiSign.remainingDays);

// Split selectors
export const useSplitState = () => useAppStore((state) => state.split);
export const useSelectedSplit = () => useAppStore((state) => state.split.selectedSplit);
export const useSelectedSplitWallet = () => useAppStore((state) => state.split.selectedSplitWallet);
export const useSplitCreationDraft = () => useAppStore((state) => state.split.creationDraft);
export const useIsSplitCreating = () => useAppStore((state) => state.split.isCreating);
export const useIsSplitPaymentModalOpen = () => useAppStore((state) => state.split.isPaymentModalOpen);
export const useSplitPaymentAmount = () => useAppStore((state) => state.split.paymentAmount);

// ============================================================================
// ACTION SELECTORS (stable references -- functions never change identity)
// ============================================================================

// User actions
export const useSetCurrentUser = () => useAppStore((s) => s.setCurrentUser);
export const useAuthenticateUser = () => useAppStore((s) => s.authenticateUser);
export const useLogoutUser = () => useAppStore((s) => s.logoutUser);
export const useUpdateUser = () => useAppStore((s) => s.updateUser);
export const useSetUserLoading = () => useAppStore((s) => s.setUserLoading);
export const useSetUserError = () => useAppStore((s) => s.setUserError);
export const useClearUserError = () => useAppStore((s) => s.clearUserError);

// Wallet actions
export const useConnectWallet = () => useAppStore((s) => s.connectWallet);
export const useDisconnectWallet = () => useAppStore((s) => s.disconnectWallet);
export const useUpdateBalance = () => useAppStore((s) => s.updateBalance);
export const useSetAppWallet = () => useAppStore((s) => s.setAppWallet);
export const useUpdateAppWalletBalance = () => useAppStore((s) => s.updateAppWalletBalance);
export const useSetWalletLoading = () => useAppStore((s) => s.setWalletLoading);
export const useSetWalletError = () => useAppStore((s) => s.setWalletError);
export const useClearWalletError = () => useAppStore((s) => s.clearWalletError);
export const useSetAvailableWallets = () => useAppStore((s) => s.setAvailableWallets);
export const useSetCurrentWalletId = () => useAppStore((s) => s.setCurrentWalletId);

// Notifications actions
export const useSetNotifications = () => useAppStore((s) => s.setNotifications);
export const useAddNotification = () => useAppStore((s) => s.addNotification);
export const useUpdateNotification = () => useAppStore((s) => s.updateNotification);
export const useRemoveNotification = () => useAppStore((s) => s.removeNotification);
export const useMarkAsRead = () => useAppStore((s) => s.markAsRead);
export const useMarkAllAsRead = () => useAppStore((s) => s.markAllAsRead);
export const useRefreshNotifications = () => useAppStore((s) => s.refreshNotifications);

// UI actions
export const useSetLoading = () => useAppStore((s) => s.setLoading);
export const useSetError = () => useAppStore((s) => s.setError);
export const useClearError = () => useAppStore((s) => s.clearError);
export const useSetTheme = () => useAppStore((s) => s.setTheme);
export const useSetLanguage = () => useAppStore((s) => s.setLanguage);
export const useSetNetworkStatus = () => useAppStore((s) => s.setNetworkStatus);

// Transactions actions
export const useSetTransactions = () => useAppStore((s) => s.setTransactions);
export const useAddTransaction = () => useAppStore((s) => s.addTransaction);
export const useUpdateTransaction = () => useAppStore((s) => s.updateTransaction);
export const useRemoveTransaction = () => useAppStore((s) => s.removeTransaction);
export const useAddPendingTransaction = () => useAppStore((s) => s.addPendingTransaction);
export const useRemovePendingTransaction = () => useAppStore((s) => s.removePendingTransaction);
export const useRefreshTransactions = () => useAppStore((s) => s.refreshTransactions);
export const useSendTransaction = () => useAppStore((s) => s.sendTransaction);

// Multi-Signature actions
export const useSetEnabled = () => useAppStore((s) => s.setEnabled);
export const useSetRemainingDays = () => useAppStore((s) => s.setRemainingDays);
export const useLoadMultiSignState = () => useAppStore((s) => s.loadMultiSignState);
export const useActivateMultiSign = () => useAppStore((s) => s.activateMultiSign);
export const useDeactivateMultiSign = () => useAppStore((s) => s.deactivateMultiSign);
export const useRefreshRemainingDays = () => useAppStore((s) => s.refreshRemainingDays);

// Split actions
export const useSetSelectedSplit = () => useAppStore((s) => s.setSelectedSplit);
export const useSetSelectedSplitWallet = () => useAppStore((s) => s.setSelectedSplitWallet);
export const useClearSplitSelection = () => useAppStore((s) => s.clearSelection);
export const useStartSplitCreation = () => useAppStore((s) => s.startCreation);
export const useUpdateSplitCreationDraft = () => useAppStore((s) => s.updateCreationDraft);
export const useSetSplitCreationStep = () => useAppStore((s) => s.setCreationStep);
export const useAddParticipantToSplitDraft = () => useAppStore((s) => s.addParticipantToDraft);
export const useRemoveParticipantFromSplitDraft = () => useAppStore((s) => s.removeParticipantFromDraft);
export const useUpdateParticipantInSplitDraft = () => useAppStore((s) => s.updateParticipantInDraft);
export const useAddItemToSplitDraft = () => useAppStore((s) => s.addItemToDraft);
export const useRemoveItemFromSplitDraft = () => useAppStore((s) => s.removeItemFromDraft);
export const useUpdateItemInSplitDraft = () => useAppStore((s) => s.updateItemInDraft);
export const useResetSplitCreation = () => useAppStore((s) => s.resetCreation);
export const useOpenSplitPaymentModal = () => useAppStore((s) => s.openPaymentModal);
export const useCloseSplitPaymentModal = () => useAppStore((s) => s.closePaymentModal);
export const useSetSplitPaymentAmount = () => useAppStore((s) => s.setPaymentAmount);
export const useSetSplitLoading = () => useAppStore((s) => s.setSplitLoading);
export const useSetSplitError = () => useAppStore((s) => s.setSplitError);
export const useClearSplitError = () => useAppStore((s) => s.clearSplitError);

// Global actions
export const useResetStore = () => useAppStore((s) => s.resetStore);
export const useClearAllErrors = () => useAppStore((s) => s.clearAllErrors);

// ============================================================================
// STORE SUBSCRIPTIONS
// ============================================================================

// Subscribe to authentication changes
useAppStore.subscribe(
  (state) => state.user.isAuthenticated,
  (isAuthenticated, previousIsAuthenticated) => {
    if (isAuthenticated !== previousIsAuthenticated) {
      if (process.env.NODE_ENV !== 'production') console.log('[Store] Authentication status changed', { isAuthenticated, previousIsAuthenticated });
    }
  },
);

// Subscribe to network status changes
useAppStore.subscribe(
  (state) => state.ui.networkStatus,
  (networkStatus, previousNetworkStatus) => {
    if (networkStatus !== previousNetworkStatus) {
      if (process.env.NODE_ENV !== 'production') console.log('[Store] Network status changed', { networkStatus, previousNetworkStatus });
    }
  },
);

// Apply persisted theme on hydration (SSR-safe)
if (typeof window !== 'undefined') {
  // Use subscribe to apply theme once store hydrates from localStorage
  useAppStore.subscribe(
    (state) => state.ui.theme,
    (theme) => {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
    },
    { fireImmediately: true },
  );

  // Listen to browser online/offline events
  window.addEventListener('online', () => {
    useAppStore.getState().setNetworkStatus('online');
  });
  window.addEventListener('offline', () => {
    useAppStore.getState().setNetworkStatus('offline');
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useAppStore;
export type { AppStore, AppStoreState } from './types';
