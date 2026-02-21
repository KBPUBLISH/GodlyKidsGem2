import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Clock, Sparkles, Crown, Check, Shield } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useUser } from '../../context/UserContext';
import { activityTrackingService } from '../../services/activityTrackingService';
import { authService } from '../../services/authService';
import ParentGateModal from './ParentGateModal';

const LIFETIME_OFFER_STAGE_KEY = 'godlykids_lifetime_offer_stage';
const LIFETIME_OFFER_TIMER_END_KEY = 'godlykids_lifetime_offer_timer_end';

const TIMER_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const hasAccount = (): boolean => {
  const userEmail = localStorage.getItem('godlykids_user_email');
  const user = authService.getUser();
  return !!(userEmail || user?.email);
};

interface LifetimeOfferModalProps {
  variant: 'first' | 'final';
  onClose: () => void;
}

const LifetimeOfferModal: React.FC<LifetimeOfferModalProps> = ({ variant, onClose }) => {
  const navigate = useNavigate();
  const { purchase } = useSubscription();
  const { subscribe } = useUser();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showParentGate, setShowParentGate] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('lifetime_popup_shown', { variant }).catch(() => {});
  }, [variant]);

  // 30-minute countdown for the first variant
  useEffect(() => {
    if (variant !== 'first') return;

    let endTime: number;
    const stored = localStorage.getItem(LIFETIME_OFFER_TIMER_END_KEY);
    if (stored) {
      endTime = parseInt(stored, 10);
    } else {
      endTime = Date.now() + TIMER_DURATION_MS;
      localStorage.setItem(LIFETIME_OFFER_TIMER_END_KEY, endTime.toString());
    }

    const tick = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setTimerExpired(true);
        setTimeRemaining(null);
        return;
      }
      setTimeRemaining({
        minutes: Math.floor(remaining / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [variant]);

  const handleDismiss = useCallback(() => {
    activityTrackingService.trackOnboardingEvent('lifetime_popup_dismissed', { variant }).catch(() => {});
    if (variant === 'first') {
      localStorage.setItem(LIFETIME_OFFER_STAGE_KEY, 'shown_first');
    } else {
      localStorage.setItem(LIFETIME_OFFER_STAGE_KEY, 'done');
    }
    onClose();
  }, [variant, onClose]);

  const handlePurchaseClick = () => {
    setError(null);
    activityTrackingService.trackOnboardingEvent('lifetime_popup_clicked', { variant }).catch(() => {});

    if (!hasAccount()) {
      navigate('/paywall', { state: { from: 'lifetime-offer' } });
      onClose();
      return;
    }
    setShowParentGate(true);
  };

  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setError(null);

    try {
      const result = await purchase('lifetime');
      if (result.success) {
        activityTrackingService.trackOnboardingEvent('subscribed', { planType: 'lifetime', source: 'lifetime-popup', variant }).catch(() => {});
        localStorage.setItem(LIFETIME_OFFER_STAGE_KEY, 'done');
        subscribe();
        navigate('/home');
      } else if (result.error && result.error !== 'Purchase cancelled') {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-[92%] max-w-md bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-3xl shadow-2xl overflow-hidden border border-indigo-400/30">

          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center">

            {/* Crown icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
              <Crown size={32} className="text-white" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-extrabold text-white mb-1">
              {variant === 'first' ? 'Special Offer Just for You!' : 'Your Final Offer'}
            </h2>
            <p className="text-indigo-200 text-sm mb-5">
              {variant === 'first'
                ? 'Unlock everything — one payment, forever.'
                : "This is your last chance to lock in lifetime access."}
            </p>

            {/* Timer (first variant only) */}
            {variant === 'first' && timeRemaining && !timerExpired && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2 mb-5">
                <Clock size={16} className="text-red-300" />
                <span className="text-red-200 text-sm font-medium">Offer expires in</span>
                <span className="font-mono font-bold text-white text-lg tracking-wider">
                  {pad(timeRemaining.minutes)}:{pad(timeRemaining.seconds)}
                </span>
              </div>
            )}

            {variant === 'first' && timerExpired && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2 mb-5">
                <Clock size={16} className="text-red-300" />
                <span className="text-red-200 text-sm font-medium">Offer expired</span>
              </div>
            )}

            {variant === 'final' && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-2 mb-5">
                <Sparkles size={16} className="text-amber-300" />
                <span className="text-amber-200 text-sm font-medium">Last chance — this won't appear again</span>
              </div>
            )}

            {/* Price */}
            <div className="mb-5">
              <div className="flex items-center justify-center gap-3">
                <span className="text-gray-400 line-through text-lg">$69.99</span>
                <span className="text-4xl font-extrabold text-white">$19.99</span>
              </div>
              <p className="text-indigo-300 text-xs mt-1">One-time payment — lifetime access</p>
            </div>

            {/* Feature highlights */}
            <div className="w-full space-y-2 mb-6">
              {[
                'Every book, lesson & audio — forever',
                'Unlimited custom Bible story books',
                'All future content & updates included',
                'Up to 5 family profiles',
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5 text-left">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-green-400" strokeWidth={3} />
                  </div>
                  <span className="text-white/90 text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-300 text-xs mb-3">{error}</p>
            )}

            {/* CTA */}
            <button
              onClick={handlePurchaseClick}
              disabled={isPurchasing || (variant === 'first' && timerExpired)}
              className="w-full font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all mb-3 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-amber-400 to-yellow-500 text-[#1e1b4b] shadow-amber-400/30"
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </span>
              ) : (
                'Get Lifetime Access — $19.99'
              )}
            </button>

            {/* Trust badge */}
            <div className="flex items-center gap-1.5 text-indigo-300/70 text-xs mb-2">
              <Shield size={12} />
              <span>Secure purchase via App Store / Google Play</span>
            </div>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="text-indigo-300/50 text-xs hover:text-indigo-300/80 transition-colors mt-1"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>

      {showParentGate && (
        <ParentGateModal
          onSuccess={handleGateSuccess}
          onClose={() => setShowParentGate(false)}
        />
      )}
    </>
  );
};

export { LIFETIME_OFFER_STAGE_KEY, LIFETIME_OFFER_TIMER_END_KEY };
export default LifetimeOfferModal;
