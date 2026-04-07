'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlass,
  User as UserIcon,
  ArrowsLeftRight,
  PaperPlaneTilt,
  Warning,
  ArrowRight,
  ArrowClockwise,
  Info,
} from '@phosphor-icons/react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/providers';
import { useAppStore } from '@/store';
import { getRecentContacts, getUserDoc } from '@/lib/firebase/queries';
import { useSOLPrice } from '@/lib/services/priceService';
import {
  getUSDCBalance,
  getSOLBalance,
  sendUSDC,
  sendSOL,
} from '@/lib/transactions/transactionService';
import { ensureContactExists } from '@/lib/services/autoContactService';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum SOL balance required to cover network fees (includes potential ATA creation). */
const MIN_SOL_FOR_FEES = 0.002; // ~0.002 SOL covers base fee + ATA rent
const BASE_TX_FEE_SOL = 0.000005; // 5000 lamports — base fee for simple tx

// ---------------------------------------------------------------------------
// Contact shape for selection
// ---------------------------------------------------------------------------

interface ContactOption {
  id: string;
  name: string;
  handle: string;
  walletAddress?: string;
}

function userToContact(u: User): ContactOption {
  return {
    id: u.id,
    name: u.name || u.wallet_address?.slice(0, 8) + '...',
    handle: u.email || (u.wallet_address ? `${u.wallet_address.slice(0, 6)}...${u.wallet_address.slice(-4)}` : ''),
    walletAddress: u.wallet_address ?? u.web_wallet_address ?? u.telegram_wallet_address,
  };
}

// ---------------------------------------------------------------------------
// Inline field error component
// ---------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-error)' }}>
      <Warning size={12} weight="fill" />
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Fee breakdown row
// ---------------------------------------------------------------------------

function FeeRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span
        className="text-sm font-semibold"
        style={{ color: highlight ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send page content (needs useSearchParams — must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function SendPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { user } = useAuth();
  const { toast } = useToast();
  const addTransaction = useAppStore((s) => s.addTransaction);
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;
  const queryClient = useQueryClient();

  // Form state
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [rawAddress, setRawAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USDC' | 'SOL'>('USDC');
  const [note, setNote] = useState('');

  // Payment request tracking (for auto-accept after successful send)
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);

  // Transaction state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation errors (shown after user attempts to proceed)
  const [touched, setTouched] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Real balances
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Live SOL price from CoinGecko
  const { data: solPrice } = useSOLPrice();

  // Recent contacts from Firestore
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 10),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const contactOptions = recentContacts.map(userToContact);

  // Fetch real balances
  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connected) {
      setUsdcBalance(null);
      setSolBalance(null);
      return;
    }
    setBalanceLoading(true);
    try {
      const [usdc, sol] = await Promise.all([
        getUSDCBalance(connection, publicKey.toBase58()),
        getSOLBalance(connection, publicKey.toBase58()),
      ]);
      setUsdcBalance(usdc);
      setSolBalance(sol);
    } catch {
      // Silently fail — will show "—" for balance
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey, connected, connection]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  // Auto-populate from URL query params (e.g. from payment request "Pay Now")
  useEffect(() => {
    const toParam = searchParams.get('to') || searchParams.get('recipientId');
    const amountParam = searchParams.get('amount');
    const requestIdParam = searchParams.get('requestId');

    if (amountParam) {
      setAmount(amountParam);
    }
    if (requestIdParam) {
      setPaymentRequestId(requestIdParam);
    }
    if (toParam) {
      getUserDoc(toParam).then((u) => {
        if (u) {
          setSelectedContact(userToContact(u));
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const filtered = contactOptions.filter(
    (c) =>
      c.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      c.handle.toLowerCase().includes(recipientSearch.toLowerCase()),
  );

  const isRawAddress = (() => {
    try {
      if (recipientSearch.length >= 32) {
        new PublicKey(recipientSearch);
        return true;
      }
    } catch { /* not an address */ }
    return false;
  })();

  const recipientAddress = rawAddress || selectedContact?.walletAddress || '';
  const parsedAmount = parseFloat(amount) || 0;
  const hasRecipient = !!(selectedContact || rawAddress);

  const showDropdown = recipientSearch.length > 0 && !selectedContact && !isRawAddress;

  // Determine the available balance for the selected currency
  const availableBalance = currency === 'USDC' ? usdcBalance : solBalance;

  // Fee estimation:
  // - USDC: base tx fee. If SOL balance is low enough to not cover ATA, show higher estimate.
  // - SOL: base tx fee deducted from send amount
  const estimatedFeeSol = BASE_TX_FEE_SOL; // simplified; ATA creation adds ~0.002 SOL

  // For SOL sends: max sendable = balance - min fee reserve
  const maxSendable =
    currency === 'USDC'
      ? usdcBalance ?? 0
      : Math.max(0, (solBalance ?? 0) - MIN_SOL_FOR_FEES);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): boolean {
    let valid = true;

    if (!hasRecipient) {
      setRecipientError('Please select a contact or enter a valid Solana address');
      valid = false;
    } else {
      setRecipientError(null);
    }

    if (!amount || parsedAmount <= 0) {
      setAmountError('Amount must be greater than 0');
      valid = false;
    } else if (availableBalance !== null && parsedAmount > availableBalance) {
      setAmountError(
        `Insufficient ${currency} balance. Available: ${
          currency === 'USDC'
            ? `$${(availableBalance).toFixed(2)}`
            : `${availableBalance.toFixed(4)} SOL`
        }`
      );
      valid = false;
    } else if (currency === 'USDC' && solBalance !== null && solBalance < MIN_SOL_FOR_FEES) {
      setAmountError(
        `Insufficient SOL for network fees. You need at least ${MIN_SOL_FOR_FEES} SOL (you have ${solBalance.toFixed(5)} SOL).`
      );
      valid = false;
    } else {
      setAmountError(null);
    }

    return valid;
  }

  function handleReviewClick() {
    setTouched(true);
    if (!connected) {
      toast({ title: 'Wallet not connected', description: 'Please connect a wallet to send.', variant: 'error' });
      return;
    }
    if (validate()) {
      setSendError(null);
      setShowConfirm(true);
    }
  }

  // ---------------------------------------------------------------------------
  // Send transaction (called from confirmation modal)
  // ---------------------------------------------------------------------------

  async function handleConfirmSend() {
    if (!publicKey || !signTransaction || !userId) return;

    setSending(true);
    setSendError(null);

    try {
      const result =
        currency === 'USDC'
          ? await sendUSDC({
              connection,
              fromPubkey: publicKey,
              toAddress: recipientAddress,
              amountUsdc: parsedAmount,
              signTransaction,
              note: note || undefined,
              senderName: currentUser?.name,
              recipientName: selectedContact?.name,
              recipientUid: selectedContact?.id,
              senderUid: user?.uid,
            })
          : await sendSOL({
              connection,
              fromPubkey: publicKey,
              toAddress: recipientAddress,
              amountSol: parsedAmount,
              signTransaction,
              note: note || undefined,
              senderName: currentUser?.name,
              recipientName: selectedContact?.name,
              recipientUid: selectedContact?.id,
              senderUid: user?.uid,
            });

      // Add to Zustand store
      addTransaction({
        id: result.txId,
        type: 'send',
        amount: result.amount,
        currency: result.currency,
        tx_hash: result.txId,
        status: 'completed',
        recipient_name: selectedContact?.name ?? '',
        to_wallet: recipientAddress,
        from_wallet: publicKey.toBase58(),
        created_at: new Date().toISOString(),
      });

      // Points are awarded internally by transactionService.recordTransaction()

      // Auto-create contact for the recipient (fire-and-forget)
      if (userId && selectedContact?.id) {
        ensureContactExists(
          userId,
          {
            id: selectedContact.id,
            name: selectedContact.name,
            email: selectedContact.handle,
            wallet_address: recipientAddress,
          },
          'transaction'
        ).catch(() => {});
      }

      // If this send was triggered by a payment request, mark it accepted now
      // (status is only updated AFTER the on-chain tx confirms, not before)
      if (paymentRequestId) {
        updateDoc(doc(db, 'paymentRequests', paymentRequestId), {
          status: 'accepted',
          // dual-format timestamps for mobile compat
          updated_at: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }

      // Invalidate balance so dashboard reflects the deducted amount
      void queryClient.invalidateQueries({ queryKey: ['userBalance'] });

      setShowConfirm(false);

      // Navigate to success
      const params = new URLSearchParams({
        amount,
        currency,
        recipient: selectedContact?.name ?? recipientAddress,
        txId: result.txId,
        ...(note && { note }),
      });
      router.push(`/send/success?${params.toString()}`);
    } catch (err: any) {
      const isNetworkError =
        err?.message?.includes('timeout') ||
        err?.message?.includes('network') ||
        err?.message?.includes('503') ||
        err?.message?.includes('fetch');

      const errorMsg = err?.message ?? 'Transaction failed. Please try again.';
      setSendError(isNetworkError ? `Network error: ${errorMsg}` : errorMsg);
      setShowConfirm(false);

      toast({
        title: isNetworkError ? 'Network Error' : 'Transaction Failed',
        description: errorMsg,
        variant: 'error',
      });
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Price conversion helper
  // ---------------------------------------------------------------------------

  function getConversion(): string {
    if (!parsedAmount || !solPrice) return '';
    if (currency === 'USDC') return `≈ ${(parsedAmount / solPrice).toFixed(4)} SOL`;
    return `≈ $${(parsedAmount * solPrice).toFixed(2)}`;
  }

  function formatBalance(): string {
    if (!connected) return 'Connect wallet';
    if (balanceLoading) return 'Loading...';
    if (currency === 'USDC') {
      return usdcBalance !== null ? `$${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
    }
    return solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageContainer>
      <PageHeader title="Send" subtitle="Send USDC or SOL instantly" />

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Wallet not connected warning */}
        {!connected && (
          <div
            className="flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3"
            style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}
          >
            <Warning size={20} color="var(--color-warning)" />
            <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
              Connect a wallet to send transactions
            </span>
          </div>
        )}

        {/* Send error banner with retry */}
        {sendError && (
          <div
            className="rounded-[var(--radius-md)] px-4 py-3"
            style={{ backgroundColor: 'var(--color-error-20)', border: '1px solid var(--color-error)' }}
          >
            <div className="flex items-start gap-2">
              <Warning size={16} weight="fill" color="var(--color-error)" className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                  {sendError.startsWith('Network error') ? 'Network Error' : 'Transaction Failed'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-error)' }}>
                  {sendError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSendError(null); setShowConfirm(true); }}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-error)' }}
            >
              <ArrowClockwise size={12} />
              Retry transaction
            </button>
          </div>
        )}

        {/* ─────────── Recipient ─────────── */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Recipient
          </h3>

          {selectedContact ? (
            <div className="flex items-center gap-3">
              <Avatar fallback={selectedContact.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{selectedContact.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{selectedContact.handle}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedContact(null); setRawAddress(''); setRecipientError(null); }}>
                Change
              </Button>
            </div>
          ) : rawAddress ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-white-10)' }}>
                <UserIcon size={20} color="var(--color-text-tertiary)" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold font-mono" style={{ color: 'var(--color-text)' }}>
                  {rawAddress.slice(0, 8)}...{rawAddress.slice(-6)}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Solana address</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setRawAddress(''); setRecipientSearch(''); setRecipientError(null); }}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Input
                  placeholder="Search contacts or paste address..."
                  value={recipientSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecipientSearch(val);
                    setRecipientError(null);
                    // Auto-detect pasted Solana address
                    try {
                      if (val.length >= 32) {
                        new PublicKey(val);
                        setRawAddress(val);
                        setRecipientSearch('');
                      }
                    } catch { /* not a valid address */ }
                  }}
                  leftIcon={<MagnifyingGlass size={16} />}
                />
                {showDropdown && (
                  <div
                    className="absolute z-20 mt-1 w-full rounded-[var(--radius-lg)] overflow-hidden"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
                  >
                    {filtered.length === 0 ? (
                      <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        No contacts found — paste a Solana address to send directly
                      </div>
                    ) : (
                      filtered.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedContact(c); setRecipientSearch(''); setRecipientError(null); }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
                        >
                          <Avatar fallback={c.name} size="sm" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{c.name}</span>
                            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.handle}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {touched && <FieldError message={recipientError ?? undefined} />}
            </>
          )}
        </Card>

        {/* ─────────── Amount ─────────── */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Amount
          </h3>

          {/* Currency toggle */}
          <div className="flex gap-2 mb-4">
            {(['USDC', 'SOL'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCurrency(c); setAmountError(null); }}
                className="flex-1 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-all"
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

          {/* Big amount input with Max button */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {currency === 'USDC' ? '$' : '◎'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); if (touched) setAmountError(null); }}
              className="flex-1 bg-transparent font-medium outline-none placeholder:text-[var(--color-text-disabled)]"
              style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)', fontSize: 'var(--font-size-send-amount)' }}
            />
            {/* Max button */}
            {maxSendable > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmount(currency === 'USDC' ? maxSendable.toFixed(2) : maxSendable.toFixed(5));
                  setAmountError(null);
                }}
                className="shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-bold transition-colors hover:opacity-80"
                style={{ backgroundColor: 'var(--color-primary-20)', color: 'var(--color-primary)' }}
              >
                MAX
              </button>
            )}
          </div>

          {/* Price conversion */}
          {(() => {
            const conversion = getConversion();
            if (!conversion) return null;
            return (
              <div className="mt-3 flex items-center gap-1.5">
                <ArrowsLeftRight size={12} color="var(--color-text-tertiary)" />
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {conversion}
                </span>
              </div>
            );
          })()}

          {/* Balance row */}
          <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2" style={{ backgroundColor: 'var(--color-white-5)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Available</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}>
              {formatBalance()}
            </span>
          </div>

          {/* Inline amount error */}
          {touched && <FieldError message={amountError ?? undefined} />}

          {/* SOL fee hint for USDC sends */}
          {currency === 'USDC' && connected && solBalance !== null && solBalance >= MIN_SOL_FOR_FEES && (
            <div className="mt-3 flex items-center gap-1.5">
              <Info size={12} color="var(--color-text-tertiary)" />
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Network fees paid in SOL (~{estimatedFeeSol} SOL)
              </span>
            </div>
          )}
        </Card>

        {/* ─────────── Note ─────────── */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Note (optional)
          </h3>
          <textarea
            placeholder="What's this for?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
            style={{
              backgroundColor: 'var(--color-white-10)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </Card>

        {/* CTA */}
        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={sending}
          loading={sending}
          onClick={handleReviewClick}
          leftIcon={<ArrowRight size={20} weight="bold" />}
        >
          Review & Send
        </Button>
      </div>

      {/* ─────────────────────────── Confirmation Modal ─────────────────────────── */}
      <Modal
        open={showConfirm}
        onClose={() => { if (!sending) setShowConfirm(false); }}
        title="Confirm Transaction"
        showCloseButton={!sending}
        closeOnOverlayClick={!sending}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              loading={sending}
              disabled={sending}
              onClick={handleConfirmSend}
              leftIcon={<PaperPlaneTilt size={20} weight="fill" />}
            >
              {sending ? 'Sending...' : 'Confirm & Send'}
            </Button>
            {!sending && (
              <Button variant="ghost" fullWidth onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Recipient summary */}
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] p-3" style={{ backgroundColor: 'var(--color-white-5)' }}>
            <Avatar fallback={selectedContact?.name ?? 'W'} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {selectedContact?.name ?? `${recipientAddress.slice(0, 8)}...${recipientAddress.slice(-6)}`}
              </p>
              <p className="text-xs font-mono truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {selectedContact?.handle || recipientAddress}
              </p>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="rounded-[var(--radius-lg)] p-3" style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
              Transaction Summary
            </p>

            <FeeRow
              label="You send"
              value={currency === 'USDC' ? `$${parsedAmount.toFixed(2)} USDC` : `${parsedAmount.toFixed(5)} SOL`}
            />

            <FeeRow
              label="Network fee"
              value={`~${estimatedFeeSol} SOL`}
            />

            {note && (
              <FeeRow label="Note" value={`"${note.length > 30 ? note.slice(0, 30) + '…' : note}"`} />
            )}

            <div className="h-px my-1" style={{ backgroundColor: 'var(--color-border)' }} />

            <FeeRow
              label="They receive"
              value={
                currency === 'USDC'
                  ? `$${parsedAmount.toFixed(2)} USDC`
                  : `${parsedAmount.toFixed(5)} SOL`
              }
              highlight
            />
          </div>

          {/* Mainnet / devnet notice */}
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] p-3" style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}>
            <Info size={14} color="var(--color-warning)" className="mt-0.5 shrink-0" />
            <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
              This transaction is irreversible. Double-check the recipient address before confirming.
            </p>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense for useSearchParams compatibility
// ---------------------------------------------------------------------------

export default function SendPage() {
  return (
    <Suspense fallback={null}>
      <SendPageContent />
    </Suspense>
  );
}
