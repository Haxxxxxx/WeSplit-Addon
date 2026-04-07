'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/store';
import { getUserTransactions, getUserSharedWallets } from '@/lib/firebase/queries';
import { getUSDCBalance } from '@/lib/transactions/transactionService';
import { useRealtimeNotifications } from '@/hooks/web/useRealtimeNotifications';
import {
  DashboardHeader,
  BalanceOverview,
  ActivityChart,
  TransactionsTable,
  RightPanel,
  MobileNavDrawer,
} from '@/components/dashboard';
import type { Transaction } from '@/types';

const STALE_TIME = 5 * 60 * 1000;

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth / identity
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userName = currentUser?.name || 'User';
  const userAvatar = currentUser?.avatar || null;
  const storeWallet = useAppStore((s) => s.user.currentUser?.wallet_address);
  const { publicKey } = useWallet();
  const walletAddress = storeWallet ?? publicKey?.toBase58();

  // Connection
  const { connection } = useConnection();

  // Notifications
  const { unreadCount } = useRealtimeNotifications(currentUser?.id);

  // On-chain USDC balance
  const { data: usdcBalance = 0, isLoading: usdcLoading } = useQuery({
    queryKey: ['balance', 'usdc', walletAddress],
    queryFn: () => getUSDCBalance(connection, walletAddress!),
    enabled: !!walletAddress,
    staleTime: STALE_TIME,
  });

  // Firestore data
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => getUserTransactions(userId!, 7),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  const { data: sharedWallets = [], isLoading: swLoading } = useQuery({
    queryKey: ['sharedWallets', userId],
    queryFn: () => getUserSharedWallets(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  // Compute sent/received totals from recent transactions
  const { totalSent, totalReceived } = useMemo(() => {
    let sent = 0;
    let received = 0;
    for (const tx of transactions as Transaction[]) {
      if (tx.from_user === userId) {
        sent += tx.amount ?? 0;
      } else {
        received += tx.amount ?? 0;
      }
    }
    return { totalSent: sent, totalReceived: received };
  }, [transactions, userId]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <DashboardHeader
        userName={userName}
        userAvatar={userAvatar}
        unreadCount={unreadCount}
        onMobileMenuToggle={() => setMobileMenuOpen(true)}
      />

      {/* Mobile Nav Drawer */}
      <MobileNavDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        userName={userName}
        userAvatar={userAvatar}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col xl:flex-row gap-6 p-6 lg:p-8 max-w-[1440px]">
          {/* Main content column */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            <BalanceOverview
              usdcBalance={usdcBalance}
              totalSent={totalSent}
              totalReceived={totalReceived}
              isLoading={usdcLoading}
            />
            <ActivityChart />
            <TransactionsTable
              transactions={transactions}
              userId={userId}
              isLoading={txLoading}
            />
          </div>

          {/* Right sidebar */}
          <div className="w-full xl:w-[340px] shrink-0">
            <div className="xl:sticky xl:top-8">
              <RightPanel
                sharedWallets={sharedWallets}
                swLoading={swLoading}
                currentUserName={userName}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
