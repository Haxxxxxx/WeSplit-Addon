'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  CreditCard,
  Moon,
  Sun,
  Globe,
  SignOut,
  CaretRight,
  Bell,
} from '@phosphor-icons/react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/providers';
import { useTheme } from '@/providers';

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  async function handleSignOut() {
    await signOut();
    document.cookie = 'wesplit-session=; path=/; max-age=0';
    router.push('/login');
  }

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { label: 'Profile',         icon: User,       href: '/settings/profile',       description: 'Name, avatar, display name' },
        { label: 'Security',        icon: ShieldCheck, href: '/settings/account',      description: 'Password, 2FA, sessions' },
        { label: 'Linked Cards',    icon: CreditCard,  href: '/settings/linked-cards', description: 'SPEND cards & payment methods' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { label: 'Notifications', icon: Bell, href: '/notifications', description: 'Manage alerts & preferences' },
      ],
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Settings" />

      {/* User profile card */}
      <Link href="/settings/profile">
        <Card hoverable className="mb-6">
          <div className="flex items-center gap-4">
            <Avatar
              src={user?.photoURL ?? undefined}
              fallback={user?.displayName ?? 'Me'}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg" style={{ color: 'var(--color-text)' }}>
                {user?.displayName ?? 'My Account'}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {user?.email ?? ''}
              </p>
            </div>
            <CaretRight size={20} color="var(--color-text-tertiary)" />
          </div>
        </Card>
      </Link>

      <div className="flex flex-col gap-5">
        {/* Settings sections */}
        {settingsSections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
              {section.title}
            </h2>
            <Card padding="none" className="overflow-hidden">
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: 'var(--color-white-10)' }}
                      >
                        <Icon size={18} color="var(--color-text-secondary)" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{item.label}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{item.description}</p>
                      </div>
                      <CaretRight size={16} color="var(--color-text-tertiary)" />
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}

        {/* Appearance */}
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
            Appearance
          </h2>
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {/* Theme toggle */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--color-white-10)' }}
                >
                  {theme === 'dark' ? <Moon size={18} color="var(--color-text-secondary)" /> : <Sun size={18} color="var(--color-text-secondary)" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Theme</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="relative h-6 w-11 rounded-full transition-colors"
                  style={{ backgroundColor: theme === 'dark' ? 'var(--color-primary)' : 'var(--color-white-20)' }}
                  role="switch"
                  aria-checked={theme === 'dark'}
                >
                  <span
                    className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                    style={{ backgroundColor: '#fff', left: theme === 'dark' ? 'calc(100% - 22px)' : '2px' }}
                  />
                </button>
              </div>

              {/* Language */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--color-white-10)' }}
                >
                  <Globe size={18} color="var(--color-text-secondary)" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Language</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>English (US)</p>
                </div>
                <CaretRight size={16} color="var(--color-text-tertiary)" />
              </div>
            </div>
          </Card>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-[var(--radius-xl)] px-5 py-4 w-full text-left transition-colors hover:bg-red-500/10"
          style={{ border: '1px solid var(--color-border)' }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--color-error-20)' }}>
            <SignOut size={18} color="var(--color-error)" />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>Sign out</span>
        </button>

        <p className="text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          WeSplit v1.0.0 · {new Date().getFullYear()}
        </p>
      </div>
    </PageContainer>
  );
}
