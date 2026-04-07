'use client';

import { useState, useCallback } from 'react';
import type { useTelegramHaptic } from '@/lib/telegram/hooks';

/**
 * Shared state + error classification for PIN-gated transaction flows.
 *
 * Handles: showPin, pinError, txError, sending states
 * plus error classification (pin vs. insufficient vs. network vs. generic).
 */

interface UsePinFlowOptions {
  haptic?: ReturnType<typeof useTelegramHaptic>;
  /** Impact style for opening PIN prompt (default: 'medium') */
  impactStyle?: 'light' | 'medium' | 'heavy';
}

interface PinFlowState {
  showPin: boolean;
  pinError: string | null;
  txError: string | null;
  sending: boolean;
}

interface UsePinFlowReturn extends PinFlowState {
  /** Open the PIN prompt — call this from your submit button */
  openPinPrompt: () => void;
  /** Call in your handlePinConfirm's try block before the TX */
  startSending: () => void;
  /** Call on successful TX — closes pin, fires success haptic */
  onSuccess: () => void;
  /** Call in catch — classifies error as pin vs. tx error */
  onError: (err: unknown) => void;
  /** Call in finally block */
  stopSending: () => void;
  /** Close the PIN prompt and clear pin error */
  cancelPin: () => void;
  /** Clear the transaction error */
  clearTxError: () => void;
}

export function usePinFlow(
  canProceed: boolean,
  opts?: UsePinFlowOptions,
): UsePinFlowReturn {
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const openPinPrompt = useCallback(() => {
    if (!canProceed || sending) return;
    setTxError(null);
    setPinError(null);
    setShowPin(true);
    opts?.haptic?.impactOccurred(opts.impactStyle ?? 'medium');
  }, [canProceed, sending, opts?.haptic, opts?.impactStyle]);

  const startSending = useCallback(() => {
    setSending(true);
    setPinError(null);
    setTxError(null);
  }, []);

  const onSuccess = useCallback(() => {
    setShowPin(false);
    opts?.haptic?.notificationOccurred('success');
  }, [opts?.haptic]);

  const onError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Transaction failed';
    const lower = msg.toLowerCase();

    if (lower.includes('decrypt') || lower.includes('pin')) {
      setPinError('Wrong PIN. Please try again.');
    } else {
      setShowPin(false);
      if (lower.includes('insufficient') || lower.includes('0x1')) {
        setTxError('Insufficient balance. Please add funds and try again.');
      } else if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
        setTxError('Network error. Check your connection and try again.');
      } else {
        setTxError(msg);
      }
    }
  }, []);

  const stopSending = useCallback(() => {
    setSending(false);
  }, []);

  const cancelPin = useCallback(() => {
    setShowPin(false);
    setPinError(null);
  }, []);

  const clearTxError = useCallback(() => {
    setTxError(null);
  }, []);

  return {
    showPin,
    pinError,
    txError,
    sending,
    openPinPrompt,
    startSending,
    onSuccess,
    onError,
    stopSending,
    cancelPin,
    clearTxError,
  };
}
