'use client';

import { use, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Receipt,
  Users,
  CalendarBlank,
  Storefront,
  Copy,
  Check,
  Warning,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useToast } from '@/components/ui/Toast';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate, formatAddress, cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { sendUSDC, buildUSDCTransferInstruction, getUSDCBalance } from '@/lib/transactions/transactionService';
import { recordParticipantPayment } from '@/lib/services/splitPaymentService';
import { SplitWalletService } from '@/lib/services/splitWalletService';
import {
  useSplitDetail,
  useIsSplitCreator,
  useCurrentUserSplitParticipant,
  useCompleteSplit,
  useCancelSplit,
  splitQueryKeys,
} from '@/hooks';
import { useRealtimeSplit } from '@/hooks/web/useRealtimeSplits';
import type { Split, SplitStatus, SplitStorageStatus, SplitParticipant } from '@/types';

// ---------------------------------------------------------------------------
// Status Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<SplitStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  draft: { label: 'Draft', variant: 'default', icon: Clock },
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  active: { label: 'Active', variant: 'info', icon: Receipt },
  locked: { label: 'Locked', variant: 'orange', icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'error', icon: XCircle },
};

function getStatusConfig(status: SplitStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// Participant status config
const PARTICIPANT_STATUS_CONFIG: Record<SplitStorageStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'default' },
  invited: { label: 'Invited', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'info' },
  declined: { label: 'Declined', variant: 'error' },
  paid: { label: 'Paid', variant: 'success' },
  locked: { label: 'Locked', variant: 'orange' },
};

function getParticipantStatusConfig(status: SplitStorageStatus) {
  return PARTICIPANT_STATUS_CONFIG[status] ?? PARTICIPANT_STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
  trip: '✈️',
  food: '🍔',
  home: '🏠',
  event: '🎉',
  rocket: '🚀',
};

function getCategoryEmoji(category?: string): string {
  return category && CATEGORY_EMOJI[category] ? CATEGORY_EMOJI[category] : '💸';
}

// Deterministic color from name
const PALETTE = [
  'var(--color-wallet-purple)',
  'var(--color-wallet-green)',
  'var(--color-wallet-orange)',
  'var(--color-wallet-blue)',
  'var(--color-wallet-red)',
  'var(--color-wallet-teal)',
  'var(--color-wallet-yellow)',
  'var(--color-wallet-pink)',
];

