/**
 * Telegram Bot — /balance command
 *
 * Shows user's USDC + SOL balance from Firestore user doc.
 * Response is sent as DM (not in group) for privacy.
 */

import type { BotContext } from '../types';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { escapeHtml, MINI_APP_URL } from '../helpers';

export default async function handleBalance(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Could not identify user.');
    return;
  }

  // Always reply via DM for privacy
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  if (isGroup) {
    await ctx.reply('💬 Sending your balance as a private message…');
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();

    // Look up user by telegram_id
    let userDoc: FirebaseFirestore.DocumentData | null = null;
    let userId_str: string | null = null;

    const snap = await db
      .collection('users')
      .where('telegram_id', '==', userId)
      .limit(1)
      .get();

    if (!snap.empty) {
      userDoc = snap.docs[0]!.data();
      userId_str = snap.docs[0]!.id;
    } else {
      // Try tg_ prefixed UID
      const tgDoc = await db.collection('users').doc(`tg_${userId}`).get();
      if (tgDoc.exists) {
        userDoc = tgDoc.data()!;
        userId_str = tgDoc.id;
      }
    }

    if (!userDoc || !userId_str) {
      // No account — prompt to create one
      await ctx.api.sendMessage(
        userId,
        '👋 You don\'t have a WeSplit account yet.\n\nOpen the app to get started:',
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

    const usdc = userDoc.usdc_balance ?? userDoc.usdcBalance ?? 0;
    const sol = userDoc.sol_balance ?? userDoc.solBalance ?? 0;
    const name = userDoc.name ?? userDoc.telegram_username ?? 'User';

    const walletAddress = userDoc.telegram_wallet_address ?? userDoc.wallet_address ?? userDoc.web_wallet_address ?? null;

    const lines = [
      `<b>💰 ${escapeHtml(name)}'s Balance</b>\n`,
      `USDC: <b>$${Number(usdc).toFixed(2)}</b>`,
      `SOL: <b>${Number(sol).toFixed(4)} SOL</b>`,
    ];

    if (!walletAddress) {
      lines.push('\n⚠️ No wallet set up yet. Open the app to create one.');
    }

    await ctx.api.sendMessage(userId, lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: walletAddress
        ? undefined
        : {
            inline_keyboard: [
              [
                {
                  text: '💳 Set Up Wallet',
                  web_app: { url: MINI_APP_URL },
                },
              ],
            ],
          },
    });
  } catch (err) {
    console.error('[/balance] Error:', err);
    // If DM failed (user hasn't started bot), tell them in group
    await ctx.reply(
      '❌ Could not send balance. Please start a DM with me first: @WeSplitBot',
    ).catch(() => {});
  }
}

