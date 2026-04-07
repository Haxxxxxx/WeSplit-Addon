'use client';

/**
 * useActiveWallet — Composable Multi-Source Wallet Hook
 *
 * Composes 3 wallet sources into a single unified interface:
 * 1. Browser wallet adapter (Phantom, Solflare, etc.)
 * 2. Imported wallet (mnemonic → PIN-encrypted in IndexedDB)
 * 3. Mobile remote signer (Firestore-based signing requests)
 *
 * Returns the active signer based on `preferredWalletId` from Zustand,
 * with fallback priority: preferred → browser adapter → imported → mobile.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { useAppStore } from '@/store';
import * as webWalletService from '@/lib/web-wallet/wallet';
import { createSigningRequest, pollForResult, cancelRequest } from '@/lib/services/remoteSigningService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActiveWalletType = 'browser' | 'imported' | 'mobile' | null;

export interface ActiveWallet {
  /** The wallet address currently active for signing */
  walletAddress: string | null;
  /** Which wallet source is active */
  walletType: ActiveWalletType;
  /** Whether a wallet is ready for signing */
  isReady: boolean;
  /** Whether the imported wallet is currently unlocked */
  isImportedUnlocked: boolean;
  /** Sign a legacy Transaction */
  signTransaction: ((tx: Transaction) => Promise<Transaction>) | null;
  /** The transaction method string for Firestore recording */
  transactionMethod: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useActiveWallet(): ActiveWallet {
  const {
    publicKey: adapterPublicKey,
    signTransaction: adapterSignTx,
    connected: adapterConnected,
  } = useSolanaWallet();

  const preferredWalletId = useAppStore((s) => s.wallet.preferredWalletId);
  const wallets = useAppStore((s) => s.wallet.wallets);
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const mobileWalletAddress = useAppStore((s) => s.user.currentUser?.wallet_address as string | undefined) ?? null;

  const [importedAddress, setImportedAddress] = useState<string | null>(null);
  const [importedUnlocked, setImportedUnlocked] = useState(false);

  // Check for imported wallet on mount and when userId changes
  useEffect(() => {
    if (!userId) {
      setImportedAddress(null);
      setImportedUnlocked(false);
      return;
    }

    webWalletService.getWebWalletInfo(userId).then((info) => {
      setImportedAddress(info.exists ? info.address : null);
      setImportedUnlocked(webWalletService.isUnlocked());
    });

    // Listen for lock events
    const unsub = webWalletService.onLock(() => {
      setImportedUnlocked(false);
    });

    return unsub;
  }, [userId]);

  // Find the preferred wallet from the wallets array
  const preferredWallet = useMemo(() => {
    if (!preferredWalletId) return null;
    return wallets.find((w) => w.id === preferredWalletId) ?? null;
  }, [preferredWalletId, wallets]);

  // Check if mobile signer is linked (field may exist on user doc but not typed)
  const mobileSignerLinked = useAppStore(
    (s) => !!(s.user.currentUser as unknown as Record<string, unknown> | undefined)?.['mobile_signer_linked'],
  );

  // Determine the active wallet type based on preference + availability
  const activeType = useMemo<ActiveWalletType>(() => {
    // If user has a preference, respect it
    if (preferredWallet) {
      if (preferredWallet.provider === 'imported') return 'imported';
      if (preferredWallet.provider === 'mobile_signer') return 'mobile';
      return 'browser';
    }

    // Fallback priority: browser → imported → mobile
    if (adapterConnected && adapterPublicKey) return 'browser';
    if (importedAddress) return 'imported';
    if (mobileSignerLinked) return 'mobile';

    return null;
  }, [preferredWallet, adapterConnected, adapterPublicKey, importedAddress, mobileSignerLinked]);

  // Build the active wallet address
  const walletAddress = useMemo(() => {
    switch (activeType) {
      case 'browser':
        return adapterPublicKey?.toBase58() ?? null;
      case 'imported':
        return importedAddress;
      case 'mobile':
        return mobileWalletAddress;
      default:
        return null;
    }
  }, [activeType, adapterPublicKey, importedAddress, mobileWalletAddress]);

  // Build the signTransaction function
  const signTransaction = useCallback(
    async (tx: Transaction): Promise<Transaction> => {
      switch (activeType) {
        case 'browser': {
          if (!adapterSignTx) throw new Error('Browser wallet does not support signing');
          return adapterSignTx(tx);
        }
        case 'imported': {
          if (!webWalletService.isUnlocked()) {
            throw new Error('WALLET_LOCKED');
          }
          return webWalletService.signTransaction(tx);
        }
        case 'mobile': {
          if (!userId) throw new Error('Not authenticated');
          const requestId = await createSigningRequest(tx, userId);
          const result = await pollForResult(requestId);
          if (result.status === 'rejected') {
            throw new Error('Transaction rejected on mobile');
          }
          if (result.status === 'expired') {
            throw new Error('Transaction approval expired');
          }
          if (!result.signedTransaction) {
            throw new Error('No signed transaction returned from mobile');
          }
          return Transaction.from(Buffer.from(result.signedTransaction, 'base64'));
        }
        default:
          throw new Error('No wallet available for signing');
      }
    },
    [activeType, adapterSignTx, userId],
  );

  const transactionMethod = useMemo(() => {
    switch (activeType) {
      case 'browser': return 'web_wallet_adapter';
      case 'imported': return 'web_imported_wallet';
      case 'mobile': return 'web_mobile_signer';
      default: return 'web_wallet_adapter';
    }
  }, [activeType]);

  return {
    walletAddress,
    walletType: activeType,
    isReady: activeType !== null && (activeType !== 'imported' || importedUnlocked),
    isImportedUnlocked: importedUnlocked,
    signTransaction: activeType ? signTransaction : null,
    transactionMethod,
  };
}
