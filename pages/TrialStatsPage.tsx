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
  ChevronRight,
  Star
} from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';
import { activityTrackingService, ActivityStats } from '../services/activityTrackingService';

const TrialStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { reverseTrial, isPremium } = useSubscription();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  
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
      className="min-h-screen bg-gradient-to-b from-[#7C3AED]/10 via-white to-amber-50/50"
      style={{ paddingTop: 'var(--safe-area-top, 0px)', paddingBottom: 'var(--safe-area-bottom, 0px)' }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
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

      <div className="px-4 py-6 space-y-6">
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
        <div className="text-center py-4">
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
          <div className="space-y-3">
            {[
              { label: 'Unlimited Books & Stories', active: true },
              { label: 'All Audio Playlists', active: true },
              { label: 'Daily Lessons & Activities', active: true },
              { label: 'Voice Selection & Cloning', active: true },
              { label: 'All Educational Games', active: true },
              { label: 'Offline Downloads', active: true },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-700">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] rounded-2xl p-6 text-center shadow-lg">
          <h3 className="text-white font-bold text-xl mb-2">
            Keep the magic going!
          </h3>
          <p className="text-white/80 text-sm mb-5">
            Subscribe now to continue unlimited access to all premium content
          </p>
          
          <button
            onClick={() => navigate('/paywall')}
            className="w-full bg-white text-[#7C3AED] font-bold py-4 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>View Plans & Pricing</span>
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <p className="text-white/60 text-xs mt-3">
            Cancel anytime • No commitment required
          </p>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default TrialStatsPage;
