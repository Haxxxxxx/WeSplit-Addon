/**
 * Web-only hooks — used exclusively by browser app routes
 */

export { useAuth } from './useAuth';
export { useWallet } from './useWallet';

// Split wallet hooks
export {
  useSplits,
  useSplitDetail,
  useSplitWallets,
  useSplitWalletDetail,
  useSplitPaymentSummary,
  useCreateSplit,
  useRecordSplitPayment,
  useCompleteSplit,
  useCancelSplit,
  useUpdateSplitStatus,
  useIsSplitCreator,
  useIsSplitParticipant,
  useCurrentUserSplitParticipant,
  useCurrentUserWalletParticipant,
  splitQueryKeys,
} from './useSplits';

// Payment request hooks
export {
  useReceivedPaymentRequests,
  useSentPaymentRequests,
  usePaymentRequestDetail,
  usePendingRequestsCount,
  useCreatePaymentRequest,
  useAcceptPaymentRequest,
  useRejectPaymentRequest,
  useCancelPaymentRequest,
  useSendPaymentReminder,
  useIsRequestSender,
  useIsRequestRecipient,
  paymentRequestQueryKeys,
} from './usePaymentRequests';

// Withdrawal approval hooks
export {
  useWalletWithdrawalRequests,
  useUserWithdrawalRequests,
  useWithdrawalRequestDetail,
  usePendingWithdrawalCount,
  useCreateWithdrawalRequest,
  useApproveWithdrawalRequest,
  useRejectWithdrawalRequest,
  useMarkWithdrawalExecuted,
  useIsWithdrawalRequester,
  useCanApproveWithdrawal,
  withdrawalQueryKeys,
} from './useWithdrawalApprovals';

// Real-time Firestore listener hooks
export {
  useRealtimeSharedWallet,
  type SharedWalletRealtimeUpdate,
  type UseRealtimeSharedWalletOptions,
} from './useRealtimeSharedWallet';

export {
  useRealtimeSplit,
  useRealtimeSplitsList,
  type RealtimeSplit,
  type RealtimeSplitParticipant,
  type SplitRealtimeUpdate,
  type UseRealtimeSplitOptions,
  type UseRealtimeSplitsListOptions,
} from './useRealtimeSplits';

export {
  useRealtimeNotifications,
  notificationQueryKeys,
  type NotificationRealtimeUpdate,
  type UseRealtimeNotificationsOptions,
} from './useRealtimeNotifications';

// Notification action hooks
export {
  useNotificationActions,
  type NotificationRoute,
  type NotificationActionResult,
  type NotificationGroup,
  type NotificationFilter,
} from './useNotificationActions';

// Wallet transfer hooks
export {
  useWalletTransfer,
  type UseWalletTransferOptions,
  type UseWalletTransferReturn,
} from './useWalletTransfer';
