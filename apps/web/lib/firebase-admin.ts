/**
 * Firebase Admin SDK — Shared server-side helper
 *
 * Lazy-imports firebase-admin to avoid bundling in client code.
 * Used by API routes that need to mint custom tokens or access Firestore server-side.
 */
import 'server-only';

export async function getFirebaseAdmin() {
  const admin = await import('firebase-admin');

  // Use try/catch to safely handle concurrent cold starts (race condition guard)
  if (!admin.default.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    // AR-C4: Fail loudly in production if service account is missing
    if (!serviceAccountKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required in production');
      }
      console.warn('[firebase-admin] No FIREBASE_SERVICE_ACCOUNT_KEY — using Application Default Credentials (dev only)');
    }

    const serviceAccount = serviceAccountKey
      ? JSON.parse(serviceAccountKey)
      : undefined;

    try {
      admin.default.initializeApp(
        serviceAccount
          ? {
              credential: admin.default.credential.cert(serviceAccount),
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wesplit-35186',
            }
          : {
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wesplit-35186',
            },
      );
    } catch {
      // Another concurrent call already initialized — safe to ignore
    }
  }

  return admin.default;
}
