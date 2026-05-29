import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, ArrowRight, ChevronLeft } from 'lucide-react';
import despia from 'despia-native';
import { activityTrackingService } from '../services/activityTrackingService';

const isDespiaNative = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('despia');
};

export type PaywallReminderLocationState = {
  selectedPlan: 'annual' | 'monthly' | 'lifetime';
  from?: string;
  fromOnboarding?: boolean;
  hideCloseButton?: boolean;
  showReverseTrialToast?: boolean;
  /** When set on `/paywall`, Back returns to this trial-reminder step. */
  paywallFlowBackTarget?: 'reminder';
};

async function tryEnableTrialNotifications(): Promise<void> {
  if (isDespiaNative()) {
    try {
      despia('settingsapp://');
    } catch {
      /* ignore */
    }
    return;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
}

function notificationsAlreadyEnabled(): boolean {
  if (isDespiaNative()) return true;
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission === 'granted';
  }
  return false;
}

/**
 * Shown after "Start 3-Day Free Trial" — explains billing reminder + optional notification opt-in.
 */
const PaywallTrialNotifyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as PaywallReminderLocationState | null;
  const selectedPlan = state?.selectedPlan;

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedPlan || !['annual', 'monthly', 'lifetime'].includes(selectedPlan)) {
      navigate('/paywall', { replace: true });
      return;
    }
    activityTrackingService.trackOnboardingEvent('paywall_notify_reminder_shown');
  }, [selectedPlan, navigate]);

  const goToCheckout = useCallback(
    (action: 'continue' | 'dismiss') => {
      navigate('/paywall', {
        replace: true,
        state: {
          ...state,
          selectedPlan,
          resumeSubscribe: true as const,
          paywallNotifyAction: action,
          paywallFlowBackTarget: 'reminder' as const,
        },
      });
    },
    [navigate, state, selectedPlan]
  );

  const handleContinue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      activityTrackingService.trackOnboardingEvent('paywall_notify_reminder_continue');
      if (!notificationsAlreadyEnabled()) {
        await tryEnableTrialNotifications();
      }
      goToCheckout('continue');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    activityTrackingService.trackOnboardingEvent('paywall_notify_reminder_dismiss');
    goToCheckout('dismiss');
  };

  const handleBackToPaywall = () => {
    const raw = state || {};
    const {
      paywallFlowBackTarget: _t,
      resumeSubscribe: _r,
      paywallNotifyAction: _n,
      ...rest
    } = raw as PaywallReminderLocationState & {
      resumeSubscribe?: boolean;
      paywallNotifyAction?: string;
    };
    navigate('/paywall', {
      state: { ...rest, selectedPlan },
    });
  };

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-6 w-36 h-24 bg-gradient-to-r from-[#c7d2fe]/45 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-24 right-4 w-44 h-32 bg-gradient-to-l from-[#fde68a]/30 to-transparent rounded-full blur-2xl" />
      </div>

      <div
        className="relative z-20 flex items-center px-4 pt-6 pb-2"
        style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 24px)' }}
      >
        <button
          type="button"
          onClick={handleBackToPaywall}
          className="flex items-center gap-0.5 pl-1 pr-2 py-2 -ml-1 text-gray-600 hover:text-gray-800 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={26} strokeWidth={2.5} className="shrink-0" />
          <span className="text-base font-semibold">Back</span>
        </button>
      </div>

      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-8"
        style={{ paddingTop: '0.5rem' }}
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`rounded-2xl bg-white/90 border border-indigo-100 shadow-md p-4 text-[#6366f1] ${i === 1 ? 'animate-pulse scale-110' : 'opacity-90'}`}
            >
              <Bell className="w-10 h-10 sm:w-12 sm:h-12" strokeWidth={2} />
            </div>
          ))}
        </div>

        <div className="text-center max-w-md mx-auto space-y-5">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1e1b4b] leading-tight">
            We&apos;ll remind you before you&apos;re charged
          </h1>
          <p className="text-[#475569] text-lg leading-relaxed">
            We&apos;ll let you know{' '}
            <span className="font-semibold text-[#6366f1]">1 day before</span> your trial ends so there are no
            surprises—only blessings.
          </p>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={busy}
          className="mt-10 w-full max-w-sm flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50 disabled:opacity-70"
        >
          {busy ? (
            <span>One moment…</span>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </button>
        {!notificationsAlreadyEnabled() && (
          <p className="mt-3 text-center text-xs text-[#64748b] max-w-sm">
            Continue to turn on notifications (recommended) so we can send your reminder.
          </p>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="mt-6 text-[#64748b] text-sm font-medium hover:text-[#6366f1] underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          Dismiss, continue without notifications
        </button>
      </div>

      <div className="relative z-10 shrink-0 pointer-events-none" style={{ height: 'var(--safe-area-bottom, 0px)' }} />
    </div>
  );
};

export default PaywallTrialNotifyPage;
