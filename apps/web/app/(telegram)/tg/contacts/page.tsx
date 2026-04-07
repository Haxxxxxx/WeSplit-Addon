'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  MagnifyingGlass,
  PaperPlaneTilt,
  AddressBook,
  Star,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { searchUsers, getUserContacts, updateContactFavorite } from '@/lib/firebase/queries';
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue';
import { PullToRefresh } from '@/components/telegram/PullToRefresh';
import { SkeletonListCard, SkeletonSearchBar } from '@/components/telegram/TelegramSkeletons';
import type { Contact } from '@/types';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Contact row — works for both Contact and User shapes
// ---------------------------------------------------------------------------

function ContactRow({
  id,
  name,
  email,
  walletAddress,
  isFavorite,
  onTap,
  onToggleFavorite,
}: {
  id: string;
  name: string;
  email?: string;
  walletAddress?: string;
  isFavorite?: boolean;
  onTap?: () => void;
  onToggleFavorite?: (id: string, current: boolean) => void;
}) {
  const truncatedAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/tg/users/${id}`} className="flex items-center gap-3 flex-1 min-w-0" onClick={onTap}>
        <Avatar fallback={name} size="md" />
        <div className="flex flex-1 flex-col min-w-0">
          <span className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
            {name}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {email || truncatedAddr}
          </span>
        </div>
      </Link>

      {/* Favorite star */}
      {onToggleFavorite && (
        <button
          type="button"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:opacity-60"
          onClick={() => onToggleFavorite(id, !!isFavorite)}
        >
          <Star
            size={16}
            weight={isFavorite ? 'fill' : 'regular'}
            color={isFavorite ? 'var(--color-warning)' : 'var(--color-text-disabled)'}
          />
        </button>
      )}

      {/* Send button */}
      <Link
        href={`/tg/send?to=${walletAddress ?? ''}&name=${encodeURIComponent(name)}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:opacity-70"
        style={{ backgroundColor: 'var(--color-primary-dim)' }}
        aria-label={`Send payment to ${name}`}
        onClick={onTap}
      >
        <PaperPlaneTilt size={14} weight="fill" color="var(--color-primary)" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium px-1" style={{ color: 'var(--color-text-tertiary)' }}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Contacts Page
// ---------------------------------------------------------------------------

export default function TelegramContactsPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  // Full contact list from contacts collection (has isFavorite)
  const { data: contacts = [], isLoading: loadingContacts, refetch } = useQuery({
    queryKey: ['userContacts', userId],
    queryFn: () => getUserContacts(userId!, 100),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Search results (User[] — no isFavorite, that's OK for search)
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['searchUsers', debouncedSearch, userId],
    queryFn: () => searchUsers(debouncedSearch, userId ?? undefined),
    enabled: debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const isSearchMode = debouncedSearch.length >= 2;
  const loading = loadingContacts && !isSearchMode;

  // Split contacts into favorites and the rest
  const favorites = contacts.filter((c) => c.isFavorite);
  const others = contacts.filter((c) => !c.isFavorite);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleToggleFavorite = useCallback(
    async (contactId: string, currentFav: boolean) => {
      haptic?.impactOccurred('light');

      // Optimistic update
      queryClient.setQueryData<Contact[]>(['userContacts', userId], (prev = []) =>
        prev.map((c) => (c.id === contactId ? { ...c, isFavorite: !currentFav } : c)),
      );

      try {
        await updateContactFavorite(contactId, !currentFav);
      } catch {
        // Revert on error
        queryClient.setQueryData<Contact[]>(['userContacts', userId], (prev = []) =>
          prev.map((c) => (c.id === contactId ? { ...c, isFavorite: currentFav } : c)),
        );
      }
    },
    [haptic, queryClient, userId],
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-24 animate-fade-in">
        {/* Header */}
        <TgPageHeader
          icon={<AddressBook size={20} weight="bold" color="var(--color-bg)" />}
          title="Contacts"
          subtitle={`${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
        />

        {/* Search */}
        <Input
          placeholder="Search by name, email, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlass size={16} />}
        />

        {isSearching && (
          <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Searching...
          </p>
        )}

        {/* Search results */}
        {isSearchMode && (
          <>
            {searchResults.length > 0 && (
              <SectionLabel>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</SectionLabel>
            )}
            {!isSearching && searchResults.length === 0 ? (
              <Card>
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <AddressBook size={36} color="var(--color-text-tertiary)" />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No users found</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    Try a different name, email, or wallet address
                  </p>
                </div>
              </Card>
            ) : searchResults.length > 0 ? (
              <Card>
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {searchResults.map((u: User) => (
                    <ContactRow
                      key={u.id}
                      id={u.id}
                      name={u.name}
                      email={u.email}
                      walletAddress={u.wallet_address}
                      onTap={() => haptic?.impactOccurred('light')}
                    />
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        )}

        {/* Regular contact list (not search mode) */}
        {!isSearchMode && (
          loading ? (
            <SkeletonListCard rows={5} title={false} />
          ) : contacts.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <AddressBook size={36} color="var(--color-text-tertiary)" />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No contacts yet</p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Your transaction contacts will appear here
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Favorites section */}
              {favorites.length > 0 && (
                <>
                  <SectionLabel>Favorites</SectionLabel>
                  <Card>
                    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {favorites.map((c) => (
                        <ContactRow
                          key={c.id}
                          id={c.id}
                          name={c.name}
                          email={c.email}
                          walletAddress={c.wallet_address}
                          isFavorite={c.isFavorite}
                          onTap={() => haptic?.impactOccurred('light')}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  </Card>
                </>
              )}

              {/* All contacts */}
              {others.length > 0 && (
                <>
                  <SectionLabel>
                    {favorites.length > 0 ? 'All contacts' : 'Recent contacts'}
                  </SectionLabel>
                  <Card>
                    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {others.map((c) => (
                        <ContactRow
                          key={c.id}
                          id={c.id}
                          name={c.name}
                          email={c.email}
                          walletAddress={c.wallet_address}
                          isFavorite={c.isFavorite}
                          onTap={() => haptic?.impactOccurred('light')}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  </Card>
                </>
              )}
            </>
          )
        )}
      </div>
    </PullToRefresh>
  );
}
