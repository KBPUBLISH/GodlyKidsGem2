import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Gift, Check, Loader2, Bell } from 'lucide-react';
import NotificationToggle from '../features/NotificationToggle';
import { useSubscription } from '../../context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { activityTrackingService } from '../../services/activityTrackingService';

interface ReverseTrialOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  childName?: string;
}

const ReverseTrialOfferModal: React.FC<ReverseTrialOfferModalProps> = ({
  isOpen,
  onClose,
  childName,
}) => {
  const navigate = useNavigate();
  const { startReverseTrial, isPremium } = useSubscription();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setIsStarting(true);
    setError(null);
    
    try {
      // Track the offer acceptance
      activityTrackingService.trackOnboardingEvent('reverse_trial_offer_accepted', {
        source: 'first_session_complete',
      });
      
      const result = await startReverseTrial();
      
      if (result?.success) {
        activityTrackingService.trackOnboardingEvent('reverse_trial_started', {
          source: 'first_session_complete',
        });
        
        // Navigate to premium onboarding to show what they unlocked
        navigate('/premium-onboarding', { replace: true });
      } else {
        setError('Something went wrong. Please try again.');
        setIsStarting(false);
      }
    } catch (err) {
      console.error('Error starting reverse trial:', err);
      setError('Something went wrong. Please try again.');
      setIsStarting(false);
    }
  };

  const handleMaybeLater = () => {
    activityTrackingService.trackOnboardingEvent('reverse_trial_offer_declined', {
      source: 'first_session_complete',
    });
    onClose();
  };

  if (!isOpen || isPremium) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleMaybeLater}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-gradient-to-b from-indigo-600 via-purple-600 to-purple-700 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl" />
          {/* Sparkles */}
          <Sparkles className="absolute top-8 right-8 w-6 h-6 text-yellow-300/60 animate-pulse" />
          <Sparkles className="absolute top-20 left-6 w-4 h-4 text-white/40 animate-pulse delay-300" />
          <Sparkles className="absolute bottom-32 right-12 w-5 h-5 text-yellow-300/50 animate-pulse delay-500" />
        </div>
        
        {/* Content */}
        <div className="relative p-8 pt-10 text-center">
          {/* Gift icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-orange-500/30">
            <Gift className="w-10 h-10 text-white" />
          </div>
          
          {/* Headline */}
          <h2 className="text-2xl font-bold text-white mb-2">
            🎉 Amazing First Session{childName ? `, ${childName}` : ''}!
          </h2>
          
          <p className="text-white/90 text-lg mb-6">
            Keep the momentum going...
          </p>
          
          {/* Value prop box */}
          <div className="bg-white/15 backdrop-blur rounded-2xl p-5 mb-6">
            <h3 className="text-xl font-bold text-white mb-3">
              7 Days FREE Premium
            </h3>
            
            <ul className="space-y-2 text-left">
              {[
                'Unlimited daily sessions',
                'All books & stories',
                'Personalized content',
                'No credit card needed',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-white/90">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* No commitment badge */}
          <p className="text-yellow-300 font-medium mb-4">
            ✨ No card. No commitment. Just try it.
          </p>
          
          {/* Daily reminder toggle */}
          <div className="bg-white/10 rounded-xl p-3 mb-4">
            <NotificationToggle 
              label="Get daily 8am reminders"
              size="md"
              showPulse={true}
            />
          </div>
          
          {/* Error message */}
          {error && (
            <p className="text-red-300 text-sm mb-4">{error}</p>
          )}
          
          {/* CTA Button */}
          <button
            onClick={handleStartTrial}
            disabled={isStarting}
            className="w-full py-4 px-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold text-xl rounded-2xl shadow-lg shadow-orange-500/30 transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </span>
            ) : (
              "Let's Go! 🚀"
            )}
          </button>
          
          {/* Maybe later link */}
          <button
            onClick={handleMaybeLater}
            disabled={isStarting}
            className="mt-4 text-white/60 hover:text-white/80 text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ReverseTrialOfferModal;
