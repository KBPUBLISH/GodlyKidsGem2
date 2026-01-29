import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, X } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { activityTrackingService } from '../../services/activityTrackingService';

interface ProBadgeProps {
  className?: string;
}

const ProBadge: React.FC<ProBadgeProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { reverseTrial, isPremium, checkReverseTrialStatus } = useSubscription();
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Check reverse trial status on mount
  useEffect(() => {
    checkReverseTrialStatus();
  }, [checkReverseTrialStatus]);

  // Check if dismissed this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('godlykids_pro_badge_dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  // Don't show if:
  // - User is a paid premium subscriber (not reverse trial)
  // - No active reverse trial
  // - Badge was dismissed this session
  if (!reverseTrial.isActive || isDismissed) {
    return null;
  }

  // If user is premium but NOT on reverse trial, don't show the badge
  // (they're a paying customer)
  if (isPremium && !reverseTrial.hasReverseTrial) {
    return null;
  }

  const handleClick = () => {
    activityTrackingService.trackOnboardingEvent('pro_badge_clicked').catch(() => {});
    navigate('/paywall');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    sessionStorage.setItem('godlykids_pro_badge_dismissed', 'true');
  };

  const daysText = reverseTrial.daysRemaining === 1 
    ? '1 day left' 
    : `${reverseTrial.daysRemaining} days left`;

  return (
    <div
      className={`
        fixed z-[90] flex items-center gap-1.5 
        bg-gradient-to-r from-amber-400 to-amber-500 
        text-amber-900 font-bold text-sm 
        px-3 py-1.5 rounded-full 
        shadow-lg shadow-amber-500/30
        cursor-pointer
        hover:shadow-xl hover:scale-105
        active:scale-95
        transition-all duration-200
        animate-in slide-in-from-right-4 fade-in duration-500
        ${className}
      `}
      style={{ 
        top: 'calc(var(--safe-area-top, 0px) + 60px)',
        right: '12px',
      }}
      onClick={handleClick}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-full bg-amber-400/50 blur-md -z-10 animate-pulse" />
      
      {/* Crown icon */}
      <Crown className="w-4 h-4 text-amber-800" />
      
      {/* Days remaining */}
      <span className="text-amber-900">{daysText}</span>
      
      {/* Divider */}
      <div className="w-px h-4 bg-amber-600/30 mx-0.5" />
      
      {/* PRO text */}
      <span className="text-amber-800 font-extrabold tracking-wide">PRO</span>
      
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="ml-1 p-0.5 rounded-full hover:bg-amber-600/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-amber-700" />
      </button>
    </div>
  );
};

export default ProBadge;
