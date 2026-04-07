/**
 * Wallet Transfer Hook
 *
 * React hook for managing wallet transfer via QR code.
 * Handles session creation, real-time status updates, and timeout.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import type { WalletTransferSession, TransferSessionStatus } from '@/lib/services/walletTransferService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseWalletTransferOptions {
  /** Called when the session is confirmed */
  onConfirmed?: (walletAddress: string) => void;
  /** Called when the session expires */
  onExpired?: () => void;
  /** Called on errors */
  onError?: (error: string) => void;
}

export interface UseWalletTransferReturn {
  /** Current transfer session */
  session: WalletTransferSession | null;
  /** Session status */
  status: TransferSessionStatus | 'idle' | 'loading';
  /** QR payload to encode */
  qrPayload: string | null;
  /** Time remaining in milliseconds */
  timeRemaining: number;
  /** Whether a session is active */
  isActive: boolean;
  /** Error message if any */
  error: string | null;
  /** Start a new transfer session */
  startSession: () => Promise<void>;
  /** Cancel the current session */
  cancelSession: () => Promise<void>;
  /** Retry with a new session */
  retry: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for managing wallet transfer via QR code.
 *
 * @param userId - The current user ID
 * @param options - Callback options
 * @returns Transfer session state and actions
 *
 * @example
 * ```tsx
 * const { session, status, qrPayload, timeRemaining, startSession, retry } = useWalletTransfer(userId, {
 *   onConfirmed: (address) => toast.success(`Wallet ${address} linked!`),
 *   onExpired: () => toast.error('Session expired'),
 * });
 *
 * useEffect(() => {
 *   startSession();
 * }, []);
 *
 * return (
 *   <div>
 *     {status === 'pending' && qrPayload && (
 *       <QRCode value={qrPayload} />
 *     )}
 *     <p>Time remaining: {Math.floor(timeRemaining / 1000)}s</p>
 *     {status === 'expired' && <Button onClick={retry}>Retry</Button>}
 *   </div>
 * );
 * ```
 */
export function useWalletTransfer(
  userId: string | null | undefined,
  options: UseWalletTransferOptions = {}
): UseWalletTransferReturn {
  const { onConfirmed, onExpired, onError } = options;

  // State
  const [session, setSession] = useState<WalletTransferSession | null>(null);
  const [status, setStatus] = useState<TransferSessionStatus | 'idle' | 'loading'>('idle');
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Store actions
  const { connectWallet, setWalletType, setWalletStatus } = useAppStore();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startCountdown = useCallback((expiresAt: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const updateRemaining = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, expiry - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    updateRemaining();
    timerRef.current = setInterval(updateRemaining, 1000);
  }, []);

  // Start real-time listener for session updates
  const startListener = useCallback((sessionId: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const sessionRef = doc(db, 'wallet_transfer_sessions', sessionId);

    unsubscribeRef.current = onSnapshot(
      sessionRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn('[useWalletTransfer] Session document deleted');
          return;
        }

        const data = snapshot.data();
        const newStatus = data.status as TransferSessionStatus;

        // Parse timestamps
        const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt;
        const expiresAt = data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt;
        const confirmedAt = data.confirmedAt?.toDate?.()?.toISOString() || data.confirmedAt;

        const updatedSession: WalletTransferSession = {
          id: sessionId,
          userId: data.userId,
          nonce: data.nonce,
          status: newStatus,
          walletAddress: data.walletAddress,
          walletPublicKey: data.walletPublicKey,
          createdAt,
          expiresAt,
          confirmedAt,
          signature: data.signature,
        };

        setSession(updatedSession);
        setStatus(newStatus);

        // Handle status changes
        if (newStatus === 'confirmed' && data.walletAddress) {
          if (process.env.NODE_ENV !== 'production') console.log('[useWalletTransfer] Session confirmed');

          // Update Zustand store
          connectWallet(data.walletAddress, 'Mobile Wallet');
          setWalletType('external');
          setWalletStatus('healthy');

          // Call callback
          onConfirmed?.(data.walletAddress);

          // Cleanup
          cleanup();
        } else if (newStatus === 'expired') {
          if (process.env.NODE_ENV !== 'production') console.log('[useWalletTransfer] Session expired');
          onExpired?.();
          cleanup();
        }
      },
      (err) => {
        console.error('[useWalletTransfer] Listener error:', err);
        setError('Failed to listen for session updates');
        onError?.('Failed to listen for session updates');
      }
    );
  }, [connectWallet, setWalletType, setWalletStatus, onConfirmed, onExpired, onError, cleanup]);

  // Start a new transfer session
  const startSession = useCallback(async () => {
    if (!userId) {
      setError('User not authenticated');
      onError?.('User not authenticated');
      return;
    }

    try {
      cleanup();
      setStatus('loading');
      setError(null);

      const response = await fetch('/api/wallet-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();

      const newSession: WalletTransferSession = {
        id: data.sessionId,
        userId,
        nonce: data.nonce,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
      };

      setSession(newSession);
      setStatus('pending');
      setQrPayload(data.qrPayload);

      // Start countdown
      startCountdown(data.expiresAt);

      // Start real-time listener
      startListener(data.sessionId);

      if (process.env.NODE_ENV !== 'production') console.log('[useWalletTransfer] Session started');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session';
      setError(message);
      setStatus('idle');
      onError?.(message);
    }
  }, [userId, cleanup, startCountdown, startListener, onError]);

  // Cancel the current session
  const cancelSession = useCallback(async () => {
    if (!session || !userId) return;

    try {
      await fetch(`/api/wallet-transfer?sessionId=${session.id}&userId=${userId}`, {
        method: 'DELETE',
      });

      cleanup();
      setSession(null);
      setStatus('idle');
      setQrPayload(null);
      setTimeRemaining(0);

      if (process.env.NODE_ENV !== 'production') console.log('[useWalletTransfer] Session cancelled');
    } catch (err) {
      console.error('[useWalletTransfer] Failed to cancel session:', err);
    }
  }, [session, userId, cleanup]);

  // Retry with a new session
  const retry = useCallback(async () => {
    await cancelSession();
    await startSession();
  }, [cancelSession, startSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    session,
    status,
    qrPayload,
    timeRemaining,
    isActive: status === 'pending' || status === 'loading',
    error,
    startSession,
    cancelSession,
    retry,
  };
}

// ---------------------------------------------------------------------------
// Export types
// ---------------------------------------------------------------------------

export type { WalletTransferSession, TransferSessionStatus };
