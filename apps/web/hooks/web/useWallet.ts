/**
 * useWallet Hook
 * Wraps @solana/wallet-adapter-react's useWallet and syncs state with Zustand.
 *
 * This hook:
 * 1. Reads the browser wallet adapter state (Phantom, Solflare, etc.)
 * 2. Syncs connection/disconnection events into Zustand's wallet slice
 * 3. Provides a unified API for components to interact with wallets
 *
 * Prerequisites: The component tree must be wrapped in:
 *   <ConnectionProvider> -> <WalletProvider> -> <WalletModalProvider>
 * from @solana/wallet-adapter-react / @solana/wallet-adapter-react-ui
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  useWallet as useSolanaWallet,
  useConnection,
} from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseWalletReturn {
  /** Whether a browser wallet is connected */
  isConnected: boolean;
  /** The connected wallet's public key as base58 string */
  address: string | null;
  /** SOL balance (null if not fetched yet) */
  balance: number | null;
  /** Name of the connected wallet adapter (e.g. "Phantom") */
  walletName: string | null;
  /** Whether we're currently connecting */
  isLoading: boolean;
  /** Last wallet error message */
  error: string | null;
  /** Connect to the selected wallet adapter */
  connect: () => Promise<void>;
  /** Disconnect the current wallet */
  disconnect: () => Promise<void>;
  /** Manually refresh the SOL balance */
  refreshBalance: () => Promise<void>;
  /** The raw wallet adapter publicKey (for signing, etc.) */
  publicKey: ReturnType<typeof useSolanaWallet>['publicKey'];
  /** The raw signTransaction from the adapter */
  signTransaction: ReturnType<typeof useSolanaWallet>['signTransaction'];
  /** The raw signAllTransactions from the adapter */
  signAllTransactions: ReturnType<typeof useSolanaWallet>['signAllTransactions'];
  /** The raw signMessage from the adapter */
  signMessage: ReturnType<typeof useSolanaWallet>['signMessage'];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWallet(): UseWalletReturn {
  const {
    publicKey,
    wallet,
    connected,
    connecting,
    disconnect: adapterDisconnect,
    connect: adapterConnect,
    signTransaction,
    signAllTransactions,
    signMessage,
  } = useSolanaWallet();
  const { connection } = useConnection();

  // Zustand state
  const storeBalance = useAppStore((s) => s.wallet.balance);
  const storeError = useAppStore((s) => s.wallet.error);
  const userId = useAppStore((s) => s.user.currentUser?.id);

  // Zustand actions (stable references)
  const connectWallet = useAppStore((s) => s.connectWallet);
  const disconnectWallet = useAppStore((s) => s.disconnectWallet);
  const updateBalance = useAppStore((s) => s.updateBalance);
  const setWalletLoading = useAppStore((s) => s.setWalletLoading);
  const setWalletError = useAppStore((s) => s.setWalletError);

  // Track previous connected state to detect transitions
  const prevConnected = useRef(connected);

  // -------------------------------------------------------------------
  // Sync adapter state -> Zustand
  // -------------------------------------------------------------------

  useEffect(() => {
    const wasConnected = prevConnected.current;
    prevConnected.current = connected;

    if (connected && publicKey) {
      const address = publicKey.toBase58();
      const name = wallet?.adapter.name ?? 'Unknown';
      connectWallet(address, name, 'solana');
    } else if (wasConnected && !connected) {
      // Wallet just disconnected
      disconnectWallet();
    }
  }, [connected, publicKey, wallet, connectWallet, disconnectWallet]);

  // Sync loading state
  useEffect(() => {
    setWalletLoading(connecting);
  }, [connecting, setWalletLoading]);

  // Save web_wallet_address to Firestore user doc when wallet connects
  const savedAddressRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || !publicKey || !userId) return;
    const address = publicKey.toBase58();
    // Skip if we already saved this address this session
    if (savedAddressRef.current === address) return;
    savedAddressRef.current = address;
    const userRef = doc(db, 'users', userId);
    updateDoc(userRef, {
      // snake_case (web convention)
      web_wallet_address: address,
      // camelCase (mobile convention)
      webWalletAddress: address,
    }).catch((err) => {
      console.warn('[useWallet] Failed to save web_wallet_address to Firestore:', err);
    });
  }, [connected, publicKey, userId]);

  // -------------------------------------------------------------------
  // Fetch SOL balance when connected
  // -------------------------------------------------------------------

  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) return;

    try {
      const lamports = await connection.getBalance(publicKey);
      const sol = lamports / LAMPORTS_PER_SOL;
      updateBalance(sol);
    } catch (err) {
      console.error('[useWallet] Failed to fetch balance:', err);
      // Don't set error for balance fetch failures — non-critical
    }
  }, [publicKey, connection, updateBalance]);

  // Auto-fetch balance on connection and periodically
  useEffect(() => {
    if (!connected || !publicKey) return;

    // Fetch immediately
    refreshBalance();

    // Poll every 30 seconds while connected
    const interval = setInterval(refreshBalance, 30_000);
    return () => clearInterval(interval);
  }, [connected, publicKey, refreshBalance]);

  // -------------------------------------------------------------------
  // Wrapped actions
  // -------------------------------------------------------------------

  const connect = useCallback(async () => {
    try {
      setWalletLoading(true);
      setWalletError(null);
      await adapterConnect();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed';
      setWalletError(message);
      console.error('[useWallet] Connect failed:', message);
    } finally {
      setWalletLoading(false);
    }
  }, [adapterConnect, setWalletLoading, setWalletError]);

  const disconnect = useCallback(async () => {
    try {
      await adapterDisconnect();
      disconnectWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet disconnect failed';
      console.error('[useWallet] Disconnect failed:', message);
      // Still clear local state
      disconnectWallet();
    }
  }, [adapterDisconnect, disconnectWallet]);

  return {
    isConnected: connected,
    address: publicKey?.toBase58() ?? null,
    balance: storeBalance,
    walletName: wallet?.adapter.name ?? null,
    isLoading: connecting,
    error: storeError,
    connect,
    disconnect,
    refreshBalance,
    publicKey,
    signTransaction,
    signAllTransactions,
    signMessage,
  };
}
