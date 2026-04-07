'use client';

/**
 * Wallet Transfer QR Component
 *
 * Displays a QR code for mobile wallet linking with:
 * - Countdown timer
 * - Status indicator (waiting/confirmed/expired)
 * - Retry button
 * - Loading states
 */

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Spinner, QrCode, CheckCircle, XCircle, ArrowClockwise } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { TransferSessionStatus } from '@/lib/services/walletTransferService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalletTransferQRProps {
  /** QR payload to encode */
  qrPayload: string | null;
  /** Session status */
  status: TransferSessionStatus | 'idle' | 'loading';
  /** Time remaining in milliseconds */
  timeRemaining: number;
  /** Error message */
  error?: string | null;
  /** Retry callback */
  onRetry?: () => void;
  /** Cancel callback */
  onCancel?: () => void;
  /** QR code size in pixels */
  size?: number;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WalletTransferQR({
  qrPayload,
  status,
  timeRemaining,
  error,
  onRetry,
  onCancel,
  size = 256,
  className,
}: WalletTransferQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code when payload changes
  useEffect(() => {
    if (!qrPayload || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, qrPayload, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    }).catch((err) => {
      console.error('[WalletTransferQR] Failed to generate QR:', err);
    });
  }, [qrPayload, size]);

  // Format time remaining
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine status color and icon
  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          icon: <Spinner size={24} className="animate-spin text-blue-500" />,
          text: 'Creating session...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
        };
      case 'pending':
        return {
          icon: <QrCode size={24} className="text-primary" />,
          text: 'Scan with WeSplit mobile app',
          color: 'text-primary',
          bgColor: 'bg-primary/5',
        };
      case 'confirmed':
        return {
          icon: <CheckCircle size={24} weight="fill" className="text-green-500" />,
          text: 'Wallet linked successfully!',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
        };
      case 'expired':
        return {
          icon: <XCircle size={24} weight="fill" className="text-red-500" />,
          text: 'Session expired',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
        };
      case 'cancelled':
        return {
          icon: <XCircle size={24} className="text-gray-500" />,
          text: 'Session cancelled',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
        };
      default:
        return {
          icon: <QrCode size={24} className="text-gray-400" />,
          text: 'Ready to start',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const isExpired = status === 'expired' || (status === 'pending' && timeRemaining === 0);
  const showQR = status === 'pending' && qrPayload && !isExpired;
  const showRetry = status === 'expired' || isExpired || error;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* QR Code Container */}
      <div
        className={cn(
          'relative rounded-2xl border-2 p-4 transition-all duration-300',
          showQR ? 'border-primary/20 bg-white' : statusConfig.bgColor + ' border-transparent'
        )}
        style={{ width: size + 32, height: size + 32 }}
      >
        {/* QR Code */}
        {showQR && (
          <canvas
            ref={canvasRef}
            className="rounded-lg"
            style={{ width: size, height: size }}
          />
        )}

        {/* Loading State */}
        {status === 'loading' && (
          <div className="flex h-full w-full items-center justify-center">
            <Spinner size={48} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Status Overlay for non-pending states */}
        {(status === 'confirmed' || status === 'expired' || status === 'cancelled' || status === 'idle') && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            {status === 'confirmed' && (
              <CheckCircle size={64} weight="fill" className="text-green-500" />
            )}
            {(status === 'expired' || status === 'cancelled') && (
              <XCircle size={64} weight="fill" className="text-red-500" />
            )}
            {status === 'idle' && (
              <QrCode size={64} className="text-gray-300" />
            )}
          </div>
        )}

        {/* Expired Overlay */}
        {isExpired && status === 'pending' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm">
            <div className="text-center">
              <XCircle size={48} weight="fill" className="mx-auto text-red-500" />
              <p className="mt-2 font-medium text-red-600">Session expired</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Text */}
      <div className={cn('flex items-center gap-2', statusConfig.color)}>
        {statusConfig.icon}
        <span className="text-sm font-medium">{statusConfig.text}</span>
      </div>

      {/* Timer */}
      {status === 'pending' && !isExpired && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Expires in</span>
          <span
            className={cn(
              'font-mono font-semibold',
              timeRemaining < 60000 ? 'text-red-500' : 'text-foreground'
            )}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <ArrowClockwise size={16} />
            Try Again
          </button>
        )}

        {status === 'pending' && !isExpired && onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Instructions */}
      {showQR && (
        <div className="mt-2 max-w-xs text-center text-xs text-muted-foreground">
          <p>Open the WeSplit mobile app and scan this QR code to link your mobile wallet to this web session.</p>
        </div>
      )}
    </div>
  );
}

export default WalletTransferQR;
