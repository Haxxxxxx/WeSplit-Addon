'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  UsersThree,
  GearSix,
  List,
  Clock,
  CheckCircle,
  XCircle,
  Warning,
  Hourglass,
} from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getSharedWalletById, getSharedWalletTransactions, getWalletExpenses } from '@/lib/firebase/queries';
import { useRealtimeSharedWallet } from '@/hooks/web/useRealtimeSharedWallet';
import { useAppStore } from '@/store';
import {
  useWalletWithdrawalRequests,
  usePendingWithdrawalCount,
  useApproveWithdrawalRequest,
  useRejectWithdrawalRequest,
} from '@/hooks';
import type { SharedWallet, SharedWalletTransaction, SharedWalletExpense, WithdrawalRequest } from '@/types';

// ---------------------------------------------------------------------------
// Approval Modal Component
// ---------------------------------------------------------------------------

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  request: WithdrawalRequest;
  type: 'approve' | 'reject';
  isLoading?: boolean;
}

function ApprovalModal({
  open,
  onClose,
  onConfirm,
  request,
  type,
  isLoading = false,
}: ApprovalModalProps) {
  const isApprove = type === 'approve';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isApprove ? 'Approve Withdrawal' : 'Reject Withdrawal'}
      maxWidth="sm"
      closeOnOverlayClick={!isLoading}
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'primary' : 'danger'}
            onClick={onConfirm}
            loading={isLoading}
            className="flex-1"
          >
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: isApprove ? 'var(--color-success-20)' : 'var(--color-error-20)',
          }}
        >
          {isApprove ? (
            <CheckCircle size={24} style={{ color: 'var(--color-success)' }} />
          ) : (
            <XCircle size={24} style={{ color: 'var(--color-error)' }} />
          )}
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {isApprove
            ? 'Are you sure you want to approve this withdrawal request?'
            : 'Are you sure you want to reject this withdrawal request?'}
        </p>
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Amount</span>
            <span
              className="font-semibold"
              style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
            >
              {formatCurrency(request.amount, (request.currency as 'USDC' | 'SOL') || 'USDC')}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Destination</span>
            <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {request.destination_address.slice(0, 4)}...{request.destination_address.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal Request Row Component
// ---------------------------------------------------------------------------

interface WithdrawalRequestRowProps {
  request: WithdrawalRequest;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function WithdrawalRequestRow({
  request,
  canApprove,
  onApprove,
  onReject,
}: WithdrawalRequestRowProps) {
  const statusConfig: Record<
    WithdrawalRequest['status'],
    { label: string; variant: 'warning' | 'success' | 'error' | 'default'; icon: React.ElementType }
  > = {
    pending: { label: 'Pending', variant: 'warning', icon: Clock },
    approved: { label: 'Approved', variant: 'success', icon: CheckCircle },
    rejected: { label: 'Rejected', variant: 'error', icon: XCircle },
    executed: { label: 'Executed', variant: 'success', icon: CheckCircle },
    failed: { label: 'Failed', variant: 'error', icon: Warning },
  };

  const status = statusConfig[request.status];
  const StatusIcon = status.icon;
  const isPending = request.status === 'pending';

  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ backgroundColor: 'var(--color-surface-elevated)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--color-primary-20)' }}
          >
            <ArrowUp size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p
              className="font-semibold"
              style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
            >
              {formatCurrency(request.amount, (request.currency as 'USDC' | 'SOL') || 'USDC')}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatDate(request.created_at, { format: 'relative' })}
            </p>
          </div>
        </div>
        <Badge variant={status.variant} size="sm">
          <StatusIcon size={12} weight="bold" />
          {status.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <span>To:</span>
        <span className="font-mono">
          {request.destination_address.slice(0, 6)}...{request.destination_address.slice(-4)}
        </span>
      </div>

      {isPending && canApprove && (
        <div className="flex gap-2 mt-1">
          <Button variant="outline" size="sm" onClick={onReject} className="flex-1">
            <XCircle size={14} weight="bold" />
            Reject
          </Button>
          <Button variant="primary" size="sm" onClick={onApprove} className="flex-1">
            <CheckCircle size={14} weight="bold" />
            Approve
          </Button>
        </div>
      )}

      {request.note && (
        <p className="text-xs italic" style={{ color: 'var(--color-text-tertiary)' }}>
          &quot;{request.note}&quot;
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tabs Configuration
// ---------------------------------------------------------------------------

const TABS = [
  { value: 'overview', label: 'Overview', icon: <List size={15} /> },
  { value: 'expenses', label: 'Expenses', icon: <ArrowUpRight size={15} /> },
  { value: 'members', label: 'Members', icon: <UsersThree size={15} /> },
  { value: 'settings', label: 'Settings', icon: <GearSix size={15} /> },
];

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SharedWalletDetailPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const userId = useAppStore((state) => state.user.currentUser?.id);
  const queryClient = useQueryClient();

  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | null>(null);

  // Fetch wallet data (initial load)
  const {
    data: wallet,
    isLoading: walletLoading,
    error: walletError,
  } = useQuery<SharedWallet | null>({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
  });

  // Real-time updates — pushes live changes into TanStack Query cache
  useRealtimeSharedWallet(walletId, {
    updateQueryCache: false,
    onUpdate: (update) => {
      if (update.wallet) {
        queryClient.setQueryData(['sharedWallet', walletId], update.wallet);
      }
    },
  });

  // Fetch wallet transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<
    SharedWalletTransaction[]
  >({
    queryKey: ['sharedWalletTransactions', walletId],
    queryFn: () => getSharedWalletTransactions(walletId),
    enabled: !!walletId,
  });

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery<SharedWalletExpense[]>({
    queryKey: ['sharedWalletExpenses', walletId],
    queryFn: () => getWalletExpenses(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  // Fetch pending withdrawal requests
  const { requests: pendingWithdrawals, isLoading: withdrawalsLoading } =
    useWalletWithdrawalRequests(walletId, { pendingOnly: true });

  // Pending count for badge
  const { count: pendingCount } = usePendingWithdrawalCount(walletId);

  // Mutations
  const approveMutation = useApproveWithdrawalRequest();
  const rejectMutation = useRejectWithdrawalRequest();

  // Determine user's role
  const currentUserMember = wallet?.members?.find((m) => m.user_id === userId);
  const userRole = currentUserMember?.role ?? 'member';
  const isAdminOrCreator = userRole === 'admin' || userRole === 'creator';

  // Handler functions
  const handleApprove = (request: WithdrawalRequest) => {
    setSelectedRequest(request);
    setModalType('approve');
  };

  const handleReject = (request: WithdrawalRequest) => {
    setSelectedRequest(request);
    setModalType('reject');
  };

  const confirmAction = async () => {
    if (!selectedRequest || !modalType) return;

    try {
      if (modalType === 'approve') {
        await approveMutation.mutateAsync({
          requestId: selectedRequest.id,
          walletId,
        });
      } else {
        await rejectMutation.mutateAsync({
          requestId: selectedRequest.id,
          walletId,
        });
      }
      setSelectedRequest(null);
      setModalType(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Loading state
  if (walletLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Skeleton height={200} radius="xl" className="mb-4" />
          <div className="flex gap-2 mb-5">
            {TABS.map((tab) => (
              <Skeleton key={tab.value} width={100} height={36} radius="lg" />
            ))}
          </div>
          <SkeletonText lines={5} />
        </div>
      </PageContainer>
    );
  }

  // Wallet not found
  if (walletError || !wallet) {
    return (
      <PageContainer>
        <Card className="text-center py-12">
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--color-text)' }}
          >
            Wallet Not Found
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            The shared wallet you&apos;re looking for doesn&apos;t exist or you don&apos;t have access
            to it.
          </p>
          <Link href="/shared-wallets">
            <Button variant="primary">Back to Wallets</Button>
          </Link>
        </Card>
      </PageContainer>
    );
  }

  // Current balance
  const balance = wallet.balance ?? wallet.usdc_balance ?? 0;
  const walletColor = (wallet as unknown as Record<string, unknown>).color as string | undefined
    ?? 'var(--color-wallet-purple)';

  return (
    <PageContainer>
      {/* Hero card */}
      <HeroCard className="mb-6 p-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: walletColor }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4 mb-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{
              backgroundColor: 'var(--color-white-5)',
              border: '1px solid var(--color-border)',
            }}
          >
            {((wallet as unknown as Record<string, unknown>).emoji as string) || '🏠'}
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-bold truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {wallet.name}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {wallet.description || 'No description'}
            </p>
          </div>
          <Badge
            variant={userRole === 'creator' ? 'primary' : 'default'}
            size="sm"
          >
            {userRole}
          </Badge>
        </div>

        <p
          className="text-xs uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Balance
        </p>
        <p
          className="font-semibold mb-4"
          style={{
            fontFamily: 'var(--font-family-number)',
            fontSize: 'var(--font-size-balance)',
            color: 'var(--color-text)',
          }}
        >
          {formatCurrency(balance, (wallet.currency as 'USD' | 'USDC' | 'SOL') ?? 'USDC')}
        </p>

        <div className="flex items-center justify-between">
          <AvatarGroup
            avatars={wallet.members.map((m) => ({
              fallback: m.name || 'U',
              src: m.avatar,
            }))}
            max={4}
            size="sm"
          />

          <div className="flex gap-2">
            <Link href={`/shared-wallets/${walletId}/withdrawals`}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowUp size={15} />}>
                Withdraw
                {pendingCount > 0 && isAdminOrCreator && (
                  <span
                    className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--color-warning)',
                      color: 'var(--color-bg)',
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link href={`/deposit?address=${wallet.wallet_address}&name=${encodeURIComponent(wallet.name)}`}>
              <Button variant="primary" size="sm" leftIcon={<ArrowDown size={15} />}>
                Fund
              </Button>
            </Link>
          </div>
        </div>
      </HeroCard>

      {/* Tabs */}
      <Tabs items={TABS} defaultValue="overview">
        {/* Overview */}
        <TabPanel value="overview" className="mt-5">
          <div className="flex flex-col gap-4">
            {/* Pending Approvals Section (Admin/Creator Only) */}
            {isAdminOrCreator && pendingWithdrawals.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      Pending Approvals
                    </h3>
                    <Badge variant="warning" size="sm">
                      {pendingWithdrawals.length}
                    </Badge>
                  </div>
                  <Link
                    href={`/shared-wallets/${walletId}/withdrawals`}
                    className="text-xs"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    View all
                  </Link>
                </div>

                {withdrawalsLoading ? (
                  <SkeletonText lines={3} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {pendingWithdrawals.slice(0, 3).map((req) => (
                      <WithdrawalRequestRow
                        key={req.id}
                        request={req}
                        canApprove={isAdminOrCreator && req.requester_id !== userId}
                        onApprove={() => handleApprove(req)}
                        onReject={() => handleReject(req)}
                      />
                    ))}
                    {pendingWithdrawals.length > 3 && (
                      <Link href={`/shared-wallets/${walletId}/withdrawals`}>
                        <Button variant="ghost" size="sm" fullWidth>
                          View {pendingWithdrawals.length - 3} more
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Recent Transactions */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-text)' }}
                >
                  Recent Transactions
                </h3>
                <Link
                  href={`/transactions`}
                  className="text-xs"
                  style={{ color: 'var(--color-primary)' }}
                >
                  View all
                </Link>
              </div>

              {transactionsLoading ? (
                <SkeletonText lines={4} />
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    No transactions yet
                  </p>
                </div>
              ) : (
                <div
                  className="flex flex-col divide-y"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {transactions.slice(0, 5).map((tx) => {
                    // Deposit is positive (green), withdrawal/transfer/fee is negative (red)
                    const isPositive = tx.type === 'deposit';
                    const label =
                      tx.note || tx.type.charAt(0).toUpperCase() + tx.type.slice(1);

                    return (
                      <div key={tx.id} className="flex items-center gap-3 py-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: isPositive
                              ? 'var(--color-success-20)'
                              : 'var(--color-error-20)',
                          }}
                        >
                          {isPositive ? (
                            <ArrowDownLeft
                              size={14}
                              weight="bold"
                              color="var(--color-success)"
                            />
                          ) : (
                            <ArrowUpRight
                              size={14}
                              weight="bold"
                              color="var(--color-error)"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {label}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            {formatDate(new Date(tx.created_at), { format: 'relative' })}
                          </p>
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color: isPositive
                              ? 'var(--color-success)'
                              : 'var(--color-error)',
                            fontFamily: 'var(--font-family-number)',
                          }}
                        >
                          {isPositive ? '+' : ''}
                          {formatCurrency(
                            tx.amount,
                            (tx.currency as 'USDC' | 'SOL') || 'USDC'
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Quick add expense */}
            <Link href={`/shared-wallets/${walletId}/expenses/add`}>
              <Button
                variant="outline"
                fullWidth
                leftIcon={<Plus size={18} weight="bold" />}
              >
                Add Expense
              </Button>
            </Link>
          </div>
        </TabPanel>

        {/* Expenses */}
        <TabPanel value="expenses" className="mt-5">
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Link href={`/shared-wallets/${walletId}/expenses/add`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={15} weight="bold" />}
                >
                  Add Expense
                </Button>
              </Link>
            </div>

            {/* Expenses list */}
            {expensesLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Card key={i} padding="sm">
                    <div className="flex items-center gap-3">
                      <Skeleton width={40} height={40} radius="full" />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <Skeleton width="55%" height={14} radius="sm" />
                        <Skeleton width="35%" height={12} radius="sm" />
                      </div>
                      <Skeleton width={60} height={14} radius="sm" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No expenses recorded yet
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  Add the first expense to start tracking
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {expenses.map((expense) => (
                  <Link
                    key={expense.id}
                    href={`/shared-wallets/${walletId}/expenses/${expense.id}`}
                  >
                    <Card padding="sm" className="hover:bg-white/[0.03] transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                          style={{ backgroundColor: 'var(--color-white-10)' }}
                        >
                          🧾
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {expense.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {expense.recordedByName} · {formatDate(expense.date, { format: 'short' })} ·{' '}
                            {expense.splitBetween.length} people
                          </p>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p
                            className="text-sm font-semibold"
                            style={{
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-family-number)',
                            }}
                          >
                            {formatCurrency(expense.amount, 'USDC')}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            each: {formatCurrency(
                              expense.splitBetween.length > 0
                                ? expense.amount / expense.splitBetween.length
                                : expense.amount,
                              'USDC'
                            )}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        {/* Members */}
        <TabPanel value="members" className="mt-5">
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Link href={`/shared-wallets/${walletId}/members`}>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus size={15} weight="bold" />}
                >
                  Invite Member
                </Button>
              </Link>
            </div>
            {wallet.members.map((m) => (
              <Card key={m.user_id} padding="sm">
                <div className="flex items-center gap-3">
                  <Avatar fallback={m.name || 'U'} src={m.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {m.name || 'Unknown User'}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {m.email || m.wallet_address?.slice(0, 8) + '...' || 'No details'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      m.role === 'creator'
                        ? 'primary'
                        : m.role === 'admin'
                          ? 'info'
                          : 'default'
                    }
                    size="sm"
                  >
                    {m.role}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </TabPanel>

        {/* Settings */}
        <TabPanel value="settings" className="mt-5">
          <Card>
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <Link
                href={`/shared-wallets/${walletId}/settings`}
                className="flex items-center justify-between py-3 transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-text)' }}
              >
                <span className="text-sm font-medium">Wallet Settings</span>
                <GearSix size={18} color="var(--color-text-secondary)" />
              </Link>
              <Link
                href={`/shared-wallets/${walletId}/members`}
                className="flex items-center justify-between py-3 transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-text)' }}
              >
                <span className="text-sm font-medium">Manage Members</span>
                <UsersThree size={18} color="var(--color-text-secondary)" />
              </Link>
              <Link
                href={`/shared-wallets/${walletId}/withdrawals`}
                className="flex items-center justify-between py-3 transition-colors hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-text)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Withdrawal Requests</span>
                  {pendingCount > 0 && (
                    <Badge variant="warning" size="sm">
                      {pendingCount}
                    </Badge>
                  )}
                </div>
                <ArrowUp size={18} color="var(--color-text-secondary)" />
              </Link>
            </div>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Approval Modal */}
      {selectedRequest && modalType && (
        <ApprovalModal
          open={true}
          onClose={() => {
            setSelectedRequest(null);
            setModalType(null);
          }}
          onConfirm={confirmAction}
          request={selectedRequest}
          type={modalType}
          isLoading={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </PageContainer>
  );
}