function colorFromName(name: string | undefined): string {
  const str = name || 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] || 'var(--color-wallet-purple)';
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SplitDetailSkeleton() {
  return (
    <PageContainer>
      {/* Back button skeleton */}
      <Skeleton width={120} height={20} radius="sm" className="mb-4" />

      {/* Hero card skeleton */}
      <SkeletonCard className="mb-6">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <Skeleton width={56} height={56} radius="xl" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton width="60%" height={24} radius="sm" />
              <Skeleton width="40%" height={14} radius="sm" />
            </div>
          </div>
          <Skeleton width="100%" height={60} radius="lg" className="mb-4" />
          <div className="flex gap-3">
            <Skeleton width={120} height={44} radius="lg" />
            <Skeleton width={120} height={44} radius="lg" />
          </div>
        </div>
      </SkeletonCard>

      {/* Participants section skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton width={150} height={20} radius="sm" />
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton width={40} height={40} radius="full" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton width="50%" height={16} radius="sm" />
                <Skeleton width="30%" height={12} radius="sm" />
              </div>
              <Skeleton width={70} height={24} radius="full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Participant Row Component
// ---------------------------------------------------------------------------

interface ParticipantRowProps {
  participant: SplitParticipant;
  isCurrentUser: boolean;
  canPay: boolean;
  onPayClick: () => void;
}

function ParticipantRow({ participant, isCurrentUser, canPay, onPayClick }: ParticipantRowProps) {
  const { label, variant } = getParticipantStatusConfig(participant.status);
  const isPaid = participant.status === 'paid';
  const remaining = Math.max(0, participant.amountOwed - (participant.amountPaid || 0));

  return (
    <Card padding="sm" className={cn(isCurrentUser && 'ring-1 ring-[var(--color-primary)]')}>
      <div className="flex items-center gap-3">
        <Avatar fallback={participant.name} src={participant.avatar} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {participant.name}
            </span>
            {isCurrentUser && (
              <Badge variant="primary" size="sm">
                You
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {participant.walletAddress
                ? formatAddress(participant.walletAddress)
                : 'No wallet'}
            </span>
            {participant.paidAt && (
              <>
                <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Paid {formatDate(participant.paidAt, { format: 'relative' })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Amount and status */}
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-sm font-semibold"
            style={{
              color: isPaid ? 'var(--color-success)' : 'var(--color-text)',
              fontFamily: 'var(--font-family-number)',
            }}
          >
            {formatCurrency(participant.amountOwed, 'USDC')}
          </span>

          {isPaid ? (
            <Badge variant="success" size="sm" leftIcon={<CheckCircle size={10} weight="bold" />}>
              Paid
            </Badge>
          ) : canPay && isCurrentUser ? (
            <Button variant="primary" size="sm" onClick={onPayClick}>
              Pay {formatCurrency(remaining, 'USDC')}
            </Button>
          ) : (
            <Badge variant={variant} size="sm">
              {remaining > 0 && remaining < participant.amountOwed
                ? `${formatCurrency(remaining, 'USDC')} left`
                : label}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pay Modal Component
// ---------------------------------------------------------------------------

interface PayModalProps {
  open: boolean;
  onClose: () => void;
  split: Split;
  participant: SplitParticipant;
  onSuccess: () => void;
}

function PayModal({ open, onClose, split, participant, onSuccess }: PayModalProps) {
  const { toast } = useToast();
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const queryClient = useQueryClient();
  const remaining = Math.max(0, participant.amountOwed - (participant.amountPaid || 0));

  const [paying, setPaying] = useState(false);

  // Copy wallet address
  const [copied, setCopied] = useState(false);
  async function copyAddress() {
    if (!split.walletAddress) return;
    try {
      await navigator.clipboard.writeText(split.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'error' });
    }
  }

  // Execute on-chain USDC transfer then record in Firestore
  async function handlePayWithWallet() {
    if (!connected || !publicKey || !signTransaction) {
      toast({ title: 'Wallet not connected', description: 'Connect your wallet to pay.', variant: 'error' });
      return;
    }
    if (!split.walletAddress) {
      toast({ title: 'No split wallet address', variant: 'error' });
      return;
    }
    if (!split.walletId) {
      toast({ title: 'No split wallet record', variant: 'error' });
      return;
    }
    if (!currentUser?.id) {
      toast({ title: 'Not authenticated', variant: 'error' });
      return;
    }

    setPaying(true);
    try {
      // Step 1: Execute on-chain USDC transfer to split wallet address
      const txResult = await sendUSDC({
        connection,
        fromPubkey: publicKey,
        toAddress: split.walletAddress,
        amountUsdc: remaining,
        signTransaction,
        note: `Split payment: ${split.title}`,
        senderName: currentUser.name,
        senderUid: currentUser.id,
        idempotencyKey: `split_pay_${split.walletId}_${currentUser.id}`,
      });

      // Step 2: Record participant payment in Firestore
      const paymentResult = await recordParticipantPayment(
        split.walletId,
        currentUser.id,
        remaining,
        txResult.txId
      );

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Failed to record payment in Firestore');
      }

      toast({
        title: 'Payment successful!',
        description: paymentResult.message || `${formatCurrency(remaining, 'USDC')} paid.`,
        variant: 'success',
      });

      // Invalidate balance so dashboard reflects the deducted amount
      void queryClient.invalidateQueries({ queryKey: ['userBalance'] });

      onClose();
      onSuccess();
    } catch (err) {
      toast({
        title: 'Payment failed',
        description: err instanceof Error ? err.message : 'Transaction failed. Please try again.',
        variant: 'error',
      });
    } finally {
      setPaying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!paying) onClose(); }}
      title="Pay Your Share"
      maxWidth="sm"
      showCloseButton={!paying}
      closeOnOverlayClick={!paying}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth disabled={paying}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePayWithWallet}
            fullWidth
            loading={paying}
            disabled={paying || !connected}
            leftIcon={<PaperPlaneTilt size={18} />}
          >
            {paying ? 'Sending...' : 'Pay with Wallet'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Wallet not connected warning */}
        {!connected && (
          <div
            className="flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3"
            style={{ backgroundColor: 'var(--color-warning-20)', border: '1px solid var(--color-warning)' }}
          >
            <Warning size={16} color="var(--color-warning)" />
            <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
              Connect a wallet to pay your share
            </span>
          </div>
        )}

        {/* Split info */}
        <div className="text-center">
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Your share for
          </p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {split.title}
          </p>
        </div>

        {/* Amount */}
        <div
          className="text-center py-6 rounded-[var(--radius-lg)]"
          style={{ backgroundColor: 'var(--color-white-5)' }}
        >
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Amount Due
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
          >
            {formatCurrency(remaining, 'USDC')}
          </p>
        </div>

        {/* Wallet address */}
        {split.walletAddress && (
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Pay to address
            </p>
            <button
              type="button"
              onClick={copyAddress}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--color-white-5)]"
              style={{
                backgroundColor: 'var(--color-white-5)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--color-text)' }}>
                {split.walletAddress}
              </span>
              {copied ? (
                <Check size={16} color="var(--color-success)" />
              ) : (
                <Copy size={16} color="var(--color-text-secondary)" />
              )}
            </button>
          </div>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
          Send USDC to complete your payment. The split creator will be notified once your transaction is confirmed.
        </p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Complete/Cancel Confirmation Modal
// ---------------------------------------------------------------------------

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'error';
  onConfirm: () => void;
  isPending: boolean;
}

function ActionModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmVariant,
  onConfirm,
  isPending,
}: ActionModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} fullWidth disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant === 'error' ? 'danger' : 'primary'}
            onClick={onConfirm}
            fullWidth
            loading={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SplitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: splitId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  // Fetch split data (initial load)
  const { split, isLoading, error, refetch } = useSplitDetail(splitId);

  // Real-time updates — pushes live changes into TanStack Query cache
  useRealtimeSplit(splitId, {
    updateQueryCache: false,
    onUpdate: (update) => {
      if (update.split) {
        queryClient.setQueryData(splitQueryKeys.detail(splitId), update.split);
      }
    },
  });

  // Check user role
  const isCreator = useIsSplitCreator(split);
  const currentUserParticipant = useCurrentUserSplitParticipant(split);

  // Mutations
  const completeSplit = useCompleteSplit();
  const cancelSplit = useCancelSplit();

  // Modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Computed values
  const paidCount = useMemo(() => {
    if (!split) return 0;
    return split.participants.filter((p) => p.status === 'paid').length;
  }, [split]);

  const progressPercent = useMemo(() => {
    if (!split || split.participants.length === 0) return 0;
    return (paidCount / split.participants.length) * 100;
  }, [split, paidCount]);

  const totalPaid = useMemo(() => {
    if (!split) return 0;
    return split.participants.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }, [split]);

  const remainingAmount = useMemo(() => {
    if (!split) return 0;
    return Math.max(0, split.totalAmount - totalPaid);
  }, [split, totalPaid]);

  const isActiveOrPending = split?.status === 'active' || split?.status === 'pending';
  const canUserPay = isActiveOrPending && currentUserParticipant?.status !== 'paid';
  const allPaid = paidCount === (split?.participants.length || 0);

  // Handle complete split — executes on-chain USDC withdrawal then marks Firestore complete
  async function handleComplete() {
    if (!split?.walletId || !split?.walletAddress) {
      toast({ title: 'No wallet linked to this split', variant: 'error' });
      return;
    }
    if (!currentUser?.id) {
      toast({ title: 'Not authenticated', variant: 'error' });
      return;
    }
    if (!publicKey || !signTransaction) {
      toast({
        title: 'Wallet not connected',
        description: 'Connect your wallet to complete the split and receive funds.',
        variant: 'error',
      });
      return;
    }

    // Hold a reference to wipe after use
    let splitSecretKey: Uint8Array | null = null;

    try {
      // 1. Retrieve the split wallet's private key from Firestore
      const keyResult = await SplitWalletService.retrieveSplitWalletPrivateKey(
        split.walletId,
        currentUser.id
      );
      if (!keyResult.success || !keyResult.privateKeyBase64) {
        toast({
          title: 'Could not retrieve split wallet key',
          description: keyResult.error || 'Please try again.',
          variant: 'error',
        });
        return;
      }

      // 2. Decode keypair from base64
      splitSecretKey = new Uint8Array(Buffer.from(keyResult.privateKeyBase64, 'base64'));
      const splitKeypair = Keypair.fromSecretKey(splitSecretKey);

      // 3. Check actual USDC balance sitting in the split wallet on-chain
      const splitBalance = await getUSDCBalance(connection, split.walletAddress);

      if (splitBalance > 0) {
        // 4. Build USDC transfer: split wallet → creator's currently connected wallet
        const tx = await buildUSDCTransferInstruction(
          connection,
          splitKeypair.publicKey,
          publicKey, // Creator's connected wallet receives the funds
          splitBalance
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey; // Creator pays the SOL transaction fee

        // 5. Split wallet keypair signs as the SPL token account authority
        tx.partialSign(splitKeypair);

        // 6. Creator's wallet adapter co-signs as fee payer
        const signedTx = await signTransaction(tx);

        // 7. Broadcast and confirm on-chain
        const sig = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        toast({
          title: `${splitBalance.toFixed(2)} USDC transferred to your wallet`,
          description: `Transaction: ${sig.slice(0, 8)}...`,
          variant: 'success',
        });
      }

      // 8. Mark split as complete in Firestore (only after on-chain confirms)
      await completeSplit.mutateAsync(split.walletId);
      toast({ title: 'Split completed!', variant: 'success' });
      setCompleteModalOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: 'Failed to complete split',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      // Always wipe the split wallet secret key from memory
      if (splitSecretKey) {
        splitSecretKey.fill(0);
      }
    }
  }

  // Handle cancel split
  async function handleCancel() {
    if (!split?.walletId) {
      toast({ title: 'No wallet linked to this split', variant: 'error' });
      return;
    }

    try {
      await cancelSplit.mutateAsync(split.walletId);
      toast({ title: 'Split cancelled', variant: 'success' });
      setCancelModalOpen(false);
      router.push('/splits');
    } catch (err) {
      toast({
        title: 'Failed to cancel split',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    }
  }

  // Loading state
  if (isLoading) {
    return <SplitDetailSkeleton />;
  }

  // Error or not found
  if (error || !split) {
    return (
      <PageContainer>
        <Card className="text-center py-12">
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Split Not Found
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {error?.message || "The split you're looking for doesn't exist or you don't have access to it."}
          </p>
          <Link href="/splits">
            <Button variant="primary">Back to Splits</Button>
          </Link>
        </Card>
      </PageContainer>
    );
  }

  const { label: statusLabel, variant: statusVariant, icon: StatusIcon } = getStatusConfig(split.status);
  const splitColor = colorFromName(split.title);
  const emoji = getCategoryEmoji(split.category);

  return (
    <PageContainer>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push('/splits')}
        className="mb-4 flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-text)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <ArrowLeft size={16} />
        Back to Splits
      </button>

      {/* Hero Card */}
      <HeroCard className="mb-6 p-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: splitColor }}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{ backgroundColor: `${splitColor}22`, border: `1px solid ${splitColor}55` }}
          >
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate mb-1" style={{ color: 'var(--color-text)' }}>
              {split.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1">
                <CalendarBlank size={12} />
                {formatDate(split.createdAt, { format: 'short' })}
              </span>
              {split.merchant?.name && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Storefront size={12} />
                    {split.merchant.name}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users size={12} />
                {split.participants.length} participants
              </span>
            </div>
          </div>
          <Badge variant={statusVariant} leftIcon={<StatusIcon size={12} weight="bold" />}>
            {statusLabel}
          </Badge>
        </div>

        {/* Total Amount */}
        <div className="mb-4">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Total Amount
          </p>
          <p
            className="font-semibold"
            style={{ fontSize: 'var(--font-size-balance)', fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
          >
            {formatCurrency(split.totalAmount, 'USDC')}
          </p>
        </div>

        {/* Progress bar */}
        {isActiveOrPending && split.participants.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {paidCount} of {split.participants.length} paid
              </span>
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                {formatCurrency(totalPaid, 'USDC')} / {formatCurrency(split.totalAmount, 'USDC')}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-white-10)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  background:
                    progressPercent === 100
                      ? 'var(--color-success)'
                      : 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
                }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {isCreator && isActiveOrPending && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                disabled={totalPaid > 0}
                leftIcon={<X size={16} />}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCompleteModalOpen(true)}
                disabled={!allPaid}
                leftIcon={<CheckCircle size={16} />}
              >
                {allPaid ? 'Complete Split' : `${remainingAmount.toFixed(2)} remaining`}
              </Button>
            </>
          )}

          {!isCreator && canUserPay && currentUserParticipant && (
            <Button variant="primary" onClick={() => setPayModalOpen(true)} leftIcon={<PaperPlaneTilt size={18} />}>
              Pay Your Share ({formatCurrency(currentUserParticipant.amountOwed - (currentUserParticipant.amountPaid || 0), 'USDC')})
            </Button>
          )}

          {split.status === 'completed' && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: 'var(--color-success-20)' }}
            >
              <CheckCircle size={16} weight="fill" color="var(--color-success)" />
              <span className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                Split Completed
              </span>
            </div>
          )}

          {split.status === 'cancelled' && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: 'var(--color-error-20)' }}
            >
              <XCircle size={16} weight="fill" color="var(--color-error)" />
              <span className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                Split Cancelled
              </span>
            </div>
          )}
        </div>
      </HeroCard>

      {/* Description */}
      {split.description && (
        <Card className="mb-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {split.description}
          </p>
        </Card>
      )}

      {/* Participants Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Participants ({split.participants.length})
          </h2>
          <AvatarGroup
            avatars={split.participants.map((p) => ({
              fallback: p.name?.charAt(0).toUpperCase() || '?',
              src: p.avatar,
            }))}
            max={5}
            size="xs"
          />
        </div>

        {split.participants.map((participant) => (
          <ParticipantRow
            key={participant.userId}
            participant={participant}
            isCurrentUser={participant.userId === currentUser?.id}
            canPay={isActiveOrPending}
            onPayClick={() => setPayModalOpen(true)}
          />
        ))}
      </div>

      {/* Items Section (if available) */}
      {split.items && split.items.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Items ({split.items.length})
          </h2>
          <Card padding="sm">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {split.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {item.name}
                    </span>
                    {item.quantity && item.quantity > 1 && (
                      <span className="text-xs ml-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        ×{item.quantity}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                  >
                    {formatCurrency(item.price, 'USDC')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Pay Modal */}
      {currentUserParticipant && (
        <PayModal
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          split={split}
          participant={currentUserParticipant}
          onSuccess={refetch}
        />
      )}

      {/* Complete Modal */}
      <ActionModal
        open={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Split"
        description="Are you sure you want to mark this split as completed? All participants have paid their share."
        confirmLabel="Complete Split"
        confirmVariant="primary"
        onConfirm={handleComplete}
        isPending={completeSplit.isPending}
      />

      {/* Cancel Modal */}
      <ActionModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Split"
        description="Are you sure you want to cancel this split? This action cannot be undone."
        confirmLabel="Cancel Split"
        confirmVariant="error"
        onConfirm={handleCancel}
        isPending={cancelSplit.isPending}
      />
    </PageContainer>
  );
}
