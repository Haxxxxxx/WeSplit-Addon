/**
 * Telegram Bot — web_app_data handler
 *
 * Receives structured JSON from the Mini App via `WebApp.sendData()`.
 * Posts appropriate confirmation messages to the group chat.
 *
 * Supported message types:
 *   payment_complete  — User paid their share of a split
 *   split_created     — User created a new split via Mini App
 *   settlement_complete — Split fully settled
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL } from '../helpers';

interface PaymentCompleteData {
  type: 'payment_complete';
  splitId: string;
  amount: number;
  txSignature: string;
  splitTitle?: string;
}

interface SplitCreatedData {
  type: 'split_created';
  splitId: string;
  title: string;
  amount: number;
  groupChatId?: number;
}

interface SettlementCompleteData {
  type: 'settlement_complete';
  splitId: string;
  splitTitle?: string;
}

type WebAppMessage = PaymentCompleteData | SplitCreatedData | SettlementCompleteData;

export default async function handleWebAppData(ctx: BotContext): Promise<void> {
  const rawData = ctx.message?.web_app_data?.data;
  if (!rawData) return;

  let message: WebAppMessage;
  try {
    message = JSON.parse(rawData) as WebAppMessage;
  } catch {
    console.error('[webAppData] Failed to parse web_app_data:', rawData);
    return;
  }

  const senderName = ctx.from?.username
    ? `@${ctx.from.username}`
    : ctx.from?.first_name ?? 'Someone';

  try {
    switch (message.type) {
      case 'payment_complete':
        await handlePaymentComplete(ctx, message, senderName);
        break;
      case 'split_created':
        await handleSplitCreated(ctx, message, senderName);
        break;
      case 'settlement_complete':
        await handleSettlementComplete(ctx, message, senderName);
        break;
      default:
        console.warn('[webAppData] Unknown message type:', (message as { type: string }).type);
    }
  } catch (err) {
    console.error('[webAppData] Error handling message:', err);
  }
}

// ---------------------------------------------------------------------------
// payment_complete
// ---------------------------------------------------------------------------

async function handlePaymentComplete(
  ctx: BotContext,
  data: PaymentCompleteData,
  senderName: string,
): Promise<void> {
  const title = data.splitTitle ?? 'split';
  const amount = Number(data.amount).toFixed(2);

  // Post to the group chat associated with the split
  const groupChatId = await getGroupChatIdForSplit(data.splitId);
  if (!groupChatId) {
    // No group — just acknowledge
    await ctx.reply(`✅ Payment of $${amount} USDC recorded!`);
    return;
  }

  const splitUrl = `${MINI_APP_URL}#start_param=split_${data.splitId}`;

  await ctx.api.sendMessage(
    groupChatId,
    `✅ <b>${escapeHtml(senderName)}</b> paid <b>$${amount} USDC</b> for <b>${escapeHtml(title)}</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 View Split', web_app: { url: splitUrl } }],
        ],
      },
    },
  );

  // Check if everyone has paid — announce if so
  await checkAndAnnounceFullPayment(ctx, data.splitId, groupChatId, title);
}

// ---------------------------------------------------------------------------
// split_created
// ---------------------------------------------------------------------------

async function handleSplitCreated(
  ctx: BotContext,
  data: SplitCreatedData,
  senderName: string,
): Promise<void> {
  const chatId = data.groupChatId;
  if (!chatId) {
    await ctx.reply(`✅ Split "<b>${escapeHtml(data.title)}</b>" created!`, { parse_mode: 'HTML' });
    return;
  }

  const splitUrl = `${MINI_APP_URL}#start_param=split_${data.splitId}`;

  await ctx.api.sendMessage(
    chatId,
    `💸 <b>${escapeHtml(senderName)}</b> created a new split: <b>${escapeHtml(data.title)}</b>\n` +
      `💰 Total: $${Number(data.amount).toFixed(2)} USDC`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 View Details', web_app: { url: splitUrl } }],
          [
            { text: '💳 Pay My Share', callback_data: `split:pay:${data.splitId}` },
            { text: '❌ Cancel', callback_data: `split:cancel:${data.splitId}` },
          ],
        ],
      },
    },
  );
}

// ---------------------------------------------------------------------------
// settlement_complete
// ---------------------------------------------------------------------------

async function handleSettlementComplete(
  ctx: BotContext,
  data: SettlementCompleteData,
  senderName: string,
): Promise<void> {
  const title = data.splitTitle ?? 'split';
  const groupChatId = await getGroupChatIdForSplit(data.splitId);

  const message = `🎉 <b>${escapeHtml(senderName)}</b> settled <b>${escapeHtml(title)}</b> — all done!`;

  if (groupChatId) {
    await ctx.api.sendMessage(groupChatId, message, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getGroupChatIdForSplit(splitId: string): Promise<number | null> {
  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const splitDoc = await db.collection('splits').doc(splitId).get();
    if (!splitDoc.exists) return null;
    const data = splitDoc.data()!;
    return data.telegram_chat_id ?? data.telegramChatId ?? null;
  } catch {
    return null;
  }
}

async function checkAndAnnounceFullPayment(
  ctx: BotContext,
  splitId: string,
  groupChatId: number,
  title: string,
): Promise<void> {
  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const splitDoc = await db.collection('splits').doc(splitId).get();
    if (!splitDoc.exists) return;

    const split = splitDoc.data()!;
    const participants: Array<{ status: string }> = split.participants ?? [];
    const allPaid = participants.length > 0 && participants.every((p) => p.status === 'paid');

    if (allPaid) {
      await ctx.api.sendMessage(
        groupChatId,
        `🎉 <b>Everyone has paid for "${escapeHtml(title)}"!</b>\n\nThe split creator can now use /settle close to close it.`,
        { parse_mode: 'HTML' },
      );
    }
  } catch {
    // Non-critical — don't propagate
  }
}
