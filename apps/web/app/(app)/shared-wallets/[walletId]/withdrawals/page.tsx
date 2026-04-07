'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Check, X } from '@phosphor-icons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { useAppStore } from '@/store';
import {
  getWalletWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getSharedWalletById,
  getUserDoc
} from '@/lib/firebase/queries';
import type { WithdrawalRequest } from '@/types';

export default function WithdrawalsPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user.currentUser?.id);

  // Fetch wallet to check permissions
  const { data: wallet } = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
  });

  // Fetch withdrawal requests
  const { data: withdrawalRequests = [], isLoading, error } = useQuery({
    queryKey: ['withdrawalRequests', walletId],
    queryFn: () => getWalletWithdrawalRequests(walletId),
    enabled: !!walletId,
  });

  // Check if current user can approve/reject (creator or admin)
  const currentMember = wallet?.members.find(
    (m) => m.user_id === userId || m.userId === userId
  );
  const canApprove = currentMember?.role === 'creator' || currentMember?.role === 'admin';

  // Approve/Reject mutation
  const updateRequestMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      if (!userId) throw new Error('User not authenticated');
      return updateWithdrawalRequestStatus(requestId, userId, action);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalRequests', walletId] });
      toast({
        title: variables.action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected',
        variant: variables.action === 'approve' ? 'success' : 'warning'
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to update request',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error'
      });
    },
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>
            {error instanceof Error ? error.message : 'Failed to load withdrawal requests'}
          </p>
        </Card>
      </PageContainer>
    );
  }

  const pendingCount = withdrawalRequests.filter((wr) => wr.status === 'pending').length;

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <Button variant="primary" size="sm" leftIcon={<Plus size={15} weight="bold" />} onClick={() => {
          toast({ title: 'Use the Withdraw button', description: 'Create withdrawal requests from the wallet page', variant: 'info' });
        }}>New Request</Button>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Withdrawal Requests</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {pendingCount} pending approval
          </p>
        </div>

        {withdrawalRequests.length === 0 ? (
          <Card>
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              No withdrawal requests yet
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {withdrawalRequests.map((wr) => {
              const isCurrentUserRequester = wr.requester_id === userId;
              const createdDate = wr.created_at ? new Date(wr.created_at) : new Date();

              return (
                <WithdrawalRequestCard
                  key={wr.id}
                  request={wr}
                  createdDate={createdDate}
                  canApprove={canApprove && !isCurrentUserRequester}
                  onApprove={() => updateRequestMutation.mutate({ requestId: wr.id, action: 'approve' })}
                  onReject={() => updateRequestMutation.mutate({ requestId: wr.id, action: 'reject' })}
                  isPending={updateRequestMutation.isPending}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function WithdrawalRequestCard({
  request,
  createdDate,
  canApprove,
  onApprove,
  onReject,
  isPending,
}: {
  request: WithdrawalRequest;
  createdDate: Date;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  // Fetch requester name
  const { data: requester } = useQuery({
    queryKey: ['user', request.requester_id],
    queryFn: () => getUserDoc(request.requester_id),
    enabled: !!request.requester_id,
  });

  const requesterName = requester?.name || 'Unknown User';

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <Avatar fallback={requesterName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{requesterName}</span>
            <Badge
              variant={
                request.status === 'approved' || request.status === 'executed'
                  ? 'success'
                  : request.status === 'rejected'
                  ? 'error'
                  : 'warning'
              }
              size="sm"
              dot
            >
              {request.status}
            </Badge>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {formatDate(createdDate, { format: 'relative' })}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Amount</p>
          <p
            className="text-xl font-semibold"
            style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
          >
            {formatCurrency(request.amount, 'USDC')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>To</p>
          <p className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {request.destination_address.slice(0, 4)}...{request.destination_address.slice(-4)}
          </p>
        </div>
      </div>

      {request.note && (
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>{request.note}</p>
      )}

      {request.status === 'pending' && canApprove && (
        <div className="flex gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            leftIcon={<Check size={14} weight="bold" />}
            onClick={onApprove}
            loading={isPending}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="sm"
            fullWidth
            leftIcon={<X size={14} weight="bold" />}
            onClick={onReject}
            loading={isPending}
          >
            Reject
          </Button>
        </div>
      )}

      {request.status === 'approved' && request.approvals && request.approvals.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Approved by {request.approvals.length} {request.approvals.length === 1 ? 'admin' : 'admins'}
          </p>
        </div>
      )}
    </Card>
  );
}
