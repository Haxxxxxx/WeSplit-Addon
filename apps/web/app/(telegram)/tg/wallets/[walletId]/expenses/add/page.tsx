'use client';

import { use, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  CalendarBlank,
  Equals,
  Sliders,
  CheckCircle,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { SuccessScreen } from '@/components/telegram/SuccessScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useSharedWalletDetail } from '@/hooks';
import { useAppStore } from '@/store';
import { createExpense } from '@/lib/firebase/queries';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { formatCurrency, sanitizeAmountInput, dismissKeyboard } from '@/lib/utils';
import type { ExpenseSplit } from '@/types';

// ---------------------------------------------------------------------------
// Add Expense Page — single-form for TG Mini App
// ---------------------------------------------------------------------------

export default function TelegramAddExpensePage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name) ?? 'Unknown';

  const queryClient = useQueryClient();
  const { wallet } = useSharedWalletDetail(walletId);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const members = wallet?.members ?? [];
  const numAmount = parseFloat(amount) || 0;

  // Initialize selected members to all wallet members
  const effectiveSelected = selectedMembers.size > 0
    ? selectedMembers
    : new Set(members.map((m) => m.user_id));

  const selectedCount = effectiveSelected.size;

  // Compute splits
  const splits: ExpenseSplit[] = useMemo(() => {
    if (splitMethod === 'equal' && selectedCount > 0) {
      const perPerson = numAmount / selectedCount;
      return members
        .filter((m) => effectiveSelected.has(m.user_id))
        .map((m) => ({
          userId: m.user_id,
          userName: m.name ?? 'Unknown',
          amount: Math.round(perPerson * 100) / 100,
        }));
    }
    if (splitMethod === 'custom') {
      return members
        .filter((m) => effectiveSelected.has(m.user_id))
        .map((m) => ({
          userId: m.user_id,
          userName: m.name ?? 'Unknown',
          amount: parseFloat(customAmounts[m.user_id] ?? '0') || 0,
        }));
    }
    return [];
  }, [splitMethod, numAmount, selectedCount, members, effectiveSelected, customAmounts]);

  const customTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const customValid = splitMethod !== 'custom' || Math.abs(customTotal - numAmount) < 0.01;

  const canSubmit =
    name.trim().length > 0 &&
    numAmount > 0 &&
    selectedCount > 0 &&
    customValid &&
    !saving;

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const brandColors = useTgBrandColors();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !userId) return;
    setSaving(true);
    setError(null);
    try {
      await createExpense({
        walletId,
        name: name.trim(),
        amount: numAmount,
        date: date ?? new Date().toISOString().slice(0, 10),
        splitMethod,
        splitBetween: splits,
        recordedById: userId!,
        recordedByName: userName,
        note: note.trim() || undefined,
      });
      haptic?.notificationOccurred('success');
      queryClient.invalidateQueries({ queryKey: ['walletExpenses', walletId] });
      queryClient.invalidateQueries({ queryKey: ['sharedWallet', walletId] });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
      haptic?.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }, [canSubmit, userId, walletId, name, numAmount, date, splitMethod, splits, userName, note, haptic, queryClient]);

  useTelegramMainButton({
    text: saving ? 'Creating...' : `Add Expense${numAmount > 0 ? ` $${amount}` : ''}`,
    onClick: handleSubmit,
    visible: canSubmit && !success,
    loading: saving,
    disabled: !canSubmit || saving,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  function toggleMember(uid: string) {
    const next = new Set(effectiveSelected);
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    setSelectedMembers(next);
    haptic?.selectionChanged();
  }

  if (success) {
    return (
      <SuccessScreen
        title="Expense Added!"
        message={`${formatCurrency(numAmount, 'USDC')} split between ${selectedCount} member${selectedCount !== 1 ? 's' : ''}`}
        onDone={() => goBack(`/tg/wallets/${walletId}`)}
        doneLabel="Back to Wallet"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<Receipt size={20} weight="fill" color="var(--color-bg)" />}
        title="Add Expense"
        subtitle={wallet?.name ?? 'Shared Wallet'}
      />

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          {error}
        </div>
      )}

      {/* Name & Note */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Expense Name
        </label>
        <Input
          placeholder="e.g. Dinner, Uber, Groceries..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <label className="block mt-3 mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Note (optional)
        </label>
        <Input
          placeholder="Any additional details..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
        />
      </Card>

      {/* Amount & Date */}
      <Card>
        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Amount (USDC)
        </label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 font-medium"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family-number)',
              fontSize: 'var(--font-size-big-number)',
            }}
          >
            $
          </span>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => { const v = sanitizeAmountInput(e.target.value); if (v !== null) setAmount(v); }}
            min={0}
            className="pl-8 font-medium"
            style={{
              fontFamily: 'var(--font-family-number)',
              fontSize: 'var(--font-size-big-number)',
            }}
          />
        </div>

        <label className="block mt-3 mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Date
        </label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          leftIcon={<CalendarBlank size={16} />}
        />
      </Card>

      {/* Split method */}
      <Card>
        <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Split Method
        </label>
        <div className="flex gap-2">
          {([
            { key: 'equal' as const, icon: Equals, label: 'Equal' },
            { key: 'custom' as const, icon: Sliders, label: 'Custom' },
          ]).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setSplitMethod(opt.key);
                haptic?.selectionChanged();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor:
                  splitMethod === opt.key ? 'var(--color-primary)' : 'var(--color-white-10)',
                color:
                  splitMethod === opt.key ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <opt.icon size={16} weight="bold" />
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Participants */}
      <Card>
        <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Split Between ({selectedCount} member{selectedCount !== 1 ? 's' : ''})
        </label>
        <div className="flex flex-col gap-1">
          {members.map((m) => {
            const isSelected = effectiveSelected.has(m.user_id);
            const perPerson =
              splitMethod === 'equal' && selectedCount > 0
                ? numAmount / selectedCount
                : parseFloat(customAmounts[m.user_id] ?? '0') || 0;

            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                style={{
                  backgroundColor: isSelected ? 'var(--color-white-5)' : 'transparent',
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleMember(m.user_id)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar fallback={m.name ?? m.user_id} size="sm" />
                  <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {m.name ?? 'Unknown'}
                  </span>
                </button>
                {isSelected && splitMethod === 'equal' && numAmount > 0 && (
                  <Badge variant="primary" size="sm">
                    {formatCurrency(perPerson, 'USDC')}
                  </Badge>
                )}
                {isSelected && splitMethod === 'custom' && (
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    min={0}
                    value={customAmounts[m.user_id] ?? ''}
                    onChange={(e) => {
                      const v = sanitizeAmountInput(e.target.value);
                      if (v !== null) setCustomAmounts((prev) => ({ ...prev, [m.user_id]: v }));
                    }}
                    className="w-24 text-right text-sm"
                    style={{ fontFamily: 'var(--font-family-number)' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {splitMethod === 'custom' && numAmount > 0 && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
            style={{ backgroundColor: 'var(--color-white-5)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Total assigned
            </span>
            <span
              className="text-xs font-medium"
              style={{
                color: customValid ? 'var(--color-success)' : 'var(--color-error)',
                fontFamily: 'var(--font-family-number)',
              }}
            >
              {formatCurrency(customTotal, 'USDC')} / {formatCurrency(numAmount, 'USDC')}
            </span>
          </div>
        )}
      </Card>

      {/* Fallback submit */}
      {canSubmit && (
        <Button onClick={handleSubmit} loading={saving} fullWidth className="tg-hide">
          Add Expense
        </Button>
      )}
    </div>
  );
}
