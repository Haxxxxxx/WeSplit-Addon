/**
 * BLE Central Service — Web Bluetooth API (Browser side)
 *
 * Implements the browser (Central) side of the BLE wallet pairing flow:
 *   1. Scan for a WeSplit mobile peripheral
 *   2. Connect via GATT
 *   3. Write our ephemeral ECDH public key to the mobile
 *   4. Receive mobile's ECDH public key (first notification)
 *   5. Derive shared secret → AES key
 *   6. Receive encrypted wallet payload (second notification)
 *   7. Decrypt payload, return BLEPairingResult
 *
 * Browser compatibility: Chrome, Edge, Opera (desktop + Android Chrome).
 * Firefox and Safari are NOT supported — use the QR fallback for those browsers.
 *
 * This module is intentionally stateful (singleton) because only one BLE
 * pairing session can be active at a time.
 */

import {
  WESPLIT_SERVICE_UUID,
  ECDH_PUBKEY_CHAR_UUID,
  WALLET_DATA_CHAR_UUID,
  BLE_SESSION_TIMEOUT_MS,
  PROTOCOL_VERSION,
  type BLEWalletPayload,
  type BLENotification,
} from './protocol';
import {
  generateECDHKeyPair,
  deriveSharedSecret,
  decryptWithSharedKey,
  parseBLENotification,
  serializeBLEMessage,
} from './crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BLEStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'exchanging_keys'
  | 'waiting_approval'
  | 'receiving'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface BLEPairingResult {
  /** Solana public key (base58) */
  publicKey: string;
  /** PIN-encrypted secret key — same format as IndexedDB storage */
  encryptedSecretKey: string;
  /** Firebase UID of the wallet owner */
  userId: string;
}

type StatusCallback = (status: BLEStatus, message?: string) => void;

// ---------------------------------------------------------------------------
// Module-level state (singleton — one pairing session at a time)
// ---------------------------------------------------------------------------

let _statusCallback: StatusCallback | null = null;
let _currentDevice: BluetoothDevice | null = null;
let _sessionAbortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

/**
 * Returns true if Web Bluetooth is available in this browser.
 * Chrome, Edge, Opera on desktop/Android support it.
 * Firefox and Safari do NOT.
 */
export function isBLEAvailable(): boolean {
  return typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof navigator.bluetooth !== 'undefined';
}

// ---------------------------------------------------------------------------
// Status callback registration
// ---------------------------------------------------------------------------

/**
 * Register a callback to receive pairing status updates.
 * Returns a cleanup function to deregister.
 */
export function onStatusChange(callback: StatusCallback): () => void {
  _statusCallback = callback;
  return () => {
    if (_statusCallback === callback) {
      _statusCallback = null;
    }
  };
}

