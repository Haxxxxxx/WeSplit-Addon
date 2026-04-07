'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ArrowUp, ClipboardText, Warning } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isValidSolanaAddress } from '@/lib/utils';
import { getUSDCBalance, getSOLBalance } from '@/lib/transactions/transactionService';

export default function WithdrawPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState<'USDC' | 'SOL'>('USDC');

  // Real balances
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fetch real balances when wallet connects
  useEffect(() => {
    if (!publicKey || !connected) {
      setUsdcBalance(null);
      setSolBalance(null);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);

    async function fetchBalances() {
      try {
        const [usdc, sol] = await Promise.all([
          getUSDCBalance(connection, publicKey!.toBase58()),
          getSOLBalance(connection, publicKey!.toBase58()),
        ]);
        if (!cancelled) {
          setUsdcBalance(usdc);
          setSolBalance(sol);
        }
      } catch (err) {
        console.error('[WithdrawPage] Failed to fetch balances:', err);
        if (!cancelled) {
          setUsdcBalance(0);
          setSolBalance(0);
        }
      } finally {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      }
    }

    fetchBalances();

    return () => {
      cancelled = true;
    };
  }, [publicKey, connected, connection]);

  const balance = currency === 'USDC' ? usdcBalance : solBalance;
  const isValidAddress = destination.length === 0 || isValidSolanaAddress(destination);
  const numAmount = parseFloat(amount) || 0;
  const canProceed =
    connected &&
    balance !== null &&
    numAmount > 0 &&
    numAmount <= balance &&
    isValidSolanaAddress(destination);

  function pasteFromClipboard() {
    navigator.clipboard.readText().then((text) => setDestination(text.trim()));
  }

  return (
    <PageContainer>
      <PageHeader title="Withdraw" subtitle="Send funds to an external wallet" />

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Warning if wallet not connected */}
        {!connected && (
          <div
            className="flex items-start gap-3 rounded-[var(--radius-lg)] p-4"
            style={{
              backgroundColor: 'var(--color-warning-20)',
              border: '1px solid var(--color-warning)',
            }}
          >
            <Warning size={20} weight="fill" color="var(--color-warning)" className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Wallet not connected
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Connect your wallet to view balances and withdraw funds.
              </p>
            </div>
          </div>
        )}

        {/* Currency toggle */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Asset
          </h3>
          <div className="flex gap-2">
            {(['USDC', 'SOL'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className="flex-1 rounded-[var(--radius-md)] py-2.5 text-sm font-semibold transition-all"
                style={{
                  backgroundColor: currency === c ? 'var(--color-primary)' : 'var(--color-white-10)',
                  color: currency === c ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </Card>

        {/* Amount */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Amount
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {currency === 'USDC' ? '$' : '◎'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              max={balance ?? undefined}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!connected || balanceLoading}
              className="flex-1 bg-transparent font-medium outline-none placeholder:text-[var(--color-text-disabled)] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)', fontSize: 'var(--font-size-send-amount)' }}
            />
          </div>

          {balance !== null && numAmount > balance && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>Insufficient balance</p>
          )}

          <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2" style={{ backgroundColor: 'var(--color-white-5)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Available</span>
            <div className="flex items-center gap-2">
              {balanceLoading ? (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
              ) : balance !== null ? (
                <>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
                    {currency === 'USDC' ? `$${balance.toFixed(2)}` : `${balance.toFixed(4)} SOL`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmount(balance.toString())}
                    disabled={!connected}
                    className="rounded px-2 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}
                  >
                    Max
                  </button>
                </>
              ) : (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
              )}
            </div>
          </div>
        </Card>

        {/* Destination address */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Destination Wallet
          </h3>
          <Input
            placeholder="Solana wallet address (base58)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            error={!isValidAddress ? 'Invalid Solana address' : undefined}
            rightIcon={<ClipboardText size={18} />}
            onRightIconClick={pasteFromClipboard}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Make sure this is a Solana address. Funds sent to wrong addresses cannot be recovered.
          </p>
        </Card>

        {/* Network fee estimate */}
        <div
          className="flex items-center justify-between rounded-[var(--radius-lg)] px-4 py-3"
          style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Network fee (est.)</span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
            ~0.000005 SOL
          </span>
        </div>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!canProceed}
          onClick={() => {
            const params = new URLSearchParams({
              amount: numAmount.toString(),
              currency,
              destination,
              fee: '0.000005',
            });
            router.push(`/withdraw/confirm?${params.toString()}`);
          }}
          leftIcon={<ArrowUp size={20} weight="bold" />}
        >
          Review Withdrawal
        </Button>
      </div>
    </PageContainer>
  );
}
