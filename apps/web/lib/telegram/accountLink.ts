/**
 * TG Mini App — Account Linking Service
 *
 * Links a Telegram user (tg_XXXXX) to their existing WeSplit mobile account.
 *
 * Three methods:
 * 1. Mnemonic — user enters 12-word phrase, we derive the address client-side
 *    and verify it matches an existing user in Firestore.
 * 2. Cloud Backup — user enters their email + backup password, we decrypt the
 *    cloud backup to get the wallet data.
 * 3. Email OTP — user enters their email, gets a code, verifies ownership.
 */

import { signInWithCustomToken } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

import { auth, db } from '@/lib/firebase';
import { walletFromMnemonic } from './crypto';
import { importWallet } from './wallet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkResult {
  success: boolean;
  linkedUserId?: string;
  walletAddress?: string;
  error?: string;
}

export interface BackupLookupResult {
  success: boolean;
  existingUserId?: string;
  backupId?: string;
  walletAddress?: string;
  userName?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Method 1: Link via Mnemonic
// ---------------------------------------------------------------------------

/**
 * Link account using a mnemonic phrase.
 *
 * Flow:
 * 1. Derive wallet address from mnemonic (client-side, same HD path as mobile)
 * 2. Call /api/telegram/link-account to find & merge the matching user
 * 3. Re-authenticate with the new Firebase token (now as the original user)
 * 4. Import the wallet into TG CloudStorage (encrypted with PIN)
 */
export async function linkWithMnemonic(
  mnemonic: string,
  pin: string,
  telegramUserId: string,
  telegramId: number,
  telegramUsername?: string,
): Promise<LinkResult> {
  try {
    // Step 1: Derive wallet address + secretKey from mnemonic (same derivation as mobile app)
    const { publicKey, secretKey } = await walletFromMnemonic(mnemonic);
    const walletAddress = bs58.encode(publicKey);

    // Sign challenge to prove key ownership (required by API)
    const challengeMessage = `WeSplit account link: ${telegramUserId} -> ${walletAddress}`;
    const messageBytes = new TextEncoder().encode(challengeMessage);
    const signatureBytes = nacl.sign.detached(messageBytes, secretKey);
    const signature = bs58.encode(signatureBytes);

    // Step 2: Call server to find the existing user and merge
    const res = await fetch('/api/telegram/link-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId,
        telegramId,
        telegramUsername,
        method: 'mnemonic',
        walletAddress,
        signature,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || 'Linking failed' };
    }

    // Step 3: Re-authenticate as the linked user
    await signInWithCustomToken(auth, data.firebaseToken);

    // Step 4: Import wallet into TG CloudStorage
    await importWallet(mnemonic, pin);

    return {
      success: true,
      linkedUserId: data.linkedUserId,
      walletAddress,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error during linking',
    };
  }
}

// ---------------------------------------------------------------------------
// Method 2: Link via Cloud Backup
// ---------------------------------------------------------------------------

/**
 * Step 1 of cloud backup linking: find the account by email.
 */
export async function findAccountByEmail(
  email: string,
  telegramUserId: string,
  telegramId: number,
  telegramUsername?: string,
): Promise<BackupLookupResult> {
  try {
    const res = await fetch('/api/telegram/link-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId,
        telegramId,
        telegramUsername,
        method: 'backup',
        email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || 'Lookup failed' };
    }

    return {
      success: true,
      existingUserId: data.existingUserId,
      backupId: data.backupId,
      walletAddress: data.walletAddress,
      userName: data.user?.name,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    };
  }
}

/**
 * Step 2 of cloud backup linking: decrypt the backup and complete the link.
 *
 * Reads the encrypted backup from Firestore, decrypts with the user's
 * backup password, extracts the seed phrase, and imports the wallet.
 */
