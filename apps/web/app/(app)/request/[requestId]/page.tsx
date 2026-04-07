'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Prohibit,
  BellRinging,
  User,
  CalendarBlank,
  CurrencyDollar,
  ChatText,
} from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import { useAppStore } from '@/store';
import {
  usePaymentRequestDetail,
  useRejectPaymentRequest,
  useCancelPaymentRequest,
  useSendPaymentReminder,
  useIsRequestSender,
  useIsRequestRecipient,
} from '@/hooks';
import type { PaymentRequestStatus } from '@/types';

// ---------------------------------------------------------------------------
// Status Configuration
// ---------------------------------------------------------------------------

const REQUEST_STATUS_CONFIG: Record<
  PaymentRequestStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'default'; icon: React.ElementType }
> = {
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  accepted: { label: 'Accepted', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'error', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'error', icon: Prohibit },
};

// ---------------------------------------------------------------------------
// Confirmation Modal (uses shared Radix Modal for focus trap + keyboard)
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      closeOnOverlayClick={!isLoading}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={isLoading}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {message}
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Row Component
// ---------------------------------------------------------------------------

interface DetailRowProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
      </div>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.user.currentUser);

  // Data fetching
  const { request, isLoading, error } = usePaymentRequestDetail(requestId);

  // Role checks
  const isSender = useIsRequestSender(request);
  const isRecipient = useIsRequestRecipient(request);

  // Mutations
  const rejectMutation = useRejectPaymentRequest();
  const cancelMutation = useCancelPaymentRequest();
  const reminderMutation = useSendPaymentReminder();

  // Modal state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Handlers
  const handleAccept = () => {
    // Do NOT mark as accepted yet — navigate to send flow.
    // The send page will mark it accepted ONLY after the on-chain tx confirms.
    setShowAcceptModal(false);
    router.push(
      `/send?to=${request?.senderId}&amount=${request?.amount}&requestId=${requestId}`
    );
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ requestId });
      setShowRejectModal(false);
      router.push('/request?tab=received');
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Could not reject request. Please try again.',
        variant: 'error',
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(requestId);
      setShowCancelModal(false);
      router.push('/request?tab=sent');
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Could not cancel request. Please try again.',
        variant: 'error',
      });
    }
  };

  const handleReminder = async () => {
    try {
      await reminderMutation.mutateAsync(requestId);
    } catch {
      // Error handled by mutation
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link
            href="/request"
            className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft size={16} /> Back to Requests
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <div className="flex flex-col items-center gap-3 py-8">
            <Skeleton width={80} height={24} radius="full" />
            <Skeleton width={140} height={48} radius="sm" />
            <Skeleton width={180} height={16} radius="sm" />
          </div>
          <Card>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between py-3">
                  <Skeleton width={100} height={14} radius="sm" />
                  <Skeleton width={80} height={14} radius="sm" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // Not found state
  if (!request || error) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link
            href="/request"
            className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft size={16} /> Back to Requests
          </Link>
        </div>
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <XCircle size={48} style={{ color: 'var(--color-text-tertiary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {error?.message || 'Payment request not found'}
            </p>
            <Button variant="secondary" onClick={() => router.push('/request')}>
              Go Back
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const status = REQUEST_STATUS_CONFIG[request.status];
  const StatusIcon = status.icon;
  const isPending = request.status === 'pending';

  return (
    <PageContainer>
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/request"
          className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={16} /> Back to Requests
        </Link>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Hero section */}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Badge variant={status.variant} size="md" dot>
            {status.label}
          </Badge>
          <p
            className="font-semibold"
            style={{
              fontFamily: 'var(--font-family-number)',
              fontSize: 'var(--font-size-balance)',
              color: 'var(--color-text)',
            }}
          >
            ${request.amount.toFixed(2)}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {isRecipient ? (
              <>
                Requested by <span className="font-medium">{request.senderName}</span>
              </>
            ) : (
              <>
                Requested from <span className="font-medium">{request.recipientName || 'Unknown'}</span>
              </>
            )}
          </p>
        </div>

        {/* Details card */}
        <Card>
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <DetailRow
              icon={CurrencyDollar}
              label="Currency"
              value={request.currency}
            />
            {request.description && (
              <DetailRow
                icon={ChatText}
                label="Description"
                value={request.description}
              />
            )}
            <DetailRow
              icon={User}
              label={isRecipient ? 'From' : 'To'}
              value={isRecipient ? request.senderName : (request.recipientName || 'Unknown')}
            />
            <DetailRow
              icon={CalendarBlank}
              label="Requested"
              value={formatDate(request.created_at, { format: 'long' })}
            />
          </div>
        </Card>

        {/* Action buttons for recipient (when pending) */}
        {isRecipient && isPending && (
          <div className="flex gap-3">
            <Button
              variant="danger"
              onClick={() => setShowRejectModal(true)}
              className="flex-1"
            >
              <XCircle size={18} weight="bold" />
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowAcceptModal(true)}
              className="flex-1"
            >
              <CheckCircle size={18} weight="bold" />
              Accept & Pay
            </Button>
          </div>
        )}

        {/* Action buttons for sender (when pending) */}
        {isSender && isPending && (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowCancelModal(true)}
              className="flex-1"
            >
              <Prohibit size={18} />
              Cancel Request
            </Button>
            <Button
              variant="outline"
              onClick={handleReminder}
              loading={reminderMutation.isPending}
              className="flex-1"
            >
              <BellRinging size={18} />
              Send Reminder
            </Button>
          </div>
        )}

        {/* Status message for non-pending requests */}
        {!isPending && (
          <div
            className="flex items-center justify-center gap-2 rounded-xl py-4"
            style={{ backgroundColor: 'var(--color-surface-elevated)' }}
          >
            <StatusIcon size={20} style={{ color: status.variant === 'success' ? 'var(--color-success)' : 'var(--color-error)' }} />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              This request has been {request.status}
            </span>
          </div>
        )}
      </div>

      {/* Confirmation modals */}
      <ConfirmModal
        open={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        onConfirm={handleAccept}
        title="Accept Payment Request"
        message={`You're accepting a request for $${request.amount.toFixed(2)} ${request.currency} from ${request.senderName}. You'll be redirected to complete the payment.`}
        confirmLabel="Accept & Pay"
        isLoading={false}
      />

      <ConfirmModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject Payment Request"
        message={`Are you sure you want to reject this request for $${request.amount.toFixed(2)} ${request.currency}? ${request.senderName} will be notified.`}
        confirmLabel="Reject"
        confirmVariant="danger"
        isLoading={rejectMutation.isPending}
      />

      <ConfirmModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancel Payment Request"
        message={`Are you sure you want to cancel this request for $${request.amount.toFixed(2)} ${request.currency}? This action cannot be undone.`}
        confirmLabel="Cancel Request"
        confirmVariant="danger"
        isLoading={cancelMutation.isPending}
      />
    </PageContainer>
  );
}
