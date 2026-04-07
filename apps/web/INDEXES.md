# Firestore Composite Index Requirements

These indexes must be created in the Firebase Console before deploying to production.
Firestore will prompt with the exact index URL on first query failure — paste that URL to auto-create.

## Required Composite Indexes

### `sharedWallets` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `member_ids` (array-contains) + `created_at` | DESC | `getUserSharedWallets` (snake_case variant) |
| `memberIds` (array-contains) + `createdAt` | DESC | `getUserSharedWallets` (camelCase variant) |

### `sharedWalletWithdrawalRequests` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `sharedWalletId` + `status` + `createdAt` | DESC | `getWithdrawalRequests` |
| `sharedWalletId` + `status` + `created_at` | DESC | `getWithdrawalRequests` (snake_case variant) |

### `notifications` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `user_id` + `created_at` | DESC | `getNotifications`, `useRealtimeNotifications` |

### `transactions` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `from_user` + `created_at` | DESC | `getTransactionHistory` |
| `to_user` + `created_at` | DESC | `getTransactionHistory` |

### `splits` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `participantIds` (array-contains) + `created_at` | DESC | `useRealtimeSplitsList` |

### `paymentRequests` collection

| Fields | Direction | Query Location |
|--------|-----------|----------------|
| `recipientId` + `status` + `created_at` | DESC | `getPaymentRequests` |
| `senderId` + `status` + `created_at` | DESC | `getPaymentRequests` |

## Notes

- Firestore auto-suggests the index creation URL in logs when a query fails with "FAILED_PRECONDITION"
- Single-field indexes are auto-created by Firestore — only composite indexes need manual creation
- Both snake_case and camelCase variants may need separate indexes (mobile writes camelCase, web writes snake_case)