export async function linkWithCloudBackup(
  existingUserId: string,
  backupPassword: string,
  pin: string,
  telegramUserId: string,
  telegramId: number,
  telegramUsername?: string,
): Promise<LinkResult> {
  try {
    // Step 1: Fetch the encrypted backup from Firestore
    const backupsRef = collection(db, 'wallet_backups');
    const q = query(
      backupsRef,
      where('userId', '==', existingUserId),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, error: 'No backup found' };
    }

    const backupData = snap.docs[0]!.data();

    // Step 2: Decrypt the backup (same AES-256-GCM + PBKDF2 as mobile)
    const decrypted = await decryptCloudBackup(
      backupData.encrypted,
      backupData.salt,
      backupData.iv,
      backupPassword,
    );

    const walletData = JSON.parse(decrypted) as {
      walletAddress: string;
      seedPhrase?: string;
      privateKey?: string;
      publicKey: string;
    };

    if (!walletData.seedPhrase && !walletData.privateKey) {
      return { success: false, error: 'Backup data is missing wallet credentials' };
    }

    // Step 3: Import wallet into TG CloudStorage
    if (walletData.seedPhrase) {
      await importWallet(walletData.seedPhrase, pin);
    }
    // Note: if only privateKey (no seedPhrase), we'd need a different import path.
    // For now, the mobile app always includes seedPhrase in backups.

    // Step 4: Complete the account merge via mnemonic method
    // (the wallet is now imported, use the address + signature to link)
    if (!walletData.seedPhrase) {
      return { success: false, error: 'Backup is missing seed phrase — cannot complete account link. Please use a different method.' };
    }
    const { secretKey: backupSecretKey } = await walletFromMnemonic(walletData.seedPhrase);
    const backupChallenge = `WeSplit account link: ${telegramUserId} -> ${walletData.walletAddress}`;
    const backupMessageBytes = new TextEncoder().encode(backupChallenge);
    const backupSigBytes = nacl.sign.detached(backupMessageBytes, backupSecretKey);
    const backupSignature = bs58.encode(backupSigBytes);

    const res = await fetch('/api/telegram/link-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId,
        telegramId,
        telegramUsername,
        method: 'mnemonic',
        walletAddress: walletData.walletAddress,
        signature: backupSignature,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || 'Account merge failed' };
    }

    // Step 5: Re-authenticate as the linked user
    await signInWithCustomToken(auth, data.firebaseToken);

    return {
      success: true,
      linkedUserId: data.linkedUserId,
      walletAddress: walletData.walletAddress,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    // Map AES-GCM decryption failure to a user-friendly message
    if (msg.includes('Decryption failed') || msg.includes('OperationError')) {
      return { success: false, error: 'Incorrect backup password' };
    }
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Method 3: Link via Email OTP
// ---------------------------------------------------------------------------

/**
 * Step 1: Request email verification code.
 */
export async function requestEmailOtp(
  email: string,
  telegramUserId: string,
  telegramId: number,
  telegramUsername?: string,
): Promise<{ success: boolean; maskedEmail?: string; userName?: string; error?: string }> {
  try {
    const res = await fetch('/api/telegram/link-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId,
        telegramId,
        telegramUsername,
        method: 'email',
        email,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || 'Failed to send verification code' };
    }

    return {
      success: true,
      maskedEmail: data.maskedEmail,
      userName: data.user?.name,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    };
  }
}

/**
 * Step 2: Verify the OTP and complete the link.
 */
export async function verifyEmailOtp(
  otp: string,
  telegramUserId: string,
  telegramId: number,
  telegramUsername?: string,
): Promise<LinkResult> {
  try {
    const res = await fetch('/api/telegram/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramUserId,
        telegramId,
        telegramUsername,
        otp,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message || 'Verification failed' };
    }

    // Re-authenticate as the linked user
    await signInWithCustomToken(auth, data.firebaseToken);

    return {
      success: true,
      linkedUserId: data.linkedUserId,
      walletAddress: data.user?.wallet_address,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unexpected error',
    };
  }
}

// ---------------------------------------------------------------------------
// Cloud Backup Decryption (mirrors mobile walletCloudBackupService)
// ---------------------------------------------------------------------------

/**
 * Decrypt a cloud backup encrypted by the mobile app.
 *
 * The mobile app uses:
 * - AES-256-GCM via Web Crypto API
 * - PBKDF2 key derivation (SHA-256, 100k iterations)
 * - salt, iv, encrypted all stored as base64 strings
 */
async function decryptCloudBackup(
  encryptedBase64: string,
  saltBase64: string,
  ivBase64: string,
  password: string,
): Promise<string> {
  const salt = base64ToUint8(saltBase64);
  const iv = base64ToUint8(ivBase64);
  const encrypted = base64ToUint8(encryptedBase64);

  // Derive key using same params as mobile app
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    aesKey,
    encrypted.buffer as ArrayBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ---------------------------------------------------------------------------
// Base64 helper
// ---------------------------------------------------------------------------

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
