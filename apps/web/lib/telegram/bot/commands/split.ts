/**
 * Telegram Bot — /split command
 *
 * Usage:
 *   /split dinner          — Creates split "dinner", asks for amount
 *   /split dinner $100     — Creates split "dinner" for $100
 *   /split dinner $100 @user1 @user2  — Split with specific participants
 *
 * Requirements:
 *  - Must be used in a group chat
 *  - User must have a WeSplit account (prompt to open app if not)
 *  - Creates splits/ doc in Firestore with telegram_group_id field
 *  - Updates telegramGroups/{id}.active_split_id
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL, lookupUserByTelegramId } from '../helpers';

export default async function handleSplit(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (!isGroup) {
    await ctx.reply(
      '📋 /split only works in group chats.\n\nAdd me to a group to start splitting expenses!',
    );
    return;
  }

  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    await ctx.reply('❌ Could not identify user or chat.');
    return;
  }

  // Check if user has a linked WeSplit account
  const wesplitUser = await lookupUserByTelegramId(userId);
  if (!wesplitUser) {
    await ctx.reply(
      '👋 You need a WeSplit account to create splits.\n\nOpen the app to get started:',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💰 Open WeSplit',
                web_app: { url: MINI_APP_URL },
              },
            ],
          ],
        },
      },
    );
    return;
  }

  // Parse command arguments: /split [title] [$amount] [@user1] [@user2]...
  const text = ctx.message?.text ?? '';
  const args = parseArgs(text);

  if (!args.title) {
    await ctx.reply(
      '❌ Please provide a title.\n\nExamples:\n' +
        '/split dinner\n' +
        '/split dinner $80\n' +
        '/split dinner $80 @user1 @user2',
    );
    return;
  }

  // If amount not provided, ask for it
  if (!args.amount) {
    ctx.session.awaitingAmount = true;
    ctx.session.pendingSplitTitle = args.title;
    ctx.session.pendingSplitParticipants = args.participants;
    ctx.session.pendingSplitGroupId = chatId;
    ctx.session.lastCommand = 'split';
    ctx.session.lastCommandAt = new Date().toISOString();

    await ctx.reply(
      `💬 How much is the total for <b>${escapeHtml(args.title)}</b>?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '$20', callback_data: `amount:20` },
              { text: '$50', callback_data: `amount:50` },
              { text: '$100', callback_data: `amount:100` },
            ],
            [
              { text: '$200', callback_data: `amount:200` },
              { text: '$500', callback_data: `amount:500` },
              { text: 'Custom', callback_data: `amount:custom` },
            ],
          ],
        },
      },
    );
    return;
  }

  await createSplit(ctx, { title: args.title, amount: args.amount, participants: args.participants, chatId });
}

/**
 * Handle text reply when bot is awaiting split amount.
 * Called from bot/index.ts `message:text` handler.
 */
export async function handleAmountReply(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text?.trim() ?? '';

  // Try to parse amount from text (e.g. "80", "$80", "80 USD")
  const amountMatch = text.match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch || !amountMatch[1]) {
    await ctx.reply('❌ Please enter a valid amount (e.g. 80 or $80)');
    return;
  }

  const amount = parseFloat(amountMatch[1]);
  const title = ctx.session.pendingSplitTitle ?? 'Untitled Split';
  const participants = ctx.session.pendingSplitParticipants ?? [];
  const chatId = ctx.session.pendingSplitGroupId ?? ctx.chat?.id ?? 0;

  // Clear awaiting state
  ctx.session.awaitingAmount = false;
  ctx.session.pendingSplitTitle = undefined;
  ctx.session.pendingSplitParticipants = undefined;
  ctx.session.pendingSplitGroupId = undefined;

  await createSplit(ctx, { title, amount, participants, chatId });
}

// ---------------------------------------------------------------------------
// Core: create the split in Firestore
// ---------------------------------------------------------------------------

interface SplitArgs {
  title: string;
  amount: number;
  participants: string[];
  chatId: number;
}

/** Public entry point for callback handler (quick-amount button selection) */
export async function createSplitFromCallback(ctx: BotContext, args: SplitArgs): Promise<void> {
  return createSplit(ctx, args);
}

