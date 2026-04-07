'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MagnifyingGlass,
  Plus,
  X,
  HandCoins,
  Clock,
  CheckCircle,
  XCircle,
  PaperPlaneTilt,
  CaretRight,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, HeroCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getRecentContacts } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  useReceivedPaymentRequests,
  useSentPaymentRequests,
  useCreatePaymentRequest,
  usePendingRequestsCount,
} from '@/hooks';
import type { User, PaymentRequestStatus } from '@/types';
import type { PaymentRequest } from '@/lib/services/paymentRequestService';

// ---------------------------------------------------------------------------
// Status Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PaymentRequestStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  accepted: { label: 'Accepted', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'error', icon: XCircle },
  cancelled: { label: 'Cancelled', variant: 'default', icon: XCircle },
};

function getStatusConfig(status: PaymentRequestStatus) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// ---------------------------------------------------------------------------
// Tabs Configuration
// ---------------------------------------------------------------------------

const REQUEST_TABS = [
  { value: 'create', label: 'Create', icon: <Plus size={15} /> },
  { value: 'received', label: 'Received', icon: <HandCoins size={15} /> },
  { value: 'sent', label: 'Sent', icon: <PaperPlaneTilt size={15} /> },
];

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function RequestRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton width={40} height={40} radius="full" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton width="50%" height={14} radius="sm" />
        <Skeleton width="30%" height={12} radius="sm" />
      </div>
      <Skeleton width={70} height={20} radius="full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request Row Component
// ---------------------------------------------------------------------------

interface RequestRowProps {
  request: PaymentRequest;
  type: 'sent' | 'received';
}

