'use client';

import { useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  PaperPlaneTilt,
  HandCoins,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Bell,
  AddressBook,
  GearSix,
  Star,
  Wallet,
  ArrowsClockwise,
  QrCode,
  Receipt,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { formatCurrency, formatDate, hexToRgba, toDate } from '@/lib/utils';
import { useTelegram } from '@/providers/TelegramProvider';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTelegramHaptic } from '@/lib/telegram/hooks';
import { useDeeplink } from '@/lib/telegram/deeplinks';
import { Button } from '@/components/ui/Button';
import { useTransactions, useSharedWallets, useUserBalance, useSplits } from '@/hooks';
import { useSOLPrice } from '@/lib/services/priceService';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import { getUserNotifications, getReceivedPaymentRequests } from '@/lib/firebase/queries';
import { DashboardSkeleton } from '@/components/telegram/TelegramSkeletons';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { useQuery } from '@tanstack/react-query';
import type { Transaction } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET_COLORS = ['#9B59B6', '#2ECC71', '#E67E22', '#3498DB', '#E74C3C', '#1ABC9C'];

function getTxLabel(tx: Transaction, userId?: string): string {
  const isOutgoing = tx.from_user === userId;
  if (tx.type === 'deposit') return 'Deposit';
  if (tx.type === 'withdraw') return 'Withdrawal';
  if (isOutgoing) return tx.recipient_name ? `Sent to ${tx.recipient_name}` : 'Sent';
  return tx.sender_name ? `From ${tx.sender_name}` : 'Received';
}

// ---------------------------------------------------------------------------
// Quick action pill
// ---------------------------------------------------------------------------

