
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, X, Loader2, RefreshCw, AlertCircle, CheckCircle, Mail, UserPlus, Bell, Lock, Calendar, CreditCard } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import ParentGateModal from '../components/features/ParentGateModal';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiService';
import { facebookPixelService } from '../services/facebookPixelService';
import { metaAttributionService } from '../services/metaAttributionService';
import { activityTrackingService } from '../services/activityTrackingService';
import despia from 'despia-native';

// Check if running in Despia native app
const isDespiaNative = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('despia');
};

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

const PaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { subscribe } = useUser();
  
  // Check if close button should be hidden (from tutorial timer expiry)
  const hideCloseButton = (location.state as any)?.hideCloseButton === true;
  const { 
    isLoading, 
    isPremium,
    isNativeApp,
    purchase, 
    restorePurchases,
  } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly' | 'lifetime'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);
  
  // Trial reminder toggle state - check notification permission
  const [trialReminderEnabled, setTrialReminderEnabled] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null);
  
  // Check notification permission on mount
  useEffect(() => {
    const checkNotificationPermission = async () => {
      if (isDespiaNative()) {
        // In Despia native app - assume notifications are available
        // The actual permission is managed at OS level
        setNotificationsAllowed(true);
        setTrialReminderEnabled(true);
      } else if ('Notification' in window) {
        // Web browser - check Notification API
        const permission = Notification.permission;
        if (permission === 'granted') {
          setNotificationsAllowed(true);
          setTrialReminderEnabled(true);
        } else if (permission === 'denied') {
          setNotificationsAllowed(false);
          setTrialReminderEnabled(false);
        } else {
          // Permission is 'default' - not yet asked
          setNotificationsAllowed(null);
          setTrialReminderEnabled(false);
        }
      } else {
        // No notification support
        setNotificationsAllowed(false);
        setTrialReminderEnabled(false);
      }
    };
    
    checkNotificationPermission();
  }, []);
  
  // Handle notification toggle - opens native settings if needed
  const handleNotificationToggle = async () => {
    if (trialReminderEnabled) {
      // Just turn off
      setTrialReminderEnabled(false);
      return;
    }
    
    // Trying to enable
    if (isDespiaNative()) {
      // Open native settings app where user can enable notifications
      despia('settingsapp://');
      // Optimistically enable - user is going to settings
      setTrialReminderEnabled(true);
      setNotificationsAllowed(true);
    } else if ('Notification' in window) {
      if (Notification.permission === 'default') {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsAllowed(true);
          setTrialReminderEnabled(true);
        } else {
          setNotificationsAllowed(false);
        }
      } else if (Notification.permission === 'denied') {
        // Can't request again - show message
        setNotificationsAllowed(false);
      } else {
        setTrialReminderEnabled(true);
      }
    }
  };
  
  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');
  
  // Account required modal state
  const [showAccountRequired, setShowAccountRequired] = useState(false);
  
  // Get personalized name
  const firstName = getUserFirstName();
  
  // Track paywall view for analytics
  useEffect(() => {
    // Facebook Pixel
    facebookPixelService.init();
    facebookPixelService.trackPaywallView();
    // Onboarding funnel tracking
    activityTrackingService.trackOnboardingEvent('paywall_shown');
  }, []);

  // If user already has premium, redirect to home
  useEffect(() => {
    if (isPremium) {
      subscribe(); // Update local state
      navigate('/home');
    }
  }, [isPremium, navigate, subscribe]);
  
  // Listen for premium status changes (from webhook confirmation after purchase)
  useEffect(() => {
    const handlePremiumChange = (event: CustomEvent) => {
      console.log('📱 Premium status changed on paywall:', event.detail);
      if (event.detail?.isPremium) {
        console.log('✅ Premium confirmed via event - navigating to home');
        subscribe();
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
  }, [error, subscribe, navigate]);

  const handleSubscribeClick = () => {
    setError(null);
    
    // Track trial button clicked
    activityTrackingService.trackOnboardingEvent('paywall_trial_clicked', { planType: selectedPlan });
    
    // Check if user has an account - require account before purchase
    if (!hasAccount()) {
      setShowAccountRequired(true);
      return;
    }
    
    // Show parent gate before processing
    setShowParentGate(true);
  };

  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setError(null);
    
    // Facebook Pixel - Track checkout initiation
    const price = selectedPlan === 'lifetime' ? 69.99 : selectedPlan === 'annual' ? 39.99 : 5.99;
    facebookPixelService.trackInitiateCheckout(selectedPlan, price);

    try {
      const result = await purchase(selectedPlan);

      if (result.success) {
        // Facebook Pixel - Track successful purchase
        facebookPixelService.trackPurchase(selectedPlan, price);
        facebookPixelService.trackSubscribe(selectedPlan, price);
        
        // Meta Conversions API - Server-side purchase tracking
        const userEmail = localStorage.getItem('godlykids_user_email') || authService.getUser()?.email;
        metaAttributionService.trackPurchase({
          email: userEmail || undefined,
          value: price,
          currency: 'USD',
          plan: selectedPlan,
        });
        
        // Track successful subscription
        activityTrackingService.trackOnboardingEvent('subscribed', { planType: selectedPlan });
        
        // Update local state
        subscribe();
        navigate('/home');
      } else if (result.error && result.error !== 'Purchase cancelled') {
        setError(result.error);
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
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
  const annualPrice = 39.99;
  const lifetimePrice = 69.99;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savings = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] overflow-y-auto no-scrollbar flex flex-col">
        {/* Decorative clouds/shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-0 w-32 h-20 bg-gradient-to-r from-[#c7d2fe]/40 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute top-20 right-0 w-40 h-24 bg-gradient-to-l from-[#ddd6fe]/40 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-40 left-5 w-24 h-16 bg-[#c7d2fe]/30 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-32 h-20 bg-[#fde68a]/20 rounded-full blur-xl"></div>
        </div>

        {/* Header with close and restore */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-6 pb-2" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 24px)' }}>
          {!hideCloseButton ? (
            <button 
              onClick={() => {
                activityTrackingService.trackOnboardingEvent('paywall_closed');
                navigate('/home');
              }} 
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="w-10" />
          )}
          
          <button
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

        <div className="flex-1 flex flex-col items-center px-5 pb-8 relative z-10">
            
            {/* Main Title */}
            <div className="text-center mb-6">
              <h1 className="text-[#1e1b4b] font-display font-extrabold text-2xl leading-tight mb-2">
                Free full access to
              </h1>
              <h2 className="text-[#6366f1] font-display font-extrabold text-3xl">
                Godly Kids Plus
              </h2>
            </div>

            {/* Timeline Cards */}
            <div className="flex gap-3 w-full max-w-sm mb-6">
              {/* Today */}
              <div className="flex-1 bg-gradient-to-b from-[#6366f1] to-[#4f46e5] rounded-2xl p-4 text-white shadow-lg shadow-indigo-200">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-3 mx-auto">
                  <Lock size={20} className="text-white" />
                </div>
                <p className="font-bold text-sm text-center">Today</p>
                <p className="text-[11px] text-white/80 text-center mt-1 leading-tight">
                  Full access to all content
                </p>
              </div>
              
              {/* Day 5 */}
              <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-[#fef3c7] rounded-full flex items-center justify-center mb-3 mx-auto">
                  <Bell size={20} className="text-[#f59e0b]" />
                </div>
                <p className="font-bold text-sm text-[#1e1b4b] text-center">Day 5</p>
                <p className="text-[11px] text-gray-500 text-center mt-1 leading-tight">
                  Reminder about trial ending
                </p>
              </div>
              
              {/* Day 7 */}
              <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="w-10 h-10 bg-[#dbeafe] rounded-full flex items-center justify-center mb-3 mx-auto">
                  <CreditCard size={20} className="text-[#3b82f6]" />
                </div>
                <p className="font-bold text-sm text-[#1e1b4b] text-center">Day 7</p>
                <p className="text-[11px] text-gray-500 text-center mt-1 leading-tight">
                  Billing starts. Cancel anytime before.
                </p>
              </div>
            </div>

            {/* Trial Reminder Toggle */}
            <div className="w-full max-w-sm bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell size={20} className={trialReminderEnabled ? 'text-[#6366f1]' : 'text-gray-400'} />
                  <span className="font-semibold text-[#1e1b4b] text-sm">
                    Trial reminder {trialReminderEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <button
                  onClick={handleNotificationToggle}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    trialReminderEnabled ? 'bg-[#6366f1]' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    trialReminderEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {notificationsAllowed === false && !isDespiaNative() && (
                <p className="text-xs text-gray-500 mt-2">
                  Enable notifications in your device settings to receive trial reminders.
                </p>
              )}
            </div>

            {/* Pricing Section */}
            <div className="w-full max-w-sm space-y-3 mb-5">
              {/* Annual Option */}
              <div 
                onClick={() => setSelectedPlan('annual')}
                className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedPlan === 'annual' 
                  ? 'bg-[#eef2ff] border-[#6366f1] shadow-md' 
                  : 'bg-white border-gray-200'
                }`}
              >
                {/* Best Value Badge */}
                <div className="absolute -top-0 -right-0">
                  <div className="bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    SAVE {savings}%
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
                    <p className="text-xs text-gray-500">${annualMonthly}/month • Billed yearly</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-extrabold text-xl text-[#1e1b4b]">${annualPrice}</p>
                    <p className="text-xs text-gray-400 line-through">${(monthlyPrice * 12).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Monthly Option */}
              <div 
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
                  
                  <div className="flex-1">
                    <p className="font-bold text-[#1e1b4b]">Monthly</p>
                    <p className="text-xs text-gray-500">Cancel anytime</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-extrabold text-xl text-[#1e1b4b]">${monthlyPrice}</p>
                    <p className="text-xs text-gray-400">/month</p>
                  </div>
                </div>
              </div>

              {/* Lifetime Option */}
              <div 
                onClick={() => setSelectedPlan('lifetime')}
                className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedPlan === 'lifetime' 
                  ? 'bg-gradient-to-r from-[#fef3c7] to-[#fde68a] border-[#f59e0b] shadow-md' 
                  : 'bg-white border-gray-200'
                }`}
              >
                {/* Best Deal Badge */}
                <div className="absolute -top-0 -right-0">
                  <div className="bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                    BEST DEAL
                  </div>
                </div>
                
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPlan === 'lifetime' ? 'bg-[#f59e0b] border-[#f59e0b]' : 'border-gray-300'
                  }`}>
                    {selectedPlan === 'lifetime' && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-bold text-[#1e1b4b]">Lifetime Access</p>
                    <p className="text-xs text-gray-500">One-time payment • Forever yours</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-extrabold text-xl text-[#1e1b4b]">${lifetimePrice}</p>
                    <p className="text-xs text-gray-400">one time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Summary */}
            <p className="text-center text-[#6366f1] font-medium text-sm mb-4">
              {selectedPlan === 'lifetime' ? (
                <>
                  One-time payment of ${lifetimePrice} for lifetime access.
                  <br />
                  <span className="text-gray-500 font-normal">No subscriptions. Yours forever!</span>
                </>
              ) : (
                <>
                  Try 7 days for free, then {selectedPlan === 'annual' ? `$${annualPrice}/year` : `$${monthlyPrice}/month`}.
                  <br />
                  <span className="text-gray-500 font-normal">No commitment. Cancel anytime.</span>
                </>
              )}
            </p>

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

            {/* CTA Button */}
            <button 
              onClick={handleSubscribeClick}
              disabled={isPurchasing || isRestoring || isLoading}
              className={`w-full max-w-sm font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all mb-3 disabled:opacity-70 disabled:cursor-not-allowed ${
                selectedPlan === 'lifetime'
                  ? 'bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] text-white shadow-purple-200/50'
                  : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1e1b4b] shadow-amber-200/50'
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
                    <span>{firstName ? `${firstName}, ` : ''}Get Lifetime Access</span>
                  ) : (
                    <span>{firstName ? `${firstName}, ` : ''}Start your free trial</span>
                  )}
                </span>
              )}
            </button>

            {/* No Payment Now Badge - only show for subscription plans */}
            {selectedPlan !== 'lifetime' && (
              <div className="flex items-center gap-2 text-green-600 mb-6">
                <Check size={18} strokeWidth={3} />
                <span className="font-semibold text-sm">No payment now!</span>
              </div>
            )}
            
            {/* Lifetime badge */}
            {selectedPlan === 'lifetime' && (
              <div className="flex items-center gap-2 text-purple-600 mb-6">
                <Check size={18} strokeWidth={3} />
                <span className="font-semibold text-sm">One-time purchase • No recurring fees</span>
              </div>
            )}

            {/* How to Cancel Section */}
            <div className="w-full max-w-sm bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
              <h3 className="font-bold text-[#1e1b4b] mb-2">How can I cancel?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                It's easy! Open your phone Settings, tap your name, then tap Subscriptions and choose Godly Kids. Tap Cancel Subscription. Done!
              </p>
            </div>

            {/* Features Grid */}
            <div className="w-full max-w-sm grid grid-cols-2 gap-3 mb-6">
              {[
                { icon: "📖", text: "Bible Stories" },
                { icon: "🎮", text: "Learning Games" },
                { icon: "🎧", text: "Audio Lessons" },
                { icon: "📝", text: "Fun Quizzes" },
                { icon: "🏆", text: "Rewards System" },
                { icon: "🔒", text: "100% Ad-Free" },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-lg">{feature.icon}</span>
                  <span className="text-sm font-medium text-[#1e1b4b]">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Fine Print */}
            <p className="text-gray-400 text-[10px] text-center px-4 max-w-sm leading-relaxed">
              Free trial for 7 days, then subscription automatically renews unless cancelled at least 24-hours before the trial ends. Cancel anytime in App Store or Google Play.
            </p>
        </div>

        <ParentGateModal 
          isOpen={showParentGate} 
          onClose={() => setShowParentGate(false)} 
          onSuccess={handleGateSuccess} 
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
                  Create an Account First
                </h2>
                <p className="text-gray-600 text-sm mb-6">
                  To manage your subscription and sync progress across devices, please create a free account.
                </p>
                
                <button
                  onClick={() => {
                    setShowAccountRequired(false);
                    navigate('/onboarding');
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
    </div>
  );
};

export default PaywallPage;
