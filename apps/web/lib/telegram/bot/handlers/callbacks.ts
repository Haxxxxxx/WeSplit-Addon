/**
 * Telegram Bot — Inline keyboard callback query handler
 *
 * Handles callback_data patterns:
 *   split:pay:{splitId}          — Open Mini App to pay
 *   split:details:{splitId}      — Open Mini App to view split
 *   split:cancel:{splitId}       — Cancel split (creator only)
 *   payment:confirm:{txId}       — Show payment receipt
 *   amount:{value}               — Quick amount selection for /split flow
 *   settings:currency:{val}:{chatId} — Toggle currency preference
 *   settings:notifications:{val}:{chatId} — Toggle notifications
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL } from '../helpers';

export default async function handleCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    if (data.startsWith('split:pay:')) {
      await handleSplitPay(ctx, data.slice('split:pay:'.length));
    } else if (data.startsWith('split:details:')) {
      await handleSplitDetails(ctx, data.slice('split:details:'.length));
    } else if (data.startsWith('split:cancel:')) {
      await handleSplitCancel(ctx, data.slice('split:cancel:'.length));
    } else if (data.startsWith('payment:confirm:')) {
      await handlePaymentConfirm(ctx, data.slice('payment:confirm:'.length));
    } else if (data.startsWith('amount:')) {
      await handleAmountSelection(ctx, data.slice('amount:'.length));
    } else if (data.startsWith('settings:')) {
      await handleSettingsCallback(ctx, data);
    } else {
      await ctx.answerCallbackQuery({ text: 'Unknown action' });
    }
  } catch (err) {
    console.error('[callbacks] Error:', err);
    await ctx.answerCallbackQuery({ text: '❌ Something went wrong' });
  }
}

// ---------------------------------------------------------------------------
// split:pay:{splitId}
// ---------------------------------------------------------------------------

async function handleSplitPay(ctx: BotContext, splitId: string): Promise<void> {
  const payUrl = `${MINI_APP_URL}#start_param=pay_${splitId}`;
  await ctx.answerCallbackQuery();
  await ctx.reply('💳 Open the app to pay your share:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Pay My Share', web_app: { url: payUrl } }],
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// split:details:{splitId}
// ---------------------------------------------------------------------------

async function handleSplitDetails(ctx: BotContext, splitId: string): Promise<void> {
  const detailUrl = `${MINI_APP_URL}#start_param=split_${splitId}`;
  await ctx.answerCallbackQuery();
  await ctx.reply('📋 Open the app to view details:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 View Split', web_app: { url: detailUrl } }],
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// split:cancel:{splitId}
// ---------------------------------------------------------------------------

async function handleSplitCancel(ctx: BotContext, splitId: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCallbackQuery({ text: '❌ Could not identify user' });
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const splitDoc = await db.collection('splits').doc(splitId).get();

    if (!splitDoc.exists) {
      await ctx.answerCallbackQuery({ text: '❌ Split not found' });
      return;
    }

    const split = splitDoc.data()!;

    // Verify creator
    const snap = await db.collection('users').where('telegram_id', '==', userId).limit(1).get();
    const creatorId = split.creator_id ?? split.creatorId;
    const callerUserId = snap.empty ? `tg_${userId}` : snap.docs[0]!.id;

    if (callerUserId !== creatorId) {
      await ctx.answerCallbackQuery({ text: '❌ Only the split creator can cancel it' });
      return;
    }

    await db.collection('splits').doc(splitId).update({
      status: 'cancelled',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Clear active_split_id from group
    const chatId = split.telegram_chat_id ?? split.telegramChatId;
    if (chatId) {
      await db.collection('telegramGroups').doc(`tg_group_${chatId}`).update({
        active_split_id: admin.firestore.FieldValue.delete(),
        activeSplitId: admin.firestore.FieldValue.delete(),
      }).catch(() => {});
    }

    await ctx.answerCallbackQuery({ text: '✅ Split cancelled' });
    await ctx.editMessageText(
      `❌ Split "<b>${escapeHtml(split.title ?? 'Untitled')}</b>" has been cancelled.`,
      { parse_mode: 'HTML' },
    ).catch(() => {});
  } catch (err) {
    console.error('[callbacks:cancel] Error:', err);
    await ctx.answerCallbackQuery({ text: '❌ Failed to cancel split' });
  }
}

// ---------------------------------------------------------------------------
// payment:confirm:{txId}
// ---------------------------------------------------------------------------

async function handlePaymentConfirm(ctx: BotContext, txId: string): Promise<void> {
  await ctx.answerCallbackQuery();

  const txUrl = `${MINI_APP_URL}#start_param=tx_${txId}`;
  await ctx.reply('📄 View your payment receipt:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 View Receipt', web_app: { url: txUrl } }],
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// amount:{value} — quick amount selection during /split flow
// ---------------------------------------------------------------------------

async function handleAmountSelection(ctx: BotContext, value: string): Promise<void> {
  if (value === 'custom') {
    await ctx.answerCallbackQuery();
    await ctx.reply('✏️ Type the amount (e.g. 75 or $75.50):');
    return;
  }

  const amount = parseFloat(value);
  if (isNaN(amount)) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid amount' });
    return;
  }

  const title = ctx.session.pendingSplitTitle ?? 'Untitled Split';
  const participants = ctx.session.pendingSplitParticipants ?? [];
  const chatId = ctx.session.pendingSplitGroupId ?? ctx.chat?.id ?? 0;

  // Clear session
  ctx.session.awaitingAmount = false;
  ctx.session.pendingSplitTitle = undefined;
  ctx.session.pendingSplitParticipants = undefined;
  ctx.session.pendingSplitGroupId = undefined;

  await ctx.answerCallbackQuery({ text: `💰 $${amount}` });

  // Delegate to split command to do the actual creation
  const { createSplitFromCallback } = await import('../commands/split');
  await createSplitFromCallback(ctx, { title, amount, participants, chatId });
}

// ---------------------------------------------------------------------------
// settings:* callbacks
// ---------------------------------------------------------------------------

async function handleSettingsCallback(ctx: BotContext, data: string): Promise<void> {
  const parts = data.split(':');
  // settings:{type}:{value}:{chatId}
  const type = parts[1];
  const value = parts[2];
  const chatId = parseInt(parts[3] ?? '0', 10);

  if (!type || !value || !chatId) {
    await ctx.answerCallbackQuery({ text: '❌ Invalid settings action' });
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const groupRef = db.collection('telegramGroups').doc(`tg_group_${chatId}`);

    if (type === 'currency') {
      await groupRef.update({ 'settings.default_currency': value });
      await ctx.answerCallbackQuery({ text: `✅ Currency set to ${value}` });
    } else if (type === 'notifications') {
      const enabled = value === 'on';
      await groupRef.update({ 'settings.notifications_enabled': enabled });
      await ctx.answerCallbackQuery({ text: enabled ? '✅ Notifications enabled' : '🔕 Notifications muted' });
    } else {
      await ctx.answerCallbackQuery({ text: 'Unknown setting' });
    }
  } catch (err) {
    console.error('[callbacks:settings] Error:', err);
    await ctx.answerCallbackQuery({ text: '❌ Failed to update settings' });
  }
}
