'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, WarningOctagon } from '@phosphor-icons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useAppStore } from '@/store';
import {
  getSharedWalletById,
  updateSharedWalletInfo,
  updateSharedWalletSettings
} from '@/lib/firebase/queries';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SharedWalletSettingsPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.user.currentUser?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [withdrawLimit, setWithdrawLimit] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);

  // Fetch wallet data
  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
  });

  // Initialize form state from fetched wallet data
  useEffect(() => {
    if (wallet) {
      setName(wallet.name || '');
      setDescription(wallet.description || '');
      setWithdrawLimit(wallet.settings?.perTransactionLimit?.toString() || '0');
      setDailyLimit(wallet.settings?.dailyWithdrawalLimit?.toString() || '0');
      setRequireApproval(wallet.settings?.requireApprovalForWithdrawals || false);
    }
  }, [wallet]);

  // Check if current user is creator or admin
  const currentMember = wallet?.members.find(
    (m) => m.user_id === userId || m.userId === userId
  );
  const canManageSettings = currentMember?.role === 'creator' || currentMember?.role === 'admin';

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update wallet info (name, description)
      await updateSharedWalletInfo(walletId, {
        name: name.trim(),
        description: description.trim(),
      });

      // Update settings (limits, approval)
      await updateSharedWalletSettings(walletId, {
        perTransactionLimit: parseFloat(withdrawLimit) || 0,
        dailyWithdrawalLimit: parseFloat(dailyLimit) || 0,
        requireApprovalForWithdrawals: requireApproval,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedWallet', walletId] });
      toast({ title: 'Settings saved', variant: 'success' });
    },
    onError: (err) => {
      toast({
        title: 'Failed to save settings',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error'
      });
    },
  });

  // Archive wallet
  const archiveWallet = async () => {
    try {
      await updateDoc(doc(db, 'sharedWallets', walletId), {
        status: 'archived',
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['sharedWallet', walletId] });
      queryClient.invalidateQueries({ queryKey: ['sharedWallets'] });
      toast({ title: 'Wallet archived', variant: 'warning' });
      router.push('/shared-wallets');
    } catch (err) {
      toast({
        title: 'Failed to archive wallet',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <div className="flex flex-col gap-6 max-w-lg">
          <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
          <Card>
            <div className="flex flex-col gap-4">
              <div className="h-10 w-full rounded bg-white/10 animate-pulse" />
              <div className="h-24 w-full rounded bg-white/10 animate-pulse" />
            </div>
          </Card>
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

  if (!canManageSettings) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <Card>
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>
            You don&apos;t have permission to manage wallet settings.
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href={`/shared-wallets/${walletId}`} className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>Wallet Settings</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage your shared wallet configuration</p>
        </div>

        {/* General */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>General</h3>
          <div className="flex flex-col gap-4">
            <Input label="Wallet name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-[var(--radius-lg)] px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                style={{ backgroundColor: 'var(--color-white-10)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
          </div>
        </Card>

        {/* Withdrawal limits */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Withdrawal Limits</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Per-transaction limit (USDC)"
              type="number"
              value={withdrawLimit}
              onChange={(e) => setWithdrawLimit(e.target.value)}
              hint="Maximum per single withdrawal. Set 0 for no limit."
            />
            <Input
              label="Daily limit (USDC)"
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              hint="Maximum total withdrawals per day. Set 0 for no limit."
            />
          </div>
        </Card>

        {/* Approval settings */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>Approval Settings</h3>
          <Switch
            checked={requireApproval}
            onCheckedChange={setRequireApproval}
            label="Require withdrawal approval"
            description="Admins must approve all withdrawals"
            labelPosition="left"
          />
        </Card>

        <Button
          variant="primary"
          fullWidth
          size="lg"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save Changes
        </Button>

        {/* Danger zone - only show for creator */}
        {currentMember?.role === 'creator' && (
          <Card className="mt-2">
            <div className="flex items-center gap-2 mb-4">
              <WarningOctagon size={18} weight="fill" color="var(--color-error)" />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>Danger Zone</h3>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Archive wallet</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Hide this wallet from your list. Funds remain safe.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={archiveWallet}>Archive</Button>
              </div>
              <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Delete wallet</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Coming soon — withdraw all funds first to enable deletion.</p>
                </div>
                <Button variant="ghost" size="sm" disabled>Delete</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
