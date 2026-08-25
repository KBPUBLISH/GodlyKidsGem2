import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { activityTrackingService } from '../services/activityTrackingService';
import { facebookPixelService } from '../services/facebookPixelService';
import { metaAttributionService } from '../services/metaAttributionService';
import { shouldSeeNewOnboardingFlow } from '../services/userTypeService';
import { getApiBaseUrl } from '../services/apiService';
import { authService } from '../services/authService';
import ParentGateModal from '../components/features/ParentGateModal';

/**
 * Hard Paywall for New Users - No easy dismiss
 * Shows AFTER trial explanation
 * User must either start trial or restore purchases
 * 
 * CRITICAL: Existing free users must NEVER reach this page
 */
const NewUserPaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const { purchase, restorePurchases, isPremium, isLoading } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showParentGate, setShowParentGate] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  const annualPrice = 39.99;
  const monthlyPrice = 5.99;

  // CRITICAL GUARD: Redirect existing users away from hard paywall
  useEffect(() => {
    if (!shouldSeeNewOnboardingFlow()) {
      console.log('⚠️ CRITICAL: Existing user tried to access hard paywall - redirecting to soft paywall');
      navigate('/paywall', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    // Track paywall shown
    activityTrackingService.trackOnboardingEvent('paywall_shown', { 
      source: 'new_user_flow',
      flow: 'hard_paywall'
    });
    
    // Facebook Pixel
    facebookPixelService.init();
    facebookPixelService.trackPaywallView();

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    setIsAndroid(/android/i.test(ua));
  }, []);

  // If user becomes premium, navigate away
  useEffect(() => {
    if (isPremium) {
      // Account creation will happen next, then land in content
      navigate('/new-user-account', { replace: true });
    }
  }, [isPremium, navigate]);

  const handleStartTrial = () => {
    setError(null);
    
    activityTrackingService.trackOnboardingEvent('paywall_trial_clicked', { 
      planType: selectedPlan,
      flow: 'new_user_hard_paywall'
    });

    // Show parent gate first
    setShowParentGate(true);
  };

  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setError(null);

    const price = selectedPlan === 'annual' ? annualPrice : monthlyPrice;
    
    try {
      // Track checkout initiation
      facebookPixelService.trackInitiateCheckout(selectedPlan, price);
      activityTrackingService.trackOnboardingEvent('paywall_purchase_started', { 
        planType: selectedPlan,
        flow: 'new_user'
      });

      // Start purchase (anonymous - no account yet)
      const result = await purchase(selectedPlan);

      if (result.success) {
        // Track successful purchase
        facebookPixelService.trackPurchase(selectedPlan, price);
        facebookPixelService.trackSubscribe(selectedPlan, price);
        
        activityTrackingService.trackOnboardingEvent('subscribed', { 
          planType: selectedPlan,
          flow: 'new_user_anonymous'
        });

        // Navigate to account creation (AFTER purchase started/completed)
        navigate('/new-user-account', { 
          replace: true,
          state: { fromPaywall: true, plan: selectedPlan }
        });
      } else if (result.error && result.error !== 'Purchase cancelled') {
        setError(result.error);
        activityTrackingService.trackOnboardingEvent('paywall_purchase_error', { 
          planType: selectedPlan,
          error: result.error
        });
      } else {
        // User cancelled
        activityTrackingService.trackOnboardingEvent('paywall_purchase_cancelled', { 
          planType: selectedPlan
        });
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      setError(err.message || 'An error occurred during purchase');
      activityTrackingService.trackOnboardingEvent('paywall_purchase_error', { 
        planType: selectedPlan,
        error: err.message
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setError(null);

    try {
      const result = await restorePurchases(true);
      
      if (result.success && result.isPremium) {
        // Successfully restored - still need account
        navigate('/new-user-account', { 
          replace: true,
          state: { fromRestore: true }
        });
      } else {
        setError('No subscription found. Contact hello@kbpublish.org for help.');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setError(err.message || 'Failed to restore purchases.');
    } finally {
      setIsRestoring(false);
    }
  };

  const ctaText = isAndroid ? 'Start Free Trial' : 'Continue';

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* NO CLOSE BUTTON - Hard paywall for new users */}
      
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-0 w-32 h-20 bg-gradient-to-r from-[#c7d2fe]/40 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-20 right-0 w-40 h-24 bg-gradient-to-l from-[#ddd6fe]/40 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-40 left-5 w-24 h-16 bg-[#c7d2fe]/30 rounded-full blur-xl" />
        <div className="absolute bottom-20 right-10 w-32 h-20 bg-[#fde68a]/20 rounded-full blur-xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pb-8 pt-6 overflow-y-auto">
        <div className="w-full max-w-md">
          
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-[#1e1b4b] font-display font-extrabold text-2xl leading-tight mb-2">
              Start Your Free Trial
            </h1>
            <h2 className="text-[#6366f1] font-display font-extrabold text-3xl">
              Godly Kids Plus
            </h2>
          </div>

          {/* Plan Selection */}
          <div className="space-y-3 mb-5">
            {/* Annual Plan */}
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                selectedPlan === 'annual'
                  ? 'bg-[#eef2ff] border-[#6366f1] shadow-md'
                  : 'bg-white border-gray-200'
              }`}
            >
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
                  <p className="text-xs text-gray-500">14-day free trial, then ${annualPrice}/year</p>
                </div>
                
                <div className="text-right">
                  <p className="font-extrabold text-xl text-[#1e1b4b]">${annualPrice}<span className="text-sm font-medium">/yr</span></p>
                </div>
              </div>
            </button>

            {/* Monthly Plan */}
            <button
              onClick={() => setSelectedPlan('monthly')}
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
                  <p className="font-bold text-[#1e1b4b]">Monthly</p>
                  <p className="text-xs text-gray-500">Flexible billing</p>
                </div>
                
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-xl text-[#1e1b4b]">${monthlyPrice}<span className="text-sm font-medium">/mo</span></p>
                </div>
              </div>
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleStartTrial}
            disabled={isPurchasing || isRestoring || isLoading}
            className="w-full font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all mb-3 disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50"
          >
            {isPurchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex flex-col items-center">
                <span>{ctaText}</span>
              </span>
            )}
          </button>

          {/* Trial Info */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-green-600 mb-1 justify-center">
              <Check size={18} strokeWidth={3} />
              <span className="font-semibold text-sm">No payment today!</span>
            </div>
            <p className="text-gray-500 text-xs text-center">
              14-day free trial, then ${selectedPlan === 'annual' ? annualPrice : monthlyPrice}/{selectedPlan === 'annual' ? 'year' : 'month'}. Cancel anytime.
            </p>
          </div>

          {/* Perks */}
          <div className="w-full space-y-3 mb-6">
            {[
              { icon: "📚", text: "150+ Bible stories & lessons" },
              { icon: "🎮", text: "15+ games to learn through play" },
              { icon: "🎧", text: "Audiobooks & devotionals" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                <span className="text-xl shrink-0">{feature.icon}</span>
                <span className="text-sm font-medium text-[#1e1b4b]">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Fine Print */}
          <p className="text-gray-400 text-[10px] text-center px-4 w-full leading-relaxed mb-4">
            Free trial for 14 days, then subscription automatically renews unless cancelled at least 24-hours before the trial ends. Cancel anytime in App Store or Google Play.
          </p>

          {/* Restore Purchases */}
          <div className="w-full flex justify-center">
            <button
              onClick={handleRestorePurchases}
              disabled={isRestoring || isPurchasing}
              className="text-[#6366f1] text-sm font-semibold hover:text-[#4f46e5] transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Restore Purchases
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Parent Gate Modal */}
      <ParentGateModal
        isOpen={showParentGate}
        onClose={() => setShowParentGate(false)}
        onSuccess={handleGateSuccess}
        isPurchasing={isPurchasing}
      />

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default NewUserPaywallPage;
