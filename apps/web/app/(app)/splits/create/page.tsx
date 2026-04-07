'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Check,
  MagnifyingGlass,
  Users,
  Receipt,
  Storefront,
  ArrowLeft,
  Warning,
  Wallet,
} from '@phosphor-icons/react';
import { useToast } from '@/components/ui/Toast';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn, formatCurrency, isValidSolanaAddress, roundUsdcAmount } from '@/lib/utils';
import { Stepper } from '@/components/ui/Stepper';
import { useAppStore } from '@/store';
import { useCreateSplit } from '@/hooks';
import { searchUsers, getRecentContacts } from '@/lib/firebase/queries';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: 'food', label: 'Food', emoji: '🍔' },
  { value: 'trip', label: 'Trip', emoji: '✈️' },
  { value: 'home', label: 'Home', emoji: '🏠' },
  { value: 'event', label: 'Event', emoji: '🎉' },
  { value: 'rocket', label: 'Other', emoji: '🚀' },
] as const;

const STEPS = ['Details', 'Amount', 'Participants', 'Review'];

// ---------------------------------------------------------------------------
// Participant Type
// ---------------------------------------------------------------------------

interface ParticipantInput {
  userId: string;
  name: string;
  email?: string;
  walletAddress: string;
  amountOwed: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreateSplitPage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;
  const connectedWalletAddress = useAppStore((s) => s.wallet.address);

  // Resolve available wallet address (same logic as useCreateSplit)
  const creatorWalletAddress =
    connectedWalletAddress ||
    currentUser?.web_wallet_address ||
    currentUser?.wallet_address;

  const createSplit = useCreateSplit();

  const [step, setStep] = useState(0);

  // Step 1 — Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [merchantName, setMerchantName] = useState('');
  const [merchantAddress, setMerchantAddress] = useState('');

  // Step 2 — Amount
  const [totalAmount, setTotalAmount] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'manual'>('equal');

  // Step 3 — Participants
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch recent contacts for the member picker
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Search users when typing in the member search
  const { data: searchResults = [] } = useQuery({
    queryKey: ['userSearch', memberSearch],
    queryFn: () => searchUsers(memberSearch, userId),
    enabled: memberSearch.length >= 2,
    staleTime: 30_000,
  });

  // Merge recent contacts with search results (search takes priority)
  const displayContacts = memberSearch.length >= 2 ? searchResults : recentContacts;

  // Calculate equal amounts when participants or total changes
  const parsedAmount = parseFloat(totalAmount) || 0;

  // Auto-calculate equal split amounts
  useEffect(() => {
    if (splitMethod === 'equal' && participants.length > 0 && parsedAmount > 0) {
      const equalShare = roundUsdcAmount(parsedAmount / participants.length);
      setParticipants((prev) =>
        prev.map((p) => ({ ...p, amountOwed: equalShare }))
      );
    }
  }, [splitMethod, parsedAmount, participants.length]);

  // Total owed by participants
  const totalOwed = useMemo(
    () => roundUsdcAmount(participants.reduce((sum, p) => sum + (p.amountOwed || 0), 0)),
    [participants]
  );

  // Check if amounts match for manual splits
  const amountsMatch = splitMethod === 'equal' || Math.abs(totalOwed - parsedAmount) < 0.01;

  // Toggle participant selection
  function toggleParticipant(user: User) {
    const exists = participants.find((p) => p.userId === user.id);

    if (exists) {
      setParticipants((prev) => prev.filter((p) => p.userId !== user.id));
    } else {
      const equalShare = participants.length > 0 && parsedAmount > 0
        ? roundUsdcAmount(parsedAmount / (participants.length + 1))
        : 0;

      setParticipants((prev) => [
        ...prev,
        {
          userId: user.id,
          name: user.name || user.email || 'Unknown',
          email: user.email,
          walletAddress: user.wallet_address || user.web_wallet_address || user.telegram_wallet_address || '',
          amountOwed: splitMethod === 'equal' ? equalShare : 0,
        },
      ]);
    }
  }

