/**
 * Telegram Bot — /settle command
 *
 * Shows who owes whom in the active split for this group.
 * Calculates net balances between all participants.
 * Creator can use /settle close to mark split as completed.
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL, lookupUserByTelegramId } from '../helpers';

export default async function handleSettle(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const chatId = ctx.chat?.id;

  if (!isGroup || !chatId) {
    await ctx.reply(
      '📊 Use /settle in the group chat where the split was created.',
    );
    return;
  }

  const text = ctx.message?.text ?? '';
  const isClose = /\bclose\b/i.test(text);

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    const groupDoc = await db.collection('telegramGroups').doc(`tg_group_${chatId}`).get();
    if (!groupDoc.exists) {
      await ctx.reply('❌ No WeSplit data for this group. Create a split with /split');
      return;
    }

    const groupData = groupDoc.data();
    const activeSplitId = groupData?.active_split_id;

    if (!activeSplitId) {
      await ctx.reply('📋 No active split in this group. Create one with /split <title>');
      return;
    }

    const splitDoc = await db.collection('splits').doc(activeSplitId).get();
    if (!splitDoc.exists) {
      await ctx.reply('❌ Could not load split data. It may have been deleted.');
      return;
    }

    const split = splitDoc.data()!;
    const participants: Participant[] = split.participants ?? [];
    const title = split.title ?? 'Untitled Split';
    const totalAmount = split.total_amount ?? split.totalAmount ?? 0;

    if (isClose) {
      // Only creator can close the split
      const userId = ctx.from?.id;
      const wesplitUser = userId ? await lookupUserByTelegramId(userId) : null;
      const creatorId = split.creator_id ?? split.creatorId;

      if (wesplitUser?.id !== creatorId) {
        await ctx.reply('❌ Only the split creator can close it.');
        return;
      }

      await db.collection('splits').doc(activeSplitId).update({
        status: 'completed',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completed_at: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('telegramGroups').doc(`tg_group_${chatId}`).update({
        active_split_id: admin.firestore.FieldValue.delete(),
        activeSplitId: admin.firestore.FieldValue.delete(),
      });

      await ctx.reply(
        `✅ <b>Split "${escapeHtml(title)}" closed!</b>\n\nAll done — thanks everyone! 🎉`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Show settlement summary
    const settled = participants.filter((p) => p.status === 'paid');
    const pending = participants.filter((p) => p.status !== 'paid');
    const paidAmount = settled.reduce((sum, p) => sum + (p.amount_owed ?? p.amountOwed ?? 0), 0);
    const settleUrl = `${MINI_APP_URL}#start_param=split_${activeSplitId}`;

    const lines = [
      `<b>📊 Settlement: ${escapeHtml(title)}</b>`,
      `💰 Total: $${totalAmount.toFixed(2)} USDC`,
      `✅ Collected: $${paidAmount.toFixed(2)} / $${totalAmount.toFixed(2)}`,
      '',
    ];

    if (settled.length > 0) {
      lines.push('<b>✅ Paid:</b>');
      settled.forEach((p) => {
        lines.push(`  • ${escapeHtml(p.name ?? p.telegram_username ?? 'Unknown')} — $${(p.amount_owed ?? p.amountOwed ?? 0).toFixed(2)}`);
      });
      lines.push('');
    }

    if (pending.length > 0) {
      lines.push('<b>⏳ Pending:</b>');
      pending.forEach((p) => {
        lines.push(`  • ${escapeHtml(p.name ?? p.telegram_username ?? 'Unknown')} — $${(p.amount_owed ?? p.amountOwed ?? 0).toFixed(2)}`);
      });
    }

    if (pending.length === 0) {
      lines.push('🎉 Everyone has paid! Use /settle close to close the split.');
    }

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📋 View Full Details',
              web_app: { url: settleUrl },
            },
          ],
        ],
      },
    });
  } catch (err) {
    console.error('[/settle] Error:', err);
    await ctx.reply('❌ Failed to load settlement data. Please try again.');
  }
}

interface Participant {
  name?: string;
  telegram_username?: string;
  status?: string;
  amount_owed?: number;
  amountOwed?: number;
}

