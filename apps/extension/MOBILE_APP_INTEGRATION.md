# WeSplit Mobile App Integration Guide

This document outlines the integration points between the WeSplit browser addon (extension) and the mobile app. The mobile app agent should implement these features to enable seamless cross-platform functionality.

---

## Table of Contents

1. [QR Code Authentication](#1-qr-code-authentication)
2. [Shared Data Types](#2-shared-data-types)
3. [Firestore Collections](#3-firestore-collections)
4. [Cloud Functions](#4-cloud-functions)
5. [Push Notifications](#5-push-notifications)
6. [Payment Requests](#6-payment-requests)
7. [Shared Wallets](#7-shared-wallets)
8. [Deep Links](#8-deep-links)

---

## 1. QR Code Authentication

The browser extension displays a QR code that users scan with the mobile app to authenticate.

### Flow Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Browser Addon  │         │    Firebase     │         │   Mobile App    │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  1. Create QR session     │                           │
         │  ─────────────────────►   │                           │
         │                           │                           │
         │  2. Display QR code       │                           │
         │  (wesplit://auth?session=X)                           │
         │                           │                           │
         │                           │   3. User scans QR        │
         │                           │   ◄────────────────────── │
         │                           │                           │
         │                           │   4. markQRSessionScanned │
         │                           │   ◄────────────────────── │
         │                           │                           │
         │  5. onSnapshot: scanned   │                           │
         │  ◄─────────────────────   │                           │
         │  (shows "Waiting for X")  │                           │
         │                           │                           │
         │                           │   6. approveQRSession     │
         │                           │   ◄────────────────────── │
         │                           │                           │
         │  7. onSnapshot: approved  │                           │
         │  ◄─────────────────────   │                           │
         │                           │                           │
         │  8. signInWithCustomToken │                           │
         │  ─────────────────────►   │                           │
         │                           │                           │
         │  9. User authenticated!   │                           │
         └───────────────────────────┴───────────────────────────┘
```

### QR Code Data Format

The QR code contains a deep link:

```
wesplit://auth?session={sessionId}
```

- `sessionId`: 32-character alphanumeric string

### QR Session Document Schema

**Collection**: `qr_sessions`

```typescript
interface QRSession {
  id: string;                    // Same as document ID
  status: 'pending' | 'scanned' | 'approved' | 'rejected' | 'expired';
  createdAt: Timestamp;          // When session was created
  expiresAt: Timestamp;          // 5 minutes after creation
  deviceInfo: string;            // e.g., "Chrome Extension"

  // Set when scanned (by mobile app)
  scannedAt?: Timestamp;
  userName?: string;             // From mobile app user
  userAvatar?: string;           // From mobile app user

  // Set when approved (by mobile app via Cloud Function)
  approvedAt?: Timestamp;
  userId?: string;               // Firebase Auth UID
  userEmail?: string;
  customToken?: string;          // Firebase custom token for extension to use
}
```

### Mobile App Implementation

1. **Handle Deep Link** - When user scans QR code:
   ```typescript
   // Parse the deep link
   const url = new URL(deepLink);
   const sessionId = url.searchParams.get('session');
   ```

2. **Mark Session as Scanned** - Call Cloud Function:
   ```typescript
   const markScanned = httpsCallable(functions, 'markQRSessionScanned');
   const result = await markScanned({ sessionId });
   // Returns: { success: true, deviceInfo: "Chrome Extension" }
   ```

3. **Show Approval UI** - Display to user:
   - Device info (e.g., "Chrome Extension")
   - "Approve" and "Reject" buttons

4. **Approve Session** - When user taps Approve:
   ```typescript
   const approve = httpsCallable(functions, 'approveQRSession');
   await approve({ sessionId });
   ```

5. **Reject Session** - When user taps Reject:
   ```typescript
   const reject = httpsCallable(functions, 'rejectQRSession');
   await reject({ sessionId });
   ```

---

## 2. Shared Data Types

These TypeScript interfaces must match between mobile app and browser extension.

### User Profile

```typescript
interface UserProfile {
  id: string;                    // Firebase Auth UID
  name: string;
  email: string;
  wallet_address: string;        // Solana public key
  wallet_public_key?: string;    // Same as wallet_address (legacy)
  phone?: string;
  points?: number;
  total_points_earned?: number;
  avatar?: string;               // URL to avatar image
  emailVerified?: boolean;
  created_at?: string;           // ISO timestamp
  updated_at?: string;           // ISO timestamp
  referral_code?: string;
  badges?: string[];
}
```

### Transaction

```typescript
type TransactionType = 'send' | 'receive' | 'deposit' | 'withdraw' | 'swap';
type TransactionStatus = 'pending' | 'completed' | 'failed';

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;              // 'USDC', 'SOL', etc.
  from_address: string;
  to_address: string;
  tx_hash?: string;              // Solana transaction signature
  status: TransactionStatus;
  created_at: string;            // ISO timestamp
  description?: string;

  // For swap transactions
  swapFromAmount?: number;
  swapFromCurrency?: string;
  swapToAmount?: number;
  swapToCurrency?: string;
}
```

### Shared Wallet

```typescript
interface SharedWallet {
  id: string;                    // Document ID
  name: string;
  description?: string;
  creatorId: string;             // Firebase Auth UID of creator
  creatorName: string;
  walletAddress: string;         // Solana public key
  totalBalance: number;
  currency: string;              // 'USDC'
  status: 'active' | 'paused' | 'archived';
  members: SharedWalletMember[];
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  customColor?: string;
  customLogo?: string;
}

interface SharedWalletMember {
  userId: string;                // Firebase Auth UID
  name: string;
  walletAddress: string;
  role: 'creator' | 'admin' | 'member';
  totalContributed: number;
  totalWithdrawn: number;
  joinedAt: string;              // ISO timestamp
  status: 'active' | 'invited' | 'left';
}
```

### Payment Request

```typescript
interface PaymentRequest {
  id: string;
  fromUserId: string;            // Who is requesting payment
  fromUserName: string;
  fromWalletAddress: string;
  toUserId: string;              // Who should pay
  toUserName: string;
  toWalletAddress: string;
  amount: number;
  currency: 'USDC' | 'SOL';
  message?: string;
  status: 'pending' | 'paid' | 'declined' | 'expired';
  createdAt: Timestamp;
  paidAt?: Timestamp;
  txHash?: string;
}
```

---

## 3. Firestore Collections

### Users Collection

**Path**: `users/{userId}`

The browser extension reads user data from this collection. Ensure the mobile app keeps this data in sync.

```typescript
// Required fields for extension compatibility
{
  id: string;           // Same as document ID
  name: string;
  email: string;
  wallet_address: string;
  avatar?: string;
  points?: number;
  total_points_earned?: number;
}
```

### QR Sessions Collection

**Path**: `qr_sessions/{sessionId}`

See [QR Session Document Schema](#qr-session-document-schema) above.

### Payment Requests Collection

**Path**: `paymentRequests/{requestId}`

The browser extension can create payment requests. The mobile app should:
1. Listen for new requests where `toUserId == currentUser.uid`
2. Display push notification
3. Allow user to pay or decline

### Shared Wallets Collection

**Path**: `sharedWallets/{walletId}`

Both platforms read/write to this collection. Key queries:
- `where('creatorId', '==', userId)` - Wallets user created
- Client-side filter on `members` array for membership

---

## 4. Cloud Functions

These Cloud Functions must be deployed. The mobile app calls them.

### QR Authentication Functions

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `markQRSessionScanned` | Yes | Mark session as scanned, show user info on extension |
| `approveQRSession` | Yes | Approve login, generate custom token |
| `rejectQRSession` | Yes | Reject login request |

### Passkey Functions

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `registerPasskey` | Yes | Register new passkey from mobile |
| `getUserPasskeys` | Yes | List user's registered passkeys |
| `deletePasskey` | Yes | Remove a passkey |
| `getPasskeyChallenge` | No | Get challenge for passkey auth |
| `verifyPasskey` | No | Verify passkey and get token |

### Email Verification Functions

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `sendVerificationCode` | No | Send code to email |
| `verifyEmailCode` | No | Verify code and get token |

### Phantom Wallet Auth

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `verifyPhantomAuth` | No | Verify wallet signature, create/find user |

### Push Notification Functions

| Function | Auth Required | Purpose |
|----------|---------------|---------|
| `sendPushNotification` | No | Send notification to user |
| `registerFCMToken` | Yes | Register device for push |
| `unregisterFCMToken` | Yes | Remove device token |

---

## 5. Push Notifications

The browser extension sends push notifications to mobile app users for payment requests.

### FCM Token Storage

The mobile app should store FCM tokens in one of these locations (checked in order):
1. `users/{userId}.fcmToken` - Single token field
2. `users/{userId}.fcmTokens` - Array of tokens
3. `users/{userId}/fcm_tokens/{token}` - Subcollection
4. `device_tokens` collection with `userId` field

### Notification Payload Format

```typescript
{
  title: string;           // e.g., "Payment Request"
  body: string;            // e.g., "John requested $10 USDC"
  data: {
    type: 'payment_request';
    requestId: string;
    fromUserId: string;
    amount: string;
    currency: string;
  }
}
```

### Register FCM Token (Mobile App)

```typescript
const register = httpsCallable(functions, 'registerFCMToken');
await register({
  token: fcmToken,
  deviceInfo: {
    platform: 'ios' | 'android',
    model: 'iPhone 15',
    appVersion: '1.0.0'
  }
});
```

---

## 6. Payment Requests

The browser extension can request payments from other WeSplit users.

### Flow

1. **Extension creates request** in `paymentRequests` collection
2. **Extension calls** `sendPushNotification` Cloud Function
3. **Mobile app receives push** with request details
4. **User opens app**, sees pending request
5. **User pays** (on-chain transaction) or declines
6. **Mobile app updates** request status in Firestore

### Listening for Payment Requests (Mobile App)

```typescript
// Query for pending requests to current user
const requestsRef = collection(db, 'paymentRequests');
const q = query(
  requestsRef,
  where('toUserId', '==', currentUser.uid),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc')
);

// Listen for changes
onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      // New payment request received
      showPaymentRequestUI(change.doc.data());
    }
  });
});
```

### Updating Request Status (Mobile App)

```typescript
// When user pays
await updateDoc(doc(db, 'paymentRequests', requestId), {
  status: 'paid',
  paidAt: serverTimestamp(),
  txHash: transactionSignature
});

// When user declines
await updateDoc(doc(db, 'paymentRequests', requestId), {
  status: 'declined'
});
```

---

## 7. Shared Wallets

Shared wallets created on mobile should be visible in the browser extension.

### Data Sync Requirements

1. **Store in Firestore** using the `SharedWallet` schema above
2. **Include all members** in the `members` array
3. **Update `totalBalance`** when deposits/withdrawals occur
4. **Update `updatedAt`** on any change

### Member Query Pattern

The extension queries wallets in two ways:
1. `where('creatorId', '==', userId)` - As creator
2. Fetch recent wallets and filter client-side for membership

Ensure the `members` array always includes:
```typescript
{
  userId: string;           // Firebase Auth UID
  name: string;
  walletAddress: string;
  role: 'creator' | 'admin' | 'member';
  status: 'active' | 'invited' | 'left';
  // ... other fields
}
```

---

## 8. Deep Links

The mobile app should handle these deep link schemes:

### QR Authentication

```
wesplit://auth?session={sessionId}
```

Action: Show QR login approval screen

### Payment Request (Future)

```
wesplit://pay?to={walletAddress}&amount={amount}&currency={currency}
```

Action: Open send payment screen pre-filled

### Shared Wallet (Future)

```
wesplit://wallet/{walletId}
```

Action: Open shared wallet details

---

## Checklist for Mobile App Integration

- [ ] Handle `wesplit://auth` deep link
- [ ] Implement QR session scanning UI
- [ ] Call `markQRSessionScanned` on scan
- [ ] Show approve/reject UI with device info
- [ ] Call `approveQRSession` or `rejectQRSession`
- [ ] Register FCM token on app launch
- [ ] Listen for push notifications
- [ ] Handle payment request notifications
- [ ] Query and display pending payment requests
- [ ] Allow paying or declining requests
- [ ] Update request status in Firestore
- [ ] Ensure shared wallets sync to Firestore
- [ ] Include proper member data in shared wallets

---

## Environment & Firebase Project

Both platforms share the same Firebase project:
- **Project ID**: `wesplit-35186`
- **Auth Domain**: `wesplit-35186.firebaseapp.com`

Ensure the mobile app uses the same Firebase configuration.

---

## Contact

For questions about this integration, refer to:
- Browser extension code: `/wesplit-addon/src/`
- Cloud functions: `/wesplit-addon/functions/src/index.ts`
- Firestore rules: `/wesplit-addon/firestore.rules`
