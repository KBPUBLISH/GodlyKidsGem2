import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';

/**
 * First screen in the paywall sequence (after onboarding account creation).
 * Sets expectations: extended trial so families can see if Godly Kids is a good fit.
 */
const PaywallIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const forwardedState = location.state;

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('paywall_intro_shown', {
      source: (forwardedState as { fromOnboarding?: boolean })?.fromOnboarding ? 'onboarding' : 'other',
    });
  }, [forwardedState]);

  const handleContinue = () => {
    const fromOnboarding = (forwardedState as { fromOnboarding?: boolean })?.fromOnboarding === true;
    navigate('/paywall', {
      state: {
        ...forwardedState,
        ...(fromOnboarding ? { paywallFlowBackTarget: 'intro' as const } : {}),
      },
      replace: true,
    });
  };

  return (
    <div className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-32 left-8 w-32 h-24 bg-[#ddd6fe]/30 rounded-full blur-xl" />
      </div>

      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-10"
        style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 2rem)' }}
      >
        <div className="flex items-center justify-center gap-1.5 mb-8 text-[#6366f1]">
          <Sparkles className="w-6 h-6 shrink-0" strokeWidth={2} />
          <span className="text-sm font-semibold tracking-wide uppercase">You&apos;re in</span>
        </div>

        <div className="text-center max-w-md mx-auto space-y-8">
          <div className="space-y-4">
            <p className="text-[#64748b] text-lg sm:text-xl leading-snug">
              Try Godly Kids Premium with a
            </p>
            <div className="relative">
              <p className="font-display font-extrabold text-4xl sm:text-5xl leading-none tracking-tight bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
                14-day free trial
              </p>
              <span
                className="absolute -right-1 -top-2 text-2xl animate-bounce select-none"
                aria-hidden
              >
                ✨
              </span>
            </div>
          </div>

          <p className="text-[#1e1b4b] text-lg sm:text-xl leading-relaxed font-medium">
            So everyone can learn on Godly Kids—and you can see if we&apos;re the right fit for your family.
          </p>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="mt-12 w-full max-w-sm flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50"
        >
          Continue
          <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default PaywallIntroPage;
