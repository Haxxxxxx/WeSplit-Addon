/**
 * Telegram Bot — Admin commands: /settings, /members, /history
 *
 * /settings — Group admin can configure bot (currency, notifications)
 * /members  — List group members with WeSplit link status
 * /history  — Show recent splits in this group
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL } from '../helpers';

export default async function handleAdmin(ctx: BotContext): Promise<void> {
  const command = ctx.message?.text?.split(/\s+/)[0]?.replace(/^\//, '') ?? '';

  switch (command) {
    case 'settings':
      return handleSettings(ctx);
    case 'members':
      return handleMembers(ctx);
    case 'history':
      return handleHistory(ctx);
  }
}

// ---------------------------------------------------------------------------
// /settings
// ---------------------------------------------------------------------------

async function handleSettings(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const chatId = ctx.chat?.id;

  if (!isGroup || !chatId) {
    await ctx.reply('⚙️ /settings only works in group chats.');
    return;
  }

  // Check admin status (Telegram API)
  const userId = ctx.from?.id;
  if (userId) {
    try {
      const member = await ctx.getChatMember(userId);
      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      if (!isAdmin) {
        await ctx.reply('❌ Only group admins can change bot settings.');
        return;
      }
    } catch {
      // Could not verify — proceed anyway
    }
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const groupDoc = await db.collection('telegramGroups').doc(`tg_group_${chatId}`).get();
    const settings = groupDoc.exists ? (groupDoc.data()?.settings ?? {}) : {};

    const currency = settings.default_currency ?? 'USDC';
    const notifs = settings.notifications_enabled !== false;

    await ctx.reply(
      `<b>⚙️ WeSplit Bot Settings</b>\n\n` +
        `Default currency: <b>${currency}</b>\n` +
        `Notifications: <b>${notifs ? 'Enabled ✅' : 'Disabled ❌'}</b>\n\n` +
        `<i>Use the app to change settings:</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '⚙️ Open Settings',
                web_app: { url: `${MINI_APP_URL}#start_param=group_${chatId}` },
              },
            ],
            [
              {
                text: currency === 'USDC' ? '💱 Switch to SOL' : '💱 Switch to USDC',
                callback_data: `settings:currency:${currency === 'USDC' ? 'SOL' : 'USDC'}:${chatId}`,
              },
              {
                text: notifs ? '🔕 Mute Notifs' : '🔔 Unmute Notifs',
                callback_data: `settings:notifications:${notifs ? 'off' : 'on'}:${chatId}`,
              },
            ],
          ],
        },
      },
    );
  } catch (err) {
    console.error('[/settings] Error:', err);
    await ctx.reply('❌ Failed to load settings. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// /members
// ---------------------------------------------------------------------------

async function handleMembers(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const chatId = ctx.chat?.id;

  if (!isGroup || !chatId) {
    await ctx.reply('👥 /members only works in group chats.');
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const groupDoc = await db.collection('telegramGroups').doc(`tg_group_${chatId}`).get();

    if (!groupDoc.exists) {
      await ctx.reply('❌ No WeSplit data for this group. Add the bot properly first.');
      return;
    }

    const members: GroupMember[] = groupDoc.data()?.members ?? [];
    if (members.length === 0) {
      await ctx.reply('👥 No members tracked yet. Members are added when they interact with the bot.');
      return;
    }

    const lines = ['<b>👥 Group Members</b>\n'];
    for (const m of members) {
      const name = m.telegram_username ? `@${m.telegram_username}` : m.telegram_first_name;
      const linked = m.wesplit_user_id ? '✅ Linked' : '⚠️ Not linked';
      lines.push(`• ${escapeHtml(name)} — ${linked}`);
    }

    lines.push('\n<i>Members without WeSplit accounts need to open the app to link up.</i>');

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[/members] Error:', err);
    await ctx.reply('❌ Failed to load members. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// /history
// ---------------------------------------------------------------------------

async function handleHistory(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const chatId = ctx.chat?.id;

  if (!isGroup || !chatId) {
    await ctx.reply('📋 /history only works in group chats.');
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    const splitsSnap = await db
      .collection('splits')
      .where('telegram_group_id', '==', `tg_group_${chatId}`)
      .orderBy('created_at', 'desc')
      .limit(5)
      .get();

    if (splitsSnap.empty) {
      await ctx.reply('📋 No splits yet in this group. Create one with /split <title>');
      return;
    }

    const lines = ['<b>📋 Recent Splits</b>\n'];
    for (const doc of splitsSnap.docs) {
      const s = doc.data();
      const status = s.status === 'completed' ? '✅' : s.status === 'cancelled' ? '❌' : '⏳';
      const amount = (s.total_amount ?? s.totalAmount ?? 0).toFixed(2);
      const title = s.title ?? 'Untitled';
      lines.push(`${status} <b>${escapeHtml(title)}</b> — $${amount} USDC`);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[/history] Error:', err);
    await ctx.reply('❌ Failed to load history. Please try again.');
  }
}

interface GroupMember {
  telegram_id: number;
  telegram_username?: string;
  telegram_first_name: string;
  wesplit_user_id?: string;
  is_admin: boolean;
}

