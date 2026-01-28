import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Trophy, Star, Coins } from 'lucide-react';
import WoodButton from '../ui/WoodButton';
import { DailySession } from '../../services/dailySessionService';
import { activityTrackingService } from '../../services/activityTrackingService';

interface SessionCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: DailySession | null;
}

// Confetti particle component
const ConfettiParticle: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const randomX = Math.random() * 100;
  const randomRotation = Math.random() * 360;
  const randomDuration = 2 + Math.random() * 2;
  
  return (
    <div
      className="absolute w-3 h-3 rounded-sm"
      style={{
        left: `${randomX}%`,
        top: '-10px',
        backgroundColor: color,
        transform: `rotate(${randomRotation}deg)`,
        animation: `confetti-fall ${randomDuration}s ease-out ${delay}s forwards`,
      }}
    />
  );
};

const SessionCelebrationModal: React.FC<SessionCelebrationModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [coinAnimation, setCoinAnimation] = useState(0);
  
  // Confetti colors
  const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD'];
  
  useEffect(() => {
    if (isOpen && session) {
      // Track completion
      activityTrackingService.trackOnboardingEvent('godly_kids_time_completed', {
        totalCoins: session.totalCoinsEarned,
        stepsCompleted: session.steps.filter(s => s.status === 'completed').length,
        duration: session.completedAt && session.startedAt 
          ? Math.floor((session.completedAt - session.startedAt) / 1000) 
          : 0,
      });
      
      // Start confetti
      setShowConfetti(true);
      
      // Animate coin counter
      const targetCoins = session.totalCoinsEarned;
      const duration = 1500;
      const steps = 30;
      const increment = targetCoins / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetCoins) {
          setCoinAnimation(targetCoins);
          clearInterval(timer);
        } else {
          setCoinAnimation(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  const completedSteps = session.steps.filter(s => s.status === 'completed').length;
  const totalSteps = session.steps.length;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      {/* Confetti container */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <ConfettiParticle
              key={i}
              delay={Math.random() * 0.5}
              color={confettiColors[i % confettiColors.length]}
            />
          ))}
        </div>
      )}
      
      {/* Modal content */}
      <div className="relative bg-gradient-to-b from-[#2a1f4e] to-[#1a1a2e] rounded-3xl p-8 mx-6 max-w-sm w-full shadow-2xl border border-[#FFD700]/20">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-[#FFD700]/5 blur-xl" />
        
        {/* Trophy icon */}
        <div className="relative flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg shadow-[#FFD700]/30 animate-bounce">
            <Trophy className="w-12 h-12 text-[#5c2e0b]" />
          </div>
          
          {/* Sparkles around trophy */}
          <Sparkles className="absolute top-0 left-1/4 w-6 h-6 text-[#FFD700] animate-pulse" />
          <Sparkles className="absolute top-4 right-1/4 w-5 h-5 text-[#FFD700] animate-pulse" style={{ animationDelay: '0.3s' }} />
          <Star className="absolute bottom-0 left-1/3 w-4 h-4 text-[#FFD700] animate-pulse" style={{ animationDelay: '0.6s' }} />
        </div>
        
        {/* Title */}
        <div className="relative text-center mb-6">
          <h2 className="text-[#FFD700] font-display font-bold text-2xl mb-2">
            Amazing Job!
          </h2>
          <p className="text-white/70">
            You completed today's Godly Kids Time!
          </p>
        </div>
        
        {/* Stats */}
        <div className="relative space-y-4 mb-6">
          {/* Coins earned */}
          <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-[#FFD700]" />
              </div>
              <span className="text-white font-medium">Coins Earned</span>
            </div>
            <span className="text-[#FFD700] font-bold text-2xl">
              +{coinAnimation}
            </span>
          </div>
          
          {/* Steps completed */}
          <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#8BC34A]/20 flex items-center justify-center">
                <Star className="w-6 h-6 text-[#8BC34A]" />
              </div>
              <span className="text-white font-medium">Steps Completed</span>
            </div>
            <span className="text-[#8BC34A] font-bold text-2xl">
              {completedSteps}/{totalSteps}
            </span>
          </div>
          
          {/* Step breakdown */}
          <div className="flex justify-center gap-4 pt-2">
            {session.steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${step.status === 'completed' 
                    ? 'bg-[#8BC34A]' 
                    : step.status === 'skipped'
                      ? 'bg-white/20'
                      : 'bg-white/10'
                  }
                `}>
                  <span className="text-lg">{step.icon}</span>
                </div>
                <span className="text-white/50 text-xs mt-1">
                  {step.status === 'completed' && `+${step.coinsEarned}`}
                  {step.status === 'skipped' && 'Skipped'}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Continue button */}
        <div className="relative">
          <WoodButton
            onClick={onClose}
            fullWidth
            variant="gold"
            className="py-4"
          >
            Continue Exploring
          </WoodButton>
        </div>
      </div>
      
      {/* CSS for confetti animation */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SessionCelebrationModal;
