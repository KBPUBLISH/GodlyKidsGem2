import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Bell, Check, Loader2, Sparkles } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';
import { useSubscription } from '../context/SubscriptionContext';
import { DespiaService } from '../services/despiaService';
import { authService } from '../services/authService';

const TRIAL_STEPS = [
  { when: 'Today', what: 'stories, games, and the voices. Nothing to pay.' },
  { when: 'Day 12', what: 'we ping you.' },
  { when: 'Day 14', what: 'the plan starts. Cancel anytime.' },
];

/**
 * Trial + reminder screen before the paywall.
 * Shared by new-user (hard paywall next) and existing/old path (/paywall next).
 */
const PaywallIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const forwardedState = (location.state || {}) as Record<string, unknown>;
  const fromNewUserFlow = forwardedState.fromNewUserFlow === true;
  const [remindBeforeCharge, setRemindBeforeCharge] = useState(true);
  const [isOpeningPaywall, setIsOpeningPaywall] = useState(false);
  const { presentPaywall } = useSubscription();

  const hasAccount = (): boolean => {
    const userEmail = localStorage.getItem('godlykids_user_email');
    const user = authService.getUser();
    return !!(userEmail || user?.email);
  };

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('paywall_intro_shown', {
      source: fromNewUserFlow ? 'new_user_flow' : forwardedState.fromOnboarding ? 'onboarding' : 'other',
    });
  }, [fromNewUserFlow, forwardedState.fromOnboarding]);

  const handleContinue = async () => {
    activityTrackingService.trackOnboardingEvent('trial_intro_continue', {
      reminderToggle: remindBeforeCharge,
      flow: fromNewUserFlow ? 'new_user' : 'existing',
    });

    if (remindBeforeCharge && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          activityTrackingService.trackOnboardingEvent('trial_notification_permission', {
            granted: permission === 'granted',
          });
        }
      } catch {
        /* ignore */
      }
    }

    // Native app: Micheal's RevenueCat dashboard paywall (localized store prices).
    if (DespiaService.isNative()) {
      setIsOpeningPaywall(true);
      try {
        const result = await presentPaywall();
        if (result.success) {
          if (fromNewUserFlow) {
            navigate('/new-user-account', { replace: true, state: { fromPaywall: true } });
            return;
          }
          if (!hasAccount()) {
            navigate('/onboarding', { replace: true, state: { returnToAccountStep: true } });
            return;
          }
          navigate('/home', { replace: true });
          return;
        }
      } finally {
        setIsOpeningPaywall(false);
      }
      return;
    }

    if (fromNewUserFlow) {
      navigate('/paywall-new-user', {
        replace: true,
        state: {
          ...forwardedState,
          reminderToggle: remindBeforeCharge,
        },
      });
      return;
    }

    navigate('/paywall', {
      state: {
        ...forwardedState,
        fromOnboarding: true,
        hideCloseButton: true,
        reminderToggle: remindBeforeCharge,
      },
      replace: true,
    });
  };

  return (
    <div className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
      </div>

      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-10"
        style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 2rem)' }}
      >
        <div className="flex items-center justify-center gap-1.5 mb-6 text-[#6366f1]">
          <Sparkles className="w-6 h-6 shrink-0" strokeWidth={2} />
          <span className="text-sm font-semibold tracking-wide uppercase">14 DAYS FREE</span>
        </div>

        <div className="text-center max-w-md mx-auto space-y-3 mb-6">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-[#1e1b4b]">
            Bedtime stories kids actually open
          </h1>
          <p className="text-[#475569] text-lg leading-relaxed">
            Full access. We&apos;ll remind you 2 days before anything charges.
          </p>
        </div>

        <ol className="w-full max-w-md space-y-2.5 mb-4">
          {TRIAL_STEPS.map((item, index) => (
            <li
              key={item.when}
              className="flex items-start gap-3 bg-white/90 border border-indigo-100 rounded-xl px-4 py-3 shadow-sm"
            >
              <span className="w-6 h-6 rounded-full bg-[#eef2ff] text-[#6366f1] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {index + 1}
              </span>
              <p className="text-sm font-medium text-[#1e1b4b] leading-snug">
                <span className="font-extrabold">{item.when}</span>
                {' — '}
                {item.what}
              </p>
            </li>
          ))}
        </ol>

        <p className="w-full max-w-md text-center text-sm font-semibold text-[#6366f1] mb-6">
          4.7 on the App Store (74 ratings)
        </p>

        <button
          type="button"
          onClick={() => setRemindBeforeCharge((v) => !v)}
          className="w-full max-w-md flex items-center justify-between gap-3 bg-white rounded-2xl border-2 border-[#6366f1]/30 px-4 py-4 mb-6 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Bell className="w-6 h-6 text-[#6366f1] shrink-0" />
            <div>
              <p className="font-semibold text-[#1e1b4b]">Remind me 2 days before</p>
              <p className="text-xs text-[#64748b]">No surprise charges — we&apos;ll ping you first</p>
            </div>
          </div>
          <div
            className={`w-12 h-7 rounded-full p-0.5 transition-colors shrink-0 ${
              remindBeforeCharge ? 'bg-[#6366f1]' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                remindBeforeCharge ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        <button
          type="button"
          onClick={handleContinue}
          disabled={isOpeningPaywall}
          className="w-full max-w-md flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50 disabled:opacity-70"
        >
          {isOpeningPaywall ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Opening…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </button>

        <p className="mt-4 flex items-center gap-1.5 text-green-600 text-sm font-semibold">
          <Check size={16} strokeWidth={3} />
          No payment today
        </p>
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default PaywallIntroPage;
