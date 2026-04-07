'use client';

import { use, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle,
  XCircle,
  ArrowSquareOut,
  Hourglass,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate, toDate } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic, tgConfirm } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useSharedWalletDetail } from '@/hooks';
import { useAppStore } from '@/store';
import {
  getWalletWithdrawalRequests,
  updateWithdrawalRequestStatus,
} from '@/lib/firebase/queries';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import type { WithdrawalRequest } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: WithdrawalRequest['status']) {
  switch (status) {
    case 'pending':
      return <Clock size={16} weight="fill" color="var(--color-warning)" />;
    case 'approved':
    case 'executed':
      return <CheckCircle size={16} weight="fill" color="var(--color-success)" />;
    case 'rejected':
    case 'failed':
      return <XCircle size={16} weight="fill" color="var(--color-error)" />;
    default:
      return <Hourglass size={16} color="var(--color-text-tertiary)" />;
  }
}

function statusBadge(status: WithdrawalRequest['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning" size="sm">Pending</Badge>;
    case 'approved':
      return <Badge variant="success" size="sm">Approved</Badge>;
    case 'executed':
      return <Badge variant="success" size="sm">Executed</Badge>;
    case 'rejected':
      return <Badge variant="error" size="sm">Rejected</Badge>;
    case 'failed':
      return <Badge variant="error" size="sm">Failed</Badge>;
    default:
      return <Badge size="sm">{status}</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TelegramWithdrawalRequestsPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();

  const { wallet, isLoading: walletLoading } = useSharedWalletDetail(walletId);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopyAddress = useCallback((address: string, reqId: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(reqId);
    haptic?.notificationOccurred('success');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
  }, [haptic]);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const { data: requests = [], isLoading: requestsLoading, refetch } = useQuery({
    queryKey: ['withdrawalRequests', walletId],
    queryFn: () => getWalletWithdrawalRequests(walletId),
    enabled: !!walletId,
    staleTime: 15_000,
  });

  // Sort: pending first, then by date desc
  const sorted = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  // Resolve requester name from wallet members
  function getRequesterName(requesterId: string): string {
    const member = wallet?.members?.find((m) => m.user_id === requesterId);
    return member?.name ?? member?.user_id?.slice(0, 8) ?? 'Unknown';
  }

  // Check if current user is creator/admin
  const role = (() => {
    if (!userId || !wallet) return 'member';
    if (wallet.creator_id === userId) return 'creator';
    const member = wallet.members?.find((m) => m.user_id === userId);
    return member?.role ?? 'member';
  })();

  const canManage = role === 'creator' || role === 'admin';

  const handleAction = useCallback(
    async (requestId: string, action: 'approve' | 'reject') => {
      if (!userId || processingRequest) return;
      const req = requests.find((r) => r.id === requestId);
      const label = action === 'approve'
        ? `Approve withdrawal of ${req ? formatCurrency(req.amount, 'USDC') : ''}?`
        : `Reject this withdrawal request?`;
      const confirmed = await tgConfirm(label);
      if (!confirmed) return;
      setProcessingRequest(requestId);

      // Optimistic update
      const queryKey = ['withdrawalRequests', walletId];
      const previous = queryClient.getQueryData<WithdrawalRequest[]>(queryKey);
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      queryClient.setQueryData<WithdrawalRequest[]>(
        queryKey,
        (old) => old?.map((r) => r.id === requestId ? { ...r, status: newStatus as WithdrawalRequest['status'] } : r),
      );

      try {
        await updateWithdrawalRequestStatus(requestId, userId, action);
        haptic?.notificationOccurred('success');
        queryClient.invalidateQueries({ queryKey });
      } catch {
        // Revert on failure
        queryClient.setQueryData(queryKey, previous);
        haptic?.notificationOccurred('error');
      } finally {
        setProcessingRequest(null);
      }
    },
    [userId, processingRequest, walletId, haptic, queryClient, requests],
  );

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isLoading = walletLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        ))}
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <XCircle size={48} style={{ color: 'var(--color-error)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Access Denied
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Only creators and admins can manage withdrawal requests.
        </p>
        <Button onClick={() => goBack(`/tg/wallets/${walletId}`)} variant="outline">
          Back to Wallet
        </Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1
            className="font-bold"
            style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}
          >
            Withdrawal Requests
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {pendingCount > 0
              ? `${pendingCount} pending`
              : 'All requests processed'}
            {' '}&middot; {wallet?.name ?? 'Wallet'}
          </p>
        </div>

        {/* Requests list */}
        {sorted.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle size={40} color="var(--color-text-tertiary)" />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No withdrawal requests
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Requests from members will appear here for your approval.
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((req) => {
              const isPending = req.status === 'pending';
              const isProcessing = processingRequest === req.id;
              const requesterName = getRequesterName(req.requester_id);

              return (
                <Card key={req.id}>
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar fallback={requesterName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {requesterName}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {formatDate(toDate(req.created_at), { format: 'relative' })}
                      </p>
                    </div>
                    {statusBadge(req.status)}
                  </div>

                  {/* Amount + destination */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-lg font-semibold"
                      style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                    >
                      {formatCurrency(req.amount, 'USDC')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(req.destination_address, req.id)}
                      className="text-xs font-mono transition-colors active:opacity-70"
                      style={{ color: copiedId === req.id ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}
                      aria-label="Copy destination address"
                    >
                      {copiedId === req.id ? 'Copied!' : `${req.destination_address.slice(0, 6)}...${req.destination_address.slice(-4)}`}
                    </button>
                  </div>

                  {/* Note */}
                  {req.note && (
                    <p
                      className="text-xs mb-3 rounded-lg px-3 py-2"
                      style={{ backgroundColor: 'var(--color-white-5)', color: 'var(--color-text-secondary)' }}
                    >
                      {req.note}
                    </p>
                  )}

                  {/* Tx hash (for executed) */}
                  {req.tx_hash && (
                    <div className="flex items-center gap-1 mb-3">
                      <ArrowSquareOut size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span
                        className="text-xs font-mono"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {req.tx_hash.slice(0, 12)}...
                      </span>
                    </div>
                  )}

                  {/* Actions for pending */}
                  {isPending && (
                    <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        fullWidth
                        onClick={() => handleAction(req.id, 'reject')}
                        loading={isProcessing}
                        disabled={!!processingRequest}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        fullWidth
                        onClick={() => handleAction(req.id, 'approve')}
                        loading={isProcessing}
                        disabled={!!processingRequest}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
