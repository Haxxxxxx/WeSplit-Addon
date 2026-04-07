'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Key, DeviceMobile, Eye, EyeSlash, Warning } from '@phosphor-icons/react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { PageContainer } from '@/components/ui/PageContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/providers';

export default function AccountSecurityPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const hasEmailProvider = user?.providerData.some((p) => p.providerId === 'password');

  async function handleUpdatePassword() {
    if (!user || !user.email || !hasEmailProvider) return;
    setUpdatingPassword(true);
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      // Update password
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', variant: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        toast({ title: 'Incorrect current password', variant: 'error' });
      } else if (msg.includes('weak-password')) {
        toast({ title: 'Password too weak', description: 'Use at least 6 characters', variant: 'error' });
      } else {
        toast({ title: 'Update failed', description: msg, variant: 'error' });
      }
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--color-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={16} /> Back to Settings
        </Link>
      </div>

      <div className="flex flex-col gap-6 max-w-md">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Account Security</h1>

        {/* Change password */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Key size={18} color="var(--color-primary)" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Change Password</h3>
          </div>

          {!hasEmailProvider ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Password change is only available for email/password accounts.
              Your account uses {user?.providerData[0]?.providerId === 'google.com' ? 'Google' : 'wallet'} sign-in.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <Input
                label="Current password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                rightIcon={showCurrent ? <EyeSlash size={16} /> : <Eye size={16} />}
                onRightIconClick={() => setShowCurrent((v) => !v)}
              />
              <Input
                label="New password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                rightIcon={showNew ? <EyeSlash size={16} /> : <Eye size={16} />}
                onRightIconClick={() => setShowNew((v) => !v)}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
              />
              <Button
                variant="primary"
                disabled={!currentPassword || !newPassword || newPassword.length < 6 || !passwordsMatch}
                loading={updatingPassword}
                onClick={handleUpdatePassword}
              >
                Update Password
              </Button>
            </div>
          )}
        </Card>

        {/* 2FA — informational for now */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} color="var(--color-primary)" />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Two-Factor Auth</h3>
            </div>
            <Badge variant="warning" size="sm" dot>Coming Soon</Badge>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Two-factor authentication via authenticator app will be available in a future update.
            Your wallet signature already provides strong account security.
          </p>
        </Card>

        {/* Danger */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Warning size={18} color="var(--color-error)" />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-error)' }}>Danger Zone</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Delete Account</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>This action is permanent and cannot be undone</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => {
              toast({ title: 'Account deletion', description: 'Please contact support at support@wesplit.io', variant: 'error' });
            }}>Delete</Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
