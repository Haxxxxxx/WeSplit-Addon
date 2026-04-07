/**
 * Server-side Firebase token verification helper.
 * Import and call in API route handlers to enforce authentication.
 *
 * Usage:
 *   const auth = await verifyAuth(request);
 *   if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function verifyAuth(req: Request): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (error) {
    // Log the actual error so network failures are distinguishable from invalid tokens
    console.error('[verifyAuth] Token verification failed:', error);
    return null;
  }
}
