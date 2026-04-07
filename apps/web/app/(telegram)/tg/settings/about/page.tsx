'use client';

import { useCallback } from 'react';
import {
  Info,
  Globe,
  XLogo,
  TelegramLogo,
  EnvelopeSimple,
  ShieldCheck,
  FileText,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { Card } from '@/components/ui/Card';
import { TgPageHeader } from '@/components/telegram/TgPageHeader';
import { useTelegramBackButton } from '@/lib/telegram/hooks';
import { useTgNavigation } from '@/lib/telegram/useTgNavigation';

// ---------------------------------------------------------------------------
// Link row helper
// ---------------------------------------------------------------------------

function LinkRow({
  icon: Icon,
  label,
  href,
  subtitle,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 transition-opacity active:opacity-70"
    >
      <Icon
        size={18}
        weight="fill"
        style={{ color: iconColor ?? 'var(--color-text-tertiary)' }}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: 'var(--color-text)' }}>{label}</p>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{subtitle}</p>
        )}
      </div>
      <ArrowSquareOut size={14} style={{ color: 'var(--color-text-tertiary)' }} className="shrink-0" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// About Page
// ---------------------------------------------------------------------------

export default function TelegramAboutPage() {
  const { goBack } = useTgNavigation();

  useTelegramBackButton({
    visible: true,
    onClick: useCallback(() => goBack('/tg/settings'), [goBack]),
  });

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 animate-fade-in">
      {/* Header */}
      <TgPageHeader
        icon={<Info size={20} weight="fill" color="var(--color-bg)" />}
        title="About WeSplit"
        subtitle="Version & info"
      />

      {/* App info */}
      <Card>
        <div className="flex flex-col items-center gap-3 py-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dim) 100%)',
            }}
          >
            <span className="text-2xl font-bold" style={{ color: 'var(--color-bg)' }}>
              W
            </span>
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
              WeSplit
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Decentralized Social Payments on Solana
            </p>
          </div>
          <p
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            v1.0.0 &middot; TG Mini App
          </p>
        </div>
      </Card>

      {/* Links */}
      <Card>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Connect
        </h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <LinkRow
            icon={Globe}
            label="Website"
            href="https://wesplit.io"
            subtitle="wesplit.io"
            iconColor="var(--color-primary)"
          />
          <LinkRow
            icon={XLogo}
            label="X (Twitter)"
            href="https://x.com/WeSplitSolana"
            subtitle="@WeSplitSolana"
          />
          <LinkRow
            icon={TelegramLogo}
            label="Telegram Community"
            href="https://t.me/WeSplitSolana"
            subtitle="@WeSplitSolana"
            iconColor="#2AABEE"
          />
          <LinkRow
            icon={EnvelopeSimple}
            label="Contact Support"
            href="mailto:support@wesplit.io"
            subtitle="support@wesplit.io"
          />
        </div>
      </Card>

      {/* Legal */}
      <Card>
        <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Legal
        </h3>
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <LinkRow
            icon={FileText}
            label="Terms of Service"
            href="https://wesplit.io/terms"
          />
          <LinkRow
            icon={ShieldCheck}
            label="Privacy Policy"
            href="https://wesplit.io/privacy"
          />
        </div>
      </Card>

      {/* Footer */}
      <p
        className="text-xs text-center pt-2"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Built on Solana &middot; Powered by Phantom
      </p>
    </div>
  );
}
