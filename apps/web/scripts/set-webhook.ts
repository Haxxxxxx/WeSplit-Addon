/**
 * One-time script to register the Telegram webhook URL.
 *
 * Run with:
 *   npx tsx scripts/set-webhook.ts
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN    — Bot token from @BotFather
 *   TELEGRAM_WEBHOOK_URL  — Public HTTPS URL of the webhook route
 *                           (e.g. https://wesplit.xyz/api/telegram/webhook)
 *   TELEGRAM_WEBHOOK_SECRET — Optional secret token for header validation
 *
 * Also sets bot commands and description.
 */

import * as https from 'node:https';
import * as http from 'node:http';

function post(url: string, body: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('❌ TELEGRAM_WEBHOOK_URL is not set');
    console.error('   Set it to your public URL, e.g. https://wesplit.xyz/api/telegram/webhook');
    process.exit(1);
  }

  const base = `https://api.telegram.org/bot${token}`;

  // 1. Set webhook
  console.log(`📡 Setting webhook to: ${webhookUrl}`);
  const webhookBody: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: [
      'message',
      'callback_query',
      'my_chat_member',
      'chat_member',
    ],
    drop_pending_updates: true,
  };

  if (secret) {
    webhookBody.secret_token = secret;
    console.log('🔒 Secret token header validation enabled');
  }

  const webhookResult = await post(`${base}/setWebhook`, webhookBody);
  console.log('Webhook result:', JSON.stringify(webhookResult, null, 2));

  // 2. Set bot commands
  console.log('\n📋 Setting bot commands…');
  const commandsResult = await post(`${base}/setMyCommands`, {
    commands: [
      { command: 'split', description: 'Create a new expense split' },
      { command: 'pay', description: 'Pay your share of the active split' },
      { command: 'balance', description: 'Check your WeSplit balance (private)' },
      { command: 'settle', description: 'Show settlement summary for active split' },
      { command: 'members', description: 'List group members with WeSplit status' },
      { command: 'history', description: 'Show recent splits in this group' },
      { command: 'settings', description: 'Configure bot settings (admins only)' },
      { command: 'help', description: 'Show available commands' },
      { command: 'start', description: 'Get started with WeSplit' },
    ],
  });
  console.log('Commands result:', JSON.stringify(commandsResult, null, 2));

  // 3. Set bot description
  console.log('\n📝 Setting bot description…');
  const descResult = await post(`${base}/setMyDescription`, {
    description:
      'WeSplit — Split bills and track expenses with friends on Solana. ' +
      'Add me to your group to manage shared expenses, create splits, and settle up instantly with USDC.',
  });
  console.log('Description result:', JSON.stringify(descResult, null, 2));

  // 4. Set short description
  const shortDescResult = await post(`${base}/setMyShortDescription`, {
    short_description: 'Split expenses and settle up with friends on Solana 💸',
  });
  console.log('Short description result:', JSON.stringify(shortDescResult, null, 2));

  console.log('\n✅ Webhook registration complete!');
  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log('   Allowed updates: message, callback_query, my_chat_member, chat_member');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
