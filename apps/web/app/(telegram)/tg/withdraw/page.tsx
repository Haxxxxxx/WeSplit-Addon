'use client';

import { useState, useCallback } from 'react';
import { ArrowUp, ClipboardText } from '@phosphor-icons/react';
import { PublicKey } from '@solana/web3.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PinPrompt } from '@/components/telegram/PinPrompt';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';
import { usePinFlow } from '@/hooks/telegram/usePinFlow';
import { isValidSolanaAddress, formatCurrency, sanitizeAmountInput, dismissKeyboard } from '@/lib/utils';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { createConnection } from '@/lib/solana';
import { sendUSDC, sendSOL, getSOLBalance } from '@/lib/transactions/transactionService';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { WithdrawSkeleton } from '@/components/telegram/TelegramSkeletons';
import { SuccessScreen } from '@/components/telegram/SuccessScreen';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { TransactionErrorBanner } from '@/components/telegram/TransactionErrorBanner';

// ---------------------------------------------------------------------------
// Telegram Withdraw Page — wired to on-chain USDC/SOL transfers via TG wallet
// ---------------------------------------------------------------------------

export default function TelegramWithdrawPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const {
    address: walletAddress,
    hasWallet,
    usdcBalance,
    isLoading: walletLoading,
    sign,
    getPinHint,
    refetchBalance,
  } = useTgWallet();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);

  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState<'USDC' | 'SOL'>('USDC');
  const [successData, setSuccessData] = useState<{ amount: number; currency: string } | null>(null);

  // SOL balance query (USDC comes from useTgWallet)
  const { data: solBalance = 0 } = useQuery({
    queryKey: ['tgWalletSolBalance', walletAddress],
    queryFn: async () => {
      const connection = createConnection();
      return getSOLBalance(connection, walletAddress!);
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const balance = currency === 'USDC' ? usdcBalance : solBalance;
  const isValidAddress = destination.length === 0 || isValidSolanaAddress(destination);
  const numAmount = parseFloat(amount) || 0;
  const canProceed =
    numAmount > 0 &&
    numAmount <= balance &&
    isValidSolanaAddress(destination) &&
    hasWallet &&
    !!walletAddress;

  const pin = usePinFlow(canProceed, { haptic, impactStyle: 'heavy' });

  function pasteFromClipboard() {
    navigator.clipboard.readText().then((text) => setDestination(text.trim()));
  }

  // Telegram back button
  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // ---- Withdraw flow ----

  const handlePinConfirm = useCallback(
    async (pinValue: string) => {
      if (!walletAddress || !canProceed) return;

      pin.startSending();

      try {
        const connection = createConnection();
        const fromPubkey = new PublicKey(walletAddress);

        if (currency === 'USDC') {
          await sendUSDC({
            connection,
            fromPubkey,
            toAddress: destination.trim(),
            amountUsdc: numAmount,
            signTransaction: (tx) => sign(tx, pinValue),
            note: 'Withdrawal from TG',
            senderName: userName ?? undefined,
            senderUid: userId ?? undefined,
            transactionType: 'withdraw',
            transactionMethod: 'telegram_wallet',
          });
        } else {
          await sendSOL({
            connection,
            fromPubkey,
            toAddress: destination.trim(),
            amountSol: numAmount,
            signTransaction: (tx) => sign(tx, pinValue),
            note: 'Withdrawal from TG',
            senderName: userName ?? undefined,
            senderUid: userId ?? undefined,
            transactionType: 'withdraw',
            transactionMethod: 'telegram_wallet',
          });
        }

        pin.onSuccess();
        refetchBalance();
        queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
        setSuccessData({ amount: numAmount, currency });
      } catch (err) {
        pin.onError(err);
      } finally {
        pin.stopSending();
      }
    },
    [walletAddress, canProceed, currency, destination, numAmount, sign, userName, userId, refetchBalance, queryClient, pin],
  );

  // Brand colors for Telegram MainButton
  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: pin.sending
      ? 'Processing...'
      : `Withdraw ${numAmount > 0 ? `${currency === 'USDC' ? '$' : ''}${amount} ${currency}` : ''}`,
    onClick: pin.openPinPrompt,
    visible: canProceed && !walletLoading && !successData,
    loading: pin.sending,
    disabled: !canProceed || pin.sending,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (walletLoading) return <WithdrawSkeleton />;

  if (successData) {
    return (
      <SuccessScreen
        title="Withdrawal Sent!"
        message={`${successData.currency === 'USDC' ? formatCurrency(successData.amount, 'USDC') : `${successData.amount.toFixed(4)} SOL`} sent to ${destination.slice(0, 6)}...${destination.slice(-4)}`}
        onDone={() => goBack()}
        link={{ href: '/tg/transactions', label: 'View Transactions' }}
      />
    );
  }

  // No wallet — prompt to create one
  if (!hasWallet) {
    return (
      <NoWalletScreen
        icon={<ArrowUp size={48} weight="bold" style={{ color: 'var(--color-text-tertiary)' }} />}
        message="Create a wallet first from the dashboard to start withdrawing."
        onBack={() => goBack()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<ArrowUp size={20} weight="bold" color="var(--color-bg)" />}
        title="Withdraw"
        subtitle="Send funds to an external wallet"
      />

      {/* Transaction error banner */}
      {pin.txError && <TransactionErrorBanner error={pin.txError} onRetry={pin.openPinPrompt} />}

      {/* Currency toggle */}
      <Card>
        <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Asset
        </label>
        <div className="flex gap-2">
          {(['USDC', 'SOL'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCurrency(c);
                setAmount('');
                haptic?.selectionChanged();
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all"
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
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Amount
        </label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          >
            {currency === 'USDC' ? '$' : '\u25CE'}
          </span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { const v = sanitizeAmountInput(e.target.value, currency === 'SOL' ? 9 : 6); if (v !== null) setAmount(v); }}
            min={0}
            className="pl-8 font-medium"
            style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          />
        </div>

        {numAmount > balance && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-error)' }}>
            Insufficient balance
          </p>
        )}

        <div
          className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
          style={{ backgroundColor: 'var(--color-white-5)' }}
        >
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Available
          </span>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
            >
              {currency === 'USDC' ? formatCurrency(balance, 'USDC') : `${balance.toFixed(4)} SOL`}
            </span>
            <button
              type="button"
              onClick={() => setAmount(balance.toString())}
              className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}
            >
              Max
            </button>
          </div>
        </div>
      </Card>

      {/* Destination */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Destination Wallet
        </label>
        <Input
          placeholder="Solana wallet address (base58)"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          error={!isValidAddress ? 'Invalid Solana address' : undefined}
          rightIcon={<ClipboardText size={18} />}
          onRightIconClick={pasteFromClipboard}
        />
        <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Make sure this is a Solana address. Funds sent to wrong addresses cannot be recovered.
        </p>
      </Card>

      {/* Network fee */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Network fee (est.)
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
        >
          ~0.000005 SOL
        </span>
      </div>

      {/* Fallback button */}
      {canProceed && (
        <Button onClick={pin.openPinPrompt} loading={pin.sending} fullWidth className="tg-hide">
          Review Withdrawal
        </Button>
      )}

      {/* PIN Prompt Modal */}
      <PinPrompt
        open={pin.showPin}
        onConfirm={handlePinConfirm}
        onCancel={pin.cancelPin}
        loading={pin.sending}
        error={pin.pinError}
        title="Confirm Withdrawal"
        description={`Withdraw ${currency === 'USDC' ? '$' : ''}${numAmount.toFixed(currency === 'USDC' ? 2 : 4)} ${currency} to ${destination.slice(0, 6)}...${destination.slice(-4)}`}
        getPinHint={getPinHint}
      />
    </div>
  );
}
