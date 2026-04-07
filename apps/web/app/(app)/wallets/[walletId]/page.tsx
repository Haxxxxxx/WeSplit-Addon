'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, Copy } from '@phosphor-icons/react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { getUSDCBalance, getSOLBalance } from '@/lib/transactions/transactionService';
import { useSOLPrice } from '@/lib/services/priceService';
import { useToast } from '@/components/ui/Toast';
import { useAppStore } from '@/store';

export default function WalletDetailPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { toast } = useToast();

  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const currentUser = useAppStore((s) => s.user.currentUser);

  const walletAddress = publicKey?.toBase58() || currentUser?.wallet_address || '';
  const walletName = wallet?.adapter.name || 'WeSplit Wallet';

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const [usdc, sol] = await Promise.all([
        getUSDCBalance(connection, walletAddress),
        getSOLBalance(connection, walletAddress),
      ]);
      return { usdc, sol };
    },
    enabled: !!walletAddress,
    refetchInterval: 30_000,
  });

  const { data: solPrice } = useSOLPrice();
  const solUsdValue = balances && solPrice ? balances.sol * solPrice : 0;

  function copy() {
    navigator.clipboard.writeText(walletAddress);
    toast({ title: 'Address copied!', variant: 'info' });
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/wallets" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Wallets
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Hero balance */}
        <HeroCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{walletName}</span>
            <Badge variant="primary" size="sm">Primary</Badge>
          </div>

          {balancesLoading ? (
            <>
              <Skeleton width={160} height={48} radius="sm" />
              <div className="mt-1 mb-5"><Skeleton width={120} height={16} radius="sm" /></div>
            </>
          ) : balances ? (
            <>
              <p
                className="font-semibold mb-1"
                style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-balance)', color: 'var(--color-text)' }}
              >
                {formatCurrency(balances.usdc, 'USDC')}
              </p>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                {balances.sol.toFixed(4)} SOL
                {solPrice ? <span className="ml-2">{'\u2248'} ${solUsdValue.toFixed(2)}</span> : null}
              </p>
            </>
          ) : (
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>No wallet connected</p>
          )}

          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10"
            style={{ backgroundColor: 'var(--color-white-10)', color: 'var(--color-text-secondary)' }}
          >
            <span className="font-mono">{formatAddress(walletAddress, { chars: 6 })}</span>
            <Copy size={12} />
          </button>
        </HeroCard>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/send">
            <Button variant="secondary" fullWidth leftIcon={<ArrowUp size={18} />}>Send</Button>
          </Link>
          <Link href="/deposit">
            <Button variant="secondary" fullWidth leftIcon={<ArrowDown size={18} />}>Deposit</Button>
          </Link>
        </div>

        {/* Token balances */}
        <div
          className="rounded-[var(--radius-xl)] overflow-hidden"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Tokens</h3>
          </div>
          {balancesLoading ? (
            <div className="px-5 py-4 flex flex-col gap-2">
              <Skeleton width="100%" height={56} radius="sm" />
              <Skeleton width="100%" height={56} radius="sm" />
            </div>
          ) : balances ? (
            [
              { symbol: 'SOL', name: 'Solana', balance: balances.sol.toFixed(4), usd: solPrice ? `$${solUsdValue.toFixed(2)}` : '-' },
              { symbol: 'USDC', name: 'USD Coin', balance: balances.usdc.toFixed(2), usd: formatCurrency(balances.usdc, 'USDC') },
            ].map((token) => (
              <div key={token.symbol} className="flex items-center gap-4 px-5 py-4 border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))', color: 'var(--color-bg)' }}
                >
                  {token.symbol.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{token.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{token.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>{token.balance}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{token.usd}</p>
                </div>
              </div>
            ))
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
