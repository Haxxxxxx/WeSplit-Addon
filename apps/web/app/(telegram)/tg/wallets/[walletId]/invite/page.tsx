'use client';

import { use, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, Plus, X, UserPlus, Check, ShieldWarning } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { SuccessScreen } from '@/components/telegram/SuccessScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import {
  useTelegramBackButton,
  useTelegramMainButton,
  useTelegramHaptic,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { useSharedWalletDetail } from '@/hooks';
import {
  searchUsers,
  getRecentContacts,
  inviteMembersToWallet,
} from '@/lib/firebase/queries';
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Invite Members Page
// ---------------------------------------------------------------------------

export default function TelegramInviteMembersPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);

  const { wallet, isLoading: walletLoading } = useSharedWalletDetail(walletId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Existing member IDs to exclude from search
  const existingMemberIds = useMemo(() => {
    if (!wallet?.members) return new Set<string>();
    return new Set(wallet.members.map((m) => m.user_id || m.userId));
  }, [wallet]);

  // Recent contacts
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['recentContacts', userId],
    queryFn: () => getRecentContacts(userId!, 10),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Search results
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['searchUsers', debouncedSearch, userId],
    queryFn: () => searchUsers(debouncedSearch, userId ?? undefined),
    enabled: debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const displayContacts = debouncedSearch.length >= 2 ? searchResults : recentContacts;

  // Filter out already-selected and existing members
  const filtered = displayContacts.filter(
    (c) =>
      !selected.find((s) => s.id === c.id) &&
      !existingMemberIds.has(c.id),
  );

  function toggleContact(c: User) {
    haptic?.selectionChanged();
    setSelected((prev) =>
      prev.find((s) => s.id === c.id)
        ? prev.filter((s) => s.id !== c.id)
        : [...prev, c],
    );
    setSearch('');
  }

  function removeContact(id: string) {
    haptic?.selectionChanged();
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const handleInvite = useCallback(async () => {
    if (selected.length === 0 || sending || !userId || !userName) return;
    setSending(true);
    setError(null);
    haptic?.impactOccurred('medium');

    try {
      await inviteMembersToWallet(
        walletId,
        userId,
        userName,
        selected.map((s) => ({
          userId: s.id,
          name: s.name,
          email: s.email,
          walletAddress: s.wallet_address,
        })),
      );

      haptic?.notificationOccurred('success');
      setSuccess(true);
      setTimeout(() => goBack(`/tg/wallets/${walletId}`), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to invite members';
      setError(msg);
      haptic?.notificationOccurred('error');
    } finally {
      setSending(false);
    }
  }, [selected, sending, userId, userName, walletId, haptic, goBack]);

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: sending
      ? 'Inviting...'
      : `Invite${selected.length > 0 ? ` ${selected.length} member${selected.length > 1 ? 's' : ''}` : ''}`,
    onClick: handleInvite,
    visible: selected.length > 0 && !success,
    loading: sending,
    disabled: selected.length === 0 || sending,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  // Loading state
  if (walletLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
      </div>
    );
  }

  // Permission check
  if (wallet) {
    const member = wallet.members?.find((m) => m.user_id === userId);
    const isCreator = wallet.creator_id === userId;
    const canInvite = isCreator || member?.permissions?.canInviteMembers;
    if (!canInvite) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
          <ShieldWarning size={48} style={{ color: 'var(--color-error)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Access Denied
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You don&apos;t have permission to invite members to this wallet.
          </p>
          <Button onClick={() => goBack(`/tg/wallets/${walletId}`)} variant="outline">
            Back to Wallet
          </Button>
        </div>
      );
    }
  }

  if (success) {
    return (
      <SuccessScreen
        title="Members Invited!"
        message={`${selected.length} member${selected.length > 1 ? 's' : ''} added to ${wallet?.name ?? 'the wallet'}`}
        onDone={() => goBack(`/tg/wallets/${walletId}`)}
        doneLabel="Back to Wallet"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<UserPlus size={20} weight="fill" color="var(--color-bg)" />}
        title="Invite Members"
        subtitle={wallet?.name ?? 'Shared Wallet'}
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      <Card>
        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                  {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeContact(c.id)}
                  style={{ color: 'var(--color-primary)' }}
                  aria-label={`Remove ${c.name}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Input
          placeholder="Search by name, email, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlass size={16} />}
        />

        {debouncedSearch.length < 2 && recentContacts.length > 0 && (
          <p className="mt-3 mb-1 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            Recent contacts
          </p>
        )}

        {isSearching && (
          <p className="mt-3 text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Searching...
          </p>
        )}

        <div className="mt-1 flex flex-col gap-0.5">
          {filtered.slice(0, 8).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleContact(c)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/[0.05]"
            >
              <Avatar fallback={c.name} size="sm" />
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                  {c.name}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {c.email || (c.wallet_address ? `${c.wallet_address.slice(0, 6)}...${c.wallet_address.slice(-4)}` : '')}
                </span>
              </div>
              <Plus size={16} color="var(--color-primary)" />
            </button>
          ))}
          {debouncedSearch.length >= 2 && !isSearching && filtered.length === 0 && (
            <p className="py-4 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              No users found
            </p>
          )}
        </div>
      </Card>

      {/* Fallback button */}
      {selected.length > 0 && (
        <Button onClick={handleInvite} loading={sending} fullWidth className="tg-hide">
          Invite {selected.length} member{selected.length > 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
