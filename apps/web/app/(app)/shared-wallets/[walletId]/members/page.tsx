'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, DotsThree, Crown, Shield, User } from '@phosphor-icons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAppStore } from '@/store';
import {
  getSharedWalletById,
  removeMemberFromWallet
} from '@/lib/firebase/queries';
import { formatDate } from '@/lib/utils';

const ROLE_ICONS = {
  creator: <Crown size={14} weight="fill" color="var(--color-primary)" />,
  admin: <Shield size={14} weight="fill" color="var(--color-info)" />,
  member: <User size={14} color="var(--color-text-secondary)" />,
};

export default function MembersPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user.currentUser?.id);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Fetch wallet data
  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
  });

  // Check current user's role
  const currentMember = wallet?.members.find(
    (m) => m.user_id === userId || m.userId === userId
  );
  const canInviteMembers = currentMember?.permissions?.canInviteMembers || false;
  const canRemoveMembers = currentMember?.permissions?.canRemoveMembers || false;

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: string) => removeMemberFromWallet(walletId, memberUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedWallet', walletId] });
      toast({ title: 'Member removed', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Failed to remove member',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error'
      });
    },
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="flex flex-col gap-5 max-w-lg">
          <div className="h-8 w-32 rounded bg-white/10 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <Card key={i} padding="sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (error || !wallet) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>
            {error instanceof Error ? error.message : 'Wallet not found'}
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        {canInviteMembers && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} weight="bold" />}
            onClick={() => setShowInvite((v) => !v)}
          >
            Invite
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Members</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{wallet.members.length} members</p>
        </div>

        {/* Invite form */}
        {showInvite && (
          <Card>
            <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Invite Member</h3>
            <div className="flex gap-3">
              <Input
                placeholder="Email or wallet address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button variant="primary" disabled={!inviteEmail} onClick={() => {
                toast({
                  title: 'Feature coming soon',
                  description: 'Member invitations will be available soon',
                  variant: 'info'
                });
                setInviteEmail('');
                setShowInvite(false);
              }}>Send</Button>
            </div>
          </Card>
        )}

        {/* Member list */}
        <div className="flex flex-col gap-3">
          {wallet.members.map((member) => {
            const memberId = member.user_id || member.userId || '';
            const isCurrentUser = memberId === userId;
            const isCreator = member.role === 'creator';
            const displayName = member.name || 'Unknown';
            const joinedAt = member.joined_at || member.joinedAt || '';

            return (
              <Card key={memberId} padding="sm">
                <div className="flex items-center gap-3">
                  <Avatar fallback={displayName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {displayName}{isCurrentUser ? ' (You)' : ''}
                      </span>
                      {ROLE_ICONS[member.role as keyof typeof ROLE_ICONS]}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Joined {formatDate(joinedAt, { format: 'relative' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={member.role === 'creator' ? 'primary' : member.role === 'admin' ? 'info' : 'default'}
                      size="sm"
                    >
                      {member.role}
                    </Badge>
                    {!isCreator && canRemoveMembers && !isCurrentUser && (
                      <button
                        type="button"
                        className="rounded p-1 transition-colors hover:bg-white/10"
                        style={{ color: 'var(--color-text-secondary)' }}
                        aria-label="More options"
                        onClick={() => {
                          if (confirm(`Remove ${displayName} from this wallet?`)) {
                            removeMemberMutation.mutate(memberId);
                          }
                        }}
                      >
                        <DotsThree size={18} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions summary */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {member.permissions?.canInviteMembers && (
                    <Badge variant="default" size="sm">Invite</Badge>
                  )}
                  {member.permissions?.canRemoveMembers && (
                    <Badge variant="default" size="sm">Remove members</Badge>
                  )}
                  {member.permissions?.canWithdraw && (
                    <Badge variant="default" size="sm">Withdraw</Badge>
                  )}
                  {member.permissions?.canFund && (
                    <Badge variant="default" size="sm">Fund</Badge>
                  )}
                  {member.permissions?.canManageSettings && (
                    <Badge variant="default" size="sm">Manage settings</Badge>
                  )}
                  {member.permissions?.canViewTransactions && (
                    <Badge variant="default" size="sm">View transactions</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
