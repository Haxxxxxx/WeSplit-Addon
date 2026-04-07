'use client';

import { use, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  UserPlus,
  ArrowUp,
  ArrowDown,
  GearSix,
  UserMinus,
  Eye,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useAppStore } from '@/store';
import { getSharedWalletById, updateMemberPermissions } from '@/lib/firebase/queries';
import type { SharedWalletPermissions } from '@/types';

// ---------------------------------------------------------------------------
// Permission toggle
// ---------------------------------------------------------------------------

const PERMISSION_CONFIG: {
  key: keyof SharedWalletPermissions;
  icon: React.ElementType;
  label: string;
  description: string;
}[] = [
  {
    key: 'canInviteMembers',
    icon: UserPlus,
    label: 'Invite Members',
    description: 'Can invite new members to the wallet',
  },
  {
    key: 'canWithdraw',
    icon: ArrowUp,
    label: 'Withdraw',
    description: 'Can withdraw funds from the wallet',
  },
  {
    key: 'canFund',
    icon: ArrowDown,
    label: 'Fund',
    description: 'Can deposit funds into the wallet',
  },
  {
    key: 'canManageSettings',
    icon: GearSix,
    label: 'Manage Settings',
    description: 'Can change wallet settings and limits',
  },
  {
    key: 'canRemoveMembers',
    icon: UserMinus,
    label: 'Remove Members',
    description: 'Can remove members from the wallet',
  },
  {
    key: 'canViewTransactions',
    icon: Eye,
    label: 'View Transactions',
    description: 'Can see wallet transaction history',
  },
];

function PermissionToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex items-center gap-3 py-3 w-full text-left"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Icon
        size={18}
        weight="fill"
        style={{ color: enabled ? 'var(--color-primary)' : 'var(--color-text-tertiary)' }}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {description}
        </p>
      </div>
      <div
        className="w-10 h-6 rounded-full relative transition-colors shrink-0"
        style={{
          backgroundColor: enabled ? 'var(--color-primary)' : 'var(--color-white-10)',
        }}
      >
        <div
          className="absolute top-1 h-4 w-4 rounded-full transition-all"
          style={{
            backgroundColor: enabled ? 'var(--color-bg)' : 'var(--color-text-tertiary)',
            left: enabled ? '22px' : '2px',
          }}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Member Rights Page
// ---------------------------------------------------------------------------

export default function TelegramMemberRightsPage({
  params,
}: {
  params: Promise<{ walletId: string; memberId: string }>;
}) {
  const { walletId, memberId } = use(params);
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const userId = useAppStore((s) => s.user.currentUser?.id);

  const [permissions, setPermissions] = useState<SharedWalletPermissions>({
    canInviteMembers: false,
    canWithdraw: true,
    canFund: true,
    canManageSettings: false,
    canRemoveMembers: false,
    canViewTransactions: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(
      () => goBack(`/tg/wallets/${walletId}`),
      [goBack, walletId],
    ),
  });

  const { data: wallet } = useQuery({
    queryKey: ['sharedWallet', walletId],
    queryFn: () => getSharedWalletById(walletId),
    enabled: !!walletId,
    staleTime: 30_000,
  });

  const member = wallet?.members?.find((m) => m.user_id === memberId);
  const currentUserRole = wallet?.members?.find((m) => m.user_id === userId)?.role;
  const isCreator = wallet?.creator_id === userId;
  const canEdit = isCreator || currentUserRole === 'admin';
  const memberIsCreator = wallet?.creator_id === memberId;

  // Initialize permissions from member data
  useEffect(() => {
    if (member?.permissions) {
      setPermissions({
        canInviteMembers: member.permissions.canInviteMembers ?? false,
        canWithdraw: member.permissions.canWithdraw ?? true,
        canFund: member.permissions.canFund ?? true,
        canManageSettings: member.permissions.canManageSettings ?? false,
        canRemoveMembers: member.permissions.canRemoveMembers ?? false,
        canViewTransactions: member.permissions.canViewTransactions ?? true,
      });
    }
  }, [member]);

  function togglePermission(key: keyof SharedWalletPermissions) {
    if (!canEdit || memberIsCreator) return;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
    haptic?.selectionChanged();
  }

  const handleSave = useCallback(async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      await updateMemberPermissions(walletId, memberId, permissions);
      haptic?.notificationOccurred('success');
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      haptic?.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }, [hasChanges, saving, walletId, memberId, permissions, haptic]);

  if (!wallet || !member) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-white-10)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--color-white-5)' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<ShieldCheck size={20} weight="fill" color="var(--color-bg)" />}
        title="Member Rights"
        subtitle="Manage permissions"
      />

      {/* Member info */}
      <Card>
        <div className="flex items-center gap-3">
          <Avatar fallback={member.name ?? memberId} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {member.name ?? 'Unknown'}
            </p>
            {member.email && (
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {member.email}
              </p>
            )}
          </div>
          <Badge
            variant={member.role === 'creator' ? 'primary' : member.role === 'admin' ? 'info' : 'default'}
            size="sm"
          >
            {member.role}
          </Badge>
        </div>
      </Card>

      {memberIsCreator && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--color-white-5)', color: 'var(--color-text-secondary)' }}
        >
          The wallet creator has all permissions and they cannot be modified.
        </div>
      )}

      {saved && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ backgroundColor: 'var(--color-success-20)', color: 'var(--color-success)' }}
        >
          Permissions updated
        </div>
      )}

      {/* Permissions */}
      <Card>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Permissions
        </h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {PERMISSION_CONFIG.map((perm) => (
            <PermissionToggle
              key={perm.key}
              icon={perm.icon}
              label={perm.label}
              description={perm.description}
              enabled={memberIsCreator ? true : permissions[perm.key]}
              onChange={() => togglePermission(perm.key)}
              disabled={!canEdit || memberIsCreator}
            />
          ))}
        </div>
      </Card>

      {/* Save button */}
      {hasChanges && canEdit && !memberIsCreator && (
        <Button onClick={handleSave} loading={saving} fullWidth>
          Save Changes
        </Button>
      )}

      {!canEdit && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ backgroundColor: 'var(--color-white-5)', color: 'var(--color-text-tertiary)' }}
        >
          Only the wallet creator or admins can modify member permissions.
        </div>
      )}
    </div>
  );
}
