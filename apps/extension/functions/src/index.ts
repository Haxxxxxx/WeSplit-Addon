/**
 * WeSplit Cloud Functions for Authentication
 *
 * Deploy these functions to Firebase to enable QR code, passkey, and
 * passwordless authentication for the browser extension.
 *
 * Commands:
 * - cd functions && npm install
 * - firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Configuration
const RP_ID = 'wesplit.app'; // Your domain - change this to match your app
const CODE_EXPIRY_MINUTES = 10;
const CHALLENGE_EXPIRY_MINUTES = 5;

/**
 * Generate a random challenge/code
 */
function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================
// QR CODE AUTHENTICATION (Primary Method)
// ============================================

/**
 * Approve a QR session from the mobile app
 * Called when user scans QR and taps "Approve"
 */
export const approveQRSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { sessionId } = data;
  const userId = context.auth.uid;

  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
  }

  // Get the QR session
  const sessionRef = db.collection('qr_sessions').doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }

  const sessionData = sessionDoc.data();
  if (!sessionData) {
    throw new functions.https.HttpsError('not-found', 'Session data not found');
  }

  // Check if session is expired
  if (sessionData.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError('failed-precondition', 'Session has expired');
  }

  // Check if session is in pending or scanned status
  if (sessionData.status !== 'pending' && sessionData.status !== 'scanned') {
    throw new functions.https.HttpsError('failed-precondition', 'Session cannot be approved');
  }

  // Get user data
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  // Generate custom token for the extension
  const customToken = await admin.auth().createCustomToken(userId);

  // Update session with approval
  await sessionRef.update({
    status: 'approved',
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    userId,
    userEmail: userData?.email || context.auth.token.email,
    userName: userData?.name || context.auth.token.name || 'User',
    userAvatar: userData?.avatar || context.auth.token.picture,
    customToken,
  });

  return { success: true };
});

/**
 * Reject a QR session from the mobile app
 */
export const rejectQRSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { sessionId } = data;

  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
  }

  const sessionRef = db.collection('qr_sessions').doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }

  await sessionRef.update({
    status: 'rejected',
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Mark QR session as scanned (called from mobile when scanning)
 */
export const markQRSessionScanned = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { sessionId } = data;
  const userId = context.auth.uid;

  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
  }

  const sessionRef = db.collection('qr_sessions').doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }

  const sessionData = sessionDoc.data();
  if (!sessionData || sessionData.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', 'Session cannot be scanned');
  }

  // Get user data for display on extension
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  await sessionRef.update({
    status: 'scanned',
    scannedAt: admin.firestore.FieldValue.serverTimestamp(),
    userName: userData?.name || context.auth.token.name || 'User',
    userAvatar: userData?.avatar || context.auth.token.picture,
  });

  return {
    success: true,
    deviceInfo: sessionData.deviceInfo,
  };
});

// ============================================
// EMAIL VERIFICATION CODE
// ============================================

/**
 * Send a verification code to the user's email
 */
export const sendVerificationCode = functions.https.onCall(async (data) => {
  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  // Find user by email
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).limit(1).get();

  if (snapshot.empty) {
    // Don't reveal if user exists - still return success
    functions.logger.info('User not found for verification code', { email });
    return { success: true };
  }

  const userDoc = snapshot.docs[0];
  const code = generateVerificationCode();
  const expiresAt = Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000;

  // Store the verification code
  await db.collection('verification_codes').doc(`${email}_${code}`).set({
    email,
    code,
    userId: userDoc.id,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    used: false,
  });

  // TODO: Send email with the code
  // Use Firebase Extensions (SendGrid, Mailgun) or a custom email service
  functions.logger.info('Verification code generated', { email, code });

  return { success: true };
});

/**
 * Verify the email code and return a custom Firebase token
 */
export const verifyEmailCode = functions.https.onCall(async (data) => {
  const { email, code } = data;

  if (!email || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and code are required');
  }

  const codeRef = db.collection('verification_codes').doc(`${email}_${code}`);
  const codeDoc = await codeRef.get();

  if (!codeDoc.exists) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid verification code');
  }

  const codeData = codeDoc.data();
  if (!codeData) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid verification code');
  }

  if (codeData.used) {
    throw new functions.https.HttpsError('invalid-argument', 'Code has already been used');
  }

  if (codeData.expiresAt < Date.now()) {
    await codeRef.delete();
    throw new functions.https.HttpsError('invalid-argument', 'Code has expired');
  }

  if (codeData.email !== email) {
    throw new functions.https.HttpsError('invalid-argument', 'Code does not match email');
  }

  // Mark code as used
  await codeRef.update({ used: true });

  // Ensure Firebase Auth user exists
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(email);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found') {
      firebaseUser = await admin.auth().createUser({
        email,
        emailVerified: true,
      });
    } else {
      throw error;
    }
  }

  // Generate custom Firebase token
  const customToken = await admin.auth().createCustomToken(firebaseUser.uid);

  return {
    customToken,
    userId: codeData.userId,
  };
});

