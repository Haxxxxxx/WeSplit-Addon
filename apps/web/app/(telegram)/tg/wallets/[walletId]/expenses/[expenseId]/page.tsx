'use client';

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  CalendarBlank,
  Trash,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { Card, HeroCard } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getExpenseById, deleteExpense } from '@/lib/firebase/queries';
import { formatCurrency } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Expense Detail Page
// ---------------------------------------------------------------------------

export default function TelegramExpenseDetailPage({
  params,
}: {
  params: Promise<{ walletId: string; expenseId: string }>;
}) {
  const { walletId, expenseId } = use(params);
  const router = useRouter();
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const { data: expense, isLoading } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => getExpenseById(expenseId),
    enabled: !!expenseId,
    staleTime: 30_000,
  });

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteExpense(expenseId);
      haptic?.notificationOccurred('success');
      queryClient.invalidateQueries({ queryKey: ['walletExpenses', walletId] });
      router.push(`/tg/wallets/${walletId}`);
    } catch {
      haptic?.notificationOccurred('error');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [confirmDelete, expenseId, walletId, haptic, queryClient, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <Receipt size={48} style={{ color: 'var(--color-text-tertiary)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Expense Not Found
        </h2>
        <Button onClick={() => goBack(`/tg/wallets/${walletId}`)} variant="outline">
          Back to Wallet
        </Button>
      </div>
    );
  }

  const isCreator = expense.recordedById === userId;
  const isFunded = expense.fundingStatus === 'funded';

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<Receipt size={20} weight="fill" color="var(--color-bg)" />}
        title={expense.name}
        subtitle="Expense detail"
      />

      {/* Amount hero */}
      <HeroCard className="p-5 text-center">
        <p
          className="text-xs uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Total Amount
        </p>
        <p
          className="font-bold mb-2"
          style={{
            fontFamily: 'var(--font-family-number)',
            fontSize: 'var(--font-size-balance)',
            color: 'var(--color-text)',
          }}
        >
          {formatCurrency(expense.amount, 'USDC')}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={isFunded ? 'default' : 'primary'} size="sm">
            {isFunded ? (
              <span className="flex items-center gap-1">
                <CheckCircle size={12} weight="fill" /> Funded
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WarningCircle size={12} weight="fill" /> Underfunded
              </span>
            )}
          </Badge>
          <Badge variant="default" size="sm">
            {expense.splitMethod === 'equal' ? 'Equal split' : 'Custom split'}
          </Badge>
        </div>
      </HeroCard>

      {/* Details */}
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          Details
        </h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Date
            </span>
            <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
              <CalendarBlank size={14} />
              {new Date(expense.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Added by
            </span>
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>
              {expense.recordedByName}
            </span>
          </div>
          {expense.note && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Note
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                {expense.note}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Per-member breakdown */}
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          Split Breakdown
        </h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {expense.splitBetween.map((split) => (
            <div key={split.userId} className="flex items-center gap-3 py-2.5">
              <Avatar fallback={split.userName} size="sm" />
              <span
                className="flex-1 text-sm truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {split.userName}
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-family-number)',
                }}
              >
                {formatCurrency(split.amount, 'USDC')}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Delete (creator only) */}
      {isCreator && (
        <Button
          variant="ghost"
          fullWidth
          onClick={handleDelete}
          loading={deleting}
          leftIcon={<Trash size={16} weight="bold" />}
          style={{ color: 'var(--color-error)' }}
        >
          {confirmDelete ? 'Tap again to confirm delete' : 'Delete Expense'}
        </Button>
      )}
    </div>
  );
}
