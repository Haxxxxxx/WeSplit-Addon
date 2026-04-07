'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, Star, PaperPlaneTilt, HandCoins } from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonAvatar } from '@/components/ui/Skeleton';
import Link from 'next/link';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getRecentContacts } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import type { User } from '@/types';

export default function ContactsPage() {
  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Initialize favorites from user doc
  useEffect(() => {
    const stored = (currentUser as unknown as Record<string, unknown>)?.favorite_contact_ids
      ?? (currentUser as unknown as Record<string, unknown>)?.favoriteContactIds;
    if (Array.isArray(stored) && stored.length > 0) {
      setFavorites(new Set(stored as string[]));
    }
  }, [currentUser]);

  const filtered = contacts.filter((u) => {
    const name = u.name?.toLowerCase() ?? '';
    const handle = (u.email ?? u.wallet_address ?? '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || handle.includes(q);
  });

  const favoriteContacts = filtered.filter((u) => favorites.has(u.id));
  const otherContacts = filtered.filter((u) => !favorites.has(u.id));

  async function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Persist to Firestore (dual-format for mobile compat)
    if (userId) {
      const updatedFavs = favorites.has(id)
        ? [...favorites].filter((fId) => fId !== id)
        : [...favorites, id];
      await updateDoc(doc(db, 'users', userId), {
        favorite_contact_ids: updatedFavs,
        favoriteContactIds: updatedFavs,
      });
    }
  }

  function getHandle(user: User): string {
    if (user.email) return user.email;
    if (user.wallet_address) return user.wallet_address.slice(0, 8) + '...';
    return '';
  }

  function getSubtitle(user: User): string {
    if (user.wallet_address) {
      return user.wallet_address.slice(0, 6) + '...' + user.wallet_address.slice(-4);
    }
    return '';
  }

  function ContactCard({ user }: { user: User }) {
    const isFav = favorites.has(user.id);
    return (
      <div
        className="flex items-center gap-3 rounded-[var(--radius-xl)] p-4 transition-colors"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <Avatar fallback={user.name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold" style={{ color: 'var(--color-text)' }}>
              {user.name}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {getHandle(user)}
          </p>
          {getSubtitle(user) && (
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              {getSubtitle(user)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={`/send?to=${user.id}`}>
            <button
              type="button"
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              title="Send"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <PaperPlaneTilt size={16} />
            </button>
          </Link>
          <Link href={`/request?from=${user.id}`}>
            <button
              type="button"
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              title="Request"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <HandCoins size={16} />
            </button>
          </Link>
          <button
            type="button"
            onClick={() => toggleFavorite(user.id)}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            title={isFav ? 'Remove favorite' : 'Add favorite'}
          >
            <Star
              size={16}
              weight={isFav ? 'fill' : 'regular'}
              color={isFav ? 'var(--color-primary)' : 'var(--color-text-secondary)'}
            />
          </button>
        </div>
      </div>
    );
  }

  function SkeletonRow() {
    return (
      <div
        className="flex items-center gap-3 rounded-[var(--radius-xl)] p-4"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <SkeletonAvatar size={40} />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton height={14} width="40%" radius="sm" />
          <Skeleton height={12} width="60%" radius="sm" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton width={32} height={32} radius="md" />
          <Skeleton width={32} height={32} radius="md" />
          <Skeleton width={32} height={32} radius="md" />
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Contacts" subtitle="People you&apos;ve transacted with" />

      <div className="mb-5">
        <Input
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlass size={16} />}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {favoriteContacts.length > 0 && (
            <div>
              <h2
                className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <Star size={12} weight="fill" color="var(--color-primary)" /> Favorites
              </h2>
              <div className="flex flex-col gap-2">
                {favoriteContacts.map((u) => (
                  <ContactCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          {otherContacts.length > 0 && (
            <div>
              <h2
                className="mb-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                All Contacts
              </h2>
              <div className="flex flex-col gap-2">
                {otherContacts.map((u) => (
                  <ContactCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <PaperPlaneTilt size={40} color="var(--color-text-tertiary)" />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {search ? 'No contacts found' : 'No contacts yet'}
              </p>
              {!search && (
                <Link
                  href="/send"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors"
                  style={{ background: 'var(--color-primary)', color: 'var(--color-black)' }}
                >
                  Send to someone
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
