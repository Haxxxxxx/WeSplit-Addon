'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlass,
  Plus,
  X,
  HandCoins,
  CheckCircle,
  PaperPlaneTilt,
  Tray,
  ArrowRight,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
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
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useAppStore } from '@/store';
import {
  searchUsers,
  getRecentContacts,
  createPaymentRequest,
  getSentPaymentRequests,
  getReceivedPaymentRequests,
} from '@/lib/firebase/queries';
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue';
import { useTgBrandColors } from '@/lib/telegram/useTgBrandColors';
import { RequestSkeleton } from '@/components/telegram/TelegramSkeletons';
import { sanitizeAmountInput, dismissKeyboard, formatCurrency, formatDate, toDate } from '@/lib/utils';
import type { User, PaymentRequest } from '@/types';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'create' | 'sent' | 'received';

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <Badge variant="warning" size="sm">Pending</Badge>;
  if (status === 'accepted') return <Badge variant="success" size="sm">Accepted</Badge>;
  if (status === 'rejected') return <Badge variant="error" size="sm">Rejected</Badge>;
  if (status === 'cancelled') return <Badge variant="default" size="sm">Cancelled</Badge>;
  if (status === 'expired') return <Badge variant="default" size="sm">Expired</Badge>;
  return <Badge variant="default" size="sm">{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Request list item
// ---------------------------------------------------------------------------

function RequestItem({ req, userId }: { req: PaymentRequest; userId: string }) {
  const isSent = (req.from_user ?? req.senderId) === userId;
  const otherName = isSent
    ? (req.to_users?.length ? `${req.to_users.length} recipient${req.to_users.length > 1 ? 's' : ''}` : 'Unknown')
    : (req.from_name ?? req.senderName ?? 'Someone');
  const amount = req.amount_per_person ?? req.amount;

  return (
    <Link href={`/tg/request/${req.id}`}>
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-3 transition-colors active:bg-white/[0.05]">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: isSent ? 'var(--color-info-20, rgba(33,150,243,0.15))' : 'var(--color-primary-dim)',
          }}
        >
          {isSent
            ? <PaperPlaneTilt size={16} color="var(--color-info)" />
            : <Tray size={16} color="var(--color-primary)" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
            {isSent ? `To ${otherName}` : `From ${otherName}`}
          </p>
          {req.note && (
            <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
              {req.note}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {formatDate(toDate(req.created_at ?? req.createdAt ?? null))}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
          >
            {formatCurrency(amount, 'USDC')}
          </span>
          <StatusBadge status={req.status} />
        </div>
        <ArrowRight size={14} color="var(--color-text-tertiary)" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'create', label: 'New', icon: Plus },
    { id: 'sent', label: 'Sent', icon: PaperPlaneTilt },
    { id: 'received', label: 'Received', icon: Tray },
  ];

  return (
    <div
      className="flex rounded-xl p-1 gap-1"
      style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
          style={{
            backgroundColor: active === id ? 'var(--color-surface)' : 'transparent',
            color: active === id ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
            boxShadow: active === id ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <Icon size={13} weight={active === id ? 'fill' : 'regular'} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TelegramRequestPage() {
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const queryClient = useQueryClient();
  const { address: walletAddress, hasWallet } = useTgWallet();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const userName = useAppStore((s) => s.user.currentUser?.name);
  const loading = !userId;

  const [tab, setTab] = useState<Tab>('create');

  // Create tab state
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Recent contacts
  const { data: recentContacts = [] } = useQuery({
    queryKey: ['recentContacts', userId],
    queryFn: () => getRecentContacts(userId!, 10),
    enabled: !!userId && tab === 'create',
    staleTime: 60_000,
  });

  // Search results
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['searchUsers', debouncedSearch, userId],
    queryFn: () => searchUsers(debouncedSearch, userId ?? undefined),
    enabled: debouncedSearch.length >= 2 && tab === 'create',
    staleTime: 10_000,
  });

  // Sent requests
  const { data: sentRequests = [], isLoading: loadingSent } = useQuery({
    queryKey: ['sentPaymentRequests', userId],
    queryFn: () => getSentPaymentRequests(userId!),
    enabled: !!userId && tab === 'sent',
    staleTime: 30_000,
  });

  // Received requests
  const { data: receivedRequests = [], isLoading: loadingReceived } = useQuery({
    queryKey: ['receivedPaymentRequests', userId],
    queryFn: () => getReceivedPaymentRequests(userId!),
    enabled: !!userId && tab === 'received',
    staleTime: 30_000,
  });

  const displayContacts = debouncedSearch.length >= 2 ? searchResults : recentContacts;
  const filtered = displayContacts.filter((c) => !selected.find((s) => s.id === c.id));

  function toggleContact(c: User) {
    haptic?.selectionChanged();
    setSelected((prev) =>
      prev.find((s) => s.id === c.id) ? prev.filter((s) => s.id !== c.id) : [...prev, c],
    );
    setSearch('');
  }

  function removeContact(id: string) {
    haptic?.selectionChanged();
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  const numAmount = parseFloat(amount) || 0;
  const canSend = selected.length > 0 && numAmount > 0 && hasWallet;

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const handleSend = useCallback(async () => {
    if (!canSend || sending || !userId || !walletAddress) return;
    setSending(true);
    setError(null);
    haptic?.impactOccurred('medium');

    try {
      await createPaymentRequest({
        fromUserId: userId,
        fromName: userName ?? 'Unknown',
        fromWallet: walletAddress,
        toUserIds: selected.map((s) => s.id),
        amount: numAmount,
        note: note.trim() || undefined,
      });

      haptic?.notificationOccurred('success');
      queryClient.invalidateQueries({ queryKey: ['sentPaymentRequests', userId] });
      queryClient.invalidateQueries({ queryKey: ['recentContacts', userId] });
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      setError(msg);
      haptic?.notificationOccurred('error');
    } finally {
      setSending(false);
    }
  }, [canSend, sending, userId, walletAddress, userName, selected, numAmount, note, haptic, queryClient]);

  const brandColors = useTgBrandColors();

  useTelegramMainButton({
    text: sending
      ? 'Sending...'
      : `Request${amount ? ` $${amount}` : ''}${selected.length > 1 ? ` from ${selected.length}` : ''}`,
    onClick: handleSend,
    visible: tab === 'create' && canSend && !loading && !success,
    loading: sending,
    disabled: !canSend || sending,
    color: brandColors.color,
    textColor: brandColors.textColor,
  });

  if (loading) return <RequestSkeleton />;

  if (success && tab === 'create') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--color-success-20)' }}
        >
          <CheckCircle size={36} weight="fill" color="var(--color-success)" />
        </div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
          Request Sent!
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Requested ${numAmount.toFixed(2)} USDC from {selected.length}{' '}
          {selected.length === 1 ? 'person' : 'people'}
        </p>
        <div className="flex gap-3 w-full mt-2">
          <Button
            onClick={() => {
              setSuccess(false);
              setSelected([]);
              setAmount('');
              setNote('');
              setTab('sent');
            }}
            variant="secondary"
            fullWidth
          >
            View Sent
          </Button>
          <Button onClick={() => goBack()} variant="primary" fullWidth>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Header */}
      <TgPageHeader
        icon={<HandCoins size={20} weight="bold" color="var(--color-bg)" />}
        title="Requests"
        subtitle="Payment requests"
      />

      {/* Tabs */}
      <TabBar active={tab} onChange={(t) => { haptic?.selectionChanged(); setTab(t); }} />

      {/* ---- Create tab ---- */}
      {tab === 'create' && (
        <>
          {error && (
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}
            >
              <span className="text-sm flex-1">{error}</span>
              <Button size="sm" variant="ghost" onClick={handleSend} style={{ color: 'var(--color-error)' }}>
                Retry
              </Button>
            </div>
          )}

          {/* Amount */}
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
                onChange={(e) => {
                  const v = sanitizeAmountInput(e.target.value);
                  if (v !== null) setAmount(v);
                }}
                min={0}
                className="pl-8 font-medium"
                style={{ fontFamily: 'var(--font-family-number)', fontSize: 'var(--font-size-big-number)' }}
              />
            </div>
            {selected.length > 1 && numAmount > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Each person: ${(numAmount / selected.length).toFixed(2)} USDC
              </p>
            )}
          </Card>

          {/* Contact selection */}
          <Card>
            <label className="block mb-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Request from
            </label>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selected.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                    style={{
                      backgroundColor: 'var(--color-primary-dim)',
                      border: '1px solid var(--color-primary)',
                    }}
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
                      {c.email ||
                        (c.wallet_address
                          ? `${c.wallet_address.slice(0, 6)}...${c.wallet_address.slice(-4)}`
                          : '')}
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

          {/* Note */}
          <Card>
            <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Note (optional)
            </label>
            <textarea
              placeholder="What's this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
              style={{
                backgroundColor: 'var(--color-white-10)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </Card>

          {canSend && (
            <Button onClick={handleSend} loading={sending} fullWidth className="tg-hide">
              Send Request{selected.length > 1 ? ` to ${selected.length} people` : ''}
            </Button>
          )}
        </>
      )}

      {/* ---- Sent tab ---- */}
      {tab === 'sent' && (
        <Card>
          {loadingSent ? (
            <div className="flex flex-col gap-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
              ))}
            </div>
          ) : sentRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <PaperPlaneTilt size={32} color="var(--color-text-disabled)" />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                No sent requests
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Requests you send will appear here
              </p>
              <Button size="sm" variant="secondary" onClick={() => setTab('create')}>
                Create Request
              </Button>
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {sentRequests.map((req) => (
                <RequestItem key={req.id} req={req} userId={userId!} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---- Received tab ---- */}
      {tab === 'received' && (
        <Card>
          {loadingReceived ? (
            <div className="flex flex-col gap-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
              ))}
            </div>
          ) : receivedRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Tray size={32} color="var(--color-text-disabled)" />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                No received requests
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                When someone requests money from you, it shows here
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {receivedRequests.map((req) => (
                <RequestItem key={req.id} req={req} userId={userId!} />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
