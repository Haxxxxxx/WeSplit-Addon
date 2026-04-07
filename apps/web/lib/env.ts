/**
 * Typed environment variable accessors with runtime validation.
 * Server secrets use lazy getters (called at request time, not build time).
 * Public vars have safe defaults for build-time static analysis.
 */

// --- Firebase (client-side public vars) ---
export const env = {
  // Firebase
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'wesplit-35186.firebaseapp.com',
  FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'wesplit-35186',
  FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'wesplit-35186.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',

  // Solana
  SOLANA_NETWORK: (process.env.NEXT_PUBLIC_NETWORK ?? 'devnet') as
    | 'mainnet-beta'
    | 'devnet',
  FORCE_MAINNET: process.env.NEXT_PUBLIC_FORCE_MAINNET === 'true',

  // RPC endpoints — server-only (proxied via /api/rpc on client)
  // These are NOT NEXT_PUBLIC_ — they stay server-side only
} as const;

/**
 * Get a required server-only secret. Throws at request time if missing.
 * Never call at module load — only call inside API route handlers.
 */
export function getServerSecret(key: 'FIREBASE_SERVICE_ACCOUNT_KEY' | 'TELEGRAM_BOT_TOKEN' | 'RESEND_API_KEY'): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required server environment variable: ${key}. ` +
      `Ensure it is set in .env.local or your deployment environment.`
    );
  }
  return value;
}

/**
 * Validate that all required public env vars are present.
 * Call this from the root layout or a startup check to catch misconfigs early.
 */
export function validatePublicEnv(): void {
  const required: Array<keyof typeof env> = [
    'FIREBASE_API_KEY',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
  ];

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    console.error(
      `[WeSplit] Missing required environment variables: ${missing.join(', ')}. ` +
      `Copy .env.local.example to .env.local and fill in the values.`
    );
  }
}
