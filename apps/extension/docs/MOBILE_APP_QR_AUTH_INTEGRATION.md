# WeSplit Mobile App - QR Code Authentication Integration

This document describes how to implement QR code authentication in the WeSplit mobile app to allow users to log into the browser extension by scanning a QR code.

## Overview

The browser extension displays a QR code that users scan with the mobile app. When approved, the user is automatically logged into the extension with their full account data synced.

### Authentication Flow

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Browser Addon  │         │    Firebase     │         │   Mobile App    │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │ 1. Create QR Session      │                           │
         │ ─────────────────────────>│                           │
         │                           │                           │
         │ 2. Display QR Code        │                           │
         │ (wesplit://auth?session=X)│                           │
         │                           │                           │
         │                           │    3. Scan QR Code        │
         │                           │<──────────────────────────│
         │                           │                           │
         │                           │ 4. markQRSessionScanned() │
         │                           │<──────────────────────────│
         │                           │                           │
         │ 5. Status: "scanned"      │                           │
         │<──────────────────────────│                           │
         │ (Show: "Confirm on phone")│                           │
         │                           │                           │
         │                           │ 6. User taps "Approve"    │
         │                           │                           │
         │                           │ 7. approveQRSession()     │
         │                           │<──────────────────────────│
         │                           │                           │
         │ 8. Status: "approved"     │                           │
         │    + customToken          │                           │
         │<──────────────────────────│                           │
         │                           │                           │
         │ 9. signInWithCustomToken()│                           │
         │ ─────────────────────────>│                           │
         │                           │                           │
         │ 10. User logged in! ✓     │                           │
         │                           │                           │
```

## Firebase Collections

### `qr_sessions` Collection

Each QR session document has the following structure:

```typescript
interface QRSession {
  id: string;                    // Session ID (document ID)
  status: 'pending' | 'scanned' | 'approved' | 'rejected' | 'expired';
  createdAt: Timestamp;          // When session was created
  expiresAt: Timestamp;          // Session expiry (5 minutes from creation)
  deviceInfo: string;            // Browser info (e.g., "Chrome Extension")

  // Set when scanned:
  scannedAt?: Timestamp;
  userName?: string;             // User's name (shown on extension)
  userAvatar?: string;           // User's avatar URL

  // Set when approved:
  approvedAt?: Timestamp;
  userId?: string;               // Firebase user ID
  userEmail?: string;            // User's email
  customToken?: string;          // Firebase custom token for extension sign-in

  // Set when rejected:
  rejectedAt?: Timestamp;
}
```

## QR Code Format

The QR code contains a deep link URL:

```
wesplit://auth?session={sessionId}
```

Example:
```
wesplit://auth?session=ABC123XYZ789...
```

The `sessionId` is a 32-character alphanumeric string.

## Mobile App Implementation

### 1. Deep Link Handler

Configure your app to handle the `wesplit://auth` deep link scheme.

**iOS (Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>wesplit</string>
    </array>
  </dict>
</array>
```

**Android (AndroidManifest.xml):**
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="wesplit" android:host="auth" />
</intent-filter>
```

### 2. QR Scanner Screen

Add a QR scanner accessible from Settings:

```
Settings → Linked Devices → Link Browser Extension
```

When the QR code is scanned, parse the session ID:

```typescript
function parseQRCode(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'wesplit:' && parsed.hostname === 'auth') {
      return parsed.searchParams.get('session');
    }
  } catch {
    // Try regex fallback
    const match = url.match(/wesplit:\/\/auth\?session=([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  }
  return null;
}
```

### 3. Cloud Functions to Call

#### Mark Session as Scanned

Call this immediately after scanning the QR code:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

async function markSessionScanned(sessionId: string): Promise<{
  success: boolean;
  deviceInfo: string;
}> {
  const markScanned = httpsCallable(functions, 'markQRSessionScanned');
  const result = await markScanned({ sessionId });
  return result.data as { success: boolean; deviceInfo: string };
}
```

**Response:**
```typescript
{
  success: true,
  deviceInfo: "Chrome Extension"  // Show this to user
}
```

#### Approve Session

Call this when the user taps "Approve":

```typescript
async function approveSession(sessionId: string): Promise<{ success: boolean }> {
  const approve = httpsCallable(functions, 'approveQRSession');
  const result = await approve({ sessionId });
  return result.data as { success: boolean };
}
```

#### Reject Session

Call this when the user taps "Deny" or closes the dialog:

```typescript
async function rejectSession(sessionId: string): Promise<{ success: boolean }> {
  const reject = httpsCallable(functions, 'rejectQRSession');
  const result = await reject({ sessionId });
  return result.data as { success: boolean };
}
```

### 4. Approval Dialog UI

After scanning, show a confirmation dialog:

```
┌─────────────────────────────────┐
│                                 │
│     🔗 Link Browser Extension   │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🌐 Chrome Extension    │    │
│  │                         │    │
│  │  Wants to access your   │    │
│  │  WeSplit account        │    │
│  └─────────────────────────┘    │
│                                 │
│  This will allow the browser    │
│  extension to:                  │
│                                 │
│  ✓ View your account info       │
│  ✓ Access your wallet           │
│  ✓ Send & receive payments      │
│  ✓ Manage splits                │
│                                 │
│  ┌───────────┐ ┌───────────┐    │
│  │   Deny    │ │  Approve  │    │
│  └───────────┘ └───────────┘    │
│                                 │
└─────────────────────────────────┘
```

### 5. Complete Implementation Example

```typescript
// types.ts
interface QRAuthResult {
  success: boolean;
  error?: string;
}

// qrAuthService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export const qrAuthService = {
  /**
   * Parse session ID from QR code URL
   */
  parseQRCode(url: string): string | null {
    const match = url.match(/wesplit:\/\/auth\?session=([A-Za-z0-9]+)/);
    return match ? match[1] : null;
  },

  /**
   * Mark session as scanned - call immediately after scanning
   */
  async markScanned(sessionId: string): Promise<{ deviceInfo: string }> {
    const fn = httpsCallable(functions, 'markQRSessionScanned');
    const result = await fn({ sessionId });
    return result.data as { success: boolean; deviceInfo: string };
  },

  /**
   * Approve the session - call when user taps Approve
   */
  async approve(sessionId: string): Promise<QRAuthResult> {
    try {
      const fn = httpsCallable(functions, 'approveQRSession');
      await fn({ sessionId });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to approve'
      };
    }
  },

  /**
   * Reject the session - call when user taps Deny
   */
  async reject(sessionId: string): Promise<QRAuthResult> {
    try {
      const fn = httpsCallable(functions, 'rejectQRSession');
      await fn({ sessionId });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to reject'
      };
    }
  },
};

