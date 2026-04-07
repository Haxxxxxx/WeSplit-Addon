import { type NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Auth middleware — Firebase ID token validation (Edge Runtime)
//
// The AuthProvider stores the Firebase ID token as the `wesplit-session`
// cookie value (set via onIdTokenChanged so it auto-refreshes every hour).
//
// Middleware decodes the JWT payload and validates:
//   - `exp`  — token has not expired
//   - `iss`  — token was issued by our Firebase project
//   - `aud`  — token audience matches our project ID
//
// NOTE: Cryptographic signature verification (JWKS) is intentionally skipped
// here because it requires a network call to Google which adds latency to
// every navigation. Signature verification happens server-side in API routes
// that use firebase-admin. Middleware guards redirects only — Firestore
// security rules remain the ultimate authority on data access.
// ---------------------------------------------------------------------------

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'wesplit-35186';
const FIREBASE_ISS = `https://securetoken.google.com/${PROJECT_ID}`;

/** Routes that do NOT require authentication */
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/verify',
  '/tg',        // Telegram Mini App — auth handled by TelegramProvider
  '/_next',
  '/favicon.ico',
  '/api',
];

/** Routes that require authentication (app group) */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/send',
  '/request',
  '/deposit',
  '/withdraw',
  '/wallets',
  '/shared-wallets',
  '/splits',
  '/transactions',
  '/contacts',
  '/rewards',
  '/settings',
  '/notifications',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Decode a JWT's payload section (base64url → JSON).
 * Does NOT verify the cryptographic signature.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1]!;
    // Base64url → Base64 standard, then pad to 4-char boundary
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Returns true if the cookie value contains a non-expired Firebase ID token
 * issued for this project.
 *
 * Guards against:
 *  - Old `=1` flag cookies (too short to be a JWT)
 *  - Expired tokens
 *  - Tokens for wrong Firebase project (wrong iss/aud)
 *
 * Does NOT verify the JWT signature (no JWKS fetch in Edge Runtime).
 */
function isValidSession(cookieValue: string | undefined): boolean {
  // Reject clearly invalid values — old "=1" flag, empty, too short to be a JWT
  if (!cookieValue || cookieValue.length < 100) return false;

  const payload = decodeJwtPayload(cookieValue);
  if (!payload) return false;

  const nowSec = Math.floor(Date.now() / 1000);

  // Token must not be expired
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return false;

  // Token must originate from our Firebase project
  if (payload.iss !== FIREBASE_ISS) return false;

  // Token must be intended for our project
  if (payload.aud !== PROJECT_ID) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get('wesplit-session');
  const isAuthenticated = isValidSession(sessionCookie?.value);

  // ------------------------------------------------------------------
  // 1. Unauthenticated user hits a protected route → redirect to login
  // ------------------------------------------------------------------
  if (isProtected(pathname) && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Preserve intended destination for post-login redirect
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ------------------------------------------------------------------
  // 2. Authenticated user hits an auth page → redirect to dashboard
  // ------------------------------------------------------------------
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ------------------------------------------------------------------
  // 3. Root redirect handled in app/page.tsx — just pass through here
  // ------------------------------------------------------------------
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
