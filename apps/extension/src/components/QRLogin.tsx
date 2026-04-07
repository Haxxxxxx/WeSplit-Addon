import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  DeviceMobile,
  Check,
  X,
  ArrowsClockwise,
  Warning,
  ShieldCheck,
  User,
} from '@phosphor-icons/react';
import { qrAuthService, QRSession } from '../services/qrAuth';
import { firestoreService, isFirebaseConfigured } from '../config/firebase';
import { useStore } from '../store';
import type { UserProfile } from '../types';

interface QRLoginProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export function QRLogin({ onBack, onSuccess }: QRLoginProps) {
  const { setUser, setWallet } = useStore();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<QRSession | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create a new QR session
  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSession(null);

    try {
      const { sessionId: newSessionId, expiresAt: newExpiresAt } =
        await qrAuthService.createSession();
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      setExpiresAt(newExpiresAt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create QR code';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    if (isFirebaseConfigured) {
      createSession();
    } else {
      setError('Authentication service not available');
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (sessionIdRef.current) {
        qrAuthService.deleteSession(sessionIdRef.current);
      }
    };
  }, [createSession]);

  // Listen for session status changes
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = qrAuthService.listenToSession(sessionId, async (updatedSession) => {
      setSession(updatedSession);

      if (updatedSession?.status === 'approved' && updatedSession.customToken) {
        try {
          // Complete authentication with the custom token
          const { userId } = await qrAuthService.completeAuthentication(
            updatedSession.customToken
          );

          // Get full user profile from Firestore
          const user = await firestoreService.getUser(userId);

          if (user) {
            const userProfile: UserProfile = {
              id: user.id,
              name: user.name,
              email: user.email,
              wallet_address: user.wallet_address,
              wallet_public_key: user.wallet_public_key,
              phone: user.phone,
              points: user.points,
              total_points_earned: user.total_points_earned,
              avatar: user.avatar,
              emailVerified: user.emailVerified,
              created_at: user.created_at,
              updated_at: user.updated_at,
              referral_code: user.referral_code,
              badges: user.badges,
            };
            setUser(userProfile, 'qr');

            // Store session info
            localStorage.setItem('wesplit_auth_method', 'qr');
            localStorage.setItem('wesplit_user_id', userId);

            if (user.wallet_address) {
              setWallet({
                isConnected: true,
                address: user.wallet_address,
                balance: 0,
                usdcBalance: 0,
                provider: 'none',
              });
            }

            // Cleanup session
            await qrAuthService.deleteSession(sessionId);

            onSuccess?.();
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Authentication failed';
          setError(message);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId, setUser, setWallet, onSuccess]);

  // Update countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(remaining);

      // Session expired, need to refresh
      if (remaining === 0 && session?.status === 'pending') {
        setSession((prev) => prev ? { ...prev, status: 'expired' } : null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, session?.status]);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Refresh QR code
  const handleRefresh = () => {
    if (sessionId) {
      qrAuthService.deleteSession(sessionId);
    }
    createSession();
  };

  // Render status-specific content
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white50 text-sm font-satoshi">Generating QR code...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-error/20 flex items-center justify-center mb-3">
            <Warning size={28} className="text-error" />
          </div>
          <p className="text-error text-sm font-satoshi mb-4">{error}</p>
          <button onClick={handleRefresh} className="btn-primary text-sm !py-2 !px-4">
            Try Again
          </button>
        </div>
      );
    }

    // Session scanned - waiting for approval
    if (session?.status === 'scanned') {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green/20 flex items-center justify-center mb-3 animate-pulse">
            <DeviceMobile size={28} className="text-green" />
          </div>
          <h3 className="text-base font-bold mb-1 font-archivo">Confirm on your phone</h3>
          <p className="text-white50 text-sm font-satoshi">
            Tap "Approve" in the WeSplit app
          </p>
          {session.userName && (
            <div className="mt-4 flex items-center gap-2 bg-white5 px-3 py-2 rounded-lg">
              {session.userAvatar ? (
                <img
                  src={session.userAvatar}
                  alt={session.userName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center">
                  <User size={16} className="text-green" />
                </div>
              )}
              <span className="text-white text-sm font-satoshi">{session.userName}</span>
            </div>
          )}
        </div>
      );
    }

    // Session approved - logging in
    if (session?.status === 'approved') {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green/20 flex items-center justify-center mb-3">
            <Check size={28} className="text-green" weight="bold" />
          </div>
          <h3 className="text-base font-bold mb-1 font-archivo">Login Approved!</h3>
          <p className="text-white50 text-sm font-satoshi">Signing you in...</p>
          <div className="mt-3 w-5 h-5 border-2 border-green border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    // Session rejected
    if (session?.status === 'rejected') {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-error/20 flex items-center justify-center mb-3">
            <X size={28} className="text-error" />
          </div>
          <h3 className="text-base font-bold mb-1 font-archivo">Login Denied</h3>
          <p className="text-white50 text-sm font-satoshi mb-4">
            The login request was rejected
          </p>
          <button onClick={handleRefresh} className="btn-primary text-sm !py-2 !px-4">
            Try Again
          </button>
        </div>
      );
    }

    // Session expired
    if (session?.status === 'expired' || timeLeft === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-warning/20 flex items-center justify-center mb-3">
            <ArrowsClockwise size={28} className="text-warning" />
          </div>
          <h3 className="text-base font-bold mb-1 font-archivo">QR Code Expired</h3>
          <p className="text-white50 text-sm font-satoshi mb-4">
            Generate a new code to continue
          </p>
          <button onClick={handleRefresh} className="btn-primary text-sm !py-2 !px-4">
            Refresh QR Code
          </button>
        </div>
      );
    }

    // Default - show QR code
    if (sessionId) {
      const qrData = qrAuthService.getQRCodeData(sessionId);

      return (
        <div className="flex flex-col items-center">
          {/* QR Code */}
          <div className="bg-white p-3 rounded-xl mb-4">
            <QRCodeSVG
              value={qrData}
              size={180}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 text-white50 text-sm mb-2">
            <span className="font-satoshi">Expires in</span>
            <span className="font-archivo text-white">{formatTime(timeLeft)}</span>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-white50 text-xs hover:text-white transition-all font-satoshi"
          >
            <ArrowsClockwise size={14} />
            Refresh
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white50 hover:text-white text-sm transition-all font-satoshi"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-4 overflow-y-auto">
        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold font-archivo">Scan to Login</h2>
          <p className="text-white50 text-xs mt-0.5 font-satoshi">
            Use your WeSplit mobile app
          </p>
        </div>

        {/* Main content */}
        {renderContent()}

        {/* Instructions */}
        {session?.status === 'pending' && timeLeft > 0 && (
          <div className="mt-6 space-y-2">
            {[
              'Open WeSplit on your phone',
              'Go to Settings → Linked Devices',
              'Tap "Link Browser Extension"',
              'Scan this QR code',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-white5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-green/20 flex items-center justify-center text-[10px] text-green font-bold">
                  {i + 1}
                </div>
                <span className="text-xs text-white60 font-satoshi">{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Security note */}
        <div className="mt-6 flex items-start gap-2 p-3 bg-white5 rounded-lg">
          <ShieldCheck size={16} className="text-green mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-white50 font-satoshi">
            Only scan this code on the WeSplit mobile app. Never share this QR code or
            scan codes from unknown sources.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white5">
        <p className="text-white30 text-[10px] text-center font-satoshi">
          Secure login via WeSplit mobile app
        </p>
      </div>
    </div>
  );
}
