'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Copy, ShareNetwork, Wallet, Check, QrCode, Warning } from '@phosphor-icons/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store';

// ---------------------------------------------------------------------------
// Inline QR canvas — renders a static address QR code
// ---------------------------------------------------------------------------

function AddressQR({ address, size = 220 }: { address: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!address || !canvasRef.current) return;
    setError(false);
    QRCode.toCanvas(canvasRef.current, address, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(() => setError(true));
  }, [address, size]);

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-2xl"
        style={{ width: size, height: size, backgroundColor: 'var(--color-white-5)' }}
      >
        <Warning size={32} color="var(--color-text-tertiary)" />
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Failed to generate QR
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-3"
      style={{ backgroundColor: '#FFFFFF', border: '3px solid var(--color-primary)' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: size, height: size }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposit page — show wallet address + QR code
// ---------------------------------------------------------------------------

export default function DepositPage() {
  return (
    <Suspense fallback={<PageContainer><div className="animate-pulse h-96 rounded-xl" style={{ backgroundColor: 'var(--color-white-5)' }} /></PageContainer>}>
      <DepositContent />
    </Suspense>
  );
}

function DepositContent() {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const { publicKey } = useWallet();
  const currentUser = useAppStore((state) => state.user.currentUser);

  // Support ?address=X&name=Y for shared wallet funding
  const overrideAddress = searchParams.get('address');
  const overrideName = searchParams.get('name');

  // Get wallet address: override (shared wallet) > wallet adapter > web wallet > mobile wallet
  const walletAddress = overrideAddress || publicKey?.toBase58() || currentUser?.web_wallet_address || currentUser?.wallet_address || '';
  const isSharedWallet = !!overrideAddress;

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareAddress() {
    if (!walletAddress) return;
    if (navigator.share) {
      navigator.share({ title: 'My WeSplit wallet address', text: walletAddress });
    } else {
      copyAddress();
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={isSharedWallet ? `Fund ${overrideName || 'Shared Wallet'}` : 'Deposit'}
        subtitle={isSharedWallet ? 'Send USDC to this shared wallet address' : 'Add funds to your WeSplit wallet'}
      />

      <div className="flex flex-col gap-5 max-w-md">
        {/* Solana-only warning */}
        <div
          className="flex items-start gap-3 rounded-[var(--radius-lg)] p-4"
          style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}
        >
          <Warning size={20} weight="fill" color="var(--color-warning)" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
              Solana network only
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Only send SOL or SPL tokens (USDC) to this address. Sending other assets may result in permanent loss.
            </p>
          </div>
        </div>

        {/* QR + address display */}
        <Card>
          {walletAddress ? (
            <div className="flex flex-col items-center gap-5">
              {/* QR code */}
              <AddressQR address={walletAddress} size={220} />

              {/* Label */}
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
                {isSharedWallet ? 'Shared Wallet Address' : 'Your Wallet Address'}
              </p>

              {/* Full address — tappable to copy */}
              <button
                type="button"
                onClick={copyAddress}
                className="w-full flex items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-3 transition-colors hover:bg-white/[0.05] active:opacity-80"
                style={{
                  backgroundColor: 'var(--color-white-5)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span
                  className="text-sm font-mono break-all text-left"
                  style={{ color: 'var(--color-text)', lineHeight: 1.6 }}
                >
                  {walletAddress}
                </span>
                <span className="shrink-0 ml-2">
                  {copied
                    ? <Check size={16} color="var(--color-success)" weight="bold" />
                    : <Copy size={16} color="var(--color-text-secondary)" />
                  }
                </span>
              </button>

              <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: 300 }}>
                Scan the QR code or share your address to receive SOL or USDC from any Solana wallet.
              </p>
            </div>
          ) : (
            // Empty state — no wallet connected
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-white-5)' }}
              >
                <QrCode size={40} color="var(--color-text-tertiary)" weight="duotone" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                  Connect a wallet
                </p>
                <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)', maxWidth: 280 }}>
                  Connect your Solana wallet to receive funds and start using WeSplit
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Supported assets */}
        <Card>
          <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Supported assets
          </p>
          <div className="flex flex-wrap gap-2">
            {['USDC', 'SOL'].map((asset) => (
              <Badge key={asset} variant="primary" size="md">{asset}</Badge>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={copyAddress}
            leftIcon={copied ? <Check size={20} weight="bold" /> : <Copy size={20} />}
            disabled={!walletAddress}
          >
            {copied ? 'Copied!' : 'Copy Address'}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={shareAddress}
            leftIcon={<ShareNetwork size={20} />}
            disabled={!walletAddress}
          >
            Share
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
