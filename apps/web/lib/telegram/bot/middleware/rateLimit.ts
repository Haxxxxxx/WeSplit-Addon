/**
 * Telegram Bot — Rate Limiting Middleware
 *
 * Protects the bot from command spam and abuse with in-memory sliding-window
 * rate limiters. Uses module-level Maps so the counters survive across
 * requests within the same serverless instance (best-effort; reset on cold start).
 *
 * Limits enforced:
 *  - Per-user: max 10 commands per minute
 *  - Per-group: max 30 messages per minute
 *  - /split creation cooldown: 1 per group per 5 minutes
 */

import type { NextFunction } from 'grammy';
import type { BotContext } from '../types';

// ---------------------------------------------------------------------------
// In-memory sliding-window state
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  windowStart: number;
}

const userWindows = new Map<number, WindowEntry>();
const groupWindows = new Map<number, WindowEntry>();
const splitCooldowns = new Map<number, number>(); // chatId → last split timestamp

const USER_MAX = 10;        // commands per user per minute
const GROUP_MAX = 30;       // messages per group per minute
const SPLIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes in ms
const WINDOW_MS = 60 * 1000;          // 1 minute

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkWindow(map: Map<number, WindowEntry>, key: number, max: number): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    map.set(key, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= max) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

// ---------------------------------------------------------------------------
// rateLimitMiddleware
//
// Drop-in grammY middleware. Call bot.use(rateLimitMiddleware) before command
// handlers so it runs on every update.
// ---------------------------------------------------------------------------

export async function rateLimitMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // Per-user limit
  if (userId) {
    const allowed = checkWindow(userWindows, userId, USER_MAX);
    if (!allowed) {
      // Silently drop — do NOT reply to avoid feedback loops with spam bots
      return;
    }
  }

  // Per-group limit
  if (isGroup && chatId) {
    const allowed = checkWindow(groupWindows, chatId, GROUP_MAX);
    if (!allowed) {
      return; // silently drop
    }
  }

  await next();
}

// ---------------------------------------------------------------------------
// checkSplitCooldown
//
// Returns true if the group is allowed to create a new split (no cooldown
// active). If allowed, records the timestamp for the next cooldown window.
// Call this from the /split command handler BEFORE creating the split.
// ---------------------------------------------------------------------------

export function checkSplitCooldown(chatId: number): boolean {
  const now = Date.now();
  const last = splitCooldowns.get(chatId);

  if (last && now - last < SPLIT_COOLDOWN) {
    return false; // still in cooldown
  }

  splitCooldowns.set(chatId, now);
  return true; // allowed
}

// ---------------------------------------------------------------------------
// resetSplitCooldown
//
// Called when a split is cancelled or completed — allows the group to create
// another split immediately without waiting for the cooldown to expire.
// ---------------------------------------------------------------------------

export function resetSplitCooldown(chatId: number): void {
  splitCooldowns.delete(chatId);
}
