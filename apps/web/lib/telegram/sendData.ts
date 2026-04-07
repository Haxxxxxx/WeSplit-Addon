/**
 * Telegram Mini App — sendData() wrapper
 *
 * Sends structured JSON back to the bot via WebApp.sendData().
 * The bot receives it as `message.web_app_data` and posts
 * appropriate confirmation messages to the group chat.
 *
 * NOTE: sendData() only works when the Mini App was opened via a
 * `KeyboardButton` with `request_contact: false` or a keyboard button
 * with `web_app`. It does NOT work when opened via an inline keyboard button.
 * For inline keyboard context, use bot API calls instead.
 *
 * IMPORTANT: Calling sendData() closes the Mini App immediately.
 * Only call after the user has completed their action.
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface PaymentCompleteMessage {
  type: 'payment_complete';
  splitId: string;
  splitTitle?: string;
  amount: number;
  txSignature: string;
}

export interface SplitCreatedMessage {
  type: 'split_created';
  splitId: string;
  title: string;
  amount: number;
  groupChatId?: number;
}

export interface SettlementCompleteMessage {
  type: 'settlement_complete';
  splitId: string;
  splitTitle?: string;
}

export interface SharedWalletFundedMessage {
  type: 'shared_wallet_funded';
  walletId: string;
  walletName?: string;
  amount: number;
  txSignature: string;
}

export type BotMessage =
  | PaymentCompleteMessage
  | SplitCreatedMessage
  | SettlementCompleteMessage
  | SharedWalletFundedMessage;

// ---------------------------------------------------------------------------
// sendData() wrapper
// ---------------------------------------------------------------------------

/**
 * Send a structured message to the bot via WebApp.sendData().
 * This closes the Mini App after sending.
 *
 * @returns true if sent, false if sendData is not available
 *          (e.g. app opened via inline keyboard, not keyboard button)
 */
export function sendDataToBot(message: BotMessage): boolean {
  if (typeof window === 'undefined') return false;

  const webApp = window.Telegram?.WebApp;
  if (!webApp?.sendData) {
    console.warn('[sendData] WebApp.sendData not available');
    return false;
  }

  try {
    const json = JSON.stringify(message);
    webApp.sendData(json);
    return true;
  } catch (err) {
    console.error('[sendData] Failed:', err);
    return false;
  }
}

/**
 * Check if sendData is available in the current context.
 * Returns false when the Mini App was opened via an inline keyboard button.
 */
export function canSendData(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.Telegram?.WebApp?.sendData === 'function';
}
