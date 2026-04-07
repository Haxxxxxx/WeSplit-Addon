'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaperPlaneTilt, X } from '@phosphor-icons/react';
import { PublicKey } from '@solana/web3.js';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { PinPrompt } from '@/components/telegram/PinPrompt';
import { SuccessScreen } from '@/components/telegram/SuccessScreen';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { TransactionErrorBanner } from '@/components/telegram/TransactionErrorBanner';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';
import { usePinFlow } from '@/hooks/telegram/usePinFlow';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { createConnection } from '@/lib/solana';
import { sendUSDC } from '@/lib/transactions/transactionService';
import { searchUsers, getRecentContacts } from '@/lib/firebase/queries';
import { isValidSolanaAddress, formatCurrency, sanitizeAmountInput, dismissKeyboard } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { SendSkeleton } from '@/components/telegram/TelegramSkeletons';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Telegram Send Screen — USDC transfers with contact resolution + PIN signing
// ---------------------------------------------------------------------------

export default function TelegramSendPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
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

  const [recipientInput, setRecipientInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [amount, setAmount] = useState('');

  // Pre-fill recipient from query params (e.g. from contacts page)
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (prefillHandled.current) return;
    const toParam = searchParams.get('to');
    const nameParam = searchParams.get('name');
    if (toParam) {
      prefillHandled.current = true;
      if (nameParam) {
        setSelectedUser({ id: '', name: nameParam, wallet_address: toParam } as User);
      } else {
        setRecipientInput(toParam);
      }
    }
    const amountParam = searchParams.get('amount');
    if (amountParam) setAmount(amountParam);
  }, [searchParams]);
  const [note, setNote] = useState('');
  const [successData, setSuccessData] = useState<{ amount: number; name: string } | null>(null);

  const debouncedSearch = useDebouncedValue(recipientInput, 300);

  // Resolve the actual wallet address to send to
  const toAddress = selectedUser?.wallet_address ?? recipientInput.trim();
  const recipientDisplayName = selectedUser?.name ?? (toAddress.length > 8 ? `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}` : toAddress);

  const numAmount = parseFloat(amount) || 0;
  const isValidRecipient = isValidSolanaAddress(toAddress);
  const canSend = isValidRecipient && numAmount > 0 && numAmount <= usdcBalance && hasWallet && !!walletAddress;

  const pin = usePinFlow(canSend, { haptic });

  // Recent contacts
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['recentContacts', userId],
    queryFn: () => getRecentContacts(userId!, 6),
    enabled: !!userId && !selectedUser,
    staleTime: 60_000,
  });

  // User search
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['searchUsers', debouncedSearch, userId],
    queryFn: () => searchUsers(debouncedSearch, userId ?? undefined),
    enabled: debouncedSearch.length >= 2 && !selectedUser,
    staleTime: 10_000,
  });

  const showDropdown = !selectedUser && (recipientInput.length >= 2 || recentContacts.length > 0);
  const displayContacts = recipientInput.length >= 2 ? searchResults : recentContacts;

  function selectContact(user: User) {
    setSelectedUser(user);
    setRecipientInput('');
    haptic?.selectionChanged();
  }

  function clearContact() {
    setSelectedUser(null);
    setRecipientInput('');
    haptic?.selectionChanged();
  }

  // Telegram back button
  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // ---- Send flow ----

  const handlePinConfirm = useCallback(
    async (pinValue: string) => {
      if (!walletAddress || !canSend) return;

      pin.startSending();

      try {
        const connection = createConnection();
        const fromPubkey = new PublicKey(walletAddress);

        await sendUSDC({
          connection,
          fromPubkey,
          toAddress,
          amountUsdc: numAmount,
          signTransaction: (tx) => sign(tx, pinValue),
          note: note.trim() || undefined,
          senderName: userName ?? undefined,
          recipientName: selectedUser?.name ?? undefined,
          senderUid: userId ?? undefined,
          transactionMethod: 'telegram_wallet',
        });

        pin.onSuccess();
        refetchBalance();
        queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentContacts', userId] });
        setSuccessData({ amount: numAmount, name: recipientDisplayName });
      } catch (err) {
        pin.onError(err);
      } finally {
        pin.stopSending();
      }
    },
    [walletAddress, canSend, toAddress, numAmount, sign, userName, selectedUser, userId, note, recipientDisplayName, refetchBalance, queryClient, pin],
  );

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: pin.sending ? 'Sending...' : `Send${numAmount > 0 ? ` $${amount}` : ''}`,
    onClick: pin.openPinPrompt,
    visible: canSend && !walletLoading && !successData,
    loading: pin.sending,
    disabled: !canSend || pin.sending,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (walletLoading) return <SendSkeleton />;

  if (successData) {
    return (
      <SuccessScreen
        title="Sent!"
        message={`${formatCurrency(successData.amount, 'USDC')} sent to ${successData.name}`}
        onDone={() => goBack()}
        link={{ href: '/tg/transactions', label: 'View Transactions' }}
      />
    );
  }

  if (!hasWallet) {
    return (
      <NoWalletScreen
        icon={<PaperPlaneTilt size={48} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />}
        message="Create a wallet first from the dashboard to start sending USDC."
        onBack={() => goBack()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<PaperPlaneTilt size={20} weight="bold" color="var(--color-bg)" />}
        title="Send"
        subtitle="Send USDC to anyone"
      />

      {pin.txError && <TransactionErrorBanner error={pin.txError} onRetry={pin.openPinPrompt} />}

      {/* Recipient */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>Recipient</label>

        {/* Selected user chip */}
        {selectedUser ? (
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-primary)' }}
          >
            <Avatar fallback={selectedUser.name} size="sm" />
            <div className="flex flex-1 flex-col min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{selectedUser.name}</span>
              <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {selectedUser.wallet_address ? `${selectedUser.wallet_address.slice(0, 6)}...${selectedUser.wallet_address.slice(-4)}` : selectedUser.email}
              </span>
            </div>
            <button type="button" onClick={clearContact} className="p-1" style={{ color: 'var(--color-text-tertiary)' }} aria-label="Clear recipient">
              <X size={16} weight="bold" />
            </button>
          </div>
        ) : (
          <>
            <Input
              placeholder="Name, email, or wallet address..."
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              error={
                recipientInput.trim().length > 30 && !isValidSolanaAddress(recipientInput.trim()) && searchResults.length === 0
                  ? 'Invalid address — try searching by name or email'
                  : undefined
              }
            />

            {/* Contact dropdown */}
            {showDropdown && displayContacts.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5">
                {recipientInput.length < 2 && recentContacts.length > 0 && (
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Recent</p>
                )}
                {isSearching && (
                  <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-tertiary)' }}>Searching...</p>
                )}
                {displayContacts.filter((c) => c.wallet_address).slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectContact(c)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors active:bg-white/[0.05]"
                  >
                    <Avatar fallback={c.name} size="sm" />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>{c.name}</span>
                      <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {c.wallet_address ? `${c.wallet_address.slice(0, 6)}...${c.wallet_address.slice(-4)}` : c.email}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Amount */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>Amount (USDC)</label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          >$</span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (v !== null) setAmount(v); }}
            min={0}
            className="pl-8 font-medium"
            style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
          />
        </div>

        {numAmount > usdcBalance && (
          <p className="mt-2 text-xs" style={{ color: 'var(--color-error)' }}>Insufficient balance</p>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--color-white-5)' }}>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Available</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
              {formatCurrency(usdcBalance, 'USDC')}
            </span>
            <button
              type="button"
              onClick={() => setAmount(usdcBalance.toString())}
              className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-primary-dim)', color: 'var(--color-primary)' }}
            >Max</button>
          </div>
        </div>
      </Card>

      {/* Note (optional) */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Note (optional)
        </label>
        <textarea
          placeholder="What's this for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
          style={{
            backgroundColor: 'var(--color-white-10)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
      </Card>

      {canSend && (
        <Button onClick={pin.openPinPrompt} loading={pin.sending} fullWidth className="mt-2 tg-hide">
          Send ${amount}
        </Button>
      )}

      <PinPrompt
        open={pin.showPin}
        onConfirm={handlePinConfirm}
        onCancel={pin.cancelPin}
        loading={pin.sending}
        error={pin.pinError}
        title="Confirm Send"
        description={`Send $${numAmount.toFixed(2)} USDC to ${recipientDisplayName}${note.trim() ? ` — "${note.trim()}"` : ''}`}
        getPinHint={getPinHint}
      />
    </div>
  );
}
