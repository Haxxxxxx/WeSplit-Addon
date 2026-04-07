'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  User as UserIcon,
  Copy,
  Check,
  Wallet,
  Star,
  SignOut,
  PencilSimple,
  LinkSimple,
  ShieldCheck,
  Info,
  CreditCard,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTelegramBackButton, useTelegramHaptic } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';
import { useTgWallet } from '@/lib/telegram/useTgWallet';
import { useTelegram } from '@/providers/TelegramProvider';
import { useAppStore } from '@/store';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { dismissKeyboard } from '@/lib/utils';
import { updateUserProfile } from '@/lib/firebase/queries';

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
  copyable,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const haptic = useTelegramHaptic();

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      haptic?.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <Icon size={16} className="shrink-0" style={{ color: 'var(--color-text-tertiary)' }} />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
        <span
          className={`text-sm break-all ${mono ? 'font-mono' : ''}`}
          style={{ color: 'var(--color-text)' }}
        >
          {value || '—'}
        </span>
      </div>
      {copyable && value && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings / Profile Page
// ---------------------------------------------------------------------------

export default function TelegramSettingsPage() {
  const router = useRouter();
  const { goBack } = useTgNavigation();
  const haptic = useTelegramHaptic();
  const { telegramUser } = useTelegram();
  const { address: walletAddress, hasWallet } = useTgWallet();
  const user = useAppStore((s) => s.user.currentUser);
  const logoutUser = useAppStore((s) => s.logoutUser);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (user?.name) setEditName(user.name);
  }, [user?.name]);

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack(), [goBack]),
  });

  const handleSaveName = useCallback(async () => {
    if (!user?.id || !editName.trim() || saving) return;
    setSaving(true);
    try {
      await updateUserProfile(user.id, { name: editName.trim() });
      haptic?.notificationOccurred('success');
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      haptic?.notificationOccurred('error');
    } finally {
      setSaving(false);
    }
  }, [user?.id, editName, saving, haptic]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    haptic?.impactOccurred('medium');
    try {
      await signOut(auth);
      logoutUser();
      router.push('/tg');
    } catch {
      haptic?.notificationOccurred('error');
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, haptic, logoutUser, router]);

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '—';

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-24 animate-fade-in" onPointerDown={dismissKeyboard}>
      {/* Profile hero */}
      <div className="flex flex-col items-center gap-3 pt-2 pb-4">
        <Avatar
          src={telegramUser?.photo_url}
          fallback={user?.name ?? telegramUser?.first_name ?? '?'}
          size="lg"
        />
        <div className="text-center">
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {user?.name ?? telegramUser?.first_name ?? 'User'}
          </h1>
          {telegramUser?.username && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              @{telegramUser.username}
            </p>
          )}
        </div>
        {user?.points !== undefined && user.points > 0 && (
          <Badge variant="primary" size="md">
            <Star size={12} weight="fill" className="mr-1" />
            {user.points.toLocaleString()} points
          </Badge>
        )}
      </div>

      {saved && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ backgroundColor: 'var(--color-success-20)', color: 'var(--color-success)' }}
        >
          <Check size={16} weight="bold" /> Profile updated
        </div>
      )}

      {/* Edit name */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Display Name
          </h3>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1"
              style={{ color: 'var(--color-primary)' }}
              aria-label="Edit display name"
            >
              <PencilSimple size={16} weight="bold" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
            />
            <Button
              size="sm"
              onClick={handleSaveName}
              loading={saving}
              disabled={!editName.trim() || editName.trim() === user?.name}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditing(false); setEditName(user?.name ?? ''); }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text)' }}>
            {user?.name ?? '—'}
          </p>
        )}
      </Card>

      {/* Account info */}
      <Card>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Account
        </h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <InfoRow icon={UserIcon} label="Email" value={user?.email ?? ''} />
          <InfoRow
            icon={Wallet}
            label="Wallet Address"
            value={walletAddress ?? ''}
            copyable
            mono
          />
          {user?.phone && (
            <InfoRow icon={UserIcon} label="Phone" value={user.phone} />
          )}
        </div>
      </Card>

      {/* Wallet status — links to wallet details */}
      <Link href={hasWallet ? '/tg/wallet/details' : '/tg/wallet/setup'}>
        <Card className="transition-colors active:bg-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={18} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Wallet
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: hasWallet ? 'var(--color-success)' : 'var(--color-error)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {hasWallet ? truncatedAddress : 'No wallet'}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>&rsaquo;</span>
          </div>
        </Card>
      </Link>

      {/* Quick links */}
      <div className="flex flex-col gap-2">
        <Link href="/tg/settings/security">
          <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
            <ShieldCheck size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
              Security
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              &rsaquo;
            </span>
          </Card>
        </Link>
        <Link href="/tg/link-account">
          <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
            <LinkSimple size={18} style={{ color: 'var(--color-primary)' }} />
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
              Link Mobile Account
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              &rsaquo;
            </span>
          </Card>
        </Link>
        <Link href="/tg/settings/about">
          <Card className="flex items-center gap-3 p-4 transition-colors active:bg-white/[0.04]">
            <Info size={18} style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="flex-1 text-sm" style={{ color: 'var(--color-text)' }}>
              About WeSplit
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              &rsaquo;
            </span>
          </Card>
        </Link>
      </div>

      {/* Telegram info */}
      {telegramUser && (
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--color-white-5)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Signed in via Telegram as {telegramUser.first_name}
            {telegramUser.last_name ? ` ${telegramUser.last_name}` : ''}
            {telegramUser.username ? ` (@${telegramUser.username})` : ''}
          </p>
        </div>
      )}

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 transition-colors active:bg-white/[0.04]"
        style={{ backgroundColor: 'var(--color-error-20)' }}
      >
        <SignOut size={18} style={{ color: 'var(--color-error)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </span>
      </button>
    </div>
  );
}
