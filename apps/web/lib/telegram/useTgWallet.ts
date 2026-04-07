'use client';

/**
 * TG Mini App — useTgWallet Hook
 *
 * React hook providing full wallet lifecycle for Telegram users:
 * - Auto-detects existing wallet on mount
 * - Create, unlock, lock, sign, change PIN, import, delete
 * - Syncs wallet address to Zustand (appWallet) + Firestore (user doc)
 * - Polls on-chain balance via TanStack Query
 *
 * Usage:
 *   const { address, isUnlocked, createWallet, unlock, sign } = useTgWallet();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { doc, updateDoc } from 'firebase/firestore';

import { useAppStore } from '@/store';
import { createConnection } from '@/lib/solana';
import { db } from '@/lib/firebase';
import {
  getWalletInfo,
  createWallet as createWalletService,
  importWallet as importWalletService,
  unlockWallet as unlockWalletService,
  signTransaction as signTxService,
  changePin as changePinService,
  deleteWallet as deleteWalletService,
  getPinHint as getPinHintService,
} from './wallet';
import type { CreateWalletResult, UnlockedWallet } from './wallet';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** USDC mint on the current network (devnet uses a common test mint) */
const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
);

/** Auto-lock after 5 minutes of inactivity */
const AUTO_LOCK_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Balance fetcher
// ---------------------------------------------------------------------------

