'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/providers';
import { formatAddress } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { updateUserProfile } from '@/lib/firebase/queries';
import { useAppStore } from '@/store';

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentUser = useAppStore((s) => s.user.currentUser);
  const updateUser = useAppStore((s) => s.updateUser);

  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || currentUser?.wallet_address || '';

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) throw new Error('User not authenticated');
      await updateUserProfile(currentUser.id, { name, email });
    },
    onSuccess: () => {
      updateUser({ name, email });
      queryClient.invalidateQueries({ queryKey: ['user', currentUser?.id] });
      toast({ title: 'Profile updated', variant: 'success' });
    },
    onError: (error) => {
      toast({ title: 'Update failed', description: error instanceof Error ? error.message : 'Please try again', variant: 'error' });
    },
  });

  const hasChanges = name !== (currentUser?.name || '') || email !== (currentUser?.email || '');

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Settings
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-md">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Edit Profile</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar
              src={user?.photoURL ?? currentUser?.avatar}
              fallback={currentUser?.name || user?.displayName || 'Me'}
              size="xl"
            />
            <button
              type="button"
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-end))' }}
              aria-label="Change avatar"
            >
              <Camera size={16} weight="fill" color="var(--color-bg)" />
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Tap to change profile photo</p>
        </div>

        {/* Profile fields */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Personal Info</h3>
          <div className="flex flex-col gap-4">
            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
        </Card>

        {/* Wallet info */}
        {walletAddress && (
          <Card>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Linked Wallet</h3>
            <div
              className="flex items-center justify-between rounded-[var(--radius-lg)] px-4 py-3"
              style={{ backgroundColor: 'var(--color-white-5)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
                <span className="font-mono text-sm" style={{ color: 'var(--color-text)' }}>
                  {formatAddress(walletAddress, { chars: 8 })}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Primary</span>
            </div>
          </Card>
        )}

        <Button
          variant="primary"
          fullWidth
          size="lg"
          loading={updateProfileMutation.isPending}
          onClick={() => updateProfileMutation.mutate()}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </div>
    </PageContainer>
  );
}