  // Update participant amount (for manual splits)
  function updateParticipantAmount(userId: string, amount: number) {
    setParticipants((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, amountOwed: amount } : p))
    );
  }

  // Validation per step
  const stepValid = [
    // Step 1: Title required
    title.trim().length > 0,
    // Step 2: Amount required and positive
    parsedAmount > 0,
    // Step 3: At least one participant with valid wallet
    participants.length > 0 &&
    participants.every((p) => p.walletAddress && isValidSolanaAddress(p.walletAddress)) &&
    amountsMatch,
    // Step 4: Always valid if we got here
    true,
  ];

  // Handle creation
  async function handleCreate() {
    if (!userId || !currentUser) return;

    try {
      const result = await createSplit.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        totalAmount: parsedAmount,
        currency: 'USDC',
        category,
        splitMethod,
        participants: participants.map((p) => ({
          userId: p.userId,
          name: p.name,
          email: p.email,
          walletAddress: p.walletAddress,
          amountOwed: p.amountOwed,
        })),
        merchant: merchantName.trim()
          ? { name: merchantName.trim(), address: merchantAddress.trim() || undefined }
          : undefined,
      });

      toast({
        title: 'Split created!',
        description: `"${title}" has been created with ${participants.length} participant(s).`,
        variant: 'success',
      });

      // Navigate to the new split detail
      if (result.split?.id) {
        router.push(`/splits/${result.split.id}`);
      } else {
        router.push('/splits');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      console.error('[CreateSplit]', err);
      toast({
        title: 'Failed to create split',
        description: message,
        variant: 'error',
      });
    }
  }

  return (
    <PageContainer>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push('/splits')}
        className="mb-4 flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--color-text)]"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <ArrowLeft size={16} />
        Back to Splits
      </button>

      {/* Wallet connection guard */}
      {!creatorWalletAddress && (
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--color-warning-20)' }}
            >
              <Wallet size={20} color="var(--color-warning)" />
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                Wallet required
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                You need a connected Solana wallet to create a split. Participants will send
                their share to your wallet address.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={() => router.push('/settings')}
              >
                Connect Wallet
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stepper */}
      <Stepper currentStep={step} steps={STEPS} />

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Step 1 — Details */}
        {step === 0 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Split Details
            </h2>
            <div className="flex flex-col gap-5">
              <Input
                label="Split name *"
                placeholder="e.g. Dinner at Luigi's, Airbnb Vacation..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {/* Category picker */}
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Category
                </p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(category === cat.value ? undefined : cat.value)}
                      className={cn(
                        'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all'
                      )}
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
                    color: 'var(--color-text)'
                  }}
                />
              </div>

              {/* Merchant (optional, collapsible) */}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <p className="mb-3 text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  <Storefront size={16} />
                  Merchant (optional)
                </p>
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="Restaurant, Store, etc."
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

        {/* Step 2 — Amount */}
        {step === 1 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Amount & Split Method
            </h2>
            <div className="flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Total Amount (USDC) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
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

              {/* Split method */}
              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Split Method
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSplitMethod('equal')}
                    className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-4 transition-all"
                    style={{
                      backgroundColor: splitMethod === 'equal' ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                      border: splitMethod === 'equal' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    <Users
                      size={24}
                      weight={splitMethod === 'equal' ? 'fill' : 'regular'}
                      color={splitMethod === 'equal' ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: splitMethod === 'equal' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                    >
                      Equal Split
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Everyone pays the same
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSplitMethod('manual')}
                    className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-4 transition-all"
                    style={{
                      backgroundColor: splitMethod === 'manual' ? 'var(--color-primary-dim)' : 'var(--color-white-5)',
                      border: splitMethod === 'manual' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    <Receipt
                      size={24}
                      weight={splitMethod === 'manual' ? 'fill' : 'regular'}
                      color={splitMethod === 'manual' ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: splitMethod === 'manual' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                    >
                      Custom Split
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      Set amounts manually
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3 — Participants */}
        {step === 2 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
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
                            No wallet address
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {p.walletAddress.slice(0, 4)}...{p.walletAddress.slice(-4)}
                          </span>
                        )}
                      </div>

                      {/* Amount input for manual splits */}
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
                          className="text-sm font-medium"
                          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                        >
                          {formatCurrency(p.amountOwed, 'USDC')}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setParticipants((prev) => prev.filter((p2) => p2.userId !== p.userId))}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <X size={16} color="var(--color-text-tertiary)" />
                      </button>
                    </div>
                  );
                })}

                {/* Amount mismatch warning for manual splits */}
                {splitMethod === 'manual' && !amountsMatch && (
                  <div
                    className="flex items-center gap-2 rounded-lg p-3 text-sm"
                    style={{ backgroundColor: 'var(--color-warning-20)', color: 'var(--color-warning)' }}
                  >
                    <Warning size={16} weight="bold" />
                    <span>
                      Total amounts ({formatCurrency(totalOwed, 'USDC')}) don&apos;t match the split total ({formatCurrency(parsedAmount, 'USDC')})
                    </span>
                  </div>
                )}
              </div>
            )}

            <Input
              placeholder="Search by name, email, or wallet address..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              leftIcon={<MagnifyingGlass size={16} />}
            />

            <div className="mt-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
              {displayContacts.length === 0 && memberSearch.length >= 2 && (
                <p className="py-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No users found
                </p>
              )}
              {displayContacts.map((user) => {
                const isSelected = !!participants.find((p) => p.userId === user.id);
                const hasWallet = user.wallet_address && isValidSolanaAddress(user.wallet_address);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleParticipant(user)}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
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
                    {!hasWallet && (
                      <Badge variant="warning" size="sm">
                        No wallet
                      </Badge>
                    )}
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        border: isSelected ? 'none' : '1.5px solid var(--color-border)',
                      }}
                    >
                      {isSelected && <Check size={12} weight="bold" color="var(--color-bg)" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {participants.length === 0 && (
              <p className="mt-4 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                Select contacts to add as participants
              </p>
            )}
          </Card>
        )}

        {/* Step 4 — Review */}
        {step === 3 && (
          <Card>
            <h2 className="mb-5 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Review & Create
            </h2>

            {/* Split preview */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-[var(--radius-lg)]" style={{ backgroundColor: 'var(--color-white-5)' }}>
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
                style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}
              >
                {CATEGORY_OPTIONS.find((c) => c.value === category)?.emoji || '💸'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {title || 'Untitled Split'}
                </p>
                {description && (
                  <p className="text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
                >
                  {formatCurrency(parsedAmount, 'USDC')}
                </p>
                <Badge variant="primary" size="sm">
                  {splitMethod === 'equal' ? 'Equal split' : 'Custom split'}
                </Badge>
              </div>
            </div>

            {/* Summary */}
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {merchantName && (
                <div className="flex justify-between py-3">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Merchant</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {merchantName}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Participants</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {participants.length}
                </span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Amount per person</span>
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
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="mb-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Participant Breakdown
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

            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Participants will receive notifications to pay their share to your wallet.
            </p>
          </Card>
        )}

        {/* Nav buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            fullWidth
            disabled={!stepValid[step] || (step === STEPS.length - 1 && !creatorWalletAddress)}
            loading={createSplit.isPending}
            onClick={async () => {
              if (step < STEPS.length - 1) {
                setStep((s) => s + 1);
              } else {
                await handleCreate();
              }
            }}
          >
            {step === STEPS.length - 1 ? 'Create Split' : 'Continue'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
