import { mockTelegramEnv } from '@tma.js/sdk-react';

// ---------------------------------------------------------------------------
// Telegram environment mock for local development
//
// Usage: call mockTelegramForDev() BEFORE initTelegramSDK()
// Only used in development — never in production!
//
// This provides fake launch params so the SDK can initialize without
// being inside the actual Telegram WebView.
// ---------------------------------------------------------------------------

export function mockTelegramForDev() {
  if (process.env.NODE_ENV !== 'development') return;
  if (typeof window === 'undefined') return;

  // Skip if already in Telegram
  if (window.Telegram?.WebApp?.initData) return;

  const mockThemeParams = {
    bg_color: '#061113' as const,
    text_color: '#ffffff' as const,
    hint_color: '#999999' as const,
    link_color: '#A5EA15' as const,
    button_color: '#A5EA15' as const,
    button_text_color: '#061113' as const,
    secondary_bg_color: '#121D1F' as const,
  };

  // Build a fake launch params query string so the SDK can boot
  const mockInitData = new URLSearchParams({
    user: JSON.stringify({
      id: 123456789,
      first_name: 'Charles',
      last_name: 'Dev',
      username: 'charlesdev',
      language_code: 'en',
    }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: 'dev_mock_hash_not_valid',
  }).toString();

  const launchParams = new URLSearchParams({
    tgWebAppData: mockInitData,
    tgWebAppVersion: '8.0',
    tgWebAppPlatform: 'tdesktop',
    tgWebAppThemeParams: JSON.stringify(mockThemeParams),
  }).toString();

  mockTelegramEnv({ launchParams });

  console.log('[TG Mock] Telegram environment mocked for development');
}
