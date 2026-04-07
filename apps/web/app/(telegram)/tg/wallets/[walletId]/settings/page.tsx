'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { GearSix, Check, Trash } from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import {
  useTelegramBackButton,
  useTelegramHaptic,
  tgConfirm,
} from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { useSharedWalletDetail } from '@/hooks';
import {
  updateSharedWalletInfo,
  updateSharedWalletSettings,
  removeMemberFromWallet,
} from '@/lib/firebase/queries';
import { WalletDetailSkeleton } from '@/components/telegram/TelegramSkeletons';

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 py-3 w-full text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>
      <div
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-white-20)' }}
      >
        <div
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function TelegramWalletSettingsPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);
  const { wallet, isLoading, refetch } = useSharedWalletDetail(walletId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requireApproval, setRequireApproval] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('');
  const [txLimit, setTxLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // Init form from wallet data
  useEffect(() => {
    if (!wallet) return;
    setName(wallet.name);
    setDescription(wallet.description ?? '');
    setRequireApproval(wallet.settings?.requireApprovalForWithdrawals ?? false);
    setDailyLimit(wallet.settings?.dailyWithdrawalLimit?.toString() ?? '');
    setTxLimit(wallet.settings?.perTransactionLimit?.toString() ?? '');
  }, [wallet]);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(`/tg/wallets/${walletId}`), [goBack, walletId]),
  });

  const isCreator = wallet?.creator_id === userId || wallet?.creatorId === userId;

  const handleSave = useCallback(async () => {
    if (!wallet || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Update name/description if changed
      if (name.trim() !== wallet.name || (description.trim() || '') !== (wallet.description ?? '')) {
        await updateSharedWalletInfo(walletId, {
          name: name.trim(),
          description: description.trim(),
        });
      }

      // Update settings
      await updateSharedWalletSettings(walletId, {
        requireApprovalForWithdrawals: requireApproval,
        ...(dailyLimit ? { dailyWithdrawalLimit: parseFloat(dailyLimit) } : {}),
        ...(txLimit ? { perTransactionLimit: parseFloat(txLimit) } : {}),
      });

      haptic?.notificationOccurred('success');
      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setError(msg);
      haptic?.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }, [wallet, walletId, name, description, requireApproval, dailyLimit, txLimit, saving, haptic, refetch]);

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (removingMember) return;
      const memberName = wallet?.members?.find((m) => m.user_id === memberId)?.name ?? 'this member';
      const confirmed = await tgConfirm(`Remove ${memberName} from the wallet?`);
      if (!confirmed) return;
      haptic?.impactOccurred('medium');
      setRemovingMember(memberId);
      try {
        await removeMemberFromWallet(walletId, memberId);
        haptic?.notificationOccurred('success');
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove member');
        haptic?.notificationOccurred('error');
      } finally {
        setRemovingMember(null);
      }
    },
    [walletId, removingMember, haptic, refetch, wallet],
  );

  if (isLoading || !wallet) return <WalletDetailSkeleton />;

  if (!isCreator) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 pt-20 text-center animate-fade-in">
        <GearSix size={48} weight="fill" style={{ color: 'var(--color-text-tertiary)' }} />
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Access Denied</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Only the wallet creator can manage settings.
        </p>
        <Button onClick={() => goBack(`/tg/wallets/${walletId}`)} variant="outline">Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<GearSix size={20} weight="fill" color="var(--color-bg)" />}
        title="Settings"
        subtitle={wallet.name}
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-error-20)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ backgroundColor: 'var(--color-success-20)', color: 'var(--color-success)' }}>
          <Check size={16} weight="bold" /> Settings saved
        </div>
      )}

      {/* General */}
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>General</h3>

        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Wallet Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />

        <label className="block mb-1.5 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--color-text-disabled)] focus:ring-1 focus:ring-[var(--color-primary)]"
          style={{
            backgroundColor: 'var(--color-white-10)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
      </Card>

      {/* Security */}
      <Card>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>Security</h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <ToggleRow
            label="Require Approval for Withdrawals"
            description="Admin must approve before funds leave the wallet"
            checked={requireApproval}
            onChange={setRequireApproval}
          />
        </div>
      </Card>

      {/* Limits */}
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Withdrawal Limits</h3>

        <label className="block mb-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Daily Limit (USDC) — leave empty for no limit
        </label>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="No limit"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(e.target.value)}
        />

        <label className="block mb-1.5 mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Per Transaction Limit (USDC)
        </label>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="No limit"
          value={txLimit}
          onChange={(e) => setTxLimit(e.target.value)}
        />
      </Card>

      {/* Members management */}
      <Card>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>Members</h3>
        <div className="flex flex-col gap-2">
          {(wallet.members ?? []).map((m) => {
            const memberId = m.user_id || m.userId || '';
            const isOwner = memberId === userId;
            return (
              <div key={memberId} className="flex items-center gap-3">
                <Avatar fallback={m.name ?? memberId} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {m.name ?? 'Unknown'}
                  </p>
                </div>
                <Badge
                  variant={m.role === 'creator' ? 'primary' : m.role === 'admin' ? 'info' : 'default'}
                  size="sm"
                >
                  {m.role}
                </Badge>
                {!isOwner && m.role !== 'creator' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(memberId)}
                    disabled={removingMember === memberId}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-error)' }}
                    aria-label={`Remove ${m.name ?? 'member'}`}
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Save button */}
      <Button onClick={handleSave} loading={saving} fullWidth>
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}
