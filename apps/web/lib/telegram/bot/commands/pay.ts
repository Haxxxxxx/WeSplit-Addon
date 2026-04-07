/**
 * Telegram Bot — /pay command
 *
 * Usage:
 *   /pay           — Pay your share of the active split in this group
 *   /pay @user $50 — Direct payment to a user
 *
 * Opens Mini App with pre-filled payment context via start_param.
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { MINI_APP_URL } from '../helpers';

export default async function handlePay(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const chatId = ctx.chat?.id;

  if (!isGroup || !chatId) {
    await ctx.reply(
      '💳 To pay a split, use /pay in the group chat where the split was created.',
    );
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // Get the active split for this group
    const groupDoc = await db.collection('telegramGroups').doc(`tg_group_${chatId}`).get();
    if (!groupDoc.exists) {
      await ctx.reply(
        '❌ No WeSplit data found for this group.\n\nCreate a split first with /split',
      );
      return;
    }

    const groupData = groupDoc.data();
    const activeSplitId = groupData?.active_split_id;

    if (!activeSplitId) {
      await ctx.reply(
        '📋 No active split in this group.\n\nCreate one with /split <title>',
      );
      return;
    }

    const payUrl = `${MINI_APP_URL}#start_param=pay_${activeSplitId}`;

    await ctx.reply(
      '💳 Open the app to pay your share:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💳 Pay My Share',
                web_app: { url: payUrl },
              },
            ],
          ],
        },
      },
    );
  } catch (err) {
    console.error('[/pay] Error:', err);
    await ctx.reply('❌ Failed to load split data. Please try again.');
  }
}
