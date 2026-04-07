/**
 * Transactions State Slice
 * Manages transaction history and processing state
 * Web adaptation — sendTransaction is a placeholder (Solana sending wired later)
 */

import { StateCreator } from 'zustand';
import type { Transaction } from '@/types';
import type { TransactionsState, TransactionsActions, AppStore } from '../types';

export const createTransactionsSlice: StateCreator<
  AppStore,
  [],
  [],
  TransactionsState & TransactionsActions
> = (set) => ({
  // Initial state
  transactions: [],
  pendingTransactions: [],
  isLoading: false,
  error: null,
  lastFetch: 0,

  // Actions
  setTransactions: (transactions: Transaction[]) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        transactions,
        lastFetch: Date.now(),
        error: null,
      },
    }));
  },

  addTransaction: (transaction: Transaction) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        transactions: [transaction, ...state.transactions.transactions],
        lastFetch: Date.now(),
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[TransactionsSlice] Transaction added', { transactionId: transaction.id || transaction.signature, type: transaction.type });
  },

  updateTransaction: (transactionId: string, updates: Partial<Transaction>) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        transactions: state.transactions.transactions.map((transaction: Transaction) =>
          (transaction.id === transactionId || transaction.signature === transactionId)
            ? { ...transaction, ...updates }
            : transaction,
        ),
        lastFetch: Date.now(),
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[TransactionsSlice] Transaction updated', { transactionId, updates: Object.keys(updates) });
  },

  removeTransaction: (transactionId: string) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        transactions: state.transactions.transactions.filter((transaction: Transaction) =>
          transaction.id !== transactionId && transaction.signature !== transactionId,
        ),
        lastFetch: Date.now(),
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[TransactionsSlice] Transaction removed', { transactionId });
  },

  addPendingTransaction: (transaction: Transaction) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        pendingTransactions: [...state.transactions.pendingTransactions, transaction],
        error: null,
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[TransactionsSlice] Pending transaction added', { transactionId: transaction.id || transaction.signature });
  },

  removePendingTransaction: (transactionId: string) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        pendingTransactions: state.transactions.pendingTransactions.filter((transaction: Transaction) =>
          transaction.id !== transactionId && transaction.signature !== transactionId,
        ),
      },
    }));

    if (process.env.NODE_ENV !== 'production') console.log('[TransactionsSlice] Pending transaction removed', { transactionId });
  },

  setTransactionsLoading: (loading: boolean) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        isLoading: loading,
      },
    }));
  },

  setTransactionsError: (error: string | null) => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        error,
      },
    }));
  },

  clearTransactionsError: () => {
    set((state) => ({
      transactions: {
        ...state.transactions,
        error: null,
      },
    }));
  },

  refreshTransactions: async () => {
    // TODO: Wire to Firestore query for user's transactions
    if (process.env.NODE_ENV !== 'production') console.warn('[TransactionsSlice] refreshTransactions not yet wired — use ConsolidatedTransactionService when ready');
  },

  sendTransaction: async (_transactionData: Partial<Transaction>) => {
    // TODO: Wire to web ConsolidatedTransactionService when Solana sending is implemented
    if (process.env.NODE_ENV !== 'production') console.warn('[TransactionsSlice] sendTransaction not yet wired — Solana sending will be added later');
  },
});
