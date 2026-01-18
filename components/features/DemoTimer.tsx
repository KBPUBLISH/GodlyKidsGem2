import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Crown } from 'lucide-react';

/**
 * DemoTimer Component
 * 
 * Shows a visible countdown timer during the 5-minute demo period.
 * When timer expires, redirects user back to onboarding paywall.
 */
const DemoTimer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Check if demo mode is active
    const checkDemoStatus = () => {
      const demoActive = localStorage.getItem('godlykids_demo_active');
      const demoEndTimeStr = localStorage.getItem('godlykids_demo_end_time');
      const isPremium = localStorage.getItem('godlykids_premium') === 'true';
      
      // Don't show timer if premium or not in demo mode
      if (isPremium || demoActive !== 'true' || !demoEndTimeStr) {
        setIsVisible(false);
        return;
      }
      
      const demoEndTime = parseInt(demoEndTimeStr, 10);
      const remaining = demoEndTime - Date.now();
      
      if (remaining <= 0) {
        // Demo expired
        handleDemoExpired();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
        setIsVisible(true);
      }
    };

    // Initial check
    checkDemoStatus();

    // Update every second
    const interval = setInterval(() => {
      const demoEndTimeStr = localStorage.getItem('godlykids_demo_end_time');
      const demoActive = localStorage.getItem('godlykids_demo_active');
      
      if (demoActive !== 'true' || !demoEndTimeStr) {
        setIsVisible(false);
        return;
      }
      
      const demoEndTime = parseInt(demoEndTimeStr, 10);
      const remaining = demoEndTime - Date.now();
      
      if (remaining <= 0) {
        handleDemoExpired();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDemoExpired = () => {
    // Mark demo as used
    localStorage.setItem('godlykids_demo_used', 'true');
    localStorage.removeItem('godlykids_demo_active');
    localStorage.removeItem('godlykids_demo_end_time');
    
    setIsExpired(true);
    setIsVisible(true);
    
    // Redirect after showing expired message
    setTimeout(() => {
      // Navigate to onboarding with demo_expired flag
      navigate('/onboarding?demo_expired=1');
    }, 2000);
  };

  const handleSubscribeClick = () => {
    // Clear demo and go to paywall
    localStorage.setItem('godlykids_demo_used', 'true');
    localStorage.removeItem('godlykids_demo_active');
    localStorage.removeItem('godlykids_demo_end_time');
    navigate('/onboarding?demo_expired=1');
  };

  // Don't show on onboarding page
  if (location.pathname === '/onboarding' || location.pathname === '/') {
    return null;
  }

  if (!isVisible) return null;

  // Format time as M:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine urgency color
  const getTimerColor = () => {
    if (isExpired) return 'from-red-500 to-red-600';
    if (timeLeft && timeLeft <= 60) return 'from-red-500 to-orange-500'; // Last minute - red
    if (timeLeft && timeLeft <= 120) return 'from-orange-500 to-yellow-500'; // 2 minutes - orange
    return 'from-[#7c4dff] to-[#536dfe]'; // Normal - purple
  };

  if (isExpired) {
    // Full screen expired overlay
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Demo Time's Up! ⏱️
          </h2>
          <p className="text-gray-600 mb-6">
            Your 5-minute demo has ended. Subscribe now to continue your child's faith journey!
          </p>
          <button
            onClick={handleSubscribeClick}
            className="w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-bold py-4 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2"
          >
            <Crown className="w-5 h-5" />
            Unlock Full Access
          </button>
          <p className="text-gray-400 text-xs mt-3">
            14-day free trial • Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  // Floating timer badge
  return (
    <button
      onClick={handleSubscribeClick}
      className={`fixed top-4 right-4 z-[100] bg-gradient-to-r ${getTimerColor()} text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95`}
    >
      <Clock className="w-4 h-4" />
      <span className="font-bold text-sm">
        Demo: {formatTime(timeLeft || 0)}
      </span>
      {timeLeft && timeLeft <= 60 && (
        <span className="animate-pulse">⚡</span>
      )}
    </button>
  );
};

export default DemoTimer;
