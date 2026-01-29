import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Crown, 
  BookOpen, 
  Music, 
  Gamepad2, 
  GraduationCap,
  Clock,
  Sparkles,
  Star,
  Check,
  Loader2
} from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { activityTrackingService, ActivityStats } from '../services/activityTrackingService';
import ParentGateModal from '../components/modals/ParentGateModal';

const TrialStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { reverseTrial, isPremium, purchase, isLoading } = useSubscription();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [showParentGate, setShowParentGate] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pricing
  const monthlyPrice = 5.99;
  const annualPrice = 39.99;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savings = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);
  
  useEffect(() => {
    // Get stats for the trial period (7 days)
    const trialStats = activityTrackingService.getStats(7);
    setStats(trialStats);
  }, []);

  // If no active trial, redirect to home
  useEffect(() => {
    if (!reverseTrial.isActive && !isPremium) {
      navigate('/home');
    }
  }, [reverseTrial.isActive, isPremium, navigate]);

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTrialEndDate = () => {
    if (!reverseTrial.endDate) return '';
    const date = new Date(reverseTrial.endDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSubscribeClick = () => {
    setError(null);
    activityTrackingService.trackOnboardingEvent('trial_stats_subscribe_clicked', { planType: selectedPlan });
    setShowParentGate(true);
  };

  const handleGateSuccess = async () => {
    setShowParentGate(false);
    setIsPurchasing(true);
    setError(null);
    
    try {
      const result = await purchase(selectedPlan);
      
      if (result.success) {
        activityTrackingService.trackOnboardingEvent('trial_stats_purchase_success', { planType: selectedPlan });
        navigate('/home', { replace: true });
      } else {
        setError(result.error || 'Purchase failed. Please try again.');
        activityTrackingService.trackOnboardingEvent('trial_stats_purchase_failed', { planType: selectedPlan, error: result.error });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Feature stats cards configuration
  const featureCards = [
    {
      icon: BookOpen,
      label: 'Books Read',
      value: stats?.booksRead || 0,
      color: 'from-blue-400 to-blue-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      icon: Music,
      label: 'Songs Played',
      value: stats?.songsListened || 0,
      color: 'from-purple-400 to-purple-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-500',
    },
    {
      icon: GraduationCap,
      label: 'Lessons Done',
      value: stats?.lessonsCompleted || 0,
      color: 'from-green-400 to-green-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      icon: Gamepad2,
      label: 'Games Played',
      value: stats?.gamesPlayed || 0,
      color: 'from-orange-400 to-orange-500',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-500',
    },
  ];

  const totalActivities = (stats?.booksRead || 0) + (stats?.songsListened || 0) + 
                          (stats?.lessonsCompleted || 0) + (stats?.gamesPlayed || 0);

  return (
    <div 
      className="min-h-screen relative"
      style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: 'var(--safe-area-bottom, 0px)' }}
    >
      {/* Sun & Sky Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/assets/images/bg-sunrise.jpg)' }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/80 to-white/95" />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-gray-100 relative">
        <div className="flex items-center px-4 py-3" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 12px)' }}>
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="flex-1 text-center font-bold text-lg text-gray-800 pr-8">Your Premium Trial</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 relative z-[1]">
        {/* Trial Status Card */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-5 shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-900" />
              <span className="font-bold text-amber-900 text-lg">PRO Trial Active</span>
            </div>
            <div className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="font-bold text-amber-900 text-sm">
                {reverseTrial.daysRemaining} {reverseTrial.daysRemaining === 1 ? 'day' : 'days'} left
              </span>
            </div>
          </div>
          
          {/* Progress bar showing days elapsed */}
          <div className="bg-amber-600/30 rounded-full h-2 mb-2">
            <div 
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${((7 - (reverseTrial.daysRemaining || 7)) / 7) * 100}%` }}
            />
          </div>
          <p className="text-amber-800 text-sm">
            Trial ends {getTrialEndDate()} • Enjoying premium features!
          </p>
        </div>

        {/* Stats Summary */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7C3AED]/10 to-purple-100 px-4 py-2 rounded-full mb-2">
            <Sparkles className="w-5 h-5 text-[#7C3AED]" />
            <span className="font-semibold text-[#7C3AED]">
              {totalActivities} premium activities completed
            </span>
          </div>
          {stats?.timeSpentMinutes ? (
            <p className="text-gray-600 text-sm flex items-center justify-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(stats.timeSpentMinutes)} of learning time
            </p>
          ) : null}
        </div>

        {/* Feature Usage Cards */}
        <div className="grid grid-cols-2 gap-3">
          {featureCards.map((card, index) => (
            <div 
              key={index}
              className={`${card.bgColor} rounded-2xl p-4 border border-gray-100`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 shadow-sm`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-gray-600 text-sm">{card.label}</p>
            </div>
          ))}
        </div>

        {/* What You've Unlocked Section */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Premium Features You're Enjoying
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              'Unlimited Books & Stories',
              'All Audio Playlists',
              'Daily Lessons',
              'Voice Selection',
              'Educational Games',
              '100% Ad-Free',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-green-600" />
                </div>
                <span className="text-gray-700 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-2xl p-5 shadow-lg">
          <h3 className="text-white font-bold text-xl mb-1 text-center">
            Keep the magic going!
          </h3>
          <p className="text-white/80 text-sm mb-4 text-center">
            Subscribe now to continue unlimited access
          </p>
          
          {/* Plan Options */}
          <div className="space-y-3 mb-4">
            {/* Annual Option */}
            <div 
              onClick={() => setSelectedPlan('annual')}
              className={`relative w-full rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                selectedPlan === 'annual' 
                ? 'bg-white border-white shadow-lg' 
                : 'bg-white/10 border-white/30'
              }`}
            >
              {/* Best Value Badge */}
              <div className="absolute -top-0 -right-0">
                <div className="bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                  SAVE {savings}%
                </div>
              </div>
              
              <div className="p-3 flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPlan === 'annual' ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-white/50'
                }`}>
                  {selectedPlan === 'annual' && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                
                <div className="flex-1">
                  <p className={`font-bold ${selectedPlan === 'annual' ? 'text-gray-800' : 'text-white'}`}>Annual</p>
                  <p className={`text-xs ${selectedPlan === 'annual' ? 'text-gray-500' : 'text-white/70'}`}>${annualMonthly}/month</p>
                </div>
                
                <div className="text-right">
                  <p className={`font-extrabold text-lg ${selectedPlan === 'annual' ? 'text-gray-800' : 'text-white'}`}>${annualPrice}</p>
                  <p className={`text-xs ${selectedPlan === 'annual' ? 'text-gray-400 line-through' : 'text-white/50 line-through'}`}>${(monthlyPrice * 12).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Option */}
            <div 
              onClick={() => setSelectedPlan('monthly')}
              className={`relative w-full rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                selectedPlan === 'monthly' 
                ? 'bg-white border-white shadow-lg' 
                : 'bg-white/10 border-white/30'
              }`}
            >
              <div className="p-3 flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedPlan === 'monthly' ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-white/50'
                }`}>
                  {selectedPlan === 'monthly' && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                
                <div className="flex-1">
                  <p className={`font-bold ${selectedPlan === 'monthly' ? 'text-gray-800' : 'text-white'}`}>Monthly</p>
                  <p className={`text-xs ${selectedPlan === 'monthly' ? 'text-gray-500' : 'text-white/70'}`}>Cancel anytime</p>
                </div>
                
                <div className="text-right">
                  <p className={`font-extrabold text-lg ${selectedPlan === 'monthly' ? 'text-gray-800' : 'text-white'}`}>${monthlyPrice}</p>
                  <p className={`text-xs ${selectedPlan === 'monthly' ? 'text-gray-400' : 'text-white/50'}`}>/month</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {error}
            </div>
          )}
          
          {/* Subscribe Button */}
          <button
            onClick={handleSubscribeClick}
            disabled={isPurchasing || isLoading}
            className="w-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1e1b4b] font-bold py-4 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-70"
          >
            {isPurchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <span>Subscribe Now • ${selectedPlan === 'annual' ? annualPrice : monthlyPrice}/{selectedPlan === 'annual' ? 'year' : 'month'}</span>
            )}
          </button>
          
          <p className="text-white/60 text-xs mt-3 text-center">
            Cancel anytime • No commitment required
          </p>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>

      {/* Parent Gate Modal */}
      <ParentGateModal 
        isOpen={showParentGate} 
        onClose={() => setShowParentGate(false)} 
        onSuccess={handleGateSuccess} 
      />
    </div>
  );
};

export default TrialStatsPage;
