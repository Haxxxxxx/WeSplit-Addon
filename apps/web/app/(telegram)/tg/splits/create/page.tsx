'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Check,
  MagnifyingGlass,
  Users,
  Receipt,
  Storefront,
  Warning,
  UsersThree,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, isValidSolanaAddress, roundUsdcAmount } from '@/lib/utils';
import { useAppStore } from '@/store';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import {
  useTelegramBackButton,
  useTelegramHaptic,
  useTelegramMainButton,
} from '@/lib/telegram/hooks';
import { searchUsers, getRecentContacts } from '@/lib/firebase/queries';
import { getTelegramGroupMembers } from '@/lib/firebase/queries/telegramGroups';
import type { TelegramGroupMember } from '@/lib/firebase/queries/telegramGroups';
import * as splitStorageService from '@/lib/services/splitStorageService';
import { createSplitWallet } from '@/lib/services/splitWalletService';
import { splitQueryKeys } from '@/hooks';
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue';
import { useTelegram } from '@/providers/TelegramProvider';
import { NoWalletScreen } from '@/components/telegram/NoWalletScreen';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: 'food',   label: 'Food',  emoji: '🍔' },
  { value: 'trip',   label: 'Trip',  emoji: '✈️' },
  { value: 'home',   label: 'Home',  emoji: '🏠' },
  { value: 'event',  label: 'Event', emoji: '🎉' },
  { value: 'rocket', label: 'Other', emoji: '🚀' },
] as const;

