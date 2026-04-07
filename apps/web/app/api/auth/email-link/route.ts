import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { sendSignInEmail } from '@/lib/server/email';

/**
 * POST /api/auth/email-link
 *
 * Generates a Firebase email sign-in link server-side.
 * - If RESEND_API_KEY is configured: sends a branded email via Resend
 * - Otherwise: returns the link so the client can fall back to Firebase's
 *   built-in sendSignInLinkToEmail (unbranded but works without Resend)
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const admin = await getFirebaseAdmin();

    // Validate origin against allowlist to prevent open redirect
    const ALLOWED_ORIGINS = [
      process.env.NEXT_PUBLIC_APP_URL,
      'https://wesplit.io',
      'https://app.wesplit.io',
      'http://localhost:3000',
    ].filter(Boolean) as string[];

    const rawOrigin = req.headers.get('origin');
    const origin = rawOrigin && ALLOWED_ORIGINS.includes(rawOrigin)
      ? rawOrigin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const redirectUrl = `${origin}/login?finishEmailLink=1&email=${encodeURIComponent(normalizedEmail)}`;

    const actionCodeSettings = {
      url: redirectUrl,
      handleCodeInApp: true,
    };

    const signInLink = await admin.auth().generateSignInWithEmailLink(
      normalizedEmail,
      actionCodeSettings,
    );

    // Build a direct app link that embeds the Firebase sign-in params
    // so the user lands on our app with the oobCode intact
    // (Firebase's /__/auth/action redirect strips these params)
    const firebaseUrl = new URL(signInLink);
    const directLink = new URL(redirectUrl);
    // Copy Firebase sign-in params to our app URL
    for (const key of ['apiKey', 'oobCode', 'mode', 'lang']) {
      const val = firebaseUrl.searchParams.get(key);
      if (val) directLink.searchParams.set(key, val);
    }
    const appSignInLink = directLink.toString();

    // Try sending branded email via Resend
    const hasResend = !!process.env.RESEND_API_KEY;

    if (hasResend) {
      const result = await sendSignInEmail({
        to: normalizedEmail,
        signInLink: appSignInLink,
      });

      if (!result.success) {
        console.error('[email-link] Resend failed, returning link for client fallback:', result.error);
        return NextResponse.json({ sent: false, useClientFallback: true });
      }

      return NextResponse.json({ sent: true });
    }

    // No Resend configured — tell client to use Firebase's built-in email
    console.log(`[email-link] No RESEND_API_KEY — client will use Firebase sendSignInLinkToEmail`);
    return NextResponse.json({ sent: false, useClientFallback: true });
  } catch (err) {
    console.error('[email-link] Error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
