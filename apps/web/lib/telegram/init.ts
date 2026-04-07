import {
  setDebug,
  backButton,
  initData,
  init as initSDK,
  miniApp,
  viewport,
  themeParams,
} from '@tma.js/sdk-react';

// ---------------------------------------------------------------------------
// Telegram Mini App SDK initialization
//
// Call once in TelegramProvider after mount. Configures all TWA platform
// features: back button, init data, viewport, theme params.
// ---------------------------------------------------------------------------

export async function initTelegramSDK(options?: { debug?: boolean }) {
  if (options?.debug) {
    setDebug(true);
  }

  // Core SDK init — must be called before using any components
  initSDK();

  // Restore persisted init data
  initData.restore();

  // Mount platform features (each can fail outside TG context)
  try {
    backButton.mount();
  } catch {
    // backButton not available
  }

  try {
    miniApp.mount();
    themeParams.bindCssVars();
  } catch {
    // miniApp not available outside Telegram
  }

  try {
    await viewport.mount();
    viewport.bindCssVars();
    // Expand viewport to full height (removes Telegram's collapsed state)
    const isExpanded = viewport.isExpanded;
    if (typeof isExpanded === 'boolean' && !isExpanded) {
      viewport.expand();
    }
  } catch {
    // viewport not available outside Telegram
  }
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** True when running inside the Telegram WebView */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Telegram?.WebApp?.initData ||
      new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData'),
  );
}

// Window.Telegram type is declared in types/telegram.d.ts
