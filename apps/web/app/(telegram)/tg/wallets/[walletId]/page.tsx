'use client';

import { use, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  GearSix,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  ShieldCheck,
  UserCircle,
  Copy,
  Check,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { formatCurrency, formatDate, hexToRgba, toDate } from '@/lib/utils';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useSharedWalletDetail } from '@/hooks';
import { useAppStore } from '@/store';
import {
  getWalletWithdrawalRequests,
  updateWithdrawalRequestStatus,
  getWalletExpenses,
} from '@/lib/firebase/queries';
import { WalletDetailSkeleton } from '@/components/telegram/TelegramSkeletons';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import type { WithdrawalRequest, SharedWalletExpense } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET_COLORS = ['#9B59B6', '#2ECC71', '#E67E22', '#3498DB', '#E74C3C', '#1ABC9C'];

function getUserRole(wallet: { creator_id: string; members?: { user_id: string; role: string }[] }, userId?: string): string {
  if (!userId) return 'member';
  if (wallet.creator_id === userId) return 'creator';
  const member = wallet.members?.find((m) => m.user_id === userId);
  return member?.role ?? 'member';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {count !== undefined && (
        <span
          className="text-xs font-medium rounded-full px-2 py-0.5"
          style={{ backgroundColor: 'var(--color-white-10)', color: 'var(--color-text-secondary)' }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Telegram Wallet Detail Page
// ---------------------------------------------------------------------------

export default function TelegramWalletDetailPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const { wallet, transactions, isLoading, refetch } = useSharedWalletDetail(walletId);
  const [tab, setTab] = useState<'activity' | 'expenses' | 'members'>('activity');
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopyAddress = useCallback(() => {
    if (!wallet?.wallet_address) return;
    navigator.clipboard.writeText(wallet.wallet_address);
    setCopiedAddress(true);
    haptic?.notificationOccurred('success');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedAddress(false), 2000);
  }, [wallet?.wallet_address, haptic]);

  // Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['walletExpenses', walletId],
    queryFn: () => getWalletExpenses(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  // Withdrawal requests
  const { data: withdrawalRequests = [] } = useQuery({
    queryKey: ['withdrawalRequests', walletId],
    queryFn: () => getWalletWithdrawalRequests(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  const pendingRequests = withdrawalRequests.filter((r) => r.status === 'pending');

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/wallets'), [goBack]),
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['withdrawalRequests', walletId] }),
      queryClient.invalidateQueries({ queryKey: ['walletExpenses', walletId] }),
    ]);
  }, [refetch, queryClient, walletId]);

  const handleRequestAction = useCallback(
    async (requestId: string, action: 'approve' | 'reject') => {
      if (!userId || processingRequest) return;
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
        queryClient.setQueryData(queryKey, previous);
        haptic?.notificationOccurred('error');
      } finally {
        setProcessingRequest(null);
      }
    },
    [userId, processingRequest, walletId, haptic, queryClient],
  );

  if (isLoading || !wallet) return <WalletDetailSkeleton />;

  const balance = wallet.usdc_balance ?? wallet.balance ?? 0;
  const role = getUserRole(wallet, userId);
  const color = WALLET_COLORS[walletId.charCodeAt(0) % WALLET_COLORS.length] ?? '#3498DB';

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Hero */}
      <HeroCard className="p-5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-semibold"
            style={{ backgroundColor: hexToRgba(color, 0.13), border: `1px solid ${hexToRgba(color, 0.3)}`, color }}
          >
            {wallet.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate" style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-h2)' }}>
              {wallet.name}
            </h1>
            {wallet.description && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {wallet.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={role === 'creator' ? 'primary' : 'default'} size="sm">
              {role}
            </Badge>
            {role === 'creator' && (
              <Link href={`/tg/wallets/${walletId}/settings`} aria-label="Wallet settings">
                <GearSix
                  size={18}
                  weight="fill"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  className="transition-colors active:opacity-70"
                />
              </Link>
            )}
          </div>
        </div>

        <p
          className="text-xs uppercase tracking-widest mb-0.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Balance
        </p>
        <p
          className="font-semibold mb-3"
          style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-balance)', color: 'var(--color-text)' }}
        >
          {formatCurrency(balance, 'USDC')}
        </p>

        {wallet.wallet_address && (
          <button
            type="button"
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 mb-3 transition-colors active:opacity-70"
            aria-label="Copy wallet address"
          >
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              {wallet.wallet_address.slice(0, 6)}...{wallet.wallet_address.slice(-4)}
            </span>
            {copiedAddress
              ? <Check size={12} weight="bold" style={{ color: 'var(--color-success)' }} />
              : <Copy size={12} style={{ color: 'var(--color-text-tertiary)' }} />}
            {copiedAddress && (
              <span className="text-xs" style={{ color: 'var(--color-success)' }}>Copied!</span>
            )}
          </button>
        )}

        <div className="flex items-center justify-between">
          <AvatarGroup
            avatars={(wallet.members ?? []).map((m) => ({ fallback: m.name ?? m.user_id }))}
            max={4}
            size="sm"
          />
          <div className="flex gap-2">
            <Link href={`/tg/wallets/${walletId}/withdraw`}>
              <Button variant="secondary" size="sm" leftIcon={<ArrowUp size={14} />}>
                Withdraw
              </Button>
            </Link>
            <Link href={`/tg/deposit?address=${wallet.wallet_address ?? ''}&name=${encodeURIComponent(wallet.name)}`}>
              <Button variant="primary" size="sm" leftIcon={<ArrowDown size={14} />}>
                Fund
              </Button>
            </Link>
          </div>
        </div>
      </HeroCard>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--color-white-5)' }}>
        {([
          { key: 'activity', label: 'Activity' },
          { key: 'expenses', label: 'Expenses' },
          { key: 'members', label: 'Members' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              haptic?.selectionChanged();
            }}
            className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
            style={{
              backgroundColor: tab === t.key ? 'var(--color-white-10)' : 'transparent',
              color: tab === t.key ? 'var(--color-text)' : 'var(--color-text-tertiary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending withdrawal requests */}
      {tab === 'activity' && pendingRequests.length > 0 && (role === 'creator' || role === 'admin') && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Pending Requests" count={pendingRequests.length} />
            <Link
              href={`/tg/wallets/${walletId}/withdrawals`}
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: 'var(--color-white-5)' }}
              >
                <Clock size={20} weight="fill" color="var(--color-warning)" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                    Withdrawal: {formatCurrency(req.amount, 'USDC')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {req.note || `To ${req.destination_address.slice(0, 6)}...${req.destination_address.slice(-4)}`}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRequestAction(req.id, 'approve')}
                    disabled={processingRequest === req.id}
                    className="p-1.5 rounded-lg transition-colors active:opacity-70"
                    aria-label="Approve withdrawal"
                  >
                    <CheckCircle size={22} weight="fill" color="var(--color-success)" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestAction(req.id, 'reject')}
                    disabled={processingRequest === req.id}
                    className="p-1.5 rounded-lg transition-colors active:opacity-70"
                    aria-label="Reject withdrawal"
                  >
                    <XCircle size={22} weight="fill" color="var(--color-error)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <Card>
          <SectionHeader title="Recent Transactions" count={transactions.length} />
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No transactions yet
            </p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {transactions.map((tx) => {
                const isWithdrawal = tx.type === 'withdrawal' || tx.type === 'fee';
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: isWithdrawal ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
                    >
                      {isWithdrawal ? (
                        <ArrowUpRight size={14} weight="bold" color="var(--color-error)" />
                      ) : (
                        <ArrowDownLeft size={14} weight="bold" color="var(--color-success)" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                        {tx.note || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {formatDate(toDate(tx.created_at), { format: 'relative' })}
                      </p>
                    </div>
                    <span
                      className="text-base font-medium"
                      style={{
                        color: isWithdrawal ? 'var(--color-error)' : 'var(--color-success)',
                        fontFamily: 'var(--font-family-number)',
                      }}
                    >
                      {isWithdrawal ? '-' : '+'}
                      {formatCurrency(tx.amount, 'USDC')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <>
          <Card>
            <SectionHeader title="Expenses" count={expenses.length} />
            {expenses.length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No expenses yet
              </p>
            ) : (
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {expenses.map((exp) => (
                  <Link
                    key={exp.id}
                    href={`/tg/wallets/${walletId}/expenses/${exp.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors active:bg-white/[0.04]"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'var(--color-white-10)' }}
                    >
                      <Receipt size={14} weight="fill" style={{ color: 'var(--color-text)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                        {exp.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {exp.splitBetween.length} people &middot; {exp.splitMethod}
                      </p>
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                    >
                      {formatCurrency(exp.amount, 'USDC')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Link href={`/tg/wallets/${walletId}/expenses/add`} className="block">
            <div
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:opacity-80"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <Plus size={16} weight="bold" />
              Add Expense
            </div>
          </Link>
        </>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="flex flex-col gap-3">
          {(wallet.members ?? []).map((m) => (
            <Card key={m.user_id} padding="sm">
              <div className="flex items-center gap-3">
                <Link href={`/tg/users/${m.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar fallback={m.name ?? m.user_id} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {m.name ?? 'Unknown'}
                    </p>
                    {m.email && (
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {m.email}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={m.role === 'creator' ? 'primary' : m.role === 'admin' ? 'info' : 'default'}
                    size="sm"
                  >
                    {m.role}
                  </Badge>
                  <Link href={`/tg/wallets/${walletId}/members/${m.user_id}/rights`} aria-label={`Manage ${m.name ?? 'member'} permissions`}>
                    <ShieldCheck size={16} style={{ color: 'var(--color-text-tertiary)' }} className="transition-colors active:opacity-70" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          <Link href={`/tg/wallets/${walletId}/invite`} className="block">
            <div
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors active:opacity-80"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              <Plus size={16} weight="bold" />
              Invite Member
            </div>
          </Link>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
