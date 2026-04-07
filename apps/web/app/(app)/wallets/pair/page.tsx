'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  DeviceMobileCamera,
  BluetoothConnected,
  QrCode,
  CheckCircle,
  Warning,
  ArrowLeft,
  Key,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/firebase';
import { useAppStore } from '@/store';
import { useBLEPairing } from '@/hooks/web/useBLEPairing';
import {
  createPairingSession,
  getSecondsRemaining,
  type QRPairingSession,
} from '@/lib/ble/qrPairingService';
import { saveEncryptedKey } from '@/lib/web-wallet/storage';
import type { BLEPairingResult } from '@/lib/ble/bleCentral';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageStep = 'pairing' | 'success';

// ---------------------------------------------------------------------------
// Helper: format mm:ss countdown
// ---------------------------------------------------------------------------

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PairWalletPage() {
  const router = useRouter();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  // BLE pairing hook
  const ble = useBLEPairing();

  // QR session state
  const [qrSession, setQrSession] = useState<QRPairingSession | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const qrCancelRef = useRef<(() => Promise<void>) | null>(null);

  // Page state
  const [step, setStep] = useState<PageStep>('pairing');
  const [pairedAddress, setPairedAddress] = useState<string | null>(null);
  const [successError, setSuccessError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // QR countdown timer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!qrSession) return;
    const tick = () => setSecondsLeft(getSecondsRemaining(qrSession.expiresAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qrSession]);

  // ---------------------------------------------------------------------------
  // Post-pairing: update Firestore + Zustand, then navigate to success
  // ---------------------------------------------------------------------------

  const handlePairingSuccess = useCallback(async (result: BLEPairingResult) => {
    if (!userId) return;

    // Cancel the other pairing method to avoid dangling sessions
    if (qrCancelRef.current) {
      qrCancelRef.current().catch(() => {});
      qrCancelRef.current = null;
    }

    try {
      // Firestore user doc update (dual camelCase + snake_case)
      await updateDoc(doc(db, 'users', userId), {
        web_wallet_address: result.publicKey,
        webWalletAddress: result.publicKey,
        web_wallet_type: 'paired',
        webWalletType: 'paired',
        web_wallet_paired_at: serverTimestamp(),
        webWalletPairedAt: serverTimestamp(),
      });

      // Add to Zustand wallets
      useAppStore.getState().addWallet({
        id: `paired-${result.publicKey.slice(0, 8)}`,
        address: result.publicKey,
        name: 'Phone Wallet',
        type: 'external',
        status: 'healthy',
        isPreferred: false,
        createdAt: new Date().toISOString(),
        provider: 'imported', // Same IndexedDB storage as mnemonic import
      });

      setPairedAddress(result.publicKey);
      setStep('success');
    } catch {
      setSuccessError('Wallet received but failed to save. Try again.');
    }
  }, [userId]);

  // ---------------------------------------------------------------------------
  // BLE: auto-start on mount if available
  // ---------------------------------------------------------------------------

  const bleStartedRef = useRef(false);

  useEffect(() => {
    if (!ble.isBLEAvailable || bleStartedRef.current) return;
    bleStartedRef.current = true;
    ble.startPairing().then(async (result) => {
      if (result) {
        await handlePairingSuccess(result);
      }
    });
  }, [ble.isBLEAvailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch BLE result reactively in case hook resolves before our effect runs
  useEffect(() => {
    if (ble.result && step === 'pairing') {
      handlePairingSuccess(ble.result);
    }
  }, [ble.result, step, handlePairingSuccess]);

  // ---------------------------------------------------------------------------
  // QR: generate session
  // ---------------------------------------------------------------------------

  const generateQRSession = useCallback(async () => {
    if (!userId) return;
    setQrLoading(true);
    setQrError(null);

    // Cancel previous session if still open
    if (qrCancelRef.current) {
      await qrCancelRef.current();
      qrCancelRef.current = null;
    }

    try {
      const session = await createPairingSession(userId);
      setQrSession(session);
      qrCancelRef.current = session.cancel;

      // Wait for mobile to complete the transfer
      session.waitForResult
        .then(async (result) => {
          // Save to IndexedDB (BLE hook does this automatically; QR does not)
          await saveEncryptedKey({
            userId: result.userId,
            encryptedKey: result.encryptedSecretKey,
            publicKey: result.publicKey,
            importedAt: new Date().toISOString(),
          });
          await handlePairingSuccess(result);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'QR pairing failed';
          const isCancelled = err instanceof Error && err.name === 'UserCancelledError';
          if (!isCancelled) {
            setQrError(msg);
          }
        })
        .finally(() => {
          qrCancelRef.current = null;
        });
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setQrLoading(false);
    }
  }, [userId, handlePairingSuccess]);

  // Auto-generate QR on mount
  useEffect(() => {
    if (userId) {
      generateQRSession();
    }
    return () => {
      // Cancel QR session on unmount
      qrCancelRef.current?.();
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Render: Success step
  // ---------------------------------------------------------------------------

  if (step === 'success' && pairedAddress) {
    return (
      <PageContainer>
        <PageHeader title="Pair Wallet" subtitle="Transfer from your phone" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(83,239,151,0.1)' }}
            >
              <CheckCircle size={32} weight="fill" color="var(--color-success)" />
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Wallet Paired
              </p>
              <p className="text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {pairedAddress.slice(0, 6)}...{pairedAddress.slice(-4)}
              </p>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Your wallet key is encrypted and stored locally. Use your PIN to sign transactions.
            </p>
            {successError && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-error)' }}>
                <Warning size={14} />
                {successError}
              </div>
            )}
            <Button fullWidth onClick={() => router.push('/wallets')}>
              Done
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Pairing step
  // ---------------------------------------------------------------------------

  return (
    <PageContainer>
      <PageHeader
        title="Pair with Phone"
        subtitle="Transfer your wallet securely"
        rightElement={
          <button
            onClick={() => {
              ble.cancelPairing();
              qrCancelRef.current?.();
              router.back();
            }}
            className="flex items-center gap-1 text-sm transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />

      <div className="flex flex-col gap-4">
        {/* BLE section — only shown if Web Bluetooth is available */}
        {ble.isBLEAvailable && (
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'rgba(33,150,243,0.15)' }}
                >
                  <BluetoothConnected
                    size={20}
                    weight={ble.status === 'complete' ? 'fill' : 'regular'}
                    color="var(--color-info)"
                  />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    Bluetooth (automatic)
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Hold your phone near this device
                  </p>
                </div>
              </div>

              {/* BLE status indicator */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'var(--color-white-5)' }}
              >
                {ble.isPairing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-info)] border-t-transparent shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {ble.statusMessage ?? 'Looking for your phone...'}
                    </span>
                  </>
                ) : ble.status === 'complete' ? (
                  <>
                    <CheckCircle size={16} weight="fill" color="var(--color-success)" className="shrink-0" />
                    <span className="text-sm" style={{ color: 'var(--color-success)' }}>Transfer complete</span>
                  </>
                ) : ble.status === 'cancelled' ? (
                  <>
                    <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Scan cancelled</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        bleStartedRef.current = false;
                        ble.startPairing().then(async (result) => {
                          if (result) await handlePairingSuccess(result);
                        });
                      }}
                      className="ml-auto shrink-0"
                    >
                      Retry
                    </Button>
                  </>
                ) : ble.error ? (
                  <>
                    <Warning size={16} color="var(--color-error)" className="shrink-0" />
                    <span className="text-xs" style={{ color: 'var(--color-error)' }}>{ble.error}</span>
                  </>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Idle</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Divider */}
        {ble.isBLEAvailable && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
          </div>
        )}

        {/* QR Code section */}
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <QrCode size={20} color="var(--color-primary)" />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  QR Code
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Scan with your phone camera
                </p>
              </div>
            </div>

            {/* QR image or loading state */}
            <div className="flex flex-col items-center gap-3">
              {qrLoading ? (
                <div
                  className="flex h-[200px] w-[200px] items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--color-white-5)' }}
                >
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                </div>
              ) : qrSession && secondsLeft > 0 ? (
                <>
                  <div className="rounded-xl overflow-hidden border-4" style={{ borderColor: 'var(--color-white)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrSession.qrDataUrl}
                      alt="Wallet pairing QR code"
                      width={200}
                      height={200}
                      className="block"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      Expires in
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: secondsLeft < 30 ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
                    >
                      {formatCountdown(secondsLeft)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="flex h-[200px] w-[200px] items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--color-white-5)' }}
                  >
                    <QrCode size={48} color="var(--color-text-disabled)" />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    {secondsLeft === 0 && qrSession ? 'QR code expired' : 'QR code unavailable'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<ArrowClockwise size={14} />}
                    onClick={generateQRSession}
                  >
                    Generate new QR
                  </Button>
                </div>
              )}
            </div>

            {qrError && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-error)' }}>
                <Warning size={14} />
                {qrError}
              </div>
            )}

            {/* Instructions */}
            <div
              className="rounded-xl p-3 text-xs"
              style={{
                backgroundColor: 'var(--color-white-5)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <p className="font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                How to pair:
              </p>
              <ol className="flex flex-col gap-1" style={{ listStyleType: 'decimal', paddingLeft: '1.2em' }}>
                <li>Open WeSplit on your phone</li>
                <li>Go to Settings → Share wallet to desktop</li>
                <li>Scan the QR code above and approve the transfer</li>
              </ol>
            </div>
          </div>
        </Card>

        {/* Security note */}
        <div
          className="rounded-xl px-4 py-3 text-xs flex items-start gap-2"
          style={{
            backgroundColor: 'rgba(165,234,21,0.06)',
            color: 'var(--color-text-secondary)',
            border: '1px solid rgba(165,234,21,0.12)',
          }}
        >
          <DeviceMobileCamera size={16} className="shrink-0 mt-0.5" color="var(--color-primary)" />
          <span>
            Your wallet key never leaves your phone unencrypted. The transfer uses end-to-end encryption —
            only your devices can read the wallet data.
          </span>
        </div>

        {/* Manual import fallback */}
        <div className="flex items-center justify-center">
          <Link
            href="/wallets/import"
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Key size={14} />
            Import recovery phrase manually
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
