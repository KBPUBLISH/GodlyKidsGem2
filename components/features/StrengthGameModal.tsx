
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { 
  X, Star, Dumbbell, Shield, Heart, Sword, Mountain, 
  Flame, Crown, Clock, Sparkles, ChevronRight
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { profileService } from '../../services/profileService';

interface StrengthGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameState = 'cooldown' | 'intro' | 'challenge' | 'success' | 'claimed';

const COOLDOWN_HOURS = 12;
const getStorageKey = () => profileService.getProfileKey('strength_game_last_completion');

// Faith Strength Challenges - Scripture-based affirmations
const STRENGTH_CHALLENGES = [
  {
    id: 'courage',
    icon: Shield,
    color: 'text-[#1565C0]',
    bgColor: 'bg-[#1565C0]',
    title: 'Courage Challenge',
    scripture: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
    reference: 'Joshua 1:9',
    affirmation: 'I am brave because God is with me!',
    action: 'Say it out loud 3 times!'
  },
  {
    id: 'strength',
    icon: Dumbbell,
    color: 'text-[#E65100]',
    bgColor: 'bg-[#E65100]',
    title: 'Strength Builder',
    scripture: 'I can do all things through Christ who strengthens me.',
    reference: 'Philippians 4:13',
    affirmation: 'I am strong because Jesus gives me power!',
    action: 'Do 5 jumping jacks while saying it!'
  },
  {
    id: 'love',
    icon: Heart,
    color: 'text-[#C2185B]',
    bgColor: 'bg-[#C2185B]',
    title: 'Love Power',
    scripture: 'And now these three remain: faith, hope and love. But the greatest of these is love.',
    reference: '1 Corinthians 13:13',
    affirmation: 'I am loved and I share God\'s love!',
    action: 'Give someone a hug today!'
  },
  {
    id: 'faith',
    icon: Mountain,
    color: 'text-[#2E7D32]',
    bgColor: 'bg-[#2E7D32]',
    title: 'Faith Mountain',
    scripture: 'If you have faith as small as a mustard seed, you can say to this mountain, "Move from here to there," and it will move.',
    reference: 'Matthew 17:20',
    affirmation: 'My faith can move mountains!',
    action: 'Close your eyes and pray for something big!'
  },
  {
    id: 'warrior',
    icon: Sword,
    color: 'text-[#5D4037]',
    bgColor: 'bg-[#5D4037]',
    title: 'Mighty Warrior',
    scripture: 'The Lord is my strength and my shield; my heart trusts in him, and he helps me.',
    reference: 'Psalm 28:7',
    affirmation: 'God is my shield and protector!',
    action: 'Stand tall like a warrior and declare it!'
  },
  {
    id: 'fire',
    icon: Flame,
    color: 'text-[#FF5722]',
    bgColor: 'bg-[#FF5722]',
    title: 'Fire of Faith',
    scripture: 'For God gave us a spirit not of fear but of power and love and self-control.',
    reference: '2 Timothy 1:7',
    affirmation: 'I have power, love, and a sound mind!',
    action: 'Take 3 deep breaths and feel God\'s peace!'
  },
  {
    id: 'victory',
    icon: Crown,
    color: 'text-[#FFB300]',
    bgColor: 'bg-[#FFB300]',
    title: 'Victory Crown',
    scripture: 'But thanks be to God! He gives us the victory through our Lord Jesus Christ.',
    reference: '1 Corinthians 15:57',
    affirmation: 'I am a winner with Jesus!',
    action: 'Raise your hands in victory!'
  }
];

const StrengthGameModal: React.FC<StrengthGameModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, playTab } = useAudio();
  const { t } = useLanguage();
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState(STRENGTH_CHALLENGES[0]);
  const [challengeComplete, setChallengeComplete] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  
  const cooldownTimerRef = useRef<number | null>(null);

  // Check cooldown on open
  useEffect(() => {
    if (isOpen) {
      if (isOnCooldown()) {
        setGameState('cooldown');
        const updateCooldown = () => {
          const timeRemaining = getTimeUntilNext();
          setTimeUntilNext(timeRemaining);
          
          if (!timeRemaining || !isOnCooldown()) {
            setGameState('intro');
            if (cooldownTimerRef.current) {
              window.clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
          }
        };
        
        updateCooldown();
        cooldownTimerRef.current = window.setInterval(updateCooldown, 1000);
      } else {
        initializeGame();
      }
    } else {
      setGameState('intro');
      setChallengeComplete(false);
      if (cooldownTimerRef.current) {
        window.clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }
    
    return () => {
      if (cooldownTimerRef.current) {
        window.clearInterval(cooldownTimerRef.current);
      }
    };
  }, [isOpen]);

  const getLastCompletionTime = (): number | null => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  };

  const isOnCooldown = (): boolean => {
    const lastTime = getLastCompletionTime();
    if (!lastTime) return false;
    const now = Date.now();
    const hoursSinceCompletion = (now - lastTime) / (1000 * 60 * 60);
    return hoursSinceCompletion < COOLDOWN_HOURS;
  };

  const getTimeUntilNext = (): string => {
    const lastTime = getLastCompletionTime();
    if (!lastTime) return '';
    
    const now = Date.now();
    const nextAvailable = lastTime + (COOLDOWN_HOURS * 60 * 60 * 1000);
    const msRemaining = nextAvailable - now;
    
    if (msRemaining <= 0) return '';
    
    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((msRemaining % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const initializeGame = () => {
    setGameState('intro');
    setIsClaiming(false);
    setChallengeComplete(false);
    // Pick a random challenge
    const randomChallenge = STRENGTH_CHALLENGES[Math.floor(Math.random() * STRENGTH_CHALLENGES.length)];
    setCurrentChallenge(randomChallenge);
  };

  const startChallenge = () => {
    playClick();
    setGameState('challenge');
  };

  const completeChallenge = () => {
    playTab();
    setChallengeComplete(true);
    setTimeout(() => {
      playSuccess();
      setGameState('success');
    }, 500);
  };

  const handleClaim = () => {
    setIsClaiming(true);
    const coinReward = 25;
    addCoins(coinReward, `Strength Challenge - ${currentChallenge.title}`, 'game');
    
    // Store completion timestamp
    localStorage.setItem(getStorageKey(), Date.now().toString());
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const ChallengeIcon = currentChallenge.icon;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={gameState === 'success' && !isClaiming ? onClose : undefined}
      />

      {/* Flying Coins Animation */}
      {isClaiming && (
        <div className="fixed inset-0 pointer-events-none z-[150]">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-8 h-8 bg-[#FFD700] border-2 border-[#B8860B] rounded-full shadow-xl flex items-center justify-center text-[#B8860B] font-bold text-xs z-[150]"
              style={{
                top: '50%',
                left: '50%',
                animation: `flyCoin 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                animationDelay: `${i * 0.05}s`,
                '--scatter-x': `${(Math.random() - 0.5) * 300}px`,
                '--scatter-y': `${(Math.random() - 0.5) * 300}px`,
              } as React.CSSProperties}
            >
              $
            </div>
          ))}
        </div>
      )}

      {/* Main Card */}
      <div className={`
        relative w-full max-w-sm bg-gradient-to-b from-[#E65100] to-[#BF360C] rounded-3xl p-1 border-4 border-[#FF8A65] shadow-2xl 
        transition-all duration-500 transform overflow-hidden
        ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white/80 rounded-full p-1 transition-colors"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center pt-8 pb-8 px-6 text-center min-h-[460px]">
          
          <h2 className="font-display font-extrabold text-2xl text-white drop-shadow-md tracking-wide mb-4 uppercase flex items-center gap-2">
            <Dumbbell className="text-[#FFD700]" />
            {t('strengthBuilder') || 'Strength Builder'}
          </h2>

          {/* COOLDOWN SCREEN */}
          {gameState === 'cooldown' && (
            <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
              <div className="relative w-32 h-32 mb-6">
                <Clock size={80} className="text-[#FFCC80] animate-pulse" />
              </div>

              <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                <p className="text-white/90 font-bold text-lg mb-2">
                  {t('comeBackSoon') || 'Come Back Soon!'}
                </p>
                <p className="text-white/60 text-sm leading-relaxed mb-3">
                  {t('strengthChallengeCompleted') || "You've completed today's strength challenge!"}
                </p>
                <div className="text-[#FFCC80] font-display font-black text-3xl mb-2">
                  {timeUntilNext || '0s'}
                </div>
                <p className="text-white/50 text-xs">
                  {t('resetsEvery12Hours') || 'Resets every 12 hours'}
                </p>
              </div>

              <WoodButton onClick={onClose} variant="primary" className="px-10 py-4 text-xl">
                {(t('close') || 'CLOSE').toUpperCase()}
              </WoodButton>
            </div>
          )}

          {/* INTRO */}
          {gameState === 'intro' && (
            <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
              <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse" />
                <Dumbbell size={64} className="text-[#FFD700] relative z-10" strokeWidth={1.5} />
                <div className="absolute -top-2 right-0">
                  <Sparkles size={24} className="text-yellow-400 fill-yellow-400 animate-bounce" />
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                <p className="text-white/90 font-bold text-lg mb-1">
                  {t('buildYourFaith') || 'Build Your Faith!'}
                </p>
                <p className="text-white/60 text-sm leading-relaxed">
                  {t('strengthChallengeDesc') || 'Complete a faith-building challenge to grow stronger in God!'}
                </p>
              </div>

              <WoodButton onClick={startChallenge} variant="gold" className="px-10 py-4 text-xl shadow-lg">
                {(t('startChallenge') || 'START CHALLENGE').toUpperCase()}
              </WoodButton>
            </div>
          )}

          {/* CHALLENGE */}
          {gameState === 'challenge' && (
            <div className="flex flex-col items-center animate-in fade-in w-full flex-1">
              {/* Challenge Icon */}
              <div className={`w-20 h-20 ${currentChallenge.bgColor} rounded-full flex items-center justify-center mb-4 shadow-lg`}>
                <ChallengeIcon size={40} className="text-white" />
              </div>

              <h3 className="text-white font-display font-bold text-xl mb-4">
                {currentChallenge.title}
              </h3>

              {/* Scripture Card */}
              <div className="bg-white/95 rounded-xl p-4 mb-4 shadow-lg w-full">
                <p className="text-gray-800 text-sm italic leading-relaxed mb-2">
                  "{currentChallenge.scripture}"
                </p>
                <p className="text-[#E65100] font-bold text-xs">
                  — {currentChallenge.reference}
                </p>
              </div>

              {/* Affirmation */}
              <div className="bg-[#FFD700]/20 rounded-xl p-4 mb-4 w-full border-2 border-[#FFD700]/50">
                <p className="text-white font-bold text-lg mb-1">
                  🗣️ Say This:
                </p>
                <p className="text-[#FFD700] font-display font-bold text-xl">
                  "{currentChallenge.affirmation}"
                </p>
              </div>

              {/* Action */}
              <div className="bg-black/20 rounded-xl p-3 mb-6 w-full">
                <p className="text-white/90 font-bold text-sm flex items-center justify-center gap-2">
                  <ChevronRight size={16} className="text-[#FFD700]" />
                  {currentChallenge.action}
                </p>
              </div>

              {/* Complete Button */}
              <WoodButton 
                onClick={completeChallenge} 
                variant="gold" 
                className={`px-10 py-4 text-xl shadow-lg w-full ${challengeComplete ? 'opacity-50' : ''}`}
                disabled={challengeComplete}
              >
                {challengeComplete ? '✓ DONE!' : "I DID IT!"}
              </WoodButton>
            </div>
          )}

          {/* SUCCESS */}
          {gameState === 'success' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in duration-500">
              <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Dumbbell size={80} className="text-[#FFD700]" />
                </div>
                <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-2 border-2 border-white">
                  <Star size={20} fill="white" className="text-white" />
                </div>
              </div>

              <h3 className="font-display font-bold text-3xl text-white mb-1">
                {t('youAreStrong') || 'You Are Strong!'}
              </h3>
              <p className="text-white/70 font-sans font-bold mb-6">
                {t('faithGrowing') || 'Your faith is growing!'}
              </p>
              
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((star) => (
                  <div key={star} className="transform transition-all duration-500 scale-110">
                    <Star 
                      size={40} 
                      fill="#FFD700"
                      className="text-[#B8860B] drop-shadow-md"
                      strokeWidth={3}
                    />
                  </div>
                ))}
              </div>

              <div className="w-full px-8">
                <WoodButton variant="gold" fullWidth onClick={handleClaim} className="py-4 text-xl shadow-[0_0_20px_#FFD700]">
                  {t('claimCoins') || 'CLAIM'} 25 {(t('coins') || 'COINS').toUpperCase()}
                </WoodButton>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes flyCoin {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          20% { transform: translate(calc(-50% + var(--scatter-x)), calc(-50% + var(--scatter-y))) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + 200px), -600px) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default StrengthGameModal;



