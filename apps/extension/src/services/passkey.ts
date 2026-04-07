/**
 * Passkey (WebAuthn) Authentication Service
 *
 * This service handles passkey authentication for the WeSplit browser extension.
 * Passkeys registered on the mobile app can be used to authenticate on the extension.
 */

import { cloudFunctions, isFirebaseConfigured } from '../config/firebase';

// WebAuthn utilities
export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData: ArrayBuffer;
    signature: ArrayBuffer;
    userHandle?: ArrayBuffer;
  };
  type: 'public-key';
}

export interface PasskeyChallenge {
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransport[];
  }>;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
}

// Convert ArrayBuffer to Base64URL string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert Base64URL string to ArrayBuffer
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Check if WebAuthn is supported
export function isWebAuthnSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function'
  );
}

// Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Check if conditional mediation (autofill passkey) is available
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    // @ts-expect-error - isConditionalMediationAvailable is not in types yet
    return await PublicKeyCredential.isConditionalMediationAvailable?.() ?? false;
  } catch {
    return false;
  }
}

export const passkeyService = {
  /**
   * Request a passkey challenge from the server
   * This is called before authenticating with a passkey
   */
  async getAuthenticationChallenge(email: string): Promise<PasskeyChallenge> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      const result = await cloudFunctions.call<PasskeyChallenge>(
        'getPasskeyChallenge',
        { email }
      );
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to initiate passkey authentication';
      console.error('Failed to get passkey challenge:', error);
      throw new Error(message);
    }
  },

  /**
   * Authenticate with a passkey
   * Returns a Firebase custom token on success
   */
  async authenticateWithPasskey(
    email: string,
    challenge: PasskeyChallenge
  ): Promise<{ customToken: string; userId: string }> {
    if (!isWebAuthnSupported()) {
      throw new Error('Passkeys are not supported on this device');
    }

    // Build the credential request options
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToArrayBuffer(challenge.challenge),
      rpId: challenge.rpId,
      timeout: challenge.timeout || 60000,
      userVerification: challenge.userVerification || 'preferred',
      allowCredentials: challenge.allowCredentials?.map((cred) => ({
        id: base64UrlToArrayBuffer(cred.id),
        type: cred.type,
        transports: cred.transports,
      })),
    };

    try {
      // Request passkey authentication
      const credential = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Passkey authentication was cancelled');
      }

      const response = credential.response as AuthenticatorAssertionResponse;

      // Prepare credential data for verification
      const credentialData = {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        response: {
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
          signature: arrayBufferToBase64Url(response.signature),
          userHandle: response.userHandle
            ? arrayBufferToBase64Url(response.userHandle)
            : undefined,
        },
        type: credential.type,
      };

      // Verify with backend and get custom token
      const result = await cloudFunctions.call<{
        customToken: string;
        userId: string;
      }>('verifyPasskey', {
        email,
        challenge: challenge.challenge,
        credential: credentialData,
      });

      return result;
    } catch (error: unknown) {
      console.error('Passkey authentication failed:', error);

      // Handle specific WebAuthn errors
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Passkey authentication was denied or timed out');
        } else if (error.name === 'SecurityError') {
          throw new Error('Security error during passkey authentication');
        } else if (error.name === 'AbortError') {
          throw new Error('Passkey authentication was cancelled');
        }
        throw new Error(error.message || 'Passkey authentication failed');
      }

      throw new Error('Passkey authentication failed');
    }
  },

  /**
   * Send a magic link for passwordless authentication
   * Fallback for users without passkey support
   */
  async sendMagicLink(email: string): Promise<{ success: boolean }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      return await cloudFunctions.call<{ success: boolean }>(
        'sendMagicLink',
        { email }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send sign-in link';
      console.error('Failed to send magic link:', error);
      throw new Error(message);
    }
  },

  /**
   * Verify a magic link token
   */
  async verifyMagicLink(token: string): Promise<{
    customToken: string;
    userId: string;
  }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      return await cloudFunctions.call<{
        customToken: string;
        userId: string;
      }>('verifyMagicLink', { token });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid or expired link';
      console.error('Failed to verify magic link:', error);
      throw new Error(message);
    }
  },

  /**
   * Request a one-time code to be sent to the user's email
   * Alternative to passkey for email verification
   */
  async sendVerificationCode(email: string): Promise<{ success: boolean }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      return await cloudFunctions.call<{ success: boolean }>(
        'sendVerificationCode',
        { email }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send code';
      console.error('Failed to send verification code:', error);
      throw new Error(message);
    }
  },

  /**
   * Verify a one-time code and get a custom token
   */
  async verifyCode(
    email: string,
    code: string
  ): Promise<{ customToken: string; userId: string }> {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase not configured');
    }

    try {
      return await cloudFunctions.call<{
        customToken: string;
        userId: string;
      }>('verifyEmailCode', { email, code });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid code';
      console.error('Failed to verify code:', error);
      throw new Error(message);
    }
  },
};

export default passkeyService;
