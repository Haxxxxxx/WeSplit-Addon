'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, ShareNetwork, Check } from '@phosphor-icons/react';
import QRCode from 'qrcode';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { DepositSkeleton } from '@/components/telegram/TelegramSkeletons';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';

export default function TelegramDepositPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const searchParams = useSearchParams();
  const { address: personalAddress, hasWallet, isLoading } = useTgWallet();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Support shared wallet funding via query params
  const overrideAddress = searchParams.get('address');
  const overrideName = searchParams.get('name');
  const walletAddress = overrideAddress || personalAddress;
  const isSharedWallet = !!overrideAddress;

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Generate QR code when wallet address is available
  useEffect(() => {
    if (!walletAddress || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, walletAddress, {
      width: 176,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }, [walletAddress]);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress).then(() => {
      haptic?.notificationOccurred('success');
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

  if (isLoading) return <DepositSkeleton />;

  if (!hasWallet) {
    return (
      <NoWalletScreen
        message="Create a wallet first from the dashboard to receive deposits."
        onBack={() => goBack()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}>
          {isSharedWallet ? `Fund ${overrideName ?? 'Wallet'}` : 'Deposit'}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isSharedWallet
            ? 'Send funds to this shared wallet address'
            : 'Add funds to your WeSplit wallet'}
        </p>
      </div>

      {/* Warning banner */}
      <div
        className="flex items-start gap-3 rounded-xl p-3.5"
        style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}
      >
        <span className="text-sm leading-none">&#9888;&#65039;</span>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>
            Solana network only
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Only send SOL or SPL tokens (USDC) to this address. Sending other assets may result in permanent loss.
          </p>
        </div>
      </div>

      {/* QR code + address */}
      <Card>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl overflow-hidden bg-white p-2">
            <canvas ref={canvasRef} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Wallet Address
            </p>
            <p
              className="text-center font-mono text-xs break-all px-2"
              style={{ color: 'var(--color-text)' }}
            >
              {walletAddress}
            </p>
          </div>
        </div>
      </Card>

      {/* Supported assets */}
      <Card>
        <p className="mb-2.5 text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          Supported assets
        </p>
        <div className="flex flex-wrap gap-2">
          {['USDC', 'SOL', 'USDT'].map((asset) => (
            <Badge key={asset} variant="primary" size="md">
              {asset}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          fullWidth
          onClick={copyAddress}
          leftIcon={copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}
        >
          {copied ? 'Copied!' : 'Copy Address'}
        </Button>
        <Button variant="secondary" onClick={shareAddress} leftIcon={<ShareNetwork size={18} />}>
          Share
        </Button>
      </div>
    </div>
  );
}