function RequestRow({ request, type }: RequestRowProps) {
  const { label, variant, icon: StatusIcon } = getStatusConfig(request.status);
  const name = type === 'sent' ? request.recipientName : request.senderName;

  return (
    <Link
      href={`/request/${request.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] border-b border-[var(--color-border)] last:border-b-0"
    >
      <Avatar fallback={name?.charAt(0) || '?'} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {type === 'sent' ? `To ${name}` : `From ${name}`}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {formatDate(request.created_at, { format: 'relative' })}
          </span>
          {request.description && (
            <>
              <span style={{ color: 'var(--color-text-disabled)' }}>•</span>
              <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                {request.description}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount and status */}
      <div className="flex flex-col items-end gap-1">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-family-number)' }}
        >
          {formatCurrency(request.amount, 'USDC')}
        </span>
        <Badge variant={variant} size="sm" leftIcon={<StatusIcon size={10} weight="bold" />}>
          {label}
        </Badge>
      </div>

      <CaretRight size={16} color="var(--color-text-tertiary)" className="shrink-0 ml-1" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Create Request Form
// ---------------------------------------------------------------------------

function CreateRequestForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const currentUser = useAppStore((s) => s.user.currentUser);
  const userId = currentUser?.id;

  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || currentUser?.wallet_address || '';

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getRecentContacts(userId!, 20),
    enabled: !!userId,
  });

  // Pre-populate recipient from ?from= query param (set by contacts page "Request" link)
  const fromId = searchParams.get('from');
  useEffect(() => {
    if (fromId && contacts.length > 0 && !selected) {
      const match = contacts.find((c) => c.id === fromId);
      if (match) setSelected(match);
    }
  }, [fromId, contacts, selected]);

  const createRequest = useCreatePaymentRequest();

  const filtered = contacts.filter(
    (c) =>
      c.id !== selected?.id &&
      ((c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  const canSend = selected && amount && parseFloat(amount) > 0 && userId;

  async function handleSendRequest() {
    if (!canSend || !selected) return;
    try {
      await createRequest.mutateAsync({
        recipientId: selected.id,
        amount: parseFloat(amount),
        description: note || undefined,
      });
      toast({
        title: 'Request sent!',
        description: `${formatCurrency(parseFloat(amount), 'USDC')} requested from ${selected.name}`,
        variant: 'success',
      });
      // Reset form
      setSelected(null);
      setAmount('');
      setNote('');
    } catch (error) {
      toast({
        title: 'Request failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'error',
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Amount input */}
      <HeroCard className="p-6">
        <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          Amount to Request
        </p>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-medium" style={{ color: 'var(--color-text-secondary)' }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent font-bold outline-none placeholder:text-[var(--color-text-disabled)]"
            style={{
              fontFamily: 'var(--font-family-number)',
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-balance)',
            }}
          />
          <Badge variant="primary" size="sm">USDC</Badge>
        </div>
      </HeroCard>

      {/* Recipient selection */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          Request From
        </h3>

        {/* Selected contact */}
        {selected && (
          <div
            className="flex items-center gap-3 mb-4 p-3 rounded-[var(--radius-lg)]"
            style={{ backgroundColor: 'var(--color-primary-dim)', border: '1px solid var(--color-primary)' }}
          >
            <Avatar src={selected.avatar} fallback={selected.name} size="sm" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selected.name}</span>
              {selected.email && (
                <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{selected.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="p-1 rounded-full transition-colors hover:bg-white/10"
              style={{ color: 'var(--color-primary)' }}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        )}

        {!selected && (
          <>
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<MagnifyingGlass size={16} />}
            />

            <div className="mt-3 flex flex-col gap-0.5 max-h-[250px] overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton width={32} height={32} radius="full" />
                    <div className="flex-1 flex flex-col gap-1">
                      <Skeleton width={100} height={14} radius="sm" />
                      <Skeleton width={140} height={12} radius="sm" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {search ? 'No contacts found' : 'No recent contacts'}
                  </p>
                </div>
              ) : (
                filtered.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setSearch('');
                    }}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <Avatar src={c.avatar} fallback={c.name} size="sm" />
                    <div className="flex flex-1 flex-col min-w-0">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{c.name}</span>
                      <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{c.email}</span>
                    </div>
                    <Plus size={16} color="var(--color-primary)" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </Card>

      {/* Note */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
          Note (optional)
        </h3>
        <textarea
          placeholder="What's this for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
          style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />
      </Card>

      <Button
        variant="primary"
        fullWidth
        size="lg"
        disabled={!canSend}
        loading={createRequest.isPending}
        onClick={handleSendRequest}
        leftIcon={<HandCoins size={20} weight="fill" />}
      >
        Send Request
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Received Requests List
// ---------------------------------------------------------------------------

function ReceivedRequestsList() {
  const { requests, isLoading, error } = useReceivedPaymentRequests({ pendingOnly: false });

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );
  const otherRequests = useMemo(
    () => requests.filter((r) => r.status !== 'pending'),
    [requests]
  );

  if (isLoading) {
    return (
      <Card padding="none">
        {Array.from({ length: 3 }).map((_, i) => (
          <RequestRowSkeleton key={i} />
        ))}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-8">
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>
          Failed to load requests
        </p>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="text-center py-12">
        <HandCoins size={40} color="var(--color-text-tertiary)" className="mx-auto mb-3" />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          No payment requests
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Requests from others will appear here
        </p>
        <Link href="/request?tab=sent">
          <Button size="sm" variant="primary">Request Payment</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pending requests - highlighted */}
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-warning)' }}>
            Pending ({pendingRequests.length})
          </h3>
          <Card padding="none" className="ring-1 ring-[var(--color-warning)]">
            {pendingRequests.map((request) => (
              <RequestRow key={request.id} request={request} type="received" />
            ))}
          </Card>
        </div>
      )}

      {/* Other requests */}
      {otherRequests.length > 0 && (
        <div>
          {pendingRequests.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Past Requests
            </h3>
          )}
          <Card padding="none">
            {otherRequests.map((request) => (
              <RequestRow key={request.id} request={request} type="received" />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sent Requests List
// ---------------------------------------------------------------------------

function SentRequestsList() {
  const { requests, isLoading, error } = useSentPaymentRequests();

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending'),
    [requests]
  );
  const otherRequests = useMemo(
    () => requests.filter((r) => r.status !== 'pending'),
    [requests]
  );

  if (isLoading) {
    return (
      <Card padding="none">
        {Array.from({ length: 3 }).map((_, i) => (
          <RequestRowSkeleton key={i} />
        ))}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-8">
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>
          Failed to load requests
        </p>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card className="text-center py-12">
        <PaperPlaneTilt size={40} color="var(--color-text-tertiary)" className="mx-auto mb-3" />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          No sent requests
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Requests you send will appear here
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-warning)' }}>
            Awaiting Payment ({pendingRequests.length})
          </h3>
          <Card padding="none">
            {pendingRequests.map((request) => (
              <RequestRow key={request.id} request={request} type="sent" />
            ))}
          </Card>
        </div>
      )}

      {/* Other requests */}
      {otherRequests.length > 0 && (
        <div>
          {pendingRequests.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Past Requests
            </h3>
          )}
          <Card padding="none">
            {otherRequests.map((request) => (
              <RequestRow key={request.id} request={request} type="sent" />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function RequestPage() {
  const { count: pendingCount } = usePendingRequestsCount();

  return (
    <PageContainer>
      <PageHeader
        title="Payment Requests"
        subtitle="Request money or view pending requests"
      />

      <div className="max-w-lg">
        <Tabs
          items={REQUEST_TABS.map((tab) => ({
            ...tab,
            // Add badge for received tab if there are pending requests
            label: tab.value === 'received' && pendingCount > 0
              ? `${tab.label} (${pendingCount})`
              : tab.label,
          }))}
          defaultValue="create"
        >
          <TabPanel value="create" className="mt-5">
            <CreateRequestForm />
          </TabPanel>

          <TabPanel value="received" className="mt-5">
            <ReceivedRequestsList />
          </TabPanel>

          <TabPanel value="sent" className="mt-5">
            <SentRequestsList />
          </TabPanel>
        </Tabs>
      </div>
    </PageContainer>
  );
}
