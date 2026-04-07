/* eslint-disable react-hooks/rules-of-hooks */
'use client';

import { useCallback, useEffect } from 'react';
import {
  initData,
  miniApp,
  viewport,
  backButton,
  mainButton,
  hapticFeedback,
  themeParams,
  useSignal,
} from '@tma.js/sdk-react';

// ---------------------------------------------------------------------------
// Telegram Mini App hooks — signal-based wrappers over @tma.js/sdk-react
//
// The SDK uses reactive signals. Use `useSignal(signal)` to subscribe
// to reactive values in React components.
// ---------------------------------------------------------------------------

/**
 * Returns the current Telegram user from initData.
 * Safe to call — returns null if not in Telegram context.
 */
export function useTelegramUser() {
  try {
    const user = useSignal(initData.user);
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the raw init data string (for server validation).
 */
export function useTelegramInitDataRaw() {
  try {
    const raw = useSignal(initData.raw);
    return raw ?? '';
  } catch {
    return '';
  }
}

/**
 * Returns TWA theme params (bgColor, textColor, etc.)
 */
export function useTelegramTheme() {
  try {
    const bgColor = useSignal(themeParams.bgColor);
    const textColor = useSignal(themeParams.buttonTextColor);
    const buttonColor = useSignal(themeParams.buttonColor);
    const hintColor = useSignal(themeParams.hintColor);
    return { bgColor, textColor, buttonColor, hintColor };
  } catch {
    return null;
  }
}

/**
 * Returns whether the mini app is in dark mode.
 */
export function useTelegramIsDark() {
  try {
    return useSignal(miniApp.isDark);
  } catch {
    return true; // default to dark
  }
}

/**
 * Configures the Telegram MainButton (the big button at the bottom).
 * Mounts on first render, cleans up on unmount.
 */
export function useTelegramMainButton(config: {
  text: string;
  onClick: () => void;
  visible?: boolean;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  textColor?: string;
}) {
  const {
    text,
    onClick,
    visible = true,
    loading = false,
    disabled = false,
    color,
    textColor: txtColor,
  } = config;

  useEffect(() => {
    try {
      if (!mainButton.isMounted) mainButton.mount();

      mainButton.setText(text);
      if (color) mainButton.setBgColor(color as `#${string}`);
      if (txtColor) mainButton.setTextColor(txtColor as `#${string}`);

      if (loading) {
        mainButton.showLoader();
      } else {
        mainButton.hideLoader();
      }

      if (disabled) {
        mainButton.disable();
      } else {
        mainButton.enable();
      }

      if (visible) {
        mainButton.show();
      } else {
        mainButton.hide();
      }
    } catch {
      // Not in Telegram context
    }

    return () => {
      try {
        mainButton.hide();
      } catch {
        // noop
      }
    };
  }, [text, visible, loading, disabled, color, txtColor]);

  useEffect(() => {
    try {
      mainButton.onClick(onClick);
      return () => {
        mainButton.offClick(onClick);
      };
    } catch {
      return undefined;
    }
  }, [onClick]);
}

/**
 * Wires the Telegram BackButton to a callback (usually router.back()).
 */
export function useTelegramBackButton(config: {
  visible?: boolean;
  onClick: () => void;
}) {
  const { visible = true, onClick } = config;

  useEffect(() => {
    try {
      if (!backButton.isMounted) backButton.mount();

      if (visible) {
        backButton.show();
      } else {
        backButton.hide();
      }
    } catch {
      // Not in Telegram context
    }

    return () => {
      try {
        backButton.hide();
      } catch {
        // noop
      }
    };
  }, [visible]);

  useEffect(() => {
    try {
      backButton.onClick(onClick);
      return () => {
        backButton.offClick(onClick);
      };
    } catch {
      return undefined;
    }
  }, [onClick]);
}

/**
 * Returns haptic feedback methods.
 * Usage: haptic.impactOccurred('medium')
 */
export function useTelegramHaptic() {
  return {
    impactOccurred: useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
      try {
        hapticFeedback.impactOccurred(style);
      } catch {
        // noop
      }
    }, []),
    notificationOccurred: useCallback((type: 'error' | 'success' | 'warning') => {
      try {
        hapticFeedback.notificationOccurred(type);
      } catch {
        // noop
      }
    }, []),
    selectionChanged: useCallback(() => {
      try {
        hapticFeedback.selectionChanged();
      } catch {
        // noop
      }
    }, []),
  };
}

/**
 * Returns viewport info (height, isExpanded, stableHeight).
 */
export function useTelegramViewport() {
  try {
    const height = useSignal(viewport.height);
    const stableHeight = useSignal(viewport.stableHeight);
    const isExpanded = useSignal(viewport.isExpanded);
    return { height, stableHeight, isExpanded };
  } catch {
    return null;
  }
}

/**
 * Close the Mini App.
 */
export function useCloseMiniApp() {
  return useCallback(() => {
    try {
      miniApp.close();
    } catch {
      window.Telegram?.WebApp?.close?.();
    }
  }, []);
}

/**
 * Show a native Telegram confirm dialog. Falls back to window.confirm outside TG.
 */
export function tgConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    if (webApp?.showConfirm) {
      webApp.showConfirm(message, (confirmed: boolean) => {
        resolve(confirmed);
      });
    } else {
      resolve(window.confirm(message));
    }
  });
}