const STEPS = ['Details', 'Amount', 'People', 'Review'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParticipantInput {
  userId: string;
  name: string;
  email?: string;
  walletAddress: string;
  amountOwed: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBillId(): string {
  return `bill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Compact TG stepper
// ---------------------------------------------------------------------------

function TgStepper({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-5">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all"
              style={{
                background: i < currentStep
                  ? 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))'
                  : i === currentStep
                  ? 'var(--color-white-20)'
                  : 'var(--color-white-10)',
                color: i < currentStep ? 'var(--color-bg)' : i === currentStep ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                border: i === currentStep ? '2px solid var(--color-primary)' : 'none',
              }}
            >
              {i < currentStep ? <Check size={12} weight="bold" /> : i + 1}
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: i === currentStep ? 'var(--color-text)' : 'var(--color-text-tertiary)' }}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px mx-1 mb-4"
              style={{ backgroundColor: i < currentStep ? 'var(--color-primary)' : 'var(--color-border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TgCreateSplitPage() {
  const { goBack } = useTgNavigation();
  const router = useRouter();
  const haptic = useTelegramHaptic();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;
  const queryClient = useQueryClient();
  const { groupContext } = useTelegram();

  // Non-null chatId means Mini App was opened from a group
  const groupChatId = groupContext.chatId;
  const telegramGroupDocId = groupChatId ? `tg_group_${groupChatId}` : null;

  // TG wallet is the creator wallet source
  const { address: tgWalletAddress, hasWallet } = useTgWallet();

  // Resolve creator wallet: TG wallet > telegram_wallet_address on user doc > fallback
  const creatorWalletAddress =
    tgWalletAddress ||
    currentUser?.telegram_wallet_address ||
    currentUser?.web_wallet_address ||
    currentUser?.wallet_address;

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  const [step, setStep] = useState(0);

  // Step 0 — Details
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [category, setCategory]         = useState<string | undefined>(undefined);
  const [merchantName, setMerchantName] = useState('');
  const [merchantAddress, setMerchantAddress] = useState('');

  // Step 1 — Amount
  const [totalAmount, setTotalAmount]   = useState('');
  const [splitMethod, setSplitMethod]   = useState<'equal' | 'manual'>('equal');

  // Step 2 — Participants
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedSearch = useDebouncedValue(memberSearch, 300);

  const parsedAmount = parseFloat(totalAmount) || 0;

  // ---------------------------------------------------------------------------
  // Contacts / search
  // ---------------------------------------------------------------------------

  const { data: recentContacts = [] } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['userSearch', debouncedSearch, userId],
    queryFn: () => searchUsers(debouncedSearch, userId ?? undefined),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  // Group members — fetched when Mini App is opened from a group
  const { data: groupMembers = [] } = useQuery({
    queryKey: ['telegramGroupMembers', groupChatId],
    queryFn: () => getTelegramGroupMembers(groupChatId!),
    enabled: groupChatId !== null,
    staleTime: 2 * 60_000,
  });

  // Exclude current user from group member list (they're the creator)
  const currentUserTgId = currentUser?.telegram_id as number | undefined;
  const filteredGroupMembers = useMemo(
    () => groupMembers.filter((m) => m.telegram_id !== currentUserTgId),
    [groupMembers, currentUserTgId],
  );

  const displayContacts = debouncedSearch.length >= 2 ? searchResults : recentContacts;

  // ---------------------------------------------------------------------------
  // Auto-recalculate equal shares
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (splitMethod === 'equal' && participants.length > 0 && parsedAmount > 0) {
      const equalShare = roundUsdcAmount(parsedAmount / participants.length);
      setParticipants((prev) => prev.map((p) => ({ ...p, amountOwed: equalShare })));
    }
  }, [splitMethod, parsedAmount, participants.length]);

  const totalOwed = useMemo(
    () => roundUsdcAmount(participants.reduce((sum, p) => sum + (p.amountOwed || 0), 0)),
    [participants],
  );

  const amountsMatch = splitMethod === 'equal' || Math.abs(totalOwed - parsedAmount) < 0.01;

  // ---------------------------------------------------------------------------
  // Participant management
  // ---------------------------------------------------------------------------

  function toggleParticipant(user: User) {
    haptic.impactOccurred('light');
    const exists = participants.find((p) => p.userId === user.id);
    if (exists) {
      setParticipants((prev) => prev.filter((p) => p.userId !== user.id));
    } else {
      const equalShare =
        participants.length > 0 && parsedAmount > 0
          ? roundUsdcAmount(parsedAmount / (participants.length + 1))
          : 0;
      setParticipants((prev) => [
        ...prev,
        {
          userId: user.id,
          name: user.name || user.email || 'Unknown',
          email: user.email,
          walletAddress:
            user.wallet_address ||
            user.web_wallet_address ||
            user.telegram_wallet_address ||
            '',
          amountOwed: splitMethod === 'equal' ? equalShare : 0,
        },
      ]);
    }
  }

  function toggleGroupMember(member: TelegramGroupMember) {
    haptic.impactOccurred('light');
    // Use wesplit_user_id if linked, otherwise use tg_{telegram_id} as a placeholder
    const uid = member.wesplit_user_id ?? `tg_${member.telegram_id}`;
    const exists = participants.find((p) => p.userId === uid);
    if (exists) {
      setParticipants((prev) => prev.filter((p) => p.userId !== uid));
    } else {
      const equalShare =
        participants.length > 0 && parsedAmount > 0
          ? roundUsdcAmount(parsedAmount / (participants.length + 1))
          : 0;
      setParticipants((prev) => [
        ...prev,
        {
          userId: uid,
          name: [member.telegram_first_name, member.telegram_username ? `@${member.telegram_username}` : '']
            .filter(Boolean)
            .join(' '),
          walletAddress: member.wallet_address ?? '',
          amountOwed: splitMethod === 'equal' ? equalShare : 0,
        },
      ]);
    }
  }

  function updateParticipantAmount(uid: string, amount: number) {
    setParticipants((prev) =>
      prev.map((p) => (p.userId === uid ? { ...p, amountOwed: amount } : p)),
    );
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const stepValid = [
    // Step 0: title required
    title.trim().length > 0,
    // Step 1: amount required
    parsedAmount > 0,
    // Step 2: at least one participant with valid wallet + amounts balanced
    participants.length > 0 &&
      participants.every((p) => p.walletAddress && isValidSolanaAddress(p.walletAddress)) &&
      amountsMatch,
    // Step 3 (review): always valid if we got here
    true,
  ];

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  const createSplit = useMutation({
    mutationFn: async () => {
      if (!userId || !currentUser) throw new Error('Not authenticated');
      if (!creatorWalletAddress) throw new Error('No wallet found. Set up your TG wallet first.');

      const billId = generateBillId();

      const splitResult = await splitStorageService.createSplit({
        billId,
        title: title.trim(),
        description: description.trim() || undefined,
        totalAmount: parsedAmount,
        currency: 'USDC',
        category,
        splitMethod,
        creatorId: userId,
        creatorName: currentUser.name,
        participants: participants.map((p) => ({
          ...p,
          amountPaid: 0,
          status: 'pending' as const,
        })),
        merchant: merchantName.trim()
          ? { name: merchantName.trim(), address: merchantAddress.trim() || undefined }
          : undefined,
        telegramGroupId: telegramGroupDocId ?? undefined,
      });

      if (!splitResult.success || !splitResult.split) {
        throw new Error(splitResult.error || 'Failed to create split');
      }

      // Create the split wallet (best-effort — log warning if fails)
      const walletResult = await createSplitWallet(
        splitResult.split.billId,
        userId,
        creatorWalletAddress,
        parsedAmount,
        'USDC',
        participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          walletAddress: p.walletAddress,
          amountOwed: p.amountOwed,
        })),
      );

      if (!walletResult.success) {
        // Wallet creation failed but split was created — user can retry wallet setup later
      }

      return { split: splitResult.split, wallet: walletResult.wallet };
    },
    onSuccess: (data) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.list(userId) });
        queryClient.invalidateQueries({ queryKey: splitQueryKeys.userWallets(userId) });
      }
      if (data.split) {
        queryClient.setQueryData(splitQueryKeys.detail(data.split.id), data.split);
        haptic.notificationOccurred('success');
        router.push(`/tg/splits/${data.split.id}`);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // TG SDK wiring
  // ---------------------------------------------------------------------------

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => {
      if (step > 0) {
        setStep((s) => s - 1);
      } else {
        goBack();
      }
    }, [step, goBack]),
  });

  const isLastStep = step === STEPS.length - 1;
  const mainButtonText = isLastStep
    ? createSplit.isPending
      ? 'Creating...'
      : 'Create Split'
    : 'Continue';

  useTelegramMainButton({
    text: mainButtonText,
    visible: true,
    loading: createSplit.isPending,
    disabled: !stepValid[step] || createSplit.isPending || (isLastStep && !creatorWalletAddress),
    onClick: useCallback(async () => {
      haptic.impactOccurred('medium');
      if (isLastStep) {
        await createSplit.mutateAsync();
      } else {
        setStep((s) => s + 1);
      }
    }, [isLastStep, createSplit, haptic]),
  });

  // ---------------------------------------------------------------------------
  // No wallet guard
  // ---------------------------------------------------------------------------

  if (!hasWallet && !creatorWalletAddress) {
    return (
      <NoWalletScreen
        icon={<Warning size={48} weight="fill" style={{ color: 'var(--color-warning)' }} />}
        message="Set up your TG wallet before creating a split."
        onBack={() => router.push('/tg/wallet/setup')}
        backLabel="Set Up Wallet"
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-32 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-display)' }}>
          Create Split
        </h1>
        {groupContext.chatTitle ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <UsersThree size={13} color="var(--color-primary)" />
            <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
              {groupContext.chatTitle}
            </p>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Split expenses with friends
          </p>
        )}
      </div>

      {/* Stepper */}
      <TgStepper currentStep={step} steps={STEPS} />

      {/* Error banner */}
      {createSplit.isError && (
        <div
          className="flex items-center gap-2 rounded-xl p-3 text-sm"
          style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
        >
          <Warning size={16} weight="bold" />
          <span>{createSplit.error instanceof Error ? createSplit.error.message : 'Failed to create split'}</span>
        </div>
      )}

      {/* ---- Step 0: Details ---- */}
      {step === 0 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Split Details
          </h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Split name *"
              placeholder="e.g. Dinner at Luigi's, Trip expenses..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* Category */}
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      haptic.impactOccurred('light');
                      setCategory(category === cat.value ? undefined : cat.value);
                    }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      backgroundColor: category === cat.value ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                      border: category === cat.value ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      color: category === cat.value ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Description (optional)
              </label>
              <textarea
                placeholder="What's this split for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-text-disabled)]"
                style={{
                  backgroundColor: 'var(--color-white-10)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              />
            </div>

            {/* Merchant (optional) */}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="mb-2 text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Storefront size={14} />
                Merchant (optional)
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="Restaurant, store, etc."
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  inputSize="sm"
                />
                {merchantName && (
                  <Input
                    placeholder="Address (optional)"
                    value={merchantAddress}
                    onChange={(e) => setMerchantAddress(e.target.value)}
                    inputSize="sm"
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Step 1: Amount ---- */}
      {step === 1 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Amount &amp; Split Method
          </h2>
          <div className="flex flex-col gap-4">
            {/* Amount input */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Total Amount (USDC) *
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full h-16 pl-10 pr-4 text-3xl font-bold rounded-[var(--radius-lg)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{
                    backgroundColor: 'var(--color-white-10)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-family-number)',
                  }}
                />
              </div>
            </div>

            {/* Split method toggle */}
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Split Method
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Equal */}
                <button
                  type="button"
                  onClick={() => {
                    haptic.impactOccurred('light');
                    setSplitMethod('equal');
                  }}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-4 transition-all"
                  style={{
                    backgroundColor: splitMethod === 'equal' ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                    border: splitMethod === 'equal' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  <Users
                    size={22}
                    weight={splitMethod === 'equal' ? 'fill' : 'regular'}
                    color={splitMethod === 'equal' ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: splitMethod === 'equal' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                  >
                    Equal Split
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Everyone pays the same
                  </span>
                </button>

                {/* Manual */}
                <button
                  type="button"
                  onClick={() => {
                    haptic.impactOccurred('light');
                    setSplitMethod('manual');
                  }}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-4 transition-all"
                  style={{
                    backgroundColor: splitMethod === 'manual' ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                    border: splitMethod === 'manual' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  }}
                >
                  <Receipt
                    size={22}
                    weight={splitMethod === 'manual' ? 'fill' : 'regular'}
                    color={splitMethod === 'manual' ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ color: splitMethod === 'manual' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                  >
                    Custom Split
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Set amounts manually
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Step 2: Participants ---- */}
      {step === 2 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Add Participants
          </h2>

          {/* Selected participants */}
          {participants.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {participants.map((p) => {
                const isInvalidWallet = !p.walletAddress || !isValidSolanaAddress(p.walletAddress);
                return (
                  <div
                    key={p.userId}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] p-3"
                    style={{
                      backgroundColor: isInvalidWallet ? 'var(--color-error-20)' : 'var(--color-white-5)',
                      border: `1px solid ${isInvalidWallet ? 'var(--color-error)' : 'var(--color-border)'}`,
                    }}
                  >
                    <Avatar fallback={p.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {p.name}
                      </span>
                      {isInvalidWallet ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-error)' }}>
                          <Warning size={12} />
                          No wallet
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {p.walletAddress.slice(0, 4)}...{p.walletAddress.slice(-4)}
                        </span>
                      )}
                    </div>

                    {/* Amount: inline input (manual) or computed display (equal) */}
                    {splitMethod === 'manual' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={p.amountOwed || ''}
                          onChange={(e) => updateParticipantAmount(p.userId, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 px-2 text-sm font-medium rounded-lg outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                          style={{
                            backgroundColor: 'var(--color-white-10)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font-family-number)',
                          }}
                        />
                      </div>
                    ) : (
                      <span
                        className="text-sm font-medium shrink-0"
                        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                      >
                        {formatCurrency(p.amountOwed, 'USDC')}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        haptic.impactOccurred('light');
                        setParticipants((prev) => prev.filter((p2) => p2.userId !== p.userId));
                      }}
                      className="p-1 rounded-full transition-colors active:bg-white/10"
                    >
                      <X size={16} color="var(--color-text-tertiary)" />
                    </button>
                  </div>
                );
              })}

              {/* Manual mismatch warning */}
              {splitMethod === 'manual' && !amountsMatch && (
                <div
                  className="flex items-center gap-2 rounded-lg p-3 text-xs"
                  style={{ backgroundColor: 'var(--color-warning-20)', color: 'var(--color-warning)' }}
                >
                  <Warning size={14} weight="bold" />
                  <span>
                    Total ({formatCurrency(totalOwed, 'USDC')}) ≠ split amount ({formatCurrency(parsedAmount, 'USDC')})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Group Members (shown when opened from a group) */}
          {filteredGroupMembers.length > 0 && (
            <div className="mb-4">
              <p
                className="mb-2 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <UsersThree size={13} />
                Group Members
              </p>
              <div className="flex flex-col gap-0.5">
                {filteredGroupMembers.map((member) => {
                  const uid = member.wesplit_user_id ?? `tg_${member.telegram_id}`;
                  const isSelected = !!participants.find((p) => p.userId === uid);
                  const hasAccount = !!member.wesplit_user_id;
                  const hasWalletAddr = !!member.wallet_address && isValidSolanaAddress(member.wallet_address);
                  const canSelect = hasAccount || true; // Allow selecting even without account; show warning on review

                  return (
                    <button
                      key={member.telegram_id}
                      type="button"
                      onClick={() => toggleGroupMember(member)}
                      className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 transition-colors active:bg-white/[0.05]"
                    >
                      <Avatar
                        fallback={member.telegram_first_name}
                        size="sm"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {member.telegram_first_name}
                          {member.telegram_username && (
                            <span style={{ color: 'var(--color-text-tertiary)' }}>
                              {' '}@{member.telegram_username}
                            </span>
                          )}
                        </span>
                        {!hasAccount && (
                          <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                            No WeSplit account
                          </span>
                        )}
                        {hasAccount && !hasWalletAddr && (
                          <span className="text-xs" style={{ color: 'var(--color-warning)' }}>
                            No wallet set up
                          </span>
                        )}
                      </div>
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                        style={{
                          backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                          border: isSelected ? 'none' : '1.5px solid var(--color-border)',
                        }}
                      >
                        {isSelected && <Check size={11} weight="bold" color="var(--color-bg)" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div
                className="mt-3 mb-1 h-px"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>
          )}

          {/* Search */}
          <Input
            placeholder="Search by name, email, or address..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            leftIcon={<MagnifyingGlass size={16} />}
          />

          {/* Contact list */}
          <div className="mt-3 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
            {displayContacts.length === 0 && debouncedSearch.length >= 2 && (
              <p className="py-4 text-center text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                No users found
              </p>
            )}
            {displayContacts.map((user) => {
              const isSelected = !!participants.find((p) => p.userId === user.id);
              const hasWalletAddress =
                (user.wallet_address && isValidSolanaAddress(user.wallet_address)) ||
                (user.web_wallet_address && isValidSolanaAddress(user.web_wallet_address)) ||
                (user.telegram_wallet_address && isValidSolanaAddress(user.telegram_wallet_address));

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleParticipant(user)}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 transition-colors active:bg-white/[0.05]"
                >
                  <Avatar fallback={user.name || user.email || '?'} size="sm" />
                  <div className="flex-1 text-left min-w-0">
                    <span className="block truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {user.name || user.email || user.id.slice(0, 12)}
                    </span>
                    {user.email && (
                      <span className="block truncate text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {user.email}
                      </span>
                    )}
                  </div>
                  {!hasWalletAddress && (
                    <Badge variant="warning" size="sm">No wallet</Badge>
                  )}
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                      border: isSelected ? 'none' : '1.5px solid var(--color-border)',
                    }}
                  >
                    {isSelected && <Check size={11} weight="bold" color="var(--color-bg)" />}
                  </div>
                </button>
              );
            })}
          </div>

          {participants.length === 0 && (
            <p className="mt-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              {filteredGroupMembers.length > 0
                ? 'Select group members or search for contacts'
                : 'Select contacts to add as participants'}
            </p>
          )}
        </Card>
      )}

      {/* ---- Step 3: Review ---- */}
      {step === 3 && (
        <Card>
          <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
            Review &amp; Create
          </h2>

          {/* Split preview card */}
          <div
            className="flex items-center gap-3 mb-5 p-3 rounded-[var(--radius-lg)]"
            style={{ backgroundColor: 'var(--color-white-5)' }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}
            >
              {CATEGORY_OPTIONS.find((c) => c.value === category)?.emoji ?? '💸'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                {title || 'Untitled Split'}
              </p>
              {description && (
                <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {description}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-xl font-bold"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
              >
                {formatCurrency(parsedAmount, 'USDC')}
              </p>
              <Badge variant="primary" size="sm">
                {splitMethod === 'equal' ? 'Equal' : 'Custom'}
              </Badge>
            </div>
          </div>

          {/* Summary rows */}
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {merchantName && (
              <div className="flex justify-between py-2.5">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Merchant</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {merchantName}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2.5">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Participants</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {participants.length}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Per person</span>
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
              >
                {splitMethod === 'equal' && participants.length > 0
                  ? formatCurrency(parsedAmount / participants.length, 'USDC')
                  : 'Varies'}
              </span>
            </div>
          </div>

          {/* Participant breakdown */}
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
              Breakdown
            </p>
            <div className="flex flex-col gap-2">
              {participants.map((p) => (
                <div key={p.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar fallback={p.name} size="xs" />
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{p.name}</span>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                  >
                    {formatCurrency(p.amountOwed, 'USDC')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {groupContext.chatTitle && (
            <div
              className="mt-3 flex items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2"
              style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}
            >
              <UsersThree size={14} color="var(--color-primary)" />
              <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                Linked to group: {groupContext.chatTitle}
              </span>
            </div>
          )}
          <p className="mt-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Participants will be notified to pay their share to your TG wallet.
          </p>
        </Card>
      )}

      {/* Fallback in-page nav — only renders when TG MainButton is NOT available
          (e.g. opening in a regular browser without TG SDK) */}
      {typeof window !== 'undefined' && !window.Telegram?.WebApp?.MainButton && (
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          )}
          <Button
            variant="primary"
            fullWidth
            disabled={!stepValid[step] || createSplit.isPending || (isLastStep && !creatorWalletAddress)}
            loading={createSplit.isPending}
            onClick={async () => {
              haptic.impactOccurred('medium');
              if (isLastStep) {
                await createSplit.mutateAsync();
              } else {
                setStep((s) => s + 1);
              }
            }}
          >
            {isLastStep ? 'Create Split' : 'Continue'}
          </Button>
        </div>
      )}
    </div>
  );
}
