/**
 * Telegram Bot — /help command
 *
 * Lists available commands with descriptions.
 * Shows different output for DM vs group context.
 */

import type { BotContext } from '../types';

export default async function handleHelp(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  if (isGroup) {
    await ctx.reply(
      '<b>WeSplit Group Commands</b>\n\n' +
        '/split <i>title [amount]</i> — Create a new expense split\n' +
        '  <i>Examples: /split dinner, /split dinner $80 @user1 @user2</i>\n\n' +
        '/pay — Pay your share of the active split\n\n' +
        '/settle — Show who owes whom + settlement options\n\n' +
        '/balance — Check your USDC & SOL balance (sent via DM)\n\n' +
        '/members — List group members with WeSplit link status\n\n' +
        '/history — Recent splits in this group\n\n' +
        '/settings — Configure bot settings (admins only)',
      { parse_mode: 'HTML' },
    );
  } else {
    await ctx.reply(
      '<b>WeSplit Commands</b>\n\n' +
        '<b>In group chats:</b>\n' +
        '/split — Create a new expense split\n' +
        '/pay — Pay your share\n' +
        '/balance — Check your balance\n' +
        '/settle — Settle up the active split\n\n' +
        '<b>Anytime:</b>\n' +
        '/start — Welcome message + open app\n' +
        '/help — Show this message\n\n' +
        'Add WeSplit to a group to track shared expenses and split bills with friends! 🎉',
      { parse_mode: 'HTML' },
    );
  }
}