// ============================================
// PASSKEY AUTHENTICATION
// ============================================

/**
 * Get passkey challenge for authentication
 */
export const getPasskeyChallenge = functions.https.onCall(async (data) => {
  const { email } = data;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required');
  }

  // Find user by email
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).limit(1).get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError('not-found', 'No account found with this email');
  }

  const userDoc = snapshot.docs[0];

  // Check for registered passkeys
  const passkeysRef = db.collection('passkeys').where('userId', '==', userDoc.id);
  const passkeysSnapshot = await passkeysRef.get();

  const allowCredentials = passkeysSnapshot.docs.map((doc) => ({
    id: doc.data().credentialId,
    type: 'public-key' as const,
    transports: doc.data().transports || ['internal', 'hybrid'],
  }));

  if (allowCredentials.length === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No passkeys registered. Please use email verification or QR code.'
    );
  }

  const challenge = generateChallenge();
  const expiresAt = Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000;

  await db.collection('challenges').doc(challenge).set({
    email,
    userId: userDoc.id,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    challenge,
    rpId: RP_ID,
    allowCredentials,
    timeout: 60000,
    userVerification: 'preferred',
  };
});

/**
 * Verify passkey and return custom token
 */
export const verifyPasskey = functions.https.onCall(async (data) => {
  const { email, challenge, credential } = data;

  if (!email || !challenge || !credential) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  const challengeDoc = await db.collection('challenges').doc(challenge).get();

  if (!challengeDoc.exists) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid or expired challenge');
  }

  const challengeData = challengeDoc.data();
  if (!challengeData || challengeData.expiresAt < Date.now()) {
    await challengeDoc.ref.delete();
    throw new functions.https.HttpsError('invalid-argument', 'Challenge has expired');
  }

  if (challengeData.email !== email) {
    throw new functions.https.HttpsError('invalid-argument', 'Challenge does not match email');
  }

  const passkeyDoc = await db.collection('passkeys').doc(credential.id).get();

  if (!passkeyDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Passkey not found');
  }

  const passkeyData = passkeyDoc.data();
  if (!passkeyData || passkeyData.userId !== challengeData.userId) {
    throw new functions.https.HttpsError('permission-denied', 'Passkey does not belong to this user');
  }

  // Delete challenge
  await challengeDoc.ref.delete();

  // Update sign-in counter
  await passkeyDoc.ref.update({
    signInCount: admin.firestore.FieldValue.increment(1),
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const customToken = await admin.auth().createCustomToken(challengeData.userId);

  return {
    customToken,
    userId: challengeData.userId,
  };
});

/**
 * Register a new passkey (from mobile app)
 */
export const registerPasskey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { credential, deviceName } = data;
  const userId = context.auth.uid;

  if (!credential || !credential.id || !credential.response) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid credential data');
  }

  await db.collection('passkeys').doc(credential.id).set({
    credentialId: credential.id,
    userId,
    publicKey: credential.response.publicKey,
    counter: credential.response.counter || 0,
    transports: credential.transports || ['internal', 'hybrid'],
    deviceName: deviceName || 'Unknown Device',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: null,
    signInCount: 0,
  });

  return { success: true };
});

/**
 * Get user's registered passkeys
 */
export const getUserPasskeys = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const passkeysRef = db.collection('passkeys').where('userId', '==', userId);
  const snapshot = await passkeysRef.get();

  const passkeys = snapshot.docs.map((doc) => ({
    id: doc.id,
    deviceName: doc.data().deviceName,
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
    lastUsedAt: doc.data().lastUsedAt?.toDate?.()?.toISOString(),
    signInCount: doc.data().signInCount,
  }));

  return { passkeys };
});

/**
 * Delete a passkey
 */
