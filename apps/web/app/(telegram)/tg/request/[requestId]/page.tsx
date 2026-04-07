'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PaperPlaneTilt,
  Tray,
  Clock,
  Check,
  Warning,
  Note,
  User as UserIcon,
  CurrencyDollar,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { useAppStore } from '@/store';
import {
  getPaymentRequestById,
  updatePaymentRequestStatus,
} from '@/lib/firebase/queries';
import { formatCurrency, formatDate, toDate } from '@/lib/utils';
import { TransactionsSkeleton } from '@/components/telegram/TelegramSkeletons';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <Badge variant="warning">Pending</Badge>;
  if (status === 'accepted') return <Badge variant="success">Accepted</Badge>;
  if (status === 'rejected') return <Badge variant="error">Rejected</Badge>;
  if (status === 'cancelled') return <Badge variant="default">Cancelled</Badge>;
  if (status === 'expired') return <Badge variant="default">Expired</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Detail row
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'var(--color-white-5)' }}
      >
        <Icon size={15} color="var(--color-text-secondary)" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TgRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const { goBack } = useTgNavigation();
  const router = useRouter();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const brandColors = useTgBrandColors();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const [actionDone, setActionDone] = useState(false);

  // Fetch request
  const { data: req, isLoading } = useQuery({
    queryKey: ['paymentRequest', requestId],
    queryFn: () => getPaymentRequestById(requestId),
    enabled: !!requestId,
    staleTime: 30_000,
  });

  // Resolve sender / recipient display
  const senderId = req?.senderId ?? req?.from_user;
  const senderName = req?.senderName ?? req?.from_name ?? 'Someone';
  const recipientIds = req?.to_users ?? (req?.recipientId ? [req.recipientId] : []);
  const amount = req?.amount_per_person ?? req?.amount ?? 0;

  const isSent = senderId === userId;
  const isRecipient = recipientIds.includes(userId ?? '');
  const isPending = req?.status === 'pending';

  // Mutation — update status
  const statusMutation = useMutation({
    mutationFn: (status: 'accepted' | 'rejected' | 'cancelled') =>
      updatePaymentRequestStatus(requestId, status),
    onSuccess: () => {
      haptic?.notificationOccurred('success');
      queryClient.invalidateQueries({ queryKey: ['paymentRequest', requestId] });
      queryClient.invalidateQueries({ queryKey: ['sentPaymentRequests', userId] });
      queryClient.invalidateQueries({ queryKey: ['receivedPaymentRequests', userId] });
      setActionDone(true);
    },
    onError: () => {
      haptic?.notificationOccurred('error');
    },
  });

  // Back button
  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Main button — "Pay Now" for pending received requests
  const canPay = isRecipient && isPending && !actionDone;
  useTelegramMainButton({
    text: statusMutation.isPending ? 'Processing...' : 'Pay Now',
    onClick: useCallback(async () => {
      if (!req) return;
      haptic?.impactOccurred('medium');
      // Navigate to send page pre-filled with sender's wallet address
      const toWallet = req.from_wallet ?? req.senderWallet ?? '';
      router.push(
        `/tg/send?to=${encodeURIComponent(toWallet)}&amount=${amount}&note=${encodeURIComponent(`Payment for request ${requestId}`)}`,
      );
    }, [req, amount, requestId, router, haptic]),
    visible: canPay && !isLoading,
    loading: statusMutation.isPending,
    disabled: statusMutation.isPending,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (isLoading) return <TransactionsSkeleton />;

  if (!req) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 pt-20 text-center">
        <Warning size={36} color="var(--color-warning)" />
        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
          Request not found
        </p>
        <Button variant="secondary" size="sm" onClick={() => goBack()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-32 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{
            background: isSent
              ? 'linear-gradient(135deg, var(--color-info), rgba(33,150,243,0.7))'
              : 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))',
          }}
        >
          {isSent ? (
            <PaperPlaneTilt size={22} weight="fill" color="white" />
          ) : (
            <Tray size={22} weight="fill" color="var(--color-bg)" />
          )}
        </div>
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-display)' }}
          >
            {isSent ? 'Sent Request' : 'Payment Request'}
          </h1>
          <StatusBadge status={req.status} />
        </div>
      </div>

      {/* Amount card */}
      <Card>
        <div className="flex flex-col items-center gap-1 py-4">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {isSent ? 'You requested' : 'Amount requested'}
          </p>
          <p
            className="text-4xl font-bold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
          >
            {formatCurrency(amount, 'USDC')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            USDC
          </p>
        </div>
      </Card>

      {/* Details */}
      <Card>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <DetailRow
            icon={isSent ? Tray : UserIcon}
            label={isSent ? 'Requested from' : 'Requested by'}
            value={isSent ? `${recipientIds.length} recipient${recipientIds.length !== 1 ? 's' : ''}` : senderName}
          />
          <DetailRow
            icon={Clock}
            label="Created"
            value={formatDate(toDate(req.created_at ?? req.createdAt ?? null))}
          />
          {req.note && (
            <DetailRow icon={Note} label="Note" value={req.note} />
          )}
          <DetailRow
            icon={CurrencyDollar}
            label="Currency"
            value={req.currency ?? 'USDC'}
          />
        </div>
      </Card>

      {/* Success state */}
      {actionDone && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-lg)] p-4"
          style={{ backgroundColor: 'var(--color-success-20)', border: '1px solid var(--color-success)' }}
        >
          <Check size={20} color="var(--color-success)" weight="bold" />
          <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
            Done! The request has been updated.
          </p>
        </div>
      )}

      {/* Actions — Received + pending */}
      {isRecipient && isPending && !actionDone && (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              haptic?.impactOccurred('light');
              statusMutation.mutate('rejected');
            }}
            disabled={statusMutation.isPending}
          >
            Decline
          </Button>
          {/* "Pay Now" is in MainButton — this is the non-TG fallback */}
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              const toWallet = req.from_wallet ?? req.senderWallet ?? '';
              router.push(
                `/tg/send?to=${encodeURIComponent(toWallet)}&amount=${amount}&note=${encodeURIComponent(`Payment for request ${requestId}`)}`,
              );
            }}
            className="tg-hide"
          >
            Pay Now
          </Button>
        </div>
      )}

      {/* Actions — Sent + pending */}
      {isSent && isPending && !actionDone && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            haptic?.impactOccurred('light');
            statusMutation.mutate('cancelled');
          }}
          disabled={statusMutation.isPending}
          loading={statusMutation.isPending}
        >
          Cancel Request
        </Button>
      )}

      {/* Error */}
      {statusMutation.isError && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          <Warning size={15} weight="bold" />
          <span>Something went wrong. Please try again.</span>
        </div>
      )}
    </div>
  );
}