async function createSplit(ctx: BotContext, { title, amount, participants, chatId }: SplitArgs): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ?? ctx.from?.first_name ?? 'Unknown';

  if (!userId) {
    await ctx.reply('❌ Could not identify user.');
    return;
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // Find creator's WeSplit user doc
    const wesplitUser = await lookupUserByTelegramId(userId);
    if (!wesplitUser) {
      await ctx.reply('❌ Could not find your WeSplit account. Please open the app first.');
      return;
    }

    const splitId = db.collection('splits').doc().id;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Get current group members for participant list
    const groupDoc = await db.collection('telegramGroups').doc(`tg_group_${chatId}`).get();
    const groupData = groupDoc.exists ? groupDoc.data() : null;
    const groupMembers = groupData?.members ?? [];

    // Build participants list — creator + mentioned users
    const creatorParticipant = {
      user_id: wesplitUser.id,
      userId: wesplitUser.id,
      name: wesplitUser.name ?? username,
      wallet_address: wesplitUser.wallet_address ?? wesplitUser.telegram_wallet_address ?? '',
      walletAddress: wesplitUser.wallet_address ?? wesplitUser.telegram_wallet_address ?? '',
      amount_owed: amount, // Will be recalculated when all participants confirmed
      amountOwed: amount,
      status: 'paid' as const,
      telegram_id: userId,
      telegramId: userId,
      telegram_username: ctx.from?.username ?? '',
      telegramUsername: ctx.from?.username ?? '',
    };

    // Create the split document (dual camelCase + snake_case format)
    const splitData = {
      // snake_case
      split_id: splitId,
      title,
      total_amount: amount,
      currency: 'USDC',
      status: 'pending',
      creator_id: wesplitUser.id,
      telegram_group_id: `tg_group_${chatId}`,
      telegram_chat_id: chatId,
      created_at: now,
      updated_at: now,
      participants: [creatorParticipant],
      split_type: 'equal',
      // camelCase (for mobile compatibility)
      splitId,
      totalAmount: amount,
      creatorId: wesplitUser.id,
      telegramGroupId: `tg_group_${chatId}`,
      telegramChatId: chatId,
      createdAt: now,
      updatedAt: now,
      splitType: 'equal',
    };

    await db.collection('splits').doc(splitId).set(splitData);

    // Update group's active_split_id
    await db.collection('telegramGroups').doc(`tg_group_${chatId}`).update({
      active_split_id: splitId,
      activeSplitId: splitId,
      total_splits_created: admin.firestore.FieldValue.increment(1),
      totalSplitsCreated: admin.firestore.FieldValue.increment(1),
    }).catch(() => {
      // Group doc may not exist yet if lifecycle handler hasn't fired
    });

    const splitUrl = `${MINI_APP_URL}#start_param=split_${splitId}`;

    // Confirmation message with inline keyboard
    await ctx.reply(
      `<b>💸 New Split: ${escapeHtml(title)}</b>\n\n` +
        `💰 Total: <b>$${amount.toFixed(2)} USDC</b>\n` +
        `👤 Created by: @${escapeHtml(username)}\n` +
        `📋 Split ID: <code>${splitId.slice(0, 8)}…</code>\n\n` +
        `<i>Open the app to add participants and set individual amounts.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📋 Open Details',
                web_app: { url: splitUrl },
              },
            ],
            [
              {
                text: '💳 Pay My Share',
                callback_data: `split:pay:${splitId}`,
              },
              {
                text: '❌ Cancel',
                callback_data: `split:cancel:${splitId}`,
              },
            ],
          ],
        },
      },
    );
  } catch (err) {
    console.error('[/split] Error creating split:', err);
    await ctx.reply('❌ Failed to create split. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedArgs {
  title: string;
  amount: number | null;
  participants: string[];
}

function parseArgs(text: string): ParsedArgs {
  // Remove /split command prefix
  const content = text.replace(/^\/split\s*/i, '').trim();

  const parts = content.split(/\s+/);
  const participants: string[] = [];
  let amount: number | null = null;
  const titleParts: string[] = [];

  for (const part of parts) {
    if (part.startsWith('@')) {
      participants.push(part.slice(1));
    } else if (/^\$?\d+(?:\.\d{1,2})?$/.test(part)) {
      amount = parseFloat(part.replace('$', ''));
    } else {
      titleParts.push(part);
    }
  }

  return {
    title: titleParts.join(' '),
    amount,
    participants,
  };
}