export const deletePasskey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { passkeyId } = data;
  const userId = context.auth.uid;

  if (!passkeyId) {
    throw new functions.https.HttpsError('invalid-argument', 'Passkey ID is required');
  }

  const passkeyRef = db.collection('passkeys').doc(passkeyId);
  const passkeyDoc = await passkeyRef.get();

  if (!passkeyDoc.exists || passkeyDoc.data()?.userId !== userId) {
    throw new functions.https.HttpsError('not-found', 'Passkey not found');
  }

  await passkeyRef.delete();

  return { success: true };
});

// ============================================
// PHANTOM WALLET AUTHENTICATION
// ============================================

/**
 * Verify Phantom wallet signature and authenticate user
 *
 * This provides SSO-like authentication using Phantom wallet.
 * Users sign a message to prove wallet ownership, then we either:
 * 1. Find existing user with this wallet and authenticate them
 * 2. Create a new user account if no user exists with this wallet
 */
export const verifyPhantomAuth = functions.https.onCall(async (data) => {
  const { walletAddress, signature, message, nonce, timestamp } = data;

  // Validate required fields
  if (!walletAddress || !signature || !message || !nonce || !timestamp) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required parameters: walletAddress, signature, message, nonce, timestamp'
    );
  }

  // Validate timestamp (must be within 5 minutes)
  const now = Date.now();
  const messageAge = now - timestamp;
  if (messageAge > 5 * 60 * 1000 || messageAge < 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Message timestamp is invalid or expired'
    );
  }

  // Verify the message contains the expected nonce
  if (!message.includes(nonce)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Message does not contain the expected nonce'
    );
  }

  // Verify Ed25519 signature
  try {
    const publicKeyBytes = bs58.decode(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
      throw new functions.https.HttpsError('unauthenticated', 'Invalid signature');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Signature verification failed';
    functions.logger.error('Signature verification error', { error: errorMessage, walletAddress });
    throw new functions.https.HttpsError('unauthenticated', 'Invalid signature');
  }

  functions.logger.info('Phantom auth request', { walletAddress });

  // Look for existing user with this wallet address
  const usersRef = db.collection('users');
  let userDoc;
  let userId;

  // Try wallet_address first
  let snapshot = await usersRef.where('wallet_address', '==', walletAddress).limit(1).get();

  if (!snapshot.empty) {
    userDoc = snapshot.docs[0];
    userId = userDoc.id;
    functions.logger.info('Found existing user by wallet_address', { userId, walletAddress });
  } else {
    // Try wallet_public_key as fallback
    snapshot = await usersRef.where('wallet_public_key', '==', walletAddress).limit(1).get();

    if (!snapshot.empty) {
      userDoc = snapshot.docs[0];
      userId = userDoc.id;
      functions.logger.info('Found existing user by wallet_public_key', { userId, walletAddress });
    }
  }

  // If no user found, create a new account
  if (!userId) {
    functions.logger.info('No existing user found, creating new account', { walletAddress });

    // Generate a unique ID
    userId = db.collection('users').doc().id;

    // Create Firebase Auth user (without email)
    await admin.auth().createUser({
      uid: userId,
      displayName: `Wallet ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
    });

    // Create Firestore user document
    const newUser = {
      id: userId,
      name: `User ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
      email: null,
      wallet_address: walletAddress,
      wallet_public_key: walletAddress,
      points: 0,
      total_points_earned: 0,
      emailVerified: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      auth_method: 'phantom',
    };

    await usersRef.doc(userId).set(newUser);
    functions.logger.info('Created new user', { userId, walletAddress });
  } else {
    // Update last login
    await usersRef.doc(userId).update({
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      last_phantom_login: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Generate custom token
  const customToken = await admin.auth().createCustomToken(userId);

  return {
    success: true,
    customToken,
    userId,
  };
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

/**
 * Send a push notification to a user
 * Used for payment requests, transaction updates, etc.
 */
export const sendPushNotification = functions.https.onCall(async (data, context) => {
  const { userId, notification } = data;

  if (!userId || !notification) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'userId and notification are required'
    );
  }

  const { title, body, data: notificationData } = notification;

  if (!title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'notification must have title and body'
    );
  }

  try {
    // Get user's FCM tokens from Firestore
    // Users may have multiple devices, so we store tokens in a subcollection or array
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      functions.logger.warn('User not found for notification', { userId });
      return { success: false, error: 'User not found' };
    }

    const userData = userDoc.data();

    // Try to get FCM tokens - could be stored as:
    // 1. Single token: userData.fcmToken
    // 2. Array of tokens: userData.fcmTokens
    // 3. Subcollection: users/{userId}/fcm_tokens

    let fcmTokens: string[] = [];

    // Method 1: Single token field
    if (userData?.fcmToken) {
      fcmTokens.push(userData.fcmToken);
    }

    // Method 2: Array of tokens
    if (userData?.fcmTokens && Array.isArray(userData.fcmTokens)) {
      fcmTokens = [...fcmTokens, ...userData.fcmTokens];
    }

    // Method 3: Subcollection (for multiple devices)
    const tokensSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('fcm_tokens')
      .get();

    tokensSnapshot.forEach((doc) => {
      const tokenData = doc.data();
      if (tokenData.token) {
        fcmTokens.push(tokenData.token);
      }
    });

    // Also check device_tokens collection (alternative structure)
    const deviceTokensSnapshot = await db
      .collection('device_tokens')
      .where('userId', '==', userId)
      .get();

    deviceTokensSnapshot.forEach((doc) => {
      const tokenData = doc.data();
      if (tokenData.token) {
        fcmTokens.push(tokenData.token);
      }
    });

    // Remove duplicates
    fcmTokens = [...new Set(fcmTokens)];

    if (fcmTokens.length === 0) {
      functions.logger.warn('No FCM tokens found for user', { userId });
      return { success: false, error: 'No FCM tokens found for user' };
    }

    functions.logger.info('Sending notification', { userId, deviceCount: fcmTokens.length });

    // Build the FCM message
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: notificationData || {},
      // iOS specific
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
      // Android specific
      android: {
        priority: 'high',
        notification: {
          title,
          body,
          sound: 'default',
          channelId: 'payment_requests',
        },
      },
    };

    // Send the notification
    const response = await admin.messaging().sendEachForMulticast(message);

    functions.logger.info('Notification sent', {
      userId,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Clean up invalid tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        // Token is invalid or expired
        if (
          error?.code === 'messaging/invalid-registration-token' ||
          error?.code === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(fcmTokens[idx]);
        }
        functions.logger.warn('Failed to send notification to token', {
          userId,
          tokenIndex: idx,
          error: error?.message,
        });
      }
    });

    // Remove invalid tokens from storage
    if (tokensToRemove.length > 0) {
      functions.logger.info('Removing invalid FCM tokens', {
        userId,
        tokenCount: tokensToRemove.length,
      });

      for (const invalidToken of tokensToRemove) {
        // Remove from array field
        if (userData?.fcmTokens) {
          await userRef.update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(invalidToken),
          });
        }

        // Remove from subcollection
        const tokenDocs = await db
          .collection('users')
          .doc(userId)
          .collection('fcm_tokens')
          .where('token', '==', invalidToken)
          .get();

        for (const doc of tokenDocs.docs) {
          await doc.ref.delete();
        }

        // Remove from device_tokens collection
        const deviceDocs = await db
          .collection('device_tokens')
          .where('token', '==', invalidToken)
          .get();

        for (const doc of deviceDocs.docs) {
          await doc.ref.delete();
        }
      }
    }

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Failed to send notification: ${message}`
    );
  }
});

/**
 * Store FCM token for a user
 * Called from mobile app when registering for push notifications
 */
export const registerFCMToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { token, deviceInfo } = data;
  const userId = context.auth.uid;

  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
  }

  try {
    // Store token in user's subcollection (supports multiple devices)
    const tokenRef = db
      .collection('users')
      .doc(userId)
      .collection('fcm_tokens')
      .doc(token);

    await tokenRef.set({
      token,
      userId,
      deviceInfo: deviceInfo || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also update the main user document with latest token
    await db.collection('users').doc(userId).update({
      fcmToken: token,
      fcmTokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('FCM token registered', { userId });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    functions.logger.error('Error registering FCM token', { userId, error });
    throw new functions.https.HttpsError(
      'internal',
      `Failed to register FCM token: ${message}`
    );
  }
});

/**
 * Unregister FCM token (called on logout)
 */
export const unregisterFCMToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { token } = data;
  const userId = context.auth.uid;

  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'FCM token is required');
  }

  try {
    // Remove from subcollection
    const tokenRef = db
      .collection('users')
      .doc(userId)
      .collection('fcm_tokens')
      .doc(token);

    await tokenRef.delete();

    functions.logger.info('FCM token unregistered', { userId });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    functions.logger.error('Error unregistering FCM token', { userId, error });
    throw new functions.https.HttpsError(
      'internal',
      `Failed to unregister FCM token: ${message}`
    );
  }
});
