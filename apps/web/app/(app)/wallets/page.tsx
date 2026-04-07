'use client';

import Link from 'next/link';
import { Wallet, Plus, Key, DeviceMobile, DeviceMobileCamera } from '@phosphor-icons/react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatAddress, formatCurrency } from '@/lib/utils';
import { getUSDCBalance, getSOLBalance } from '@/lib/transactions/transactionService';
import { useAppStore } from '@/store';
import { getWebWalletInfo } from '@/lib/web-wallet/wallet';

export default function WalletsPage() {
  const { publicKey, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const currentUser = useAppStore((s) => s.user.currentUser);

  // Check for imported wallet
  const [importedWallet, setImportedWallet] = useState<{ address: string; exists: boolean }>({ address: '', exists: false });
  useEffect(() => {
    if (!currentUser?.id) return;
    getWebWalletInfo(currentUser.id).then(setImportedWallet);
  }, [currentUser?.id]);

  const walletAddress = publicKey?.toBase58() || currentUser?.wallet_address;

  const { data: balances, isLoading } = useQuery({
    queryKey: ['balances', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const [usdc, sol] = await Promise.all([
        getUSDCBalance(connection, walletAddress),
        getSOLBalance(connection, walletAddress),
      ]);
      return { usdc, sol };
    },
    enabled: !!walletAddress && connected,
    refetchInterval: 30_000,
  });

  if (!connected || !walletAddress) {
    return (
      <PageContainer>
        <PageHeader title="Wallets" subtitle="Manage your connected wallets" />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-white-10)' }}
            >
              <Wallet size={32} color="var(--color-text-secondary)" />
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>No wallet connected</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Connect a Solana wallet to get started</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Link href="/wallets/connect">
                <Button variant="primary" size="lg" fullWidth leftIcon={<Plus size={16} weight="bold" />}>Connect Wallet</Button>
              </Link>
              <Link href="/wallets/pair">
                <Button variant="secondary" size="lg" fullWidth leftIcon={<DeviceMobileCamera size={16} />}>Pair with Phone</Button>
              </Link>
              <Link href="/wallets/import">
                <Button variant="ghost" size="lg" fullWidth leftIcon={<Key size={16} />}>Import Recovery Phrase</Button>
              </Link>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Wallets"
        subtitle="Manage your connected wallets"
        rightElement={
          <Link href="/wallets/connect">
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} weight="bold" />}>Connect</Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-4">
        <Link href={`/wallets/${wallet?.adapter.name || 'connected'}`}>
          <Card hoverable className="transition-all">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
              >
                <Wallet size={24} weight="fill" color="var(--color-bg)" />
              </div>

              <div className="flex flex-1 flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {wallet?.adapter.name || 'Connected Wallet'}
                  </span>
                  <Badge variant="success" size="sm" dot>Connected</Badge>
                  <Badge variant="primary" size="sm">Primary</Badge>
                </div>

                <p className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatAddress(walletAddress, { chars: 8 })}
                </p>

                {isLoading ? (
                  <div className="flex gap-4 mt-1">
                    <Skeleton width={80} height={36} radius="sm" />
                    <Skeleton width={80} height={36} radius="sm" />
                  </div>
                ) : balances ? (
                  <div className="flex gap-6 mt-1">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>SOL</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                        {balances.sol.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>USDC</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                        {formatCurrency(balances.usdc, 'USDC')}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </Link>

        {/* Imported wallet card */}
        {importedWallet.exists && (
          <Card>
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <Key size={24} color="var(--color-primary)" />
              </div>
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    Imported Wallet
                  </span>
                  <Badge variant="info" size="sm">Imported</Badge>
                </div>
                <p className="font-mono text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatAddress(importedWallet.address, { chars: 8 })}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Action cards */}
        <div className="flex flex-col gap-3">
          <Link href="/wallets/connect">
            <div
              className="flex items-center gap-4 rounded-[var(--radius-xl)] p-5 transition-all cursor-pointer hover:bg-white/[0.04]"
              style={{ border: '2px dashed var(--color-border)' }}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: 'var(--color-white-10)' }}
              >
                <Plus size={22} color="var(--color-text-secondary)" />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Connect browser wallet</p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Phantom, Solflare, Backpack</p>
              </div>
            </div>
          </Link>

          {!importedWallet.exists && (
            <>
              <Link href="/wallets/pair">
                <div
                  className="flex items-center gap-4 rounded-[var(--radius-xl)] p-5 transition-all cursor-pointer hover:bg-white/[0.04]"
                  style={{ border: '2px dashed var(--color-border)' }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'rgba(165,234,21,0.08)' }}
                  >
                    <DeviceMobileCamera size={22} color="var(--color-primary)" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Pair with your phone</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Transfer wallet via Bluetooth or QR code</p>
                  </div>
                </div>
              </Link>

              <Link href="/wallets/import">
                <div
                  className="flex items-center gap-4 rounded-[var(--radius-xl)] p-5 transition-all cursor-pointer hover:bg-white/[0.04]"
                  style={{ border: '2px dashed var(--color-border)' }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--color-white-10)' }}
                  >
                    <Key size={22} color="var(--color-text-secondary)" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text)' }}>Import from recovery phrase</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Enter 12/24-word mnemonic manually</p>
                  </div>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
