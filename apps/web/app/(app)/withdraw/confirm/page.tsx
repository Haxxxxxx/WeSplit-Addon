'use client';

import { Suspense, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { WarningCircle, ArrowLeft, LockSimple, Warning } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatAddress } from '@/lib/utils';
import { sendUSDC, sendSOL, getSOLBalance } from '@/lib/transactions/transactionService';
import { useAppStore } from '@/store';
import { useAuth } from '@/providers';

/** Minimum SOL needed to pay for any transaction */
const MIN_SOL_FOR_FEES = 0.002;

export default function WithdrawConfirmPage() {
  return (
    <Suspense fallback={<PageContainer><Skeleton width="100%" height={400} radius="lg" /></PageContainer>}>
      <WithdrawConfirmInner />
    </Suspense>
  );
}

function WithdrawConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { user } = useAuth();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // SOL balance — needed to check gas fee coverage for USDC withdrawals
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const rawAmount = searchParams.get('amount') ?? '0';
  const currency = searchParams.get('currency') ?? 'USDC';
  const destination = searchParams.get('destination') ?? '';
  const fee = searchParams.get('fee') ?? '0.000005';

  // Validate destination is a valid Solana public key
  const isValidDestination = (() => {
    try {
      if (!destination) return false;
      new PublicKey(destination);
      return true;
    } catch {
      return false;
    }
  })();

  const displayAmount = currency === 'USDC' ? `$${parseFloat(rawAmount).toFixed(2)}` : `${parseFloat(rawAmount).toFixed(4)} SOL`;
  const shortDest = destination.length > 12 ? formatAddress(destination, { chars: 6 }) : destination;

  // Fetch SOL balance when connected (needed for gas fee check)
  useEffect(() => {
    if (!publicKey || !connected) {
      setSolBalance(null);
      return;
    }
    getSOLBalance(connection, publicKey.toBase58())
      .then(setSolBalance)
      .catch(() => setSolBalance(null));
  }, [publicKey, connected, connection]);

  // Insufficient SOL for gas — only relevant for USDC withdrawals
  const insufficientSolForFees =
    currency === 'USDC' && solBalance !== null && solBalance < MIN_SOL_FOR_FEES;

  // For SOL withdrawals, ensure enough left for gas after sending
  const numAmount = parseFloat(rawAmount) || 0;
  const insufficientSolAfterWithdraw =
    currency === 'SOL' && solBalance !== null && solBalance - numAmount < MIN_SOL_FOR_FEES;

  const hasFeeError = insufficientSolForFees || insufficientSolAfterWithdraw;
  const hasValidationError = hasFeeError || !isValidDestination;

  async function handleConfirm() {
    if (!publicKey || !signTransaction || !connected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to withdraw funds',
        variant: 'error',
      });
      return;
    }

    if (hasFeeError) {
      toast({
        title: 'Insufficient SOL for fees',
        description: `You need at least ${MIN_SOL_FOR_FEES} SOL to cover network fees.`,
        variant: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      const result = currency === 'USDC'
        ? await sendUSDC({
            connection,
            fromPubkey: publicKey,
            toAddress: destination,
            amountUsdc: parseFloat(rawAmount),
            signTransaction,
            senderName: currentUser?.name,
            senderUid: user?.uid,
            transactionType: 'withdraw',
          })
        : await sendSOL({
            connection,
            fromPubkey: publicKey,
            toAddress: destination,
            amountSol: parseFloat(rawAmount),
            signTransaction,
            senderName: currentUser?.name,
            senderUid: user?.uid,
            transactionType: 'withdraw',
          });

      // Add to local store for immediate UI update
      addTransaction({
        id: result.txId,
        type: 'withdraw',
        amount: result.amount,
        currency: result.currency,
        tx_hash: result.txId,
        status: 'completed',
        to_wallet: destination,
        from_wallet: publicKey.toBase58(),
        created_at: new Date().toISOString(),
      });

      toast({
        title: 'Withdrawal confirmed!',
        description: `${displayAmount} sent to ${shortDest}`,
        variant: 'success',
      });

      // Invalidate balance so dashboard reflects the withdrawn amount
      void queryClient.invalidateQueries({ queryKey: ['userBalance'] });

      // Navigate to dedicated success page
      const successParams = new URLSearchParams({
        amount: rawAmount,
        currency,
        destination,
        txId: result.txId,
      });
      router.push(`/withdraw/success?${successParams.toString()}`);
    } catch (err: any) {
      toast({
        title: 'Withdrawal failed',
        description: err?.message ?? 'Transaction failed. Please try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/withdraw" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-md">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Confirm Withdrawal</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Review the details before submitting</p>
        </div>

        {/* Invalid destination address */}
        {!isValidDestination && destination && (
          <div
            className="flex items-start gap-3 rounded-[var(--radius-lg)] p-4"
            style={{
              backgroundColor: 'var(--color-error-20)',
              border: '1px solid var(--color-error)',
            }}
          >
            <Warning size={20} weight="fill" color="var(--color-error)" className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
                Invalid destination address
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                The destination is not a valid Solana address. Please go back and enter a correct address.
              </p>
            </div>
          </div>
        )}

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
                Connect your wallet to complete this withdrawal.
              </p>
            </div>
          </div>
        )}

        {/* Insufficient SOL for gas banner */}
        {connected && hasFeeError && (
          <div
            className="flex items-start gap-3 rounded-[var(--radius-lg)] p-4"
            style={{
              backgroundColor: 'var(--color-error-20)',
              border: '1px solid var(--color-error)',
            }}
          >
            <Warning size={20} weight="fill" color="var(--color-error)" className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>
                Insufficient SOL for network fees
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {insufficientSolForFees
                  ? `You need at least ${MIN_SOL_FOR_FEES} SOL to pay for network fees (you have ${solBalance?.toFixed(5) ?? '0'} SOL).`
                  : `After this withdrawal, you won't have enough SOL left to cover network fees (~${MIN_SOL_FOR_FEES} SOL). Reduce the amount or keep some SOL.`}
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        <Card>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {[
              { label: 'Amount', value: displayAmount, highlight: true },
              { label: 'Asset', value: currency },
              { label: 'To', value: shortDest },
              { label: 'Network fee', value: `~${fee} SOL` },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: highlight ? 'var(--font-family-number)' : undefined,
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Irreversibility warning */}
        <div
          className="flex gap-3 rounded-[var(--radius-lg)] p-4"
          style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}
        >
          <WarningCircle size={20} weight="fill" color="var(--color-warning)" className="shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            This action is irreversible. Funds sent to an incorrect address cannot be recovered.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            loading={loading}
            disabled={!connected || hasValidationError}
            onClick={handleConfirm}
            leftIcon={<LockSimple size={20} weight="fill" />}
          >
            Confirm &amp; Withdraw
          </Button>
          <Button variant="ghost" fullWidth onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
