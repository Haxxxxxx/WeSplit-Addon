/**
 * Telegram Bot — grammY Bot Instance (module-level singleton)
 *
 * The bot is created once and reused across webhook invocations.
 * All middleware, session, and command handlers are registered here.
 *
 * Architecture:
 *  - Runs as a serverless webhook (NOT long-polling)
 *  - All heavy operations use Firebase Admin SDK via `getFirebaseAdmin()`
 *  - Session state is stored in Firestore `telegramBotSessions`
 *
 * Middleware stack (in order):
 *  1. Error boundary — catches unhandled errors, logs and replies gracefully
 *  2. Session — Firestore-backed session storage
 *  3. Command handlers — /start, /help, /split, /pay, /balance, /settle
 *  4. Callback query handlers — inline keyboard button presses
 *  5. web_app_data handler — Mini App → Bot messages
 */

import { Bot, session } from 'grammy';
import type { BotContext, SessionData } from './types';
import { FirestoreSessionAdapter } from './session';
import { initialSessionData } from './types';
import { rateLimitMiddleware } from './middleware/rateLimit';

// ---------------------------------------------------------------------------
// Singleton guard
// ---------------------------------------------------------------------------

let _bot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (_bot) return _bot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('[TelegramBot] TELEGRAM_BOT_TOKEN is not set');
  }

  const bot = new Bot<BotContext>(token);

  // -------------------------------------------------------------------------
  // 1. Error boundary middleware
  // -------------------------------------------------------------------------
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[TelegramBot] Error for update ${ctx.update.update_id}:`, err.error);

    // Try to notify the user, but don't crash if it fails
    ctx.reply('⚠️ Something went wrong. Please try again in a moment.').catch(() => {});
  });

  // -------------------------------------------------------------------------
  // 2. Session middleware (Firestore-backed)
  // -------------------------------------------------------------------------
  const adapter = new FirestoreSessionAdapter();
  bot.use(
    session<SessionData, BotContext>({
      initial: initialSessionData,
      storage: adapter,
    }),
  );

  // -------------------------------------------------------------------------
  // 3. Rate limiting middleware (runs before all commands)
  // -------------------------------------------------------------------------
  bot.use(rateLimitMiddleware);

  // -------------------------------------------------------------------------
  // 4. Command handlers (registered lazily — imported when first needed)
  // -------------------------------------------------------------------------

  // /start — DM welcome or group introduction
  bot.command('start', async (ctx) => {
    const { default: handleStart } = await import('./commands/start');
    return handleStart(ctx);
  });

  // /help — command list
  bot.command('help', async (ctx) => {
    const { default: handleHelp } = await import('./commands/help');
    return handleHelp(ctx);
  });

  // /split — create a split in the current group
  bot.command('split', async (ctx) => {
    const { default: handleSplit } = await import('./commands/split');
    return handleSplit(ctx);
  });

  // /pay — pay your share of the active split
  bot.command('pay', async (ctx) => {
    const { default: handlePay } = await import('./commands/pay');
    return handlePay(ctx);
  });

  // /balance — check your WeSplit balance (responds via DM for privacy)
  bot.command('balance', async (ctx) => {
    const { default: handleBalance } = await import('./commands/balance');
    return handleBalance(ctx);
  });

  // /settle — show settlement summary for active split
  bot.command('settle', async (ctx) => {
    const { default: handleSettle } = await import('./commands/settle');
    return handleSettle(ctx);
  });

  // /settings, /members, /history — admin commands
  bot.command(['settings', 'members', 'history'], async (ctx) => {
    const { default: handleAdmin } = await import('./commands/admin');
    return handleAdmin(ctx);
  });

  // -------------------------------------------------------------------------
  // 4. Callback query handlers (inline keyboard buttons)
  // -------------------------------------------------------------------------
  bot.on('callback_query:data', async (ctx) => {
    const { default: handleCallback } = await import('./handlers/callbacks');
    return handleCallback(ctx);
  });

  // -------------------------------------------------------------------------
  // 5. web_app_data handler (Mini App → Bot communication)
  // -------------------------------------------------------------------------
  bot.on('message:web_app_data', async (ctx) => {
    const { default: handleWebAppData } = await import('./handlers/webAppData');
    return handleWebAppData(ctx);
  });

  // -------------------------------------------------------------------------
  // 6. Group lifecycle events (bot added/removed, member join/leave)
  // -------------------------------------------------------------------------
  bot.on('my_chat_member', async (ctx) => {
    const { handleMyChatMember } = await import('./handlers/groupEvents');
    return handleMyChatMember(ctx);
  });

  bot.on('chat_member', async (ctx) => {
    const { handleChatMember } = await import('./handlers/groupEvents');
    return handleChatMember(ctx);
  });

  // -------------------------------------------------------------------------
  // 7. Handle text messages while awaiting split amount
  // -------------------------------------------------------------------------
  bot.on('message:text', async (ctx) => {
    if (ctx.session.awaitingAmount) {
      const { handleAmountReply } = await import('./commands/split');
      return handleAmountReply(ctx);
    }
    // Ignore other text messages
  });

  // -------------------------------------------------------------------------
  // 8. Inline query handler (@WeSplitBot in any chat)
  // -------------------------------------------------------------------------
  bot.on('inline_query', async (ctx) => {
    const { default: handleInlineQuery } = await import('./handlers/inline');
    return handleInlineQuery(ctx);
  });

  _bot = bot;
  return bot;
}
