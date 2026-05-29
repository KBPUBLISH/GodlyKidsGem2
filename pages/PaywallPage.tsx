
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, RefreshCw, AlertCircle, CheckCircle, Mail, UserPlus, ChevronDown, ChevronUp, ChevronLeft, Gift, Clock } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import ParentGateModal from '../components/features/ParentGateModal';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiService';
import { facebookPixelService } from '../services/facebookPixelService';
import { metaAttributionService } from '../services/metaAttributionService';
import { activityTrackingService } from '../services/activityTrackingService';

// Check if user has a real account (not just device ID)
const hasAccount = (): boolean => {
  const userEmail = localStorage.getItem('godlykids_user_email');
  const user = authService.getUser();
  return !!(userEmail || user?.email);
};

// Get user's first name for personalization
const getUserFirstName = (): string => {
  // Try to get from the main user data storage
  const savedData = localStorage.getItem('godly_kids_data_v7') || localStorage.getItem('godly_kids_data_v6');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      if (parsed.parentName) {
        return parsed.parentName.split(' ')[0];
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Fallback to auth user
  const user = authService.getUser();
  if (user?.username && !user.username.startsWith('device_') && !user.username.includes('_')) {
    return user.username.split(' ')[0];
  }
  
  return '';
};

/** 5-minute urgency countdown for Create Your Story paywall CTA (persists across visits). */
const PAYWALL_TRIAL_URGENCY_KEY = 'godlykids_paywall_trial_urgency_start';
const PAYWALL_TRIAL_URGENCY_MS = 5 * 60 * 1000;

function getTrialUrgencyRemaining(): { mm: number; ss: number; expired: boolean } {
  if (typeof window === 'undefined') {
    return { mm: 5, ss: 0, expired: false };
  }
  let start = localStorage.getItem(PAYWALL_TRIAL_URGENCY_KEY);
  if (!start) {
    start = Date.now().toString();
    localStorage.setItem(PAYWALL_TRIAL_URGENCY_KEY, start);
  }
  const end = parseInt(start, 10) + PAYWALL_TRIAL_URGENCY_MS;
  const rem = end - Date.now();
  if (rem <= 0) {
    return { mm: 0, ss: 0, expired: true };
  }
  return {
    mm: Math.floor(rem / 60000),
    ss: Math.floor((rem % 60000) / 1000),
    expired: false,
  };
}

/** Create Your Story paywall hero carousel (auto-advances every 3s). */
const PAYWALL_HERO_SLIDES: { src: string; alt: string }[] = [
  {
    src: '/assets/images/paywall-carousel-1.png',
    alt: 'Daily devotional activities for kids — family using Godly Kids on a tablet at home',
  },
  {
    src: '/assets/images/paywall-carousel-2.png',
    alt: 'Child watching a calming video book on a tablet',
  },
  {
    src: '/assets/images/paywall-carousel-3.png',
    alt: 'Hours of screen-free fun — Holy Spirit Adventures audio playing on a phone in the car',
  },
  {
    src: '/assets/images/paywall-carousel-4.png',
    alt: 'Games that teach faith — child playing Scribby Path on Godly Kids',
  },
];

const PAYWALL_KID_FEEDBACK: { name: string; quote: string }[] = [
  { name: 'Emma', quote: 'THANK YOU SO MUCH FOR GODLY KIDS!!!' },
  { name: 'Marcus', quote: 'Keep up the great work' },
  { name: 'Lily', quote: 'I love Godly Kids because you get to learn about the Bible' },
  { name: 'Noah', quote: 'The Bible stories are my favorite part every day!' },
  { name: 'Ava', quote: "We listen together as a family and it's so fun." },
  { name: 'Ethan', quote: 'I memorized a new verse this week!' },
  { name: 'Zoe', quote: 'The games help me remember what we read.' },
];

const PaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscribe } = useUser();
  /** Dedupe Strict Mode / re-renders when opening parent gate from `/paywall/reminder` return. */
  const resumeSubscribeHandledKey = useRef<string | null>(null);

  const hideCloseButton = (location.state as any)?.hideCloseButton === true;
  
  const fromState = (location.state as any)?.from as string | undefined;
  const fromOnboarding = (location.state as any)?.fromOnboarding === true;
  
  const { 
    isLoading, 
    isPremium,
    purchase, 
    restorePurchases,
    reverseTrial,
    startReverseTrial,
  } = useSubscription();

  // Show "You've Got a Gift!" toast when coming from reverse-trial activation or when state requests it
  const showReverseTrialToast = (location.state as any)?.showReverseTrialToast === true
    || (reverseTrial?.isActive && fromState === 'create-your-story');

  // Create Your Story paywall: hero image, 12 custom books for annual. Show lifetime option when from deal page.
  const isCreateYourStoryPaywall = fromState === 'create-your-story';
  const showLifetimeOption = fromState === 'lifetime-offer'; // Deal page sends users here; show $19.99 lifetime

  /** Funnel source for analytics (portal "Paywall sources"). Not every entry path sets this. */
  const paywallAnalyticsSource =
    fromState === 'create-your-story'
      ? 'create-your-story'
      : fromOnboarding
        ? 'onboarding-first-time-user'
        : undefined;
  const paywallSourceMeta = paywallAnalyticsSource ? { source: paywallAnalyticsSource } : {};
  
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly' | 'lifetime'>(() => {
    const s = (location.state as any)?.selectedPlan;
    if (s === 'annual' || s === 'monthly' || s === 'lifetime') return s;
    return fromState === 'lifetime-offer' ? 'lifetime' : 'annual';
  });
  const [planSelectorExpanded, setPlanSelectorExpanded] = useState(fromState === 'lifetime-offer');
  const [showParentGate, setShowParentGate] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);
  
  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');
  
  // Account required modal state
  const [showAccountRequired, setShowAccountRequired] = useState(false);
  
  // Exit-intent 24h trial popup state
  const [showExitTrialOffer, setShowExitTrialOffer] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  
  // Get personalized name
  const firstName = getUserFirstName();
  
  // Track paywall view for analytics (include source when from Dive into the Bible)
  useEffect(() => {
    // Facebook Pixel
    facebookPixelService.init();
    facebookPixelService.trackPaywallView();
    // Onboarding funnel tracking
    activityTrackingService.trackOnboardingEvent(
      'paywall_shown',
      paywallAnalyticsSource ? { source: paywallAnalyticsSource } : undefined
    );
  }, [paywallAnalyticsSource]);

  // If user already has premium, redirect to home
  useEffect(() => {
    if (isPremium) {
      subscribe(); // Update local state
      navigate('/home');
    }
  }, [isPremium, navigate, subscribe]);
  
  // Listen for premium status changes (from webhook confirmation after purchase)
  // IMPORTANT: Do NOT call subscribe() here - the event was already dispatched by subscribe().
  // Calling it again causes an infinite loop: subscribe → dispatch event → handler → subscribe → ...
  useEffect(() => {
    const handlePremiumChange = (event: CustomEvent) => {
      console.log('📱 Premium status changed on paywall:', event.detail);
      if (event.detail?.isPremium) {
        console.log('✅ Premium confirmed via event - navigating to home');
        navigate('/home');
      }
    };
    
    window.addEventListener('revenuecat:premiumChanged' as any, handlePremiumChange);
    
    // Background poll if we have a "processing" error
    let backgroundPollInterval: ReturnType<typeof setInterval> | null = null;
    
    if (error && error.includes('processing')) {
      console.log('🔄 Starting background poll for purchase confirmation...');
      const apiBaseUrl = getApiBaseUrl();
      const userId = localStorage.getItem('godlykids_device_id') || 
                     localStorage.getItem('godlykids_user_email') || 
                     'anonymous';
      
      backgroundPollInterval = setInterval(async () => {
        try {
          const localPremium = localStorage.getItem('godlykids_premium') === 'true';
          if (localPremium) {
            console.log('✅ Premium found in background poll (localStorage)');
            clearInterval(backgroundPollInterval!);
            subscribe();
            navigate('/home');
            return;
          }
          
          const response = await fetch(`${apiBaseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.isPremium) {
              console.log('✅ Premium found in background poll (backend)');
              localStorage.setItem('godlykids_premium', 'true');
              clearInterval(backgroundPollInterval!);
              subscribe();
              navigate('/home');
            }
          }
        } catch (e) {
          // Silently continue
        }
      }, 3000);
    }
    
    return () => {
      window.removeEventListener('revenuecat:premiumChanged' as any, handlePremiumChange);
      if (backgroundPollInterval) {
        clearInterval(backgroundPollInterval);
      }
    };
  }, [error, navigate]);

  // After trial-notify step: resume straight to parent gate + purchase
  useEffect(() => {
    const st = location.state as any;
    if (!st?.resumeSubscribe) {
      resumeSubscribeHandledKey.current = null;
      return;
    }
    if (resumeSubscribeHandledKey.current === location.key) return;
    resumeSubscribeHandledKey.current = location.key;

    const plan =
      st.selectedPlan === 'annual' || st.selectedPlan === 'monthly' || st.selectedPlan === 'lifetime'
        ? st.selectedPlan
        : selectedPlan;

    if (!hasAccount()) {
      navigate('/paywall', { replace: true, state: { ...st, resumeSubscribe: false } });
      return;
    }

    console.log('🔐 Resuming from trial reminder — showing parent gate');
    activityTrackingService.trackOnboardingEvent('paywall_parent_gate_shown', {
      planType: plan,
      ...paywallSourceMeta,
    });
    setShowParentGate(true);

    const { resumeSubscribe: _ignored, ...rest } = st;
    navigate('/paywall', { replace: true, state: { ...rest, resumeSubscribe: false } });
  }, [location.key, location.state, navigate, selectedPlan, paywallAnalyticsSource]);

  const handleSubscribeClick = () => {
    setError(null);
    
    // Track trial button clicked
    console.log('🔘 Start Trial button clicked, plan:', selectedPlan);
    activityTrackingService.trackOnboardingEvent('paywall_trial_clicked', { planType: selectedPlan, ...paywallSourceMeta });
    
    // Require sign-in before ANY in-app purchase so RevenueCat webhook receives email as app_user_id.
    // Otherwise purchase is tied to device ID and user won't get premium after signing in on another device.
    if (!hasAccount()) {
      console.log('⚠️ No account found, showing account required modal');
      activityTrackingService.trackOnboardingEvent('paywall_account_required', { planType: selectedPlan, ...paywallSourceMeta });
      setShowAccountRequired(true);
      return;
    }

    // Trial billing reminder + optional notifications, then return here with resumeSubscribe
    console.log('🔔 Navigating to trial reminder step');
    navigate('/paywall/reminder', {
      state: {
        ...(location.state as object || {}),
        selectedPlan,
        from: fromState,
        hideCloseButton,
        showReverseTrialToast: (location.state as any)?.showReverseTrialToast,
      },
    });
  };

  const handleGateSuccess = async () => {
    console.log('✅ Parent gate passed, starting purchase flow');
    activityTrackingService.trackOnboardingEvent('paywall_parent_gate_passed', { planType: selectedPlan, ...paywallSourceMeta });
    
    // Keep parent gate open with "Processing..." state until purchase dialog appears
    // This prevents user from seeing the paywall and thinking they already got access
    setIsPurchasing(true);
    setError(null);

    // Create Your Story paywall has no lifetime unless from deal page; otherwise use annual
    const effectivePlan = (isCreateYourStoryPaywall && !showLifetimeOption && selectedPlan === 'lifetime') ? 'annual' : selectedPlan;
    
    // Facebook Pixel - Track checkout initiation
    const price = effectivePlan === 'lifetime' ? lifetimeSalePrice : effectivePlan === 'annual' ? annualPrice : 5.99;
    facebookPixelService.trackInitiateCheckout(effectivePlan, price);
    
    // Track purchase attempt
    activityTrackingService.trackOnboardingEvent('paywall_purchase_started', { planType: effectivePlan, ...paywallSourceMeta });

    try {
      console.log('💳 Calling purchase() with plan:', effectivePlan);
      const result = await purchase(effectivePlan);
      console.log('💳 Purchase result:', result);

      // Close parent gate now that purchase dialog appeared and completed
      setShowParentGate(false);

      if (result.success) {
        // RevenueCat service already confirmed purchase (via DeSpia callback, localStorage,
        // or backend webhook polling). Grant premium immediately — don't block the user
        // with another round of verification.
        try {
          facebookPixelService.trackPurchase(effectivePlan, price);
          facebookPixelService.trackSubscribe(effectivePlan, price);
        } catch (fbError) {
          console.warn('⚠️ Facebook Pixel tracking error:', fbError);
        }
        
        try {
          const userEmail = localStorage.getItem('godlykids_user_email') || authService.getUser()?.email;
          metaAttributionService.trackPurchase({
            email: userEmail || undefined,
            value: price,
            currency: 'USD',
            plan: selectedPlan,
          });
        } catch (metaError) {
          console.warn('⚠️ Meta Conversions API tracking error:', metaError);
        }
        
        try {
          activityTrackingService.trackOnboardingEvent('subscribed', { planType: selectedPlan, ...paywallSourceMeta });
        } catch (trackError) {
          console.warn('⚠️ Activity tracking error:', trackError);
        }
        
        subscribe();
        navigate('/home');

        // Non-blocking background recheck: if the webhook hasn't arrived yet, keep
        // polling the backend so the premium status is eventually persisted server-side.
        // This does NOT revoke access — it just ensures the backend catches up.
        const userId = localStorage.getItem('godlykids_user_email') || localStorage.getItem('godlykids_device_id') || 'anonymous';
        const baseUrl = getApiBaseUrl();
        (async () => {
          for (let attempt = 0; attempt < 10; attempt++) {
            try {
              const statusRes = await fetch(`${baseUrl}/api/webhooks/purchase-status/${encodeURIComponent(userId)}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                if (statusData.isPremium) {
                  console.log('✅ Backend confirmed premium (background recheck)');
                  return;
                }
              }
            } catch { /* ignore */ }
            await new Promise(r => setTimeout(r, 3000));
          }
          console.warn('⚠️ Backend has not confirmed premium after background recheck — webhook may be delayed');
        })();
      } else if (result.error && result.error !== 'Purchase cancelled') {
        console.error('❌ Purchase failed:', result.error);
        activityTrackingService.trackOnboardingEvent('paywall_purchase_error', { planType: selectedPlan, error: result.error, ...paywallSourceMeta });
        setError(result.error);
      } else {
        console.log('⏸️ Purchase cancelled by user');
        activityTrackingService.trackOnboardingEvent('paywall_purchase_cancelled', { planType: selectedPlan, ...paywallSourceMeta });
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      activityTrackingService.trackOnboardingEvent('paywall_purchase_error', { planType: selectedPlan, error: err.message, ...paywallSourceMeta });
      setError(err.message || 'An error occurred during purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchases = async (emailToSearch?: string) => {
    setIsRestoring(true);
    setError(null);
    setMigrationResult(null);
    setShowRestoreModal(false);

    try {
      const user = authService.getUser();
      const emailForRestore = emailToSearch || user?.email;
      if (emailForRestore) {
        localStorage.setItem('godlykids_user_email', emailForRestore.toLowerCase().trim());
      }
      
      // First, check backend directly with the email
      const baseUrl = getApiBaseUrl();
      if (emailForRestore) {
        try {
          const response = await fetch(`${baseUrl}/api/webhooks/purchase-status/${encodeURIComponent(emailForRestore)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.isPremium) {
              localStorage.setItem('godlykids_premium', 'true');
              subscribe();
              setMigrationResult({
                type: 'success',
                message: 'Your subscription has been restored! 🎉',
              });
              setTimeout(() => navigate('/home'), 1500);
              return;
            }
          }
        } catch (backendError) {
          console.log('⚠️ Backend check failed:', backendError);
        }
      }
      
      // Try native RevenueCat/DeSpia restore
      const result = await restorePurchases(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const localPremium = localStorage.getItem('godlykids_premium') === 'true';
      
      if (result.success && (result.isPremium || localPremium)) {
        subscribe();
        setMigrationResult({
          type: 'success',
          message: 'Your subscription has been restored! 🎉',
        });
        setTimeout(() => navigate('/home'), 1500);
        return;
      }

      // Try migration API for OLD app users
      if (emailForRestore) {
        const migrationResponse = await fetch(`${baseUrl}/api/migration/restore-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailForRestore }),
        });

        const migrationData = await migrationResponse.json();

        if (migrationData.subscriptionRestored) {
          subscribe();
          setMigrationResult({
            type: 'success',
            message: `Welcome back! Your subscription has been restored! 🎉`,
          });
          setTimeout(() => navigate('/home'), 2000);
          return;
        } else if (migrationData.found) {
          setMigrationResult({
            type: 'info',
            message: migrationData.message || `Account found but subscription has expired.`,
          });
          return;
        } else {
          setError(`No subscription found for ${emailForRestore}. Contact hello@kbpublish.org for help.`);
          return;
        }
      }

      setError('No subscription found. Contact hello@kbpublish.org for assistance.');
    } catch (err: any) {
      console.error('Restore error:', err);
      setError(err.message || 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Calculate prices and savings
  const monthlyPrice = 5.99;
  const annualPrice = 39.99;  // Main paywall: annual subscription
  const lifetimeOriginalPrice = 69.99;  // Lifetime (exit deal only) - was $69.99, sale $19.99
  const lifetimeSalePrice = 19.99;      // Only shown in LifetimeOfferModal (exit paywall deal)
  const lifetimeDiscount = Math.round(((lifetimeOriginalPrice - lifetimeSalePrice) / lifetimeOriginalPrice) * 100);
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savings = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);
  
  // 30-minute countdown timer for lifetime deal
  const LIFETIME_DEAL_KEY = 'godlykids_lifetime_deal_start';
  const DEAL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  
  const [timeRemaining, setTimeRemaining] = useState<{ minutes: number; seconds: number } | null>(null);
  const [dealExpired, setDealExpired] = useState(false);
  
  useEffect(() => {
    let dealStartTime = localStorage.getItem(LIFETIME_DEAL_KEY);
    if (!dealStartTime) {
      dealStartTime = Date.now().toString();
      localStorage.setItem(LIFETIME_DEAL_KEY, dealStartTime);
    }
    
    const startTime = parseInt(dealStartTime, 10);
    const endTime = startTime + DEAL_DURATION_MS;
    
    const updateTimer = () => {
      const remaining = endTime - Date.now();
      
      if (remaining <= 0) {
        setDealExpired(true);
        setTimeRemaining(null);
        return;
      }
      
      setTimeRemaining({
        minutes: Math.floor(remaining / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
      });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const [trialUrgency, setTrialUrgency] = useState(getTrialUrgencyRemaining);
  useEffect(() => {
    setTrialUrgency(getTrialUrgencyRemaining());
    const id = setInterval(() => setTrialUrgency(getTrialUrgencyRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    if (!isCreateYourStoryPaywall) return;
    const id = setInterval(() => {
      setHeroSlide((i) => (i + 1) % PAYWALL_HERO_SLIDES.length);
    }, 3000);
    return () => clearInterval(id);
  }, [isCreateYourStoryPaywall]);

  const [feedbackSlide, setFeedbackSlide] = useState(0);
  useEffect(() => {
    if (!isCreateYourStoryPaywall) return;
    const id = setInterval(() => {
      setFeedbackSlide((i) => (i + 1) % PAYWALL_KID_FEEDBACK.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isCreateYourStoryPaywall]);

  const EXIT_TRIAL_SHOWN_KEY = 'godlykids_exit_trial_shown';

  const proceedWithPaywallBack = () => {
    const stage = localStorage.getItem('godlykids_lifetime_offer_stage');
    if (!stage || stage === 'none') {
      localStorage.setItem('godlykids_lifetime_offer_stage', 'ready');
      localStorage.setItem('godlykids_lifetime_offer_ready_at', Date.now().toString());
      if (!localStorage.getItem(LIFETIME_DEAL_KEY)) {
        localStorage.setItem(LIFETIME_DEAL_KEY, Date.now().toString());
      }
    }

    const st = (location.state || {}) as {
      paywallFlowBackTarget?: 'intro' | 'reminder';
      selectedPlan?: 'annual' | 'monthly' | 'lifetime';
      from?: string;
      fromOnboarding?: boolean;
      hideCloseButton?: boolean;
      showReverseTrialToast?: boolean;
    };

    if (st.paywallFlowBackTarget === 'reminder' && st.selectedPlan) {
      navigate('/paywall/reminder', {
        state: {
          selectedPlan: st.selectedPlan,
          from: st.from,
          fromOnboarding: st.fromOnboarding,
          hideCloseButton: st.hideCloseButton,
          showReverseTrialToast: st.showReverseTrialToast,
        },
      });
      return;
    }

    if (st.paywallFlowBackTarget === 'intro' || fromOnboarding) {
      navigate('/paywall/intro', { state: { fromOnboarding: true } });
      return;
    }
    if (fromState === 'create-your-story') {
      navigate('/create-your-story', { replace: true });
      return;
    }
    navigate('/home');
  };

  const handlePaywallBack = () => {
    activityTrackingService.trackOnboardingEvent(
      'paywall_closed',
      paywallAnalyticsSource ? { source: paywallAnalyticsSource } : undefined
    ).catch(() => {});

    // Check if user is eligible for the 24h exit-intent trial
    const alreadyShown = sessionStorage.getItem(EXIT_TRIAL_SHOWN_KEY) === 'true';
    const hadReverseTrial = localStorage.getItem('godlykids_reverse_trial') === 'true';
    const isEligible = !isPremium
      && !hadReverseTrial
      && reverseTrial?.eligible !== false
      && !alreadyShown;

    if (isEligible) {
      sessionStorage.setItem(EXIT_TRIAL_SHOWN_KEY, 'true');
      activityTrackingService.trackOnboardingEvent('paywall_exit_trial_offered', paywallSourceMeta).catch(() => {});
      setShowExitTrialOffer(true);
      return;
    }

    proceedWithPaywallBack();
  };

  const handleAcceptExitTrial = async () => {
    setIsStartingTrial(true);
    try {
      activityTrackingService.trackOnboardingEvent('paywall_exit_trial_accepted', paywallSourceMeta).catch(() => {});
      const result = await startReverseTrial({ trialDurationHours: 24 });
      if (result.success) {
        setShowExitTrialOffer(false);
        navigate('/home');
      } else {
        setShowExitTrialOffer(false);
        proceedWithPaywallBack();
      }
    } catch {
      setShowExitTrialOffer(false);
      proceedWithPaywallBack();
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleDeclineExitTrial = () => {
    activityTrackingService.trackOnboardingEvent('paywall_exit_trial_declined', paywallSourceMeta).catch(() => {});
    setShowExitTrialOffer(false);
    proceedWithPaywallBack();
  };

  return (
    <div
      className="relative h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] overflow-y-auto no-scrollbar flex flex-col"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
        {/* Decorative clouds/shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-0 w-32 h-20 bg-gradient-to-r from-[#c7d2fe]/40 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute top-20 right-0 w-40 h-24 bg-gradient-to-l from-[#ddd6fe]/40 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-40 left-5 w-24 h-16 bg-[#c7d2fe]/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-32 h-20 bg-[#fde68a]/20 rounded-full blur-xl"></div>
        </div>

        {/* Close button for default paywall variant */}
        {!isCreateYourStoryPaywall && !hideCloseButton && (
          <button
            type="button"
            onClick={handlePaywallBack}
            className="absolute top-3 right-3 z-20 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white shadow-sm transition-all"
            style={{ marginTop: 'var(--safe-area-top, 0px)' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}

        {/* Hero carousel — Create Your Story paywall */}
        {isCreateYourStoryPaywall && (
          <div className="w-full flex-shrink-0 relative z-10">
            {!hideCloseButton && (
              <header className="flex items-center border-b border-indigo-400/40 bg-gradient-to-r from-[#6366f1] to-[#4f46e5] px-2 py-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={handlePaywallBack}
                  className="flex items-center gap-0.5 py-0.5 pl-0.5 pr-2 text-sm font-semibold text-white hover:text-indigo-100 transition-colors"
                  aria-label="Back"
                >
                  <ChevronLeft size={22} strokeWidth={2.5} className="shrink-0" />
                  <span>Back</span>
                </button>
              </header>
            )}
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="Godly Kids highlights"
          >
            <p className="sr-only" aria-live="polite">
              Slide {heroSlide + 1} of {PAYWALL_HERO_SLIDES.length}
            </p>
            <div className="relative aspect-[3/2] w-full overflow-hidden bg-slate-100 sm:aspect-[16/9]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={heroSlide}
                  src={PAYWALL_HERO_SLIDES[heroSlide].src}
                  alt={PAYWALL_HERO_SLIDES[heroSlide].alt}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  initial={{ opacity: 0, x: 32, scale: 0.88 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.85 }}
                />
              </AnimatePresence>
            </div>
            <div className="flex justify-center gap-1.5 py-2.5" aria-hidden="true">
              {PAYWALL_HERO_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === heroSlide ? 'w-6 bg-[#6366f1]' : 'w-1.5 bg-[#c7d2fe]'
                  }`}
                />
              ))}
            </div>
          </div>
          </div>
        )}

        <div className={`flex-1 flex flex-col items-center px-3 pb-8 relative z-10 w-full max-w-xl mx-auto ${isCreateYourStoryPaywall ? 'pt-2' : ''}`}>
            {/* Main Title - hidden on Create Your Story (simpler paywall) */}
            {!isCreateYourStoryPaywall && (
            <div className="text-center mb-6">
              <h1 className="text-[#1e1b4b] font-display font-extrabold text-2xl leading-tight mb-2">
                Free full access to
              </h1>
              <h2 className="text-[#6366f1] font-display font-extrabold text-3xl">
                Godly Kids Plus
              </h2>
            </div>
            )}

            {/* CTA + trial summary (Create Your Story paywall only) */}
            {isCreateYourStoryPaywall && (
              <>
                <section
                  className="w-full mb-4 rounded-xl bg-white/90 border border-indigo-100 px-4 py-4 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40"
                  role="region"
                  aria-roledescription="carousel"
                  aria-label="Real feedback from kids"
                >
                  <h3 className="font-display font-extrabold text-base sm:text-lg text-center mb-2 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                    Real Feedback from Kids
                  </h3>
                  <p className="text-center text-xs font-semibold tracking-wide text-[#64748b] mb-3">
                    8/10 Members Refer Godly Kids
                  </p>
                  <p className="sr-only" aria-live="polite">
                    {PAYWALL_KID_FEEDBACK[feedbackSlide].name}: {PAYWALL_KID_FEEDBACK[feedbackSlide].quote}
                  </p>
                  <div className="relative min-h-[4.5rem] overflow-hidden sm:min-h-[4rem]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={feedbackSlide}
                        className="flex items-start gap-3 text-left"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <span className="shrink-0 rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-bold text-[#6366f1] ring-1 ring-indigo-100">
                          {PAYWALL_KID_FEEDBACK[feedbackSlide].name}
                        </span>
                        <p className="min-w-0 flex-1 text-sm italic leading-snug text-[#475569]">
                          &ldquo;{PAYWALL_KID_FEEDBACK[feedbackSlide].quote}&rdquo;
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </section>
                <div className="relative w-full mb-3">
                  <p
                    id="paywall-trial-countdown-label"
                    className="sr-only"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {trialUrgency.expired
                      ? 'Five minute offer timer ended'
                      : `${trialUrgency.mm} minutes ${trialUrgency.ss} seconds remaining on limited offer`}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubscribeClick}
                    disabled={isPurchasing || isRestoring || isLoading}
                    className="relative flex min-h-[3.5rem] w-full items-center justify-center px-4 py-4 text-lg font-bold leading-tight rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50 pl-4 pr-[5.25rem] sm:pr-28"
                    aria-describedby="paywall-trial-countdown-label"
                  >
                    {isPurchasing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      <>
                        <span className="sr-only">
                          Start 3-day free trial, zero dollars today
                        </span>
                        <span className="text-center leading-tight" aria-hidden="true">
                          <span className="inline-flex flex-wrap items-center justify-center gap-x-1">
                            <span>Start 3-Day Free Trial — $0.00</span>
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                  <div
                    className="pointer-events-none absolute -top-1 right-2 sm:right-3 z-10 min-w-[3.25rem] rounded-lg bg-gradient-to-b from-red-500 to-red-600 px-2 py-1 text-center shadow-md ring-2 ring-white"
                    aria-hidden="true"
                  >
                    <span className="block text-[9px] font-semibold uppercase leading-tight text-red-100">5 min</span>
                    <span className="font-mono text-sm font-bold leading-none tabular-nums text-white">
                      {String(trialUrgency.mm).padStart(2, '0')}:{String(trialUrgency.ss).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <Check size={18} strokeWidth={3} />
                    <span className="font-semibold text-sm">No payment now!</span>
                  </div>
                  <p className="text-gray-500 text-xs text-center">
                    {selectedPlan === 'annual'
                      ? `3-day free trial, then $${annualPrice}/year. Cancel anytime.`
                      : selectedPlan === 'lifetime'
                      ? `$${lifetimeSalePrice} one-time • Lifetime access`
                      : `3-day free trial, then $${monthlyPrice}/month. Cancel anytime.`}
                  </p>
                </div>
              </>
            )}

            {/* Pricing Section - collapsed on Create Your Story until tapped */}
            <div className="w-full space-y-3 mb-5">
              {isCreateYourStoryPaywall && !planSelectorExpanded ? (
                <button
                  type="button"
                  onClick={() => setPlanSelectorExpanded(true)}
                  className="w-full rounded-2xl border-2 border-[#6366f1] bg-[#eef2ff] p-4 flex items-center justify-between cursor-pointer transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full border-2 bg-[#6366f1] border-[#6366f1] flex items-center justify-center">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#1e1b4b]">
                        {selectedPlan === 'annual' ? 'Annual' : selectedPlan === 'lifetime' ? 'Lifetime' : 'Family Monthly Plan'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedPlan === 'annual'
                          ? `$${annualPrice}/year • 12 free custom books`
                          : selectedPlan === 'lifetime'
                          ? `$${lifetimeSalePrice} one-time • Forever`
                          : `$${monthlyPrice} USD/month • Over 1,000 members • Cancel anytime`}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={20} className="text-[#6366f1]" />
                </button>
              ) : (
                <>
                  {isCreateYourStoryPaywall && planSelectorExpanded && (
                    <button
                      type="button"
                      onClick={() => setPlanSelectorExpanded(false)}
                      className="w-full flex items-center justify-center gap-1 text-[#6366f1] text-sm font-medium py-1 mb-1"
                    >
                      <ChevronUp size={16} />
                      Collapse
                    </button>
                  )}
              {/* Annual Membership - main paywall */}
              <div 
                onClick={() => { setSelectedPlan('annual'); if (isCreateYourStoryPaywall) setPlanSelectorExpanded(false); }}
                className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedPlan === 'annual' 
                  ? 'bg-[#eef2ff] border-[#6366f1] shadow-md' 
                  : 'bg-white border-gray-200'
                }`}
              >
                {/* Best Value Badge */}
                <div className="absolute -top-0 -right-0">
                  <div className="bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    BEST VALUE
                  </div>
                </div>
                
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'annual' ? 'bg-[#6366f1] border-[#6366f1]' : 'border-gray-300'
                  }`}>
                    {selectedPlan === 'annual' && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-[#1e1b4b]">Annual</p>
                    <p className="text-xs text-gray-500">3-day free trial, then <span className="font-semibold text-green-600">$39.99/year</span></p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-extrabold text-xl text-[#1e1b4b]">${annualPrice}<span className="text-sm font-medium">/yr</span></p>
                    <p className="text-[10px] text-green-600 font-semibold">12 free custom books</p>
                  </div>
                </div>
              </div>

              {/* Monthly Option */}
              <div 
                onClick={() => { setSelectedPlan('monthly'); if (isCreateYourStoryPaywall) setPlanSelectorExpanded(false); }}
                className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedPlan === 'monthly' 
                  ? 'bg-[#eef2ff] border-[#6366f1] shadow-md' 
                  : 'bg-white border-gray-200'
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'monthly' ? 'bg-[#6366f1] border-[#6366f1]' : 'border-gray-300'
                  }`}>
                    {selectedPlan === 'monthly' && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1e1b4b]">Family Monthly Plan</p>
                    <p className="text-xs text-gray-500">Over 1,000 members • Cancel anytime</p>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-xl text-[#1e1b4b]">${monthlyPrice} <span className="text-sm font-medium">USD</span></p>
                    <p className="text-xs text-gray-400">/month</p>
                  </div>
                </div>
              </div>
              </>
              )}

              {/* Lifetime Option - shown when from deal page (links to iOS/Android lifetime IAP) or legacy paywall.
                  Temporarily hidden during onboarding (unless coming from the explicit lifetime deal page). */}
              {(showLifetimeOption || (!isCreateYourStoryPaywall && !fromOnboarding)) && (
              <div 
                onClick={() => setSelectedPlan('lifetime')}
                className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedPlan === 'lifetime' 
                  ? 'bg-gradient-to-r from-[#fef3c7] to-[#fde68a] border-[#f59e0b] shadow-lg' 
                  : 'bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] border-[#fbbf24]'
                }`}
              >
                {/* Discount Badge */}
                <div className="absolute -top-0 -right-0">
                  <div className="bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl animate-pulse">
                    {lifetimeDiscount}% OFF
                  </div>
                </div>
                
                {/* Countdown Timer Banner */}
                {timeRemaining && !dealExpired && (
                  <div className="bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] px-4 py-2 flex items-center justify-center gap-2">
                    <span className="text-white text-xs font-semibold">⏰ Limited Time Offer:</span>
                    <div className="flex gap-1">
                      <span className="bg-white/20 text-white font-mono font-bold text-sm px-2 py-0.5 rounded">
                        {String(timeRemaining.minutes).padStart(2, '0')}
                      </span>
                      <span className="text-white font-bold">:</span>
                      <span className="bg-white/20 text-white font-mono font-bold text-sm px-2 py-0.5 rounded">
                        {String(timeRemaining.seconds).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'lifetime' ? 'bg-[#f59e0b] border-[#f59e0b]' : 'border-[#f59e0b]'
                  }`}>
                    {selectedPlan === 'lifetime' && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-[#1e1b4b]">🔥 Lifetime Access</p>
                    <p className="text-xs text-gray-600">One-time payment • Forever yours</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-400 line-through">${lifetimeOriginalPrice} USD</p>
                    <p className="font-extrabold text-xl text-[#dc2626]">${lifetimeSalePrice} <span className="text-sm">USD</span></p>
                    <p className="text-[10px] text-green-600 font-semibold">Save ${(lifetimeOriginalPrice - lifetimeSalePrice).toFixed(2)} USD</p>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Pricing Summary - only for lifetime (subscription summary moved below CTA) */}
            {selectedPlan === 'lifetime' && (
              <p className="text-center text-[#6366f1] font-medium text-sm mb-4">
                <span className="text-[#dc2626]">Special offer: ${lifetimeSalePrice} USD</span> <span className="text-gray-400 line-through text-xs">${lifetimeOriginalPrice} USD</span>
                <br />
                <span className="text-gray-500 font-normal">One-time payment. Yours forever!</span>
              </p>
            )}

            {/* Error Messages */}
            {error && (
              error.includes('processing') ? (
                <div className="w-full max-w-sm bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-4 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 size={16} className="animate-spin shrink-0" />
                    <span className="font-semibold">Confirming your purchase...</span>
                  </div>
                  <p className="text-amber-700 text-xs">
                    Payment is processing. We'll activate your subscription shortly.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-sm bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )
            )}

            {/* Migration Result */}
            {migrationResult && (
              <div className={`w-full max-w-sm px-4 py-3 rounded-xl mb-4 text-sm flex items-start gap-2 ${
                migrationResult.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-blue-50 border border-blue-200 text-blue-700'
              }`}>
                {migrationResult.type === 'success' ? (
                  <CheckCircle size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                {migrationResult.message}
              </div>
            )}

            {/* CTA Button - not shown on Create Your Story (moved above plan selector) */}
            {!isCreateYourStoryPaywall && (
            <button 
              onClick={handleSubscribeClick}
              disabled={isPurchasing || isRestoring || isLoading}
              className={`w-full font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all mb-3 disabled:opacity-70 disabled:cursor-not-allowed ${
                selectedPlan === 'lifetime'
                  ? 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white shadow-red-200/50'
                  : 'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50'
              }`}
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex flex-col items-center">
                  {selectedPlan === 'lifetime' ? (
                    <>
                      <span>{firstName ? `${firstName}, ` : ''}Get Lifetime for ${lifetimeSalePrice} USD</span>
                      <span className="text-xs font-normal opacity-90">Save ${(lifetimeOriginalPrice - lifetimeSalePrice).toFixed(2)} USD today!</span>
                    </>
                  ) : (
                    <span>{firstName ? `${firstName}, ` : ''}Start your free trial</span>
                  )}
                </span>
              )}
            </button>
            )}

            {/* No payment + trial summary - only for subscription plans, not on Create Your Story (moved above) */}
            {!isCreateYourStoryPaywall && selectedPlan !== 'lifetime' && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Check size={18} strokeWidth={3} />
                  <span className="font-semibold text-sm">No payment now!</span>
                </div>
                <p className="text-gray-500 text-xs text-center">
                  {selectedPlan === 'annual'
                    ? `3-day free trial, then $${annualPrice}/year. Cancel anytime.`
                    : `3-day free trial, then $${monthlyPrice}/month. Cancel anytime.`}
                </p>
              </div>
            )}
            
            {/* Lifetime badge */}
            {selectedPlan === 'lifetime' && !isCreateYourStoryPaywall && (
              <div className="flex items-center gap-2 text-[#dc2626] mb-6">
                <Check size={18} strokeWidth={3} />
                <span className="font-semibold text-sm">🔥 {lifetimeDiscount}% off • Limited time only!</span>
              </div>
            )}

            {/* How to Cancel Section */}
            <div className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
              <h3 className="font-bold text-[#1e1b4b] mb-2">How can I cancel?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                It's easy! Open your phone Settings, tap your name, then tap Subscriptions and choose Godly Kids. Tap Cancel Subscription. Done!
              </p>
            </div>

            {/* Perks */}
            <div className="w-full space-y-3 mb-6">
              {[
                { icon: "📚", text: "12 Free Custom Books for personalized learning fun" },
                { icon: "📖", text: "Unlimited Access to 150+ books with word highlighting" },
                { icon: "🎮", text: "15+ Bible Games and Learning Exercises to enhance memorization" },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                  <span className="text-xl shrink-0">{feature.icon}</span>
                  <span className="text-sm font-medium text-[#1e1b4b]">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Fine Print */}
            <p className="text-gray-400 text-[10px] text-center px-4 w-full leading-relaxed">
              Free trial for 3 days, then subscription automatically renews unless cancelled at least 24-hours before the trial ends. Cancel anytime in App Store or Google Play.
            </p>

            <div
              className="w-full flex justify-center pt-4"
              style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={() => {
                  const user = authService.getUser();
                  setRestoreEmail(user?.email || '');
                  setShowRestoreModal(true);
                }}
                disabled={isRestoring}
                className="text-[#6366f1] text-sm font-semibold hover:text-[#4f46e5] transition-colors disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
        </div>

        <ParentGateModal 
          isOpen={showParentGate} 
          onClose={() => setShowParentGate(false)} 
          onSuccess={handleGateSuccess}
          isPurchasing={isPurchasing}
        />

        {/* Account Required Modal */}
        {showAccountRequired && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAccountRequired(false)}
            />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowAccountRequired(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#eef2ff] rounded-full flex items-center justify-center mb-4">
                  <UserPlus size={32} className="text-[#6366f1]" />
                </div>
                
                <h2 className="text-[#1e1b4b] font-bold text-xl mb-2">
                  Sign in so your purchase is saved
                </h2>
                <p className="text-gray-600 text-sm mb-6">
                  Create a free account first. That way your subscription is tied to your email and will restore on any device.
                </p>
                
                <button
                  onClick={() => {
                    setShowAccountRequired(false);
                    navigate('/onboarding', { state: { returnToAccountStep: true } });
                  }}
                  className="w-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mb-3"
                >
                  <UserPlus size={18} />
                  Create Free Account
                </button>
                
                <button
                  onClick={() => {
                    setShowAccountRequired(false);
                    navigate('/signin');
                  }}
                  className="text-[#6366f1] text-sm font-semibold hover:underline"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Purchases Modal */}
        {showRestoreModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowRestoreModal(false)}
            />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
              
              <h2 className="text-[#1e1b4b] font-bold text-xl mb-2">
                Restore Subscription
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Enter your email to find your subscription:
              </p>
              
              <div className="relative mb-4">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={restoreEmail}
                  onChange={(e) => setRestoreEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20"
                  autoFocus
                />
              </div>
              
              <button
                onClick={() => handleRestorePurchases(restoreEmail)}
                disabled={!restoreEmail || isRestoring}
                className="w-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold py-3 px-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Search & Restore
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Reverse Trial Toast */}
        {showReverseTrialToast && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-8 mx-6 shadow-2xl animate-in zoom-in-95 duration-300 max-w-sm">
              <div className="text-center">
                <div className="text-6xl mb-4">🎁</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">You've Got a Gift!</h3>
                <p className="text-gray-600 mb-4">
                  Enjoy <span className="font-bold text-[#6366f1]">14 days of Premium</span> on us!
                </p>
                <p className="text-sm text-gray-500">
                  Full access to all stories, lessons, and features. No payment required.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-[#10b981]">
                  <CheckCircle size={20} />
                  <span className="font-medium">Premium activated!</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exit-Intent 24h Free Trial Popup */}
        <AnimatePresence>
          {showExitTrialOffer && (
            <motion.div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleDeclineExitTrial}
              />
              <motion.div
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                {/* Decorative top band */}
                <div className="h-2 bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#f59e0b]" />

                <div className="relative p-6 pt-5 text-center">
                  <button
                    onClick={handleDeclineExitTrial}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>

                  {/* Icon */}
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-full flex items-center justify-center mb-4 shadow-lg shadow-indigo-300/40">
                    <Gift className="w-8 h-8 text-white" />
                  </div>

                  <h2 className="text-xl font-bold text-[#1e1b4b] mb-1">
                    Wait! Try Premium FREE
                  </h2>
                  <p className="text-[#6366f1] font-extrabold text-2xl mb-4">
                    for 24 Hours
                  </p>

                  {/* Perks */}
                  <div className="bg-[#f8faff] rounded-2xl p-4 mb-5 text-left space-y-2.5">
                    {[
                      { icon: <Check size={16} className="text-green-500" strokeWidth={3} />, text: 'Full access to 150+ books & stories' },
                      { icon: <Check size={16} className="text-green-500" strokeWidth={3} />, text: '15+ Bible games & activities' },
                      { icon: <Check size={16} className="text-green-500" strokeWidth={3} />, text: 'Personalized content for your child' },
                      { icon: <Clock size={16} className="text-[#6366f1]" />, text: 'No credit card needed' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="shrink-0">{item.icon}</span>
                        <span className="text-sm font-medium text-gray-700">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleAcceptExitTrial}
                    disabled={isStartingTrial}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-300/40 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mb-3"
                  >
                    {isStartingTrial ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Starting...
                      </span>
                    ) : (
                      'Start My Free Day'
                    )}
                  </button>

                  <button
                    onClick={handleDeclineExitTrial}
                    className="text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

    </div>
  );
};

export default PaywallPage;
