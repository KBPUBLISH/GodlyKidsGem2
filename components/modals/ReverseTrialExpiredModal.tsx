import React, { useState, useEffect } from 'react';
import { X, BookOpen, Trophy, Star, Coins, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { activityTrackingService } from '../../services/activityTrackingService';

interface ReverseTrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserStats {
  booksRead: number;
  quizzesCompleted: number;
  coinsEarned: number;
  lessonsCompleted: number;
}

// Get API base URL
const getApiBaseUrl = (): string => {
  return localStorage.getItem('godlykids_api_url') || 
    (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backendgk2-0.onrender.com');
};

const ReverseTrialExpiredModal: React.FC<ReverseTrialExpiredModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats>({
    booksRead: 0,
    quizzesCompleted: 0,
    coinsEarned: 0,
    lessonsCompleted: 0,
  });
  const [kidName, setKidName] = useState<string>('');

  // Fetch user stats on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchStats = async () => {
      try {
        const user = authService.getUser();
        const deviceId = localStorage.getItem('godlykids_device_id') || localStorage.getItem('device_id');
        const identifier = user?.email || deviceId;

        if (!identifier) return;

        const response = await fetch(`${getApiBaseUrl()}/api/app-user/stats/${encodeURIComponent(identifier)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setStats(data.stats);
            if (data.kidProfiles?.[0]?.name) {
              setKidName(data.kidProfiles[0].name);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    activityTrackingService.trackOnboardingEvent('reverse_trial_expired');
  }, [isOpen]);

  const handleSubscribe = () => {
    activityTrackingService.trackOnboardingEvent('reverse_trial_expired_subscribe_clicked');
    onClose();
    navigate('/paywall');
  };

  const handleMaybeLater = () => {
    activityTrackingService.trackOnboardingEvent('reverse_trial_churned');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-in fade-in duration-300">
      {/* Modal */}
      <div className="relative bg-gradient-to-b from-white to-gray-50 rounded-3xl p-6 mx-4 shadow-2xl animate-in zoom-in-95 duration-300 max-w-md w-full">
        {/* Close button */}
        <button
          onClick={handleMaybeLater}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Sad emoji */}
          <div className="text-6xl mb-4">😢</div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Your Free Trial Ended
          </h2>
          
          <p className="text-gray-600 mb-6">
            {kidName ? `${kidName} had an amazing week!` : 'You had an amazing week!'}
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.booksRead > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-blue-700">{stats.booksRead}</p>
                  <p className="text-xs text-blue-600">Stories Read</p>
                </div>
              </div>
            )}
            
            {stats.quizzesCompleted > 0 && (
              <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-green-700">{stats.quizzesCompleted}</p>
                  <p className="text-xs text-green-600">Quizzes Done</p>
                </div>
              </div>
            )}
            
            {stats.coinsEarned > 0 && (
              <div className="bg-yellow-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Coins className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-yellow-700">{stats.coinsEarned}</p>
                  <p className="text-xs text-yellow-600">Coins Earned</p>
                </div>
              </div>
            )}
            
            {stats.lessonsCompleted > 0 && (
              <div className="bg-purple-50 rounded-xl p-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Star className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-purple-700">{stats.lessonsCompleted}</p>
                  <p className="text-xs text-purple-600">Lessons Done</p>
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <p className="text-gray-600 text-sm mb-4">
            Don't lose your progress!
          </p>

          {/* Subscribe Button */}
          <button
            onClick={handleSubscribe}
            className="w-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] mb-3"
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle size={20} />
              <span>Continue Premium - $3.33/mo</span>
            </div>
          </button>

          {/* Maybe Later */}
          <button
            onClick={handleMaybeLater}
            className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReverseTrialExpiredModal;
