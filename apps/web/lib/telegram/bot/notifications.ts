/**
 * Telegram Bot — Group Notifications
 *
 * Utility functions for posting event-driven notifications to Telegram group
 * chats. These are called directly from Mini App API routes or services, NOT
 * in response to bot commands.
 *
 * Use cases:
 *  - Payment received in a split → post to the group
 *  - All participants paid → announce fully paid
 *  - Split cancelled → notify group
 *  - New member joined WeSplit from a group → welcome post
 */

import { getBot } from './index';
import { escapeHtml, MINI_APP_URL } from './helpers';

// ---------------------------------------------------------------------------
// notifyPaymentReceived
// Post "✅ @user paid $X for 'split'" to a group chat
// ---------------------------------------------------------------------------

export async function notifyPaymentReceived(options: {
  chatId: number;
  payerName: string;
  amount: number;
  currency?: string;
  splitTitle: string;
  splitId: string;
}): Promise<void> {
  const { chatId, payerName, amount, currency = 'USDC', splitTitle, splitId } = options;
  const splitUrl = `${MINI_APP_URL}#start_param=split_${splitId}`;

  try {
    const bot = getBot();
    await bot.api.sendMessage(
      chatId,
      `✅ <b>${escapeHtml(payerName)}</b> paid <b>$${amount.toFixed(2)} ${currency}</b> for <b>${escapeHtml(splitTitle)}</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View Split', web_app: { url: splitUrl } }],
          ],
        },
      },
    );
  } catch (err) {
    console.error('[notifications] notifyPaymentReceived failed:', err);
  }
}

// ---------------------------------------------------------------------------
// notifySplitFullyPaid
// Post "🎉 Split 'X' is fully paid!" when all participants have paid
// ---------------------------------------------------------------------------

export async function notifySplitFullyPaid(options: {
  chatId: number;
  splitTitle: string;
  splitId: string;
  creatorName?: string;
}): Promise<void> {
  const { chatId, splitTitle, splitId, creatorName } = options;
  const splitUrl = `${MINI_APP_URL}#start_param=split_${splitId}`;
  const settleHint = creatorName
    ? ` ${escapeHtml(creatorName)} can now close the split.`
    : ' Use /settle to close it.';

  try {
    const bot = getBot();
    await bot.api.sendMessage(
      chatId,
      `🎉 <b>Everyone has paid for "${escapeHtml(splitTitle)}"!</b>${settleHint}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View Split', web_app: { url: splitUrl } }],
          ],
        },
      },
    );
  } catch (err) {
    console.error('[notifications] notifySplitFullyPaid failed:', err);
  }
}

// ---------------------------------------------------------------------------
// notifySplitCancelled
// Post "❌ Split 'X' was cancelled by @creator"
// ---------------------------------------------------------------------------

export async function notifySplitCancelled(options: {
  chatId: number;
  splitTitle: string;
  cancelledByName: string;
}): Promise<void> {
  const { chatId, splitTitle, cancelledByName } = options;

  try {
    const bot = getBot();
    await bot.api.sendMessage(
      chatId,
      `❌ Split <b>"${escapeHtml(splitTitle)}"</b> was cancelled by <b>${escapeHtml(cancelledByName)}</b>.`,
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error('[notifications] notifySplitCancelled failed:', err);
  }
}

// ---------------------------------------------------------------------------
// notifyMemberJoined
// Post "👋 @user joined WeSplit and linked their wallet!"
// ---------------------------------------------------------------------------

export async function notifyMemberJoined(options: {
  chatId: number;
  memberName: string;
}): Promise<void> {
  const { chatId, memberName } = options;

  try {
    const bot = getBot();
    await bot.api.sendMessage(
      chatId,
      `👋 <b>${escapeHtml(memberName)}</b> joined WeSplit and linked their wallet! They can now pay splits directly.`,
      { parse_mode: 'HTML' },
    );
  } catch (err) {
    console.error('[notifications] notifyMemberJoined failed:', err);
  }
}
