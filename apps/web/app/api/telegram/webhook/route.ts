/**
 * POST /api/telegram/webhook
 *
 * Receives updates from Telegram, validates the secret token header,
 * and passes them to the grammY bot instance.
 *
 * Security:
 *  - Validates `X-Telegram-Bot-Api-Secret-Token` header (set during webhook registration)
 *  - Bot token is server-only (never in client bundle)
 *  - All Firestore writes use Firebase Admin SDK
 *
 * The bot instance is a module-level singleton (created once, reused across cold starts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/telegram/bot';

// ---------------------------------------------------------------------------
// POST — Telegram webhook handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // -------------------------------------------------------------------------
    // 1. Validate webhook secret token (prevents spoofed updates)
    // -------------------------------------------------------------------------
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] TELEGRAM_WEBHOOK_SECRET is not configured — rejecting all requests');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secretHeader || secretHeader !== webhookSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // -------------------------------------------------------------------------
    // 2. Parse update JSON
    // -------------------------------------------------------------------------
    let update: object;
    try {
      update = await request.json();
    } catch {
      console.error('[Webhook] Failed to parse request body as JSON');
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // 3. Pass to grammY bot
    // -------------------------------------------------------------------------
    const bot = getBot();
    await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Log but always return 200 to Telegram (prevents retry storm)
    console.error('[Webhook] Unhandled error:', err);
    return NextResponse.json({ ok: true });
  }
}

// ---------------------------------------------------------------------------
// GET — health check (optional, useful for debugging)
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'wesplit-telegram-bot',
    timestamp: new Date().toISOString(),
  });
}