async function fetchUsdcBalance(address: string): Promise<number> {
  try {
    const connection = createConnection();
    const pubkey = new PublicKey(address);
    const ata = getAssociatedTokenAddressSync(USDC_MINT, pubkey);

    const info = await connection.getTokenAccountBalance(ata);
    return info.value.uiAmount ?? 0;
  } catch {
    // No ATA yet or RPC error → balance is 0
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface TgWalletState {
  /** Solana address (base58) or null if no wallet */
  address: string | null;
  /** Whether wallet exists in CloudStorage */
  hasWallet: boolean;
  /** Whether the wallet is currently decrypted in memory */
  isUnlocked: boolean;
  /** USDC balance (from on-chain query) */
  usdcBalance: number;
  /** Loading states */
  isLoading: boolean;
  isCreating: boolean;
  isUnlocking: boolean;
  isSigning: boolean;
  /** Error message if last op failed */
  error: string | null;

  /** Create a new wallet with a PIN */
  create: (pin: string, hint?: string) => Promise<CreateWalletResult>;
  /** Unlock the wallet with the user's PIN */
  unlock: (pin: string) => Promise<void>;
  /** Lock the wallet (wipe decrypted key from memory) */
  lock: () => void;
  /** Sign a transaction (will decrypt → sign → wipe) */
  sign: <T extends Transaction | VersionedTransaction>(tx: T, pin: string) => Promise<T>;
  /** Import a wallet from mnemonic */
  restore: (mnemonic: string, pin: string, hint?: string) => Promise<string>;
  /** Change PIN */
  changePin: (oldPin: string, newPin: string) => Promise<void>;
  /** Delete wallet from storage (irreversible) */
  remove: () => Promise<void>;
  /** Get PIN hint */
  getPinHint: () => Promise<string | null>;
  /** Refresh balance */
  refetchBalance: () => void;
}

export function useTgWallet(): TgWalletState {
  const setAppWallet = useAppStore((s) => s.setAppWallet);
  const updateAppWalletBalance = useAppStore((s) => s.updateAppWalletBalance);
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();

  const [address, setAddress] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlockedRef = useRef<UnlockedWallet | null>(null);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Auto-lock timer management ----

  const resetAutoLock = useCallback(() => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    if (isUnlocked) {
      autoLockTimer.current = setTimeout(() => {
        // AR-C5: Zero out secret key before releasing reference
        if (unlockedRef.current) {
          unlockedRef.current.keypair.secretKey.fill(0);
        }
        unlockedRef.current = null;
        setIsUnlocked(false);
      }, AUTO_LOCK_MS);
    }
  }, [isUnlocked]);

  useEffect(() => {
    resetAutoLock();
    return () => {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    };
  }, [resetAutoLock]);

  // ---- Check for existing wallet on mount ----

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const info = await getWalletInfo();
        if (!mounted) return;
        setHasWallet(info.exists);
        if (info.exists) {
          setAddress(info.address);
          // Sync to Zustand
          setAppWallet(info.address, 0);
        }
      } catch {
        // CloudStorage not available yet — retry after a tick
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    check();
    return () => { mounted = false; };
  }, [setAppWallet]);

  // ---- USDC balance polling ----

  const { data: usdcBalance = 0, refetch: refetchBalance } = useQuery({
    queryKey: ['tgWalletBalance', address],
    queryFn: () => fetchUsdcBalance(address!),
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Sync balance to Zustand
  useEffect(() => {
    if (usdcBalance > 0) {
      updateAppWalletBalance(usdcBalance);
    }
  }, [usdcBalance, updateAppWalletBalance]);

  // ---- Sync wallet address to Firestore user doc ----

  const syncAddressToFirestore = useCallback(async (addr: string) => {
    if (!userId) return;
    try {
      const userRef = doc(db, 'users', userId);
      // Use telegram_wallet_address field — never overwrite wallet_address (mobile primary)
      await updateDoc(userRef, {
        // snake_case (web convention)
        telegram_wallet_address: addr,
        telegram_wallet_type: 'app-generated',
        telegram_wallet_status: 'healthy',
        telegram_wallet_created_at: new Date().toISOString(),
        // camelCase (mobile convention)
        telegramWalletAddress: addr,
        telegramWalletType: 'app-generated',
        telegramWalletStatus: 'healthy',
        telegramWalletCreatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-critical — wallet works locally even if Firestore sync fails
      // User doc will be updated on next successful operation
    }
  }, [userId]);

  // ---- Actions ----

  const create = useCallback(async (pin: string, hint?: string): Promise<CreateWalletResult> => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await createWalletService(pin, hint);
      setAddress(result.address);
      setHasWallet(true);
      setAppWallet(result.address, 0);
      await syncAddressToFirestore(result.address);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create wallet';
      setError(msg);
      throw e;
    } finally {
      setIsCreating(false);
    }
  }, [setAppWallet, syncAddressToFirestore]);

  const unlock = useCallback(async (pin: string): Promise<void> => {
    setIsUnlocking(true);
    setError(null);
    try {
      const wallet = await unlockWalletService(pin);
      unlockedRef.current = wallet;
      setIsUnlocked(true);
      resetAutoLock();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to unlock wallet';
      setError(msg);
      throw e;
    } finally {
      setIsUnlocking(false);
    }
  }, [resetAutoLock]);

  const lock = useCallback(() => {
    // AR-C5: Zero out secret key bytes before releasing reference to help GC
    if (unlockedRef.current) {
      unlockedRef.current.keypair.secretKey.fill(0);
    }
    unlockedRef.current = null;
    setIsUnlocked(false);
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
  }, []);

  const sign = useCallback(async <T extends Transaction | VersionedTransaction>(
    tx: T,
    pin: string,
  ): Promise<T> => {
    setIsSigning(true);
    setError(null);
    try {
      const signed = await signTxService(tx, pin);
      resetAutoLock();
      return signed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sign transaction';
      setError(msg);
      throw e;
    } finally {
      setIsSigning(false);
    }
  }, [resetAutoLock]);

  const restore = useCallback(async (mnemonic: string, pin: string, hint?: string): Promise<string> => {
    setIsCreating(true);
    setError(null);
    try {
      const addr = await importWalletService(mnemonic, pin, hint);
      setAddress(addr);
      setHasWallet(true);
      setAppWallet(addr, 0);
      await syncAddressToFirestore(addr);
      return addr;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to import wallet';
      setError(msg);
      throw e;
    } finally {
      setIsCreating(false);
    }
  }, [setAppWallet, syncAddressToFirestore]);

  const changePinAction = useCallback(async (oldPin: string, newPin: string): Promise<void> => {
    setError(null);
    try {
      await changePinService(oldPin, newPin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to change PIN';
      setError(msg);
      throw e;
    }
  }, []);

  const remove = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await deleteWalletService();
      setAddress(null);
      setHasWallet(false);
      setIsUnlocked(false);
      unlockedRef.current = null;
      queryClient.removeQueries({ queryKey: ['tgWalletBalance'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete wallet';
      setError(msg);
      throw e;
    }
  }, [queryClient]);

  return {
    address,
    hasWallet,
    isUnlocked,
    usdcBalance,
    isLoading,
    isCreating,
    isUnlocking,
    isSigning,
    error,
    create,
    unlock,
    lock,
    sign,
    restore,
    changePin: changePinAction,
    remove,
    getPinHint: getPinHintService,
    refetchBalance: () => { refetchBalance(); },
  };
}