function QuickAction({
  icon: Icon,
  label,
  href,
  primary,
  onTouchStart,
  onTap,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  primary?: boolean;
  onTouchStart?: () => void;
  onTap?: () => void;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5" onTouchStart={onTouchStart} onClick={onTap}>
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform active:scale-90"
        style={
          primary
            ? { background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }
            : { backgroundColor: 'var(--color-white-10)' }
        }
      >
        <Icon
          size={22}
          weight={primary ? 'fill' : 'regular'}
          color={primary ? 'var(--color-bg)' : 'var(--color-text)'}
        />
      </div>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Transaction row (compact for mobile)
// ---------------------------------------------------------------------------

function TxRow({ tx, userId }: { tx: Transaction; userId?: string }) {
  const isOutgoing = tx.from_user === userId;
  return (
    <Link href={`/tg/transactions/${tx.id}`} className="flex items-center gap-3 py-2.5 transition-colors active:bg-white/[0.04]">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: isOutgoing ? 'var(--color-error-20)' : 'var(--color-success-20)' }}
      >
        {isOutgoing ? (
          <ArrowUpRight size={16} weight="bold" color="var(--color-error)" />
        ) : (
          <ArrowDownLeft size={16} weight="bold" color="var(--color-success)" />
        )}
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <span className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
          {getTxLabel(tx, userId)}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatDate(toDate(tx.created_at), { format: 'relative' })}
        </span>
      </div>
      <span
        className="text-base font-medium"
        style={{
          color: isOutgoing ? 'var(--color-error)' : 'var(--color-success)',
          fontFamily: 'var(--font-family-number)',
        }}
      >
        {isOutgoing ? '-' : '+'}
        {formatCurrency(tx.amount, 'USDC')}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Telegram Dashboard
// ---------------------------------------------------------------------------

export default function TelegramDashboardPage() {
  const { telegramUser, groupContext } = useTelegram();
  const { prefetchRoutes, prefetchData } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userPoints = useAppStore((s) => s.user.currentUser?.points);
  const { hasWallet, isLoading: walletCheckLoading } = useTgWallet();
  const { usdc, sol, isLoading: balanceLoading, refetch: refetchBalance } = useUserBalance();
  const { data: solPrice } = useSOLPrice();
  const { transactions, isLoading: txLoading, refetch: refetchTx } = useTransactions(5);
  const { wallets, isLoading: walletsLoading, refetch: refetchWallets } = useSharedWallets();
  const { splits, refetch: refetchSplits } = useSplits();

  // Notifications — unread count for bell badge
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUserNotifications(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length;

  // Payment requests — pending requests from others
  const { data: paymentRequests = [], refetch: refetchRequests } = useQuery({
    queryKey: ['receivedPaymentRequests', userId],
    queryFn: () => getReceivedPaymentRequests(userId!, 5),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const firstName = telegramUser?.first_name ?? 'there';
  const loading = balanceLoading || txLoading || walletsLoading;
  const isGroupContext = groupContext.chatId != null && groupContext.chatType !== 'private';

  // Prefetch all TG sub-route JS bundles on dashboard mount
  useEffect(() => {
    prefetchRoutes();
  }, [prefetchRoutes]);

  // Auto-route to deeplink target if start_param is present
  useDeeplink(groupContext.startParam, !loading);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchBalance(), refetchTx(), refetchWallets(), refetchRequests(), refetchSplits()]);
  }, [refetchBalance, refetchTx, refetchWallets, refetchRequests, refetchSplits]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="flex flex-col gap-5 px-4 pt-5 pb-24 animate-fade-in">
      {/* Group context banner — shown when opened from a Telegram group */}
      {isGroupContext && groupContext.chatTitle && (
        <Link
          href="/tg/splits/create"
          className="flex items-center gap-2.5 rounded-xl p-3"
          style={{ backgroundColor: 'var(--color-primary-10)', border: '1px solid var(--color-primary-20)' }}
        >
          <Users size={18} weight="fill" color="var(--color-primary)" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--color-primary)' }}>
              {groupContext.chatTitle}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Tap to create a group split
            </p>
          </div>
          <ArrowUpRight size={14} color="var(--color-primary)" />
        </Link>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src="/wesplit-logo.png"
            alt="WeSplit"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Hey, {firstName}
            </p>
            <h1
              className="text-base font-bold leading-tight"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-display)' }}
            >
              WeSplit
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/tg/notifications" className="relative p-1.5" aria-label="Notifications">
            <Bell size={22} weight={unreadCount > 0 ? 'fill' : 'regular'} style={{ color: 'var(--color-text-secondary)' }} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{ backgroundColor: 'var(--color-error)', color: '#fff' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/tg/settings" className="relative" aria-label="Settings">
            <Avatar
              src={telegramUser?.photo_url}
              fallback={firstName}
              size="sm"
            />
          </Link>
        </div>
      </div>

      {/* Balance hero / Wallet setup CTA */}
      {!walletCheckLoading && !hasWallet ? (
        <HeroCard className="p-5">
          <div className="flex flex-col items-center gap-3 py-2">
            <Wallet size={36} weight="fill" style={{ color: 'var(--color-primary)' }} />
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                Set Up Your Wallet
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Create a non-custodial Solana wallet to start sending and receiving USDC
              </p>
            </div>
            <div className="flex gap-2 w-full mt-1">
              <Link href="/tg/wallet/setup" className="flex-1">
                <Button fullWidth leftIcon={<Wallet size={16} weight="fill" />}>
                  Create Wallet
                </Button>
              </Link>
              <Link href="/tg/wallet/import" className="flex-1">
                <Button fullWidth variant="outline" leftIcon={<ArrowsClockwise size={16} />}>
                  Import
                </Button>
              </Link>
            </div>
          </div>
        </HeroCard>
      ) : (
        <HeroCard className="p-5">
          <p
            className="text-xs uppercase tracking-widest mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Total Balance
          </p>
          <p
            className="font-semibold leading-none"
            style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)', fontSize: 'var(--font-size-balance)' }}
          >
            {formatCurrency(usdc, 'USDC')}
          </p>
          {sol > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-sm"
                style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text-secondary)' }}
              >
                ◎ {sol.toFixed(4)} SOL
              </span>
              {solPrice != null && (
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  ≈ ${(sol * solPrice).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </HeroCard>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-5 gap-2 py-1">
        <QuickAction icon={PaperPlaneTilt} label="Send" href="/tg/send" primary onTouchStart={() => prefetchData('/tg/send')} onTap={() => haptic?.impactOccurred('light')} />
        <QuickAction icon={QrCode} label="Receive" href="/tg/receive" onTap={() => haptic?.impactOccurred('light')} />
        <QuickAction icon={HandCoins} label="Request" href="/tg/request" onTouchStart={() => prefetchData('/tg/request')} onTap={() => haptic?.impactOccurred('light')} />
        <QuickAction icon={ArrowDown} label="Deposit" href="/tg/deposit" onTap={() => haptic?.impactOccurred('light')} />
        <QuickAction icon={ArrowUp} label="Withdraw" href="/tg/withdraw" onTap={() => haptic?.impactOccurred('light')} />
      </div>

      {/* Payment requests */}
      {paymentRequests.length > 0 && (
        <Card>
          <h2 className="text-base font-medium mb-3" style={{ color: 'var(--color-text)' }}>
            Payment Requests
          </h2>
          <div className="flex flex-col gap-2">
            {paymentRequests.map((req) => (
              <Link
                key={req.id}
                href={`/tg/send?to=${req.from_wallet ?? ''}&name=${encodeURIComponent(req.from_name ?? 'User')}&amount=${req.amount_per_person}`}
                className="flex items-center gap-3 rounded-xl p-2.5 transition-colors active:bg-white/[0.04]"
                style={{ backgroundColor: 'var(--color-white-5)' }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'var(--color-warning-20)' }}
                >
                  <HandCoins size={16} weight="fill" color="var(--color-warning)" />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {req.from_name ?? 'Someone'} requested
                  </span>
                  {req.note && (
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {req.note}
                    </span>
                  )}
                </div>
                <span
                  className="text-sm font-medium shrink-0"
                  style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-warning)' }}
                >
                  {formatCurrency(req.amount_per_person ?? req.amount, 'USDC')}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Shared wallets */}
      {wallets.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
              Shared Wallets
            </h2>
            <Link
              href="/tg/wallets"
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
              onTouchStart={() => prefetchData('/tg/wallets')}
            >
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {wallets.slice(0, 3).map((sw, i) => {
              const color = WALLET_COLORS[i % WALLET_COLORS.length] ?? '#3498DB';
              const balance = sw.usdc_balance ?? sw.balance ?? 0;
              return (
                <Link
                  key={sw.id}
                  href={`/tg/wallets/${sw.id}`}
                  className="flex items-center gap-3 rounded-xl p-2.5 transition-colors active:bg-white/[0.04]"
                  onTouchStart={() => prefetchData(`/tg/wallets/${sw.id}`, { walletId: sw.id })}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
                    style={{ backgroundColor: hexToRgba(color, 0.13), color }}
                  >
                    {sw.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                      {sw.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      <Users size={10} className="inline mr-1" />
                      {sw.members?.length ?? 0} members
                    </span>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                  >
                    {formatCurrency(balance, 'USDC')}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* Active splits */}
      {splits.filter((s) => s.status === 'active' || s.status === 'pending').length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
              Active Splits
            </h2>
            <Link
              href="/tg/splits"
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {splits
              .filter((s) => s.status === 'active' || s.status === 'pending')
              .slice(0, 3)
              .map((s) => {
                const paidCount = s.participants.filter((p) => p.status === 'paid').length;
                const total = s.participants.length;
                const progress = total > 0 ? (paidCount / total) * 100 : 0;
                return (
                  <Link
                    key={s.id}
                    href={`/tg/splits/${s.id}`}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors active:bg-white/[0.04]"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                      style={{ backgroundColor: 'var(--color-primary-20)' }}
                    >
                      <Receipt size={18} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="flex flex-1 flex-col min-w-0 gap-0.5">
                      <span className="truncate text-sm" style={{ color: 'var(--color-text)' }}>
                        {s.title}
                      </span>
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--color-white-10)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, var(--color-gradient-start), var(--color-gradient-end))',
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-sm font-medium shrink-0"
                      style={{ fontFamily: 'var(--font-family-number)', color: 'var(--color-text)' }}
                    >
                      {formatCurrency(s.totalAmount, s.currency as 'USDC')}
                    </span>
                  </Link>
                );
              })}
          </div>
        </Card>
      )}

      {/* Rewards teaser */}
      <Link href="/tg/rewards">
        <Card className="flex items-center gap-3 transition-colors active:bg-white/[0.04]">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
          >
            <Star size={20} weight="fill" color="var(--color-bg)" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Rewards
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {(userPoints ?? 0).toLocaleString()} points
            </p>
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>&rsaquo;</span>
        </Card>
      </Link>

      {/* Recent activity */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
            Recent Activity
          </h2>
          {transactions.length > 0 && (
            <Link
              href="/tg/transactions"
              className="text-xs font-medium"
              style={{ color: 'var(--color-primary)' }}
              onTouchStart={() => prefetchData('/tg/transactions')}
            >
              See all
            </Link>
          )}
        </div>
        {transactions.length > 0 ? (
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} userId={userId} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No transactions yet
          </p>
        )}
      </Card>
    </div>
    </PullToRefresh>
  );
}