function emit(status: BLEStatus, message?: string) {
  _statusCallback?.(status, message);
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

/**
 * Cancel an in-progress pairing session.
 * Safe to call even if no session is active.
 */
export function cancelScan(): void {
  _sessionAbortController?.abort();
  if (_currentDevice?.gatt?.connected) {
    try {
      _currentDevice.gatt.disconnect();
    } catch {
      // Ignore — device may already be disconnected
    }
  }
  _currentDevice = null;
  emit('cancelled');
}

// ---------------------------------------------------------------------------
// Core pairing flow
// ---------------------------------------------------------------------------

/**
 * Scan for a WeSplit mobile peripheral and complete the wallet pairing handshake.
 *
 * This function:
 * 1. Opens the browser's native BLE device picker (requires user gesture)
 * 2. Connects to the selected peripheral
 * 3. Performs ECDH key exchange
 * 4. Receives and decrypts the wallet credentials
 *
 * @returns The decrypted wallet credentials ready for IndexedDB storage
 * @throws If the user cancels, device is out of range, or pairing fails
 */
export async function scanAndPair(): Promise<BLEPairingResult> {
  if (!isBLEAvailable()) {
    throw new Error('Web Bluetooth is not supported in this browser. Use the QR code option instead.');
  }

  // Create a new abort controller for this session
  _sessionAbortController = new AbortController();
  const signal = _sessionAbortController.signal;

  // Session timeout
  const timeoutId = setTimeout(() => {
    _sessionAbortController?.abort(new Error('Pairing session timed out'));
  }, BLE_SESSION_TIMEOUT_MS);

  let device: BluetoothDevice | null = null;

  try {
    // -----------------------------------------------------------------------
    // Step 1: Device picker — user selects their phone
    // -----------------------------------------------------------------------
    emit('scanning', 'Looking for your phone...');

    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [WESPLIT_SERVICE_UUID] }],
      optionalServices: [WESPLIT_SERVICE_UUID],
    });

    if (signal.aborted) throw new Error('cancelled');
    _currentDevice = device;

    // -----------------------------------------------------------------------
    // Step 2: GATT connect
    // -----------------------------------------------------------------------
    emit('connecting', `Connecting to ${device.name ?? 'your phone'}...`);

    if (!device.gatt) {
      throw new Error('GATT not supported on this device');
    }

    const server = await device.gatt.connect();
    if (signal.aborted) throw new Error('cancelled');

    // -----------------------------------------------------------------------
    // Step 3: Get WeSplit GATT service + characteristics
    // -----------------------------------------------------------------------
    const service = await server.getPrimaryService(WESPLIT_SERVICE_UUID);
    if (signal.aborted) throw new Error('cancelled');

    const ecdhPubkeyChar = await service.getCharacteristic(ECDH_PUBKEY_CHAR_UUID);
    const walletDataChar = await service.getCharacteristic(WALLET_DATA_CHAR_UUID);
    if (signal.aborted) throw new Error('cancelled');

    // -----------------------------------------------------------------------
    // Step 4: Generate our ephemeral ECDH keypair
    // -----------------------------------------------------------------------
    emit('exchanging_keys', 'Exchanging security keys...');

    const ourKeyPair = await generateECDHKeyPair();

    // -----------------------------------------------------------------------
    // Step 5: Subscribe to wallet data notifications BEFORE writing our key
    // (avoid race condition where mobile sends response before we listen)
    // -----------------------------------------------------------------------
    await walletDataChar.startNotifications();
    if (signal.aborted) throw new Error('cancelled');

    // Set up the two-notification state machine via Promises
    let resolveKeyExchange!: (key: string) => void;
    let rejectKeyExchange!: (err: Error) => void;
    let resolvePayload!: (encrypted: string) => void;
    let rejectPayload!: (err: Error) => void;

    const keyExchangePromise = new Promise<string>((res, rej) => {
      resolveKeyExchange = res;
      rejectKeyExchange = rej;
    });
    const payloadPromise = new Promise<string>((res, rej) => {
      resolvePayload = res;
      rejectPayload = rej;
    });

    let notificationIndex = 0;

    function handleNotification(event: Event) {
      const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
      const dataView = characteristic.value;
      if (!dataView) return;

      const msg = parseBLENotification(dataView) as BLENotification | null;
      if (!msg) {
        const err = new Error('Received malformed BLE notification');
        rejectKeyExchange(err);
        rejectPayload(err);
        return;
      }

      // Validate protocol version
      if (msg.version !== PROTOCOL_VERSION) {
        const err = new Error(`Unsupported protocol version: ${msg.version}`);
        rejectKeyExchange(err);
        rejectPayload(err);
        return;
      }

      notificationIndex++;

      if (notificationIndex === 1) {
        // First notification: mobile's ECDH public key
        if (msg.type !== 'key_exchange') {
          rejectKeyExchange(new Error('Expected key_exchange as first notification'));
          return;
        }
        resolveKeyExchange(msg.ecdhPublicKey);
      } else if (notificationIndex === 2) {
        // Second notification: encrypted wallet payload
        if (msg.type !== 'wallet_data') {
          rejectPayload(new Error('Expected wallet_data as second notification'));
          return;
        }
        resolvePayload(msg.encryptedData);
      }
    }

    walletDataChar.addEventListener('characteristicvaluechanged', handleNotification);

    // -----------------------------------------------------------------------
    // Step 6: Write our ECDH public key to the mobile (triggers the exchange)
    // -----------------------------------------------------------------------
    const keyMessage = serializeBLEMessage({
      type: 'key_exchange',
      version: PROTOCOL_VERSION,
      ecdhPublicKey: ourKeyPair.publicKeyBase64,
    });

    await ecdhPubkeyChar.writeValueWithResponse(keyMessage);
    if (signal.aborted) throw new Error('cancelled');

    // -----------------------------------------------------------------------
    // Step 7: Wait for mobile's ECDH public key (first notification)
    // Mobile shows approval UI to the user at this point
    // -----------------------------------------------------------------------
    emit('waiting_approval', 'Approve the transfer on your phone...');

    const mobileECDHPubKey = await raceWithAbort(keyExchangePromise, signal);

    // -----------------------------------------------------------------------
    // Step 8: Derive ECDH shared secret
    // -----------------------------------------------------------------------
    const sharedSecret = await deriveSharedSecret(ourKeyPair.privateKey, mobileECDHPubKey);
    if (signal.aborted) throw new Error('cancelled');

    // -----------------------------------------------------------------------
    // Step 9: Wait for encrypted wallet payload (second notification)
    // -----------------------------------------------------------------------
    emit('receiving', 'Receiving wallet credentials...');

    const encryptedPayloadBase64 = await raceWithAbort(payloadPromise, signal);

    // -----------------------------------------------------------------------
    // Step 10: Decrypt the wallet payload with the ECDH shared secret
    // -----------------------------------------------------------------------
    const decryptedJson = await decryptWithSharedKey(encryptedPayloadBase64, sharedSecret);
    const payload = JSON.parse(decryptedJson) as BLEWalletPayload;

    // Freshness check — reject if payload is more than 5 minutes old
    const ageMs = Date.now() - payload.timestamp;
    if (ageMs > 5 * 60 * 1000) {
      throw new Error('Wallet payload is too old. Please try pairing again.');
    }

    // Cleanup
    walletDataChar.removeEventListener('characteristicvaluechanged', handleNotification);
    server.disconnect();
    _currentDevice = null;

    emit('complete', 'Wallet received successfully!');

    return {
      publicKey: payload.publicKey,
      encryptedSecretKey: payload.encryptedSecretKey,
      userId: payload.userId,
    };

  } catch (err: unknown) {
    // Cleanup on error
    if (_currentDevice?.gatt?.connected) {
      try { _currentDevice.gatt.disconnect(); } catch { /* ignore */ }
    }
    _currentDevice = null;

    const message = err instanceof Error ? err.message : String(err);

    if (message === 'cancelled' || message.includes('cancelled')) {
      emit('cancelled');
      const error = new Error('Pairing cancelled');
      error.name = 'UserCancelledError';
      throw error;
    }

    // Classify Web Bluetooth errors for better UX messages
    let userMessage = message;
    if (message.includes('NotFoundError') || message.includes('User cancelled')) {
      userMessage = 'No device selected. Open WeSplit on your phone first, then try again.';
    } else if (message.includes('NetworkError') || message.includes('GATT')) {
      userMessage = 'Connection lost. Make sure your phone is nearby and try again.';
    } else if (message.includes('SecurityError')) {
      userMessage = 'Bluetooth permission denied. Allow Bluetooth access and try again.';
    }

    emit('error', userMessage);
    throw new Error(userMessage);

  } finally {
    clearTimeout(timeoutId);
    _sessionAbortController = null;
  }
}

// ---------------------------------------------------------------------------
// Helper: race a Promise against an AbortSignal
// ---------------------------------------------------------------------------

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('cancelled'));
      return;
    }

    const onAbort = () => reject(new Error('cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}
