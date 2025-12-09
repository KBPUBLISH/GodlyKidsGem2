
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../context/SubscriptionContext';
import ParentGateModal from '../components/features/ParentGateModal';
import { authService } from '../services/authService';
import { getApiBaseUrl } from '../services/apiService';

const PaywallPage: React.FC = () => {
  const navigate = useNavigate();
  const { subscribe } = useUser();
  const { 
    isLoading, 
    isPremium,
    isNativeApp,
    purchase, 
    restorePurchases,
  } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // If user already has premium, redirect to home
  useEffect(() => {
    if (isPremium) {
      subscribe(); // Update local state
      navigate('/home');
    }
  }, [isPremium, navigate, subscribe]);

  const handleSubscribeClick = () => {
    setError(null);
    // Show parent gate before processing
    setShowParentGate(true);
  };

  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setError(null);

    try {
      // Purchase through DeSpia/RevenueCat native integration
      const result = await purchase(selectedPlan);

      if (result.success) {
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

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    setError(null);
    setMigrationResult(null);

    try {
      console.log('🔄 Starting restore purchases...');
      console.log('🔄 isNativeApp:', isNativeApp);
      
      // First, try native RevenueCat/DeSpia restore (this asks Apple directly)
      const result = await restorePurchases();
      console.log('🔄 Native restore result:', result);

      // Check if premium was set (either by restore or by checking localStorage)
      // Give a moment for state to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check localStorage directly since state might not have updated yet
      const localPremium = localStorage.getItem('godlykids_premium') === 'true';
      console.log('🔄 Local premium after restore:', localPremium);
      
      if (result.success && (result.isPremium || localPremium)) {
        // Native restore worked!
        console.log('✅ Restore successful - user has premium!');
        subscribe(); // Update context
        setMigrationResult({
          type: 'success',
          message: 'Your subscription has been restored! 🎉',
        });
        setTimeout(() => navigate('/home'), 1500);
        return;
      }

      // If native restore didn't find purchases, also try migration API for old app users
      const user = authService.getUser();
      console.log('🔄 Checking if user is signed in:', user ? `Yes (${user.email})` : 'No');
      
      if (user?.email) {
        console.log('🔄 Checking migration API for:', user.email);
        const baseUrl = getApiBaseUrl();
        console.log('🔄 Migration API URL:', `${baseUrl}migration/restore-subscription`);
        const migrationResponse = await fetch(`${baseUrl}migration/restore-subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });

        const migrationData = await migrationResponse.json();
        console.log('🔄 Migration result:', migrationData);

        if (migrationData.subscriptionRestored) {
          // Successfully restored from old app!
          subscribe();
          setMigrationResult({
            type: 'success',
            message: 'Welcome back! Your subscription from the old app has been restored! 🎉',
          });
          setTimeout(() => navigate('/home'), 2000);
          return;
        } else if (migrationData.found) {
          setMigrationResult({
            type: 'info',
            message: migrationData.message || 'Account found but subscription has expired.',
          });
          return;
        }
      }

      // No purchases found - but Apple might still know about it
      // This could happen if the subscription is valid in Apple but not linked to our user
      if (!user?.email) {
        console.log('⚠️ User not signed in - cannot check migration API');
        setError('Please sign in first to restore your subscription. If you subscribed in the old app, use the same email address.');
      } else {
        setError('No subscription found. If you just subscribed, please try again in a few seconds or contact support.');
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setError(err.message || 'Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-[#1a237e] via-[#283593] to-[#3949ab] overflow-y-auto no-scrollbar flex flex-col">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-[#fdd835]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 right-5 w-40 h-40 bg-[#4fc3f7]/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        {/* Close Button */}
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-6 left-6 z-50 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white/80 transition-colors"
        >
            <X size={24} strokeWidth={3} />
        </button>

        <div className="flex-1 flex flex-col items-center px-6 pt-10 pb-20 min-h-[600px] relative z-10">
            
            {/* Brand Logo */}
            <div className="mb-4 flex flex-col items-center">
                 <div className="flex items-center gap-1">
                   <span className="text-3xl">📚</span>
                   <div className="flex flex-col items-start -space-y-1">
                     <h1 className="font-display font-extrabold text-2xl text-white tracking-wide drop-shadow-lg">
                        GODLY KIDS
                     </h1>
                     <h2 className="font-display font-bold text-lg text-[#fdd835] tracking-[0.2em] drop-shadow-md">
                        ACADEMY
                     </h2>
                   </div>
                 </div>
                 <p className="text-white/60 text-xs mt-1 font-medium tracking-wide">Christian Learning for Ages 4-10+</p>
            </div>

            {/* Main Card */}
            <div className="relative bg-white/95 backdrop-blur-sm rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-white/20 flex flex-col items-center text-center animate-in slide-in-from-bottom-10 duration-700">
                
                {/* Homeschool Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#7c4dff] to-[#536dfe] px-4 py-1.5 rounded-full shadow-lg">
                    <span className="text-white font-bold text-xs tracking-wide flex items-center gap-1.5">
                        🏠 Perfect for Homeschool
                    </span>
                </div>

                <h2 className="text-[#1a237e] font-display font-extrabold text-2xl leading-tight mb-2 mt-4 drop-shadow-sm">
                    Give Your Child a<br/>
                    <span className="text-[#7c4dff]">Faith-Filled Education</span>
                </h2>

                <p className="text-[#455a64] font-sans font-medium text-sm mb-3 leading-snug px-2">
                    Interactive Bible lessons, stories & activities that make Christian learning fun and engaging.
                </p>
                
                {/* Free Trial Badge */}
                <div className="bg-gradient-to-r from-[#fdd835] to-[#ffca28] px-5 py-2 rounded-full mb-4 shadow-md animate-pulse border border-[#f9a825]/30">
                    <span className="text-[#3e2723] font-extrabold text-sm tracking-wide">
                        🎁 START FREE FOR 3 DAYS
                    </span>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl mb-4 text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Migration Result Message */}
                {migrationResult && (
                  <div className={`w-full px-4 py-2 rounded-xl mb-4 text-sm flex items-start gap-2 ${
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

                {/* Pricing Options */}
                <div className="w-full space-y-3 mb-5">
                    
                    {/* Annual Option */}
                    <div 
                        onClick={() => setSelectedPlan('annual')}
                        className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                            selectedPlan === 'annual' 
                            ? 'bg-[#ede7f6] border-[#7c4dff] shadow-md scale-[1.02] ring-1 ring-[#7c4dff]' 
                            : 'bg-gray-50 border-gray-200 opacity-90 hover:opacity-100'
                        }`}
                    >
                        <div className="bg-gradient-to-r from-[#fdd835] to-[#ffca28] py-1 text-center shadow-sm absolute top-0 left-0 right-0 z-10">
                            <span className="text-[#3e2723] text-[10px] font-extrabold uppercase tracking-widest">
                                ⭐ BEST FOR FAMILIES • SAVE 45%
                            </span>
                        </div>
                        <div className="px-4 pt-8 pb-3 flex items-center justify-between">
                            <div className="flex flex-col text-left">
                                <span className={`font-display font-bold text-lg ${selectedPlan === 'annual' ? 'text-[#1a237e]' : 'text-gray-600'}`}>Annual Plan</span>
                                <span className="text-xs text-[#7c4dff] font-semibold bg-[#ede7f6] px-2 py-0.5 rounded-md w-fit">
                                  Save 42% • $1.33/week
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                 <div className="flex items-center gap-1">
                                    <span className="font-display font-extrabold text-2xl text-[#1a237e]">
                                      $69
                                    </span>
                                    <span className="text-xs text-gray-500 font-bold">/yr</span>
                                 </div>
                                 <span className="text-xs text-gray-400 line-through">$119.88</span>
                            </div>
                        </div>
                        
                        {/* Checkmark circle */}
                        <div className="absolute top-8 right-2 transition-all">
                            <div className={`rounded-full p-1 ${selectedPlan === 'annual' ? 'bg-[#7c4dff] text-white' : 'bg-transparent border-2 border-gray-300'}`}>
                                {selectedPlan === 'annual' && <Check size={12} strokeWidth={4} />}
                                {selectedPlan !== 'annual' && <div className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Option */}
                    <div 
                        onClick={() => setSelectedPlan('monthly')}
                        className={`relative w-full rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                            selectedPlan === 'monthly' 
                            ? 'bg-[#ede7f6] border-[#7c4dff] shadow-md scale-[1.02] ring-1 ring-[#7c4dff]' 
                            : 'bg-gray-50 border-gray-200 opacity-90 hover:opacity-100'
                        }`}
                    >
                        {selectedPlan === 'monthly' && (
                            <div className="bg-[#ede7f6] py-1 text-center shadow-sm absolute top-0 left-0 right-0 z-10">
                                <span className="text-[#7c4dff] text-[10px] font-extrabold uppercase tracking-widest">
                                    3-DAY FREE TRIAL INCLUDED
                                </span>
                            </div>
                        )}
                        <div className={`px-4 ${selectedPlan === 'monthly' ? 'pt-8 pb-3' : 'py-4'} flex items-center justify-between`}>
                            <div className="flex flex-col text-left">
                                <span className={`font-display font-bold text-lg ${selectedPlan === 'monthly' ? 'text-[#1a237e]' : 'text-gray-600'}`}>Monthly Plan</span>
                                <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-md w-fit">
                                    Cancel anytime
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1">
                                     <span className="font-display font-extrabold text-2xl text-[#1a237e]">
                                       $9.99
                                     </span>
                                     <span className="text-xs text-gray-500 font-bold">/mo</span>
                                </div>
                            </div>
                        </div>

                         {/* Checkmark circle */}
                        <div className={`absolute ${selectedPlan === 'monthly' ? 'top-8' : 'top-1/2 -translate-y-1/2'} right-2`}>
                            <div className={`rounded-full p-1 ${selectedPlan === 'monthly' ? 'bg-[#7c4dff] text-white' : 'bg-transparent border-2 border-gray-300'}`}>
                                {selectedPlan === 'monthly' && <Check size={12} strokeWidth={4} />}
                                {selectedPlan !== 'monthly' && <div className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>

                </div>

                {/* CTA Button */}
                <button 
                    onClick={handleSubscribeClick}
                    disabled={isPurchasing || isRestoring || isLoading}
                    className="w-full bg-gradient-to-b from-[#7c4dff] to-[#651fff] hover:from-[#9575cd] hover:to-[#7c4dff] text-white font-display font-bold text-lg py-4 rounded-2xl shadow-[0_4px_0_#4527a0,0_8px_15px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-[0_0_0_#4527a0] transition-all mb-3 border-t border-[#b388ff] relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {isPurchasing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          '🎓 Start Learning Free'
                        )}
                    </span>
                    {/* Shine effect */}
                    <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] group-hover:animate-[shimmer_1s_infinite]"></div>
                </button>

                {/* Restore Purchases Button - Always clickable unless actively restoring */}
                <button
                  onClick={handleRestorePurchases}
                  disabled={isRestoring}
                  className="text-[#7c4dff] text-sm font-semibold flex items-center gap-2 mb-4 hover:text-[#651fff] transition-colors disabled:opacity-50"
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

                {/* Features - Education focused */}
                <div className="space-y-2.5 text-left w-full mb-2">
                    {[
                        { icon: "📖", text: "Bible Stories & Scripture Memory" },
                        { icon: "🎮", text: "Interactive Learning Games" },
                        { icon: "🎧", text: "Audio Lessons & Devotionals" },
                        { icon: "📝", text: "Quizzes to Reinforce Learning" },
                        { icon: "🏆", text: "Rewards System Kids Love" },
                        { icon: "🔒", text: "100% Ad-Free & Safe" },
                    ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 text-[#1a237e] font-semibold text-sm group">
                             <span className="text-base">{feature.icon}</span>
                            <span>{feature.text}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Trust Badge */}
            <div className="mt-6 flex flex-col items-center">
                <p className="text-white/70 text-xs font-medium mb-2">Trusted by Christian families everywhere</p>
                <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                        <span key={i} className="text-[#fdd835] text-lg">★</span>
                    ))}
                    <span className="text-white/60 text-xs ml-1">4.9 Rating</span>
                </div>
            </div>

            <p className="text-white/40 text-[10px] font-medium mt-6 text-center px-6 max-w-xs">
                Free trial for 3 days, then subscription automatically renews unless cancelled at least 24-hours before the trial ends. Cancel anytime in App Store or Google Play.
            </p>

            {/* Debug info for development */}
            {!isNativeApp && (
              <p className="text-white/20 text-[10px] mt-4">
                Running in web mode (DeSpia will handle native purchases)
              </p>
            )}
        </div>

        <ParentGateModal 
            isOpen={showParentGate} 
            onClose={() => setShowParentGate(false)} 
            onSuccess={handleGateSuccess} 
        />
    </div>
  );
};

export default PaywallPage;
