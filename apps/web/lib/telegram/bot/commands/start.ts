/**
 * Telegram Bot — /start command
 *
 * Behavior:
 *  - In a DM with a start_param: parse deeplink and route accordingly
 *  - In a DM without param: welcome message + "Open WeSplit" button
 *  - In a group: "WeSplit Bot is ready! Use /split to get started"
 */

import type { BotContext } from '../types';
import { MINI_APP_URL, buildMiniAppUrl } from '../helpers';

export default async function handleStart(ctx: BotContext): Promise<void> {
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  const startParam = ctx.match as string | undefined;

  if (isGroup) {
    await ctx.reply(
      '👋 WeSplit is ready! Use these commands to manage expenses:\n\n' +
        '/split — Create a new split\n' +
        '/pay — Pay your share\n' +
        '/balance — Check your balance\n' +
        '/settle — Show who owes whom\n' +
        '/help — Full command list',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // DM context — check for deeplink
  if (startParam) {
    await handleDeeplink(ctx, startParam);
    return;
  }

  // DM welcome
  await ctx.reply(
    '<b>Welcome to WeSplit! 🎉</b>\n\n' +
      'Split bills, track expenses, and settle up with friends — all on Solana.\n\n' +
      '• Add me to a group to manage shared expenses\n' +
      '• Open the app to send/receive payments and manage your wallet',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '💰 Open WeSplit App',
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
      },
    },
  );
}

async function handleDeeplink(ctx: BotContext, param: string): Promise<void> {
  // Deeplink patterns: split_{id}, pay_{id}, wallet_{id}, request_{id}, group_{chatId}
  const miniAppUrl = buildMiniAppUrl(param);

  const label = getDeeplinkLabel(param);

  await ctx.reply(
    `Opening WeSplit${label ? ` — ${label}` : ''}…`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 Open in WeSplit',
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      },
    },
  );
}


function getDeeplinkLabel(param: string): string {
  if (param.startsWith('split_')) return 'Split details';
  if (param.startsWith('pay_')) return 'Pay your share';
  if (param.startsWith('wallet_')) return 'Shared wallet';
  if (param.startsWith('request_')) return 'Payment request';
  if (param.startsWith('group_')) return 'Group dashboard';
  return '';
}
