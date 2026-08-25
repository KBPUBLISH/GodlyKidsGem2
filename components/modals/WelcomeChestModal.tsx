import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Clock } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { SKIP_TRIAL_MINUTES } from '../../services/revenueCatService';
import { activityTrackingService } from '../../services/activityTrackingService';
import { markWelcomeChestClaimed } from '../../services/userTypeService';

interface WelcomeChestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeChestModal: React.FC<WelcomeChestModalProps> = ({ isOpen, onClose }) => {
  const { startReverseTrial } = useSubscription();
  const [opened, setOpened] = useState(false);
  const [claiming, setClaiming] = useState(false);

  if (!isOpen) return null;

  const handleOpenChest = async () => {
    if (opened || claiming) return;
    setOpened(true);
    setClaiming(true);
    try {
      await startReverseTrial({ trialDurationMinutes: SKIP_TRIAL_MINUTES });
      markWelcomeChestClaimed();
      activityTrackingService.trackOnboardingEvent('reverse_trial_started', {
        source: 'welcome_chest',
        trialMinutes: SKIP_TRIAL_MINUTES,
      }).catch(() => {});
    } finally {
      setClaiming(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-gradient-to-b from-[#3E1F07] to-[#2a1201] rounded-3xl border-2 border-[#FFD700]/60 shadow-[0_0_40px_rgba(255,215,0,0.25)] overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#B8860B] via-[#FFD700] to-[#B8860B]" />

        <div className="px-6 pt-8 pb-7 text-center">
          {!opened ? (
            <>
              <p className="text-[#FFD700] font-display font-extrabold text-xl tracking-wide mb-1">
                A gift for you!
              </p>
              <p className="text-[#eecaa0] text-sm mb-6">Tap the chest to open it</p>

              <button
                type="button"
                onClick={handleOpenChest}
                className="relative mx-auto block w-40 h-40 focus:outline-none active:scale-95 transition-transform"
                aria-label="Open welcome chest"
              >
                <span className="absolute inset-0 rounded-full bg-[#FFD700]/20 blur-2xl animate-pulse" />
                <svg viewBox="0 0 200 200" className="relative w-full h-full drop-shadow-2xl welcome-chest-jiggle">
                  <path d="M30,88 L170,88 L165,138 L35,138 Z" fill="#2a1201" />
                  <path d="M20,88 L180,88 L160,28 Q100,16 40,28 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                  <rect x="20" y="88" width="160" height="10" fill="#5c2e0b" />
                  <path d="M20,88 L180,88 L175,158 Q100,172 25,158 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                  <path d="M85,78 L85,62 Q85,46 100,46 Q115,46 115,62 L115,78" fill="none" stroke="#FFD700" strokeWidth="6" />
                  <rect x="80" y="78" width="40" height="30" rx="4" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
                  <circle cx="100" cy="93" r="4" fill="#3E1F07" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <div className="relative mx-auto w-40 h-40 mb-3">
                <span className="absolute inset-0 rounded-full bg-[#FFD700]/30 blur-2xl" />
                <svg viewBox="0 0 200 200" className="relative w-full h-full drop-shadow-2xl">
                  <g className="origin-bottom" style={{ transform: 'translateY(-12px) rotate(-14deg)' }}>
                    <path d="M20,88 L180,88 L160,28 Q100,16 40,28 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                    <path d="M85,68 L115,68 L115,78 L85,78 Z" fill="#FFD700" />
                  </g>
                  <path d="M30,88 L170,88 L165,138 L35,138 Z" fill="#2a1201" />
                  <path d="M20,88 L180,88 L175,158 Q100,172 25,158 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                  <circle cx="62" cy="96" r="11" fill="#FFD700" stroke="#B8860B" />
                  <circle cx="88" cy="90" r="13" fill="#FFD700" stroke="#B8860B" />
                  <circle cx="112" cy="94" r="11" fill="#FFD700" stroke="#B8860B" />
                  <circle cx="136" cy="91" r="12" fill="#FFD700" stroke="#B8860B" />
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 text-[#FFD700] mb-1">
                <Sparkles size={20} />
                <h2 className="font-display font-extrabold text-2xl">Chest unlocked!</h2>
              </div>
              <p className="text-white font-bold text-lg mb-1">1 Hour Unlimited</p>
              <p className="text-[#eecaa0] text-sm mb-6 flex items-center justify-center gap-1.5">
                <Clock size={14} />
                Stories, games, and voices — all unlocked
              </p>

              <button
                type="button"
                onClick={onClose}
                disabled={claiming}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#DAA520] text-[#3E1F07] font-display font-extrabold text-lg shadow-[0_4px_0_#8B6914] active:translate-y-0.5 active:shadow-none disabled:opacity-70"
              >
                {claiming ? 'Opening…' : 'Let’s go!'}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes welcome-chest-jiggle {
          0%, 18%, 22%, 48%, 52%, 78%, 82%, 100% { transform: rotate(0deg); }
          19% { transform: rotate(-6deg); }
          20% { transform: rotate(6deg); }
          21% { transform: rotate(-3deg); }
          49% { transform: rotate(-6deg); }
          50% { transform: rotate(6deg); }
          51% { transform: rotate(-3deg); }
          79% { transform: rotate(-6deg); }
          80% { transform: rotate(6deg); }
          81% { transform: rotate(-3deg); }
        }
        .welcome-chest-jiggle { animation: welcome-chest-jiggle 4.5s ease-in-out infinite; }
      `}</style>
    </div>,
    document.body
  );
};

export default WelcomeChestModal;
