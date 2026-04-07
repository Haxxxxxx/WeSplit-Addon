'use client';

/**
 * Wallet Link Page
 *
 * Displays QR code for mobile app to scan and link wallet to web session.
 * Uses the wallet transfer flow for secure wallet linking.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, DeviceMobile, CheckCircle, Info } from '@phosphor-icons/react';
import { useAuth } from '@/providers';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { WalletTransferQR } from '@/components/ui/WalletTransferQR';
import { useWalletTransfer } from '@/hooks';
import { toast } from 'sonner';

export default function WalletLinkPage() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    status,
    qrPayload,
    timeRemaining,
    error,
    startSession,
    cancelSession,
    retry,
  } = useWalletTransfer(user?.uid, {
    onConfirmed: (walletAddress) => {
      toast.success('Wallet linked successfully!', {
        description: `Connected: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-4)}`,
      });
      // Redirect to wallets page after short delay
      setTimeout(() => {
        router.push('/wallets');
      }, 1500);
    },
    onExpired: () => {
      toast.error('Session expired', {
        description: 'Click "Try Again" to generate a new QR code',
      });
    },
    onError: (err) => {
      toast.error('Connection failed', { description: err });
    },
  });

  // Start session on mount
  useEffect(() => {
    if (user?.uid && status === 'idle') {
      startSession();
    }
  }, [user?.uid, status, startSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (status === 'pending') {
        cancelSession();
      }
    };
  }, [status, cancelSession]);

  return (
    <PageContainer>
      <div className="mb-6">
        <Link
          href="/wallets"
          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back to Wallets
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-md mx-auto">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: 'var(--color-primary-20)' }}>
            <DeviceMobile size={32} weight="fill" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Link Mobile Wallet
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Scan this QR code with your WeSplit mobile app to link your wallet
          </p>
        </div>

        {/* QR Code Card */}
        <Card className="p-6">
          <WalletTransferQR
            qrPayload={qrPayload}
            status={status}
            timeRemaining={timeRemaining}
            error={error}
            onRetry={retry}
            onCancel={cancelSession}
            size={240}
            className="mx-auto"
          />
        </Card>

        {/* Success State */}
        {status === 'confirmed' && (
          <Card className="p-4" style={{ backgroundColor: 'var(--color-success-20)' }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={24} weight="fill" style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-success)' }}>
                  Wallet Linked!
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Redirecting to your wallets...
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        {status === 'pending' && (
          <Card className="p-4" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
            <div className="flex gap-3">
              <Info size={20} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} />
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  How to link your wallet:
                </p>
                <ol className="text-xs space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>1. Open the WeSplit app on your phone</li>
                  <li>2. Go to Settings → Link to Web</li>
                  <li>3. Scan this QR code</li>
                  <li>4. Approve the connection in the app</li>
                </ol>
              </div>
            </div>
          </Card>
        )}

        {/* Alternative Option */}
        <div className="text-center">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
            Don&apos;t have the mobile app?
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/wallets/connect')}
          >
            Connect Browser Wallet Instead
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Your wallet&apos;s private keys stay on your mobile device.
          WeSplit never has access to your private keys.
        </p>
      </div>
    </PageContainer>
  );
}