// QRScannerScreen.tsx (React Native example)
import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import { Camera } from 'expo-camera'; // or react-native-camera
import { qrAuthService } from './qrAuthService';

export function QRScannerScreen({ navigation }) {
  const [showApproval, setShowApproval] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    const parsedSessionId = qrAuthService.parseQRCode(data);

    if (!parsedSessionId) {
      Alert.alert('Invalid QR Code', 'This QR code is not valid for WeSplit.');
      return;
    }

    setSessionId(parsedSessionId);
    setLoading(true);

    try {
      // Mark as scanned immediately
      const result = await qrAuthService.markScanned(parsedSessionId);
      setDeviceInfo(result.deviceInfo);
      setShowApproval(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;

    setLoading(true);
    const result = await qrAuthService.approve(sessionId);
    setLoading(false);

    if (result.success) {
      setShowApproval(false);
      Alert.alert('Success', 'Browser extension is now connected!');
      navigation.goBack();
    } else {
      Alert.alert('Error', result.error || 'Failed to approve');
    }
  };

  const handleDeny = async () => {
    if (!sessionId) return;

    await qrAuthService.reject(sessionId);
    setShowApproval(false);
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={{ flex: 1 }}
        onBarCodeScanned={handleBarCodeScanned}
        barCodeScannerSettings={{
          barCodeTypes: ['qr'],
        }}
      />

      {/* Approval Modal */}
      <Modal visible={showApproval} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Link Browser Extension</Text>

            <View style={styles.deviceBox}>
              <Text style={styles.deviceIcon}>🌐</Text>
              <Text style={styles.deviceName}>{deviceInfo}</Text>
              <Text style={styles.deviceDesc}>Wants to access your WeSplit account</Text>
            </View>

            <Text style={styles.permissionsTitle}>This will allow the extension to:</Text>
            <View style={styles.permissionsList}>
              <Text style={styles.permission}>✓ View your account info</Text>
              <Text style={styles.permission}>✓ Access your wallet</Text>
              <Text style={styles.permission}>✓ Send & receive payments</Text>
              <Text style={styles.permission}>✓ Manage splits</Text>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.denyButton}
                onPress={handleDeny}
                disabled={loading}
              >
                <Text style={styles.denyText}>Deny</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.approveButton}
                onPress={handleApprove}
                disabled={loading}
              >
                <Text style={styles.approveText}>
                  {loading ? 'Approving...' : 'Approve'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  deviceBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  deviceIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deviceDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  permissionsTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 12,
  },
  permissionsList: {
    marginBottom: 24,
  },
  permission: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  denyButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  denyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#A5EA15',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  approveText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
};
```

## Error Handling

### Possible Errors

| Error Code | Message | Cause |
|------------|---------|-------|
| `not-found` | Session not found | Session expired or invalid ID |
| `failed-precondition` | Session has expired | Session older than 5 minutes |
| `failed-precondition` | Session cannot be approved | Already approved/rejected |
| `unauthenticated` | Must be authenticated | User not logged in on mobile |

### Handle Errors Gracefully

```typescript
try {
  await qrAuthService.approve(sessionId);
} catch (error: any) {
  switch (error.code) {
    case 'functions/not-found':
      Alert.alert('Session Expired', 'Please scan a new QR code.');
      break;
    case 'functions/failed-precondition':
      Alert.alert('Invalid Session', 'This session is no longer valid.');
      break;
    case 'functions/unauthenticated':
      Alert.alert('Not Logged In', 'Please log in to approve this request.');
      break;
    default:
      Alert.alert('Error', error.message || 'Something went wrong.');
  }
}
```

## Security Considerations

1. **Session Expiry**: Sessions expire after 5 minutes
2. **One-Time Use**: Sessions can only be approved once
3. **User Verification**: Only the authenticated user can approve
4. **Custom Token**: Token is securely generated server-side
5. **No Sensitive Data in QR**: Only session ID is in QR code

## Settings Screen Integration

Add an entry in Settings:

```typescript
// Settings items
const settingsItems = [
  // ... other items
  {
    icon: 'link',
    title: 'Linked Devices',
    subtitle: 'Manage browser extensions',
    onPress: () => navigation.navigate('LinkedDevices'),
  },
];

// LinkedDevicesScreen
function LinkedDevicesScreen() {
  return (
    <View>
      <Text style={styles.header}>Linked Devices</Text>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('QRScanner')}
      >
        <QrCodeIcon />
        <View>
          <Text style={styles.linkTitle}>Link Browser Extension</Text>
          <Text style={styles.linkSubtitle}>Scan QR code to connect</Text>
        </View>
      </TouchableOpacity>

      {/* List of linked devices could go here */}
    </View>
  );
}
```

## Testing

1. **Happy Path**: Scan → Approve → Extension logs in
2. **Deny Path**: Scan → Deny → Extension shows "rejected"
3. **Timeout**: Wait 5+ minutes → Scan → Should fail
4. **Double Scan**: Scan same QR twice → Second should fail
5. **Network Error**: Approve with no network → Handle gracefully

## Cloud Functions Deployment

The Cloud Functions must be deployed for this to work:

```bash
cd functions
npm install
firebase deploy --only functions
```

## Questions?

Contact the extension team for any questions about this integration.
