import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Bell, Check, Sparkles } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';

const SOCIAL_PROOF = [
  { icon: '📚', text: '150+ Bible stories families finish together' },
  { icon: '🎮', text: '15+ games that teach Scripture, not just screen time' },
  { icon: '🙏', text: 'Loved by 10,000+ Christian families' },
  { icon: '⭐', text: '8/10 members refer Godly Kids to a friend' },
];

/**
 * Trial + reminder screen before the paywall.
 * 14-day free trial, 2-day notification toggle, social proof.
 */
const PaywallIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const forwardedState = (location.state || {}) as Record<string, unknown>;
  const [remindBeforeCharge, setRemindBeforeCharge] = useState(true);

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('paywall_intro_shown', {
      source: forwardedState.fromOnboarding ? 'onboarding' : 'other',
    });
  }, [forwardedState.fromOnboarding]);

  const handleContinue = async () => {
    activityTrackingService.trackOnboardingEvent('trial_intro_continue', {
      reminderToggle: remindBeforeCharge,
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
          <span className="text-sm font-semibold tracking-wide uppercase">14-day free trial</span>
        </div>

        <div className="text-center max-w-md mx-auto space-y-3 mb-6">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl leading-tight text-[#1e1b4b]">
            Try Godly Kids free
          </h1>
          <p className="text-[#475569] text-lg leading-relaxed">
            Full access for 14 days. We&apos;ll remind you 2 days before anything charges.
          </p>
        </div>

        <div className="w-full max-w-md space-y-2.5 mb-6">
          {SOCIAL_PROOF.map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-3 bg-white/90 border border-indigo-100 rounded-xl px-4 py-3 shadow-sm"
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              <span className="text-sm font-medium text-[#1e1b4b]">{item.text}</span>
            </div>
          ))}
        </div>

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
          className="w-full max-w-md flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50"
        >
          Continue
          <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
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
