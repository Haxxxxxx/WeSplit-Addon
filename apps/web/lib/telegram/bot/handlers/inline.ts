/**
 * Telegram Bot — Inline Query Handler
 *
 * Handles `@WeSplitBot <query>` typed in any Telegram chat.
 * Returns results that users can tap to share wallet info, payment
 * requests, or split invite links.
 *
 * Supported inline query inputs:
 *   (empty)       → Show wallet address + quick-pay button
 *   "pay <amount>" → Generate a shareable payment request card
 *   "split <title>" → Share a split invite link
 *   "wallet"       → Share wallet address as a card
 */

import type { BotContext } from '../types';
import type { InlineQueryResult } from 'grammy/types';
import { escapeHtml, MINI_APP_URL, lookupUserByTelegramId } from '../helpers';

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'WeSplitBot';

// ---------------------------------------------------------------------------
// Main inline query handler
// ---------------------------------------------------------------------------

export default async function handleInlineQuery(ctx: BotContext): Promise<void> {
  const query = (ctx.inlineQuery?.query ?? '').trim().toLowerCase();
  const telegramId = ctx.from?.id;
  const displayName = ctx.from?.username
    ? `@${ctx.from.username}`
    : ctx.from?.first_name ?? 'A WeSplit user';

  // Look up WeSplit user by telegram_id
  const userDoc = telegramId ? await lookupUserByTelegramId(telegramId) : null;

  const results: InlineQueryResult[] = [];

  // ----------------------------------------------------------
  // Wallet card — always show if user has a wallet
  // ----------------------------------------------------------
  const walletAddress: string | null = (userDoc?.telegram_wallet_address ?? userDoc?.wallet_address ?? null) as string | null;

  if (!query || query === 'wallet') {
    if (walletAddress) {
      results.push({
        type: 'article',
        id: 'wallet-address',
        title: '💳 Share My Wallet Address',
        description: `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`,
        input_message_content: {
          message_text:
            `💳 <b>${escapeHtml(displayName)}'s WeSplit Wallet</b>\n` +
            `<code>${walletAddress}</code>\n\n` +
            `Send USDC or SOL on Solana.`,
          parse_mode: 'HTML',
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📲 Open WeSplit',
                url: `https://t.me/${BOT_USERNAME}/app`,
              },
            ],
          ],
        },
      });
    } else {
      // No wallet — prompt to set up
      results.push({
        type: 'article',
        id: 'setup-wallet',
        title: '⚙️ Set Up Your WeSplit Wallet',
        description: 'Tap to create a non-custodial Solana wallet',
        input_message_content: {
          message_text:
            `💳 <b>${escapeHtml(displayName)}</b> is on WeSplit!\n\nSend them USDC or SOL after they set up their wallet.`,
          parse_mode: 'HTML',
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Set Up Wallet', url: `https://t.me/${BOT_USERNAME}/app#start_param=wallet` }],
          ],
        },
      });
    }
  }

  // ----------------------------------------------------------
  // "pay <amount>" — share a payment request
  // ----------------------------------------------------------
  const payMatch = query.match(/^pay\s+(\d+(?:\.\d+)?)/);
  if (payMatch?.[1]) {
    const amount = parseFloat(payMatch[1]);
    const requestUrl = walletAddress
      ? `${MINI_APP_URL}#start_param=request_new_${amount}`
      : `https://t.me/${BOT_USERNAME}/app`;

    results.push({
      type: 'article',
      id: `pay-request-${amount}`,
      title: `💰 Request $${amount} USDC`,
      description: `Share a payment request for $${amount} USDC`,
      input_message_content: {
        message_text:
          `💰 <b>${escapeHtml(displayName)}</b> is requesting <b>$${amount} USDC</b>.\n\nTap below to pay via WeSplit.`,
        parse_mode: 'HTML',
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Pay $${amount} USDC`, web_app: { url: requestUrl } }],
        ],
      },
    });
  }

  // ----------------------------------------------------------
  // "split <title>" — share a split invite
  // ----------------------------------------------------------
  const splitMatch = query.match(/^split\s+(.+)/);
  if (splitMatch?.[1]) {
    const title = splitMatch[1];
    const createUrl = `${MINI_APP_URL}#start_param=split_new`;

    results.push({
      type: 'article',
      id: `split-invite-${title.slice(0, 20)}`,
      title: `✂️ Start Split: "${title}"`,
      description: 'Share a split invite — participants pay their share via WeSplit',
      input_message_content: {
        message_text:
          `✂️ <b>${escapeHtml(displayName)}</b> wants to split <b>"${escapeHtml(title)}"</b>.\n\nTap to join and pay your share.`,
        parse_mode: 'HTML',
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: '✂️ Join Split', web_app: { url: createUrl } }],
        ],
      },
    });
  }

  // ----------------------------------------------------------
  // Fallback — show help card
  // ----------------------------------------------------------
  if (results.length === 0) {
    results.push({
      type: 'article',
      id: 'help',
      title: '🤔 WeSplit Inline Mode',
      description: 'Try: wallet · pay 50 · split dinner',
      input_message_content: {
        message_text:
          `<b>WeSplit Inline Commands:</b>\n\n` +
          `<code>@${BOT_USERNAME} wallet</code> — Share your wallet address\n` +
          `<code>@${BOT_USERNAME} pay 50</code> — Request $50 USDC\n` +
          `<code>@${BOT_USERNAME} split dinner</code> — Start a "dinner" split`,
        parse_mode: 'HTML',
      },
    });
  }

  await ctx.answerInlineQuery(results, { cache_time: 10 });
}

