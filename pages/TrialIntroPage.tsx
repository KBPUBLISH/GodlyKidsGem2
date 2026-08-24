import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, ArrowRight } from 'lucide-react';
import { activityTrackingService } from '../services/activityTrackingService';
import { shouldSeeNewOnboardingFlow } from '../services/userTypeService';
import { Capacitor } from '@capacitor/core';

/**
 * Trial Introduction Screen
 * Explains the free trial and asks for notification permission
 * Shows BEFORE the hard paywall for new users
 */
const TrialIntroPage: React.FC = () => {
  const navigate = useNavigate();
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default'>('default');
  
  // Check if we're on mobile (Capacitor) for notification flow
  const isMobile = Capacitor.isNativePlatform();

  // Guard: redirect existing users away from new flow
  useEffect(() => {
    if (!shouldSeeNewOnboardingFlow()) {
      console.log('⚠️ Existing user tried to access trial intro - redirecting to old paywall');
      navigate('/paywall', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    activityTrackingService.trackOnboardingEvent('trial_intro_shown');
    
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      // Skip if not supported
      handleContinue();
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      activityTrackingService.trackOnboardingEvent('trial_notification_permission', {
        granted: permission === 'granted'
      });
      
      // Auto-continue after requesting permission
      setTimeout(() => handleContinue(), 500);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      handleContinue();
    }
  };

  const handleContinue = () => {
    activityTrackingService.trackOnboardingEvent('trial_intro_continue');
    
    // Navigate to hard paywall
    navigate('/paywall-new-user', { replace: true });
  };

  return (
    <div 
      className="relative min-h-full w-full bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#e0e7ff] flex flex-col overflow-hidden"
      style={{ paddingTop: 'var(--safe-area-top, 0px)' }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 left-4 w-40 h-28 bg-gradient-to-r from-[#c7d2fe]/50 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-32 right-0 w-48 h-32 bg-gradient-to-l from-[#fde68a]/35 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-32 left-8 w-32 h-24 bg-[#ddd6fe]/30 rounded-full blur-xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pb-10">
        <div className="w-full max-w-md">
          
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-300/40">
              <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-[#1e1b4b] mb-4">
              Try Free for 7 Days
            </h1>
            <p className="text-[#64748b] text-lg leading-relaxed">
              Full access to all stories, games, and lessons. We'll remind you before any charges.
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-8 space-y-4 border border-[#6366f1]/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#4CAF50] shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <p className="text-[#1e1b4b] font-semibold">No payment today</p>
                <p className="text-[#64748b] text-sm">7 days completely free</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#4CAF50] shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <p className="text-[#1e1b4b] font-semibold">Cancel anytime</p>
                <p className="text-[#64748b] text-sm">No commitment required</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#4CAF50] shrink-0 mt-0.5" strokeWidth={2.5} />
              <div>
                <p className="text-[#1e1b4b] font-semibold">Reminder before billing</p>
                <p className="text-[#64748b] text-sm">We'll notify you before day 7</p>
              </div>
            </div>
          </div>

          {/* Notification Request Section (if permission not granted) */}
          {notificationPermission !== 'granted' && isMobile && (
            <div className="bg-gradient-to-br from-[#6366f1]/10 to-[#8b5cf6]/10 rounded-2xl p-5 mb-6 border border-[#6366f1]/30">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="w-6 h-6 text-[#6366f1]" />
                <p className="text-[#1e1b4b] font-semibold">Stay in the loop</p>
              </div>
              <p className="text-[#64748b] text-sm mb-4">
                We'll send you a friendly reminder before your trial ends, so you're never surprised.
              </p>
              <button
                onClick={handleRequestNotifications}
                className="w-full py-3 px-4 bg-white text-[#6366f1] font-semibold rounded-xl border border-[#6366f1]/30 hover:bg-[#6366f1] hover:text-white transition-all active:scale-[0.98]"
              >
                Enable Notifications
              </button>
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={notificationPermission !== 'granted' && isMobile ? handleRequestNotifications : handleContinue}
            className="w-full flex items-center justify-center gap-2 font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-indigo-200/50"
          >
            {notificationPermission !== 'granted' && isMobile ? 'Enable Notifications & Continue' : 'Continue'}
            <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
          </button>

          {/* Small print */}
          <p className="text-center text-[#94a3b8] text-xs mt-4 leading-relaxed">
            By continuing, you agree to start your 7-day free trial. Cancel anytime before day 7 to avoid charges.
          </p>
        </div>
      </div>

      <div
        className="relative z-10 shrink-0 pointer-events-none"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
    </div>
  );
};

export default TrialIntroPage;
