'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, LinkSimple, DeviceMobile, QrCode } from '@phosphor-icons/react';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers';
import { useAppStore } from '@/store';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatAddress } from '@/lib/utils';

const SUPPORTED_WALLETS = [
  { name: 'Phantom',  icon: '👻', description: 'Most popular Solana wallet' },
  { name: 'Solflare', icon: '🔆', description: 'Feature-rich Solana wallet' },
  { name: 'Backpack', icon: '🎒', description: 'Multi-chain xNFT wallet' },
];

export default function ConnectWalletPage() {
  const router = useRouter();
  const { connected, publicKey, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { user } = useAuth();
  const updateUser = useAppStore((s) => s.updateUser);
  const currentUser = useAppStore((s) => s.user.currentUser);

  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const webWalletAddress = publicKey?.toBase58();
  const hasMobileWallet = !!currentUser?.wallet_address;
  const isSameAsMobile = hasMobileWallet && currentUser?.wallet_address === webWalletAddress;
  const hasWebWallet = !!currentUser?.web_wallet_address;
  const walletAlreadyLinked = isSameAsMobile || hasWebWallet;

  async function handleLinkWallet() {
    if (!publicKey || !signMessage || !user) return;

    setLinking(true);
    setLinkError(null);

    try {
      // Sign a message to prove ownership
      const message = `Link wallet ${publicKey.toBase58()} to WeSplit account ${user.uid}`;
      const encodedMessage = new TextEncoder().encode(message);
      await signMessage(encodedMessage);

      const userRef = doc(db, 'users', user.uid);
      const walletAddr = publicKey.toBase58();

      if (!hasMobileWallet) {
        // No wallet at all — set as primary
        const walletFields = {
          wallet_address: walletAddr,
          wallet_public_key: walletAddr,
          wallet_type: 'external' as const,
          wallet_provider: 'browser_wallet',
          wallet_status: 'healthy' as const,
        };
        await updateDoc(userRef, walletFields);
        updateUser(walletFields);
      } else {
        // Already has a mobile wallet — store as web_wallet_address
        // so we don't break the mobile app's wallet identity
        await updateDoc(userRef, { web_wallet_address: walletAddr });
        updateUser({ web_wallet_address: walletAddr });
      }

      setLinked(true);
    } catch (err: any) {
      setLinkError(err?.message ?? 'Failed to link wallet');
    } finally {
      setLinking(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/wallets" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Wallets
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-md">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Connect Wallet</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Choose a wallet to connect to WeSplit
          </p>
        </div>

        {connected && publicKey ? (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle size={24} weight="fill" color="var(--color-success)" />
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Wallet connected</p>
                <p className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatAddress(publicKey.toBase58(), { chars: 8 })}
                </p>
              </div>
              <Badge variant="success" size="sm" dot className="ml-auto">Active</Badge>
            </div>

            {/* Link wallet to account (for email/Google users) */}
            {!walletAlreadyLinked && !linked && user && (
              <div className="mb-4">
                {linkError && (
                  <p className="mb-2 text-xs" style={{ color: 'var(--color-error)' }}>{linkError}</p>
                )}
                <Button
                  variant="secondary"
                  fullWidth
                  loading={linking}
                  onClick={handleLinkWallet}
                  leftIcon={<LinkSimple size={18} weight="bold" />}
                >
                  Link to Account
                </Button>
                <p className="mt-2 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                  {hasMobileWallet && !isSameAsMobile
                    ? 'This will be saved as your web wallet. Your mobile wallet stays unchanged.'
                    : 'Sign a message to prove you own this wallet'}
                </p>
              </div>
            )}

            {(walletAlreadyLinked || linked) && (
              <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2" style={{ backgroundColor: 'var(--color-success-20)' }}>
                <CheckCircle size={16} weight="fill" color="var(--color-success)" />
                <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                  {isSameAsMobile ? 'Wallet linked to your account' : 'Web wallet linked to your account'}
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="primary" fullWidth onClick={() => router.push('/wallets')}>
                Done
              </Button>
              <Button variant="danger" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Wallet options */}
            <div className="flex flex-col gap-3">
              {SUPPORTED_WALLETS.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => setVisible(true)}
                  className="flex items-center gap-4 rounded-[var(--radius-xl)] p-4 text-left transition-all hover:bg-white/[0.04]"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <span className="text-2xl">{w.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{w.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{w.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => setVisible(true)}
            >
              Open Wallet Selector
            </Button>
          </>
        )}

        {/* Mobile Wallet Link Option */}
        <Card className="p-4" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: 'var(--color-primary-20)' }}>
              <DeviceMobile size={24} weight="fill" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Have the WeSplit mobile app?
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                Link your mobile wallet by scanning a QR code. Your wallet stays on your phone.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/wallets/link')}
                leftIcon={<QrCode size={16} weight="bold" />}
              >
                Link via QR Code
              </Button>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          By connecting your wallet you agree to WeSplit&apos;s Terms of Service.
          WeSplit never has access to your private keys.
        </p>
      </div>
    </PageContainer>
  );
}
