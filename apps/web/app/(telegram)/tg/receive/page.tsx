'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  QrCode,
  CopySimple,
  Check,
  ShareNetwork,
} from '@phosphor-icons/react';
import QRCode from 'qrcode';
import { Card, HeroCard } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useTelegram } from '@/providers/TelegramProvider';
import { useAppStore } from '@/store';

// ---------------------------------------------------------------------------
// Solana Pay URI builder
// ---------------------------------------------------------------------------

const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function buildSolanaPayUri(address: string, label?: string, message?: string): string {
  const params = new URLSearchParams();
  params.set('spl-token', USDC_MINT);
  if (label) params.set('label', label);
  if (message) params.set('message', message);
  return `solana:${address}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// QR Receive Page
// ---------------------------------------------------------------------------

export default function TelegramReceivePage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { telegramUser } = useTelegram();
  const { address } = useTgWallet();
  const user = useAppStore((s) => s.user.currentUser);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const displayName = user?.name ?? telegramUser?.first_name ?? 'User';
  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Generate QR code onto canvas
  useEffect(() => {
    if (!address || !canvasRef.current) return;

    const uri = buildSolanaPayUri(address, 'WeSplit', `Send USDC to ${displayName}`);

    QRCode.toCanvas(canvasRef.current, uri, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  }, [address, displayName]);

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address, haptic]);

  const handleShare = useCallback(() => {
    if (!address) return;
    const text = `Send me USDC on WeSplit!\n\nWallet: ${address}`;

    // Use Telegram share if available, fallback to Web Share API
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink: (url: string) => void } } }).Telegram?.WebApp;
    if (tg) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(address)}&text=${encodeURIComponent(`Send me USDC on WeSplit!`)}`,
      );
    } else if (navigator.share) {
      navigator.share({ title: 'WeSplit Wallet', text }).catch(() => {});
    }
  }, [address]);

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <QrCode size={48} style={{ color: 'var(--color-text-tertiary)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          No Wallet
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Set up a wallet first to receive payments.
        </p>
        <Button onClick={() => goBack('/tg/wallet/setup')} variant="outline">
          Set Up Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<QrCode size={20} weight="bold" color="var(--color-bg)" />}
        title="Receive"
        subtitle="Show this QR to receive USDC"
      />

      {/* QR Card */}
      <HeroCard className="p-6">
        <div className="flex flex-col items-center gap-4">
          {/* User info */}
          <div className="flex items-center gap-2">
            <Avatar
              src={telegramUser?.photo_url}
              fallback={displayName}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {displayName}
              </p>
              <p className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {truncatedAddress}
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <canvas ref={canvasRef} />
          </div>

          <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Solana Pay &middot; USDC only
          </p>
        </div>
      </HeroCard>

      {/* Address card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Wallet Address
            </span>
            <span
              className="text-sm font-mono break-all"
              style={{ color: 'var(--color-text)' }}
            >
              {address}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-2 rounded-lg ml-3 transition-colors"
            style={{ backgroundColor: 'var(--color-white-10)', color: 'var(--color-text)' }}
            aria-label={copied ? 'Copied' : 'Copy address'}
          >
            {copied ? <Check size={16} weight="bold" /> : <CopySimple size={16} />}
          </button>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="outline" fullWidth leftIcon={copied ? <Check size={16} weight="bold" /> : <CopySimple size={16} />}>
          {copied ? 'Copied' : 'Copy Address'}
        </Button>
        <Button onClick={handleShare} fullWidth leftIcon={<ShareNetwork size={16} />}>
          Share
        </Button>
      </div>
    </div>
  );
}
