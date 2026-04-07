'use client';

/**
 * useBLEPairing — React hook for BLE wallet pairing lifecycle
 *
 * Wraps `lib/ble/bleCentral.ts` with React state management.
 *
 * On successful pairing:
 * 1. Decrypted wallet credentials are stored in IndexedDB (same format as mnemonic import)
 * 2. The `useActiveWallet` hook picks up the new wallet automatically on next render
 * 3. The page is responsible for updating the Firestore user doc with `web_wallet_address`
 *    and navigating the user onwards.
 *
 * Usage:
 *   const { isBLEAvailable, status, startPairing, cancelPairing, result, error } = useBLEPairing();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  isBLEAvailable,
  onStatusChange,
  scanAndPair,
  cancelScan,
  type BLEStatus,
  type BLEPairingResult,
} from '@/lib/ble/bleCentral';
import { saveEncryptedKey } from '@/lib/web-wallet/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseBLEPairingReturn {
  /** Whether Web Bluetooth is available in this browser */
  isBLEAvailable: boolean;
  /** Current pairing lifecycle status */
  status: BLEStatus;
  /** Human-readable status message from the pairing service */
  statusMessage: string | null;
  /** Whether a pairing session is currently in progress */
  isPairing: boolean;
  /** Start scanning for a WeSplit mobile peripheral */
  startPairing: () => Promise<BLEPairingResult | null>;
  /** Cancel the current pairing session */
  cancelPairing: () => void;
  /** The successfully paired wallet result (null until pairing completes) */
  result: BLEPairingResult | null;
  /** Error message if pairing failed */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBLEPairing(): UseBLEPairingReturn {
  const [bleAvailable] = useState(() => isBLEAvailable());
  const [status, setStatus] = useState<BLEStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [result, setResult] = useState<BLEPairingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track whether the component is still mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Register status callback on mount
  useEffect(() => {
    const unsubscribe = onStatusChange((newStatus, message) => {
      if (!mountedRef.current) return;
      setStatus(newStatus);
      setStatusMessage(message ?? null);

      if (newStatus === 'complete' || newStatus === 'error' || newStatus === 'cancelled') {
        setIsPairing(false);
      }
    });

    return unsubscribe;
  }, []);

  const startPairing = useCallback(async (): Promise<BLEPairingResult | null> => {
    if (!bleAvailable) {
      setError('Web Bluetooth is not supported in this browser. Use the QR code option instead.');
      return null;
    }

    // Reset state for new session
    setError(null);
    setResult(null);
    setStatus('scanning');
    setStatusMessage(null);
    setIsPairing(true);

    try {
      const pairingResult = await scanAndPair();

      if (!mountedRef.current) return null;

      // Store the received wallet credentials in IndexedDB.
      // The format matches what `importFromMnemonic` produces — same storage layer,
      // same IndexedDB key format. `useActiveWallet` picks it up automatically.
      await saveEncryptedKey({
        userId: pairingResult.userId,
        encryptedKey: pairingResult.encryptedSecretKey,
        publicKey: pairingResult.publicKey,
        importedAt: new Date().toISOString(),
      });

      if (!mountedRef.current) return null;

      setResult(pairingResult);
      return pairingResult;

    } catch (err: unknown) {
      if (!mountedRef.current) return null;

      const message = err instanceof Error ? err.message : 'Pairing failed. Please try again.';

      // Don't set error for user-cancelled flows
      const isCancelled = (err instanceof Error && err.name === 'UserCancelledError') ||
        message.includes('cancelled');

      if (!isCancelled) {
        setError(message);
      }

      return null;
    }
  }, [bleAvailable]);

  const cancelPairing = useCallback(() => {
    cancelScan();
    setIsPairing(false);
    setStatus('cancelled');
    setStatusMessage(null);
  }, []);

  return {
    isBLEAvailable: bleAvailable,
    status,
    statusMessage,
    isPairing,
    startPairing,
    cancelPairing,
    result,
    error,
  };
}
