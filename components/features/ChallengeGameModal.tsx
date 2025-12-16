
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { 
  X, Star, Brain, BookOpen, Fish, Flame, Crown, Anchor, Heart, Cross,
  Sun, Moon, Music, Shield, Gift, Key, Bird, Droplets, Mountain, Clock
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';

interface ChallengeGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameState = 'cooldown' | 'intro' | 'ready' | 'playing' | 'game-over' | 'success' | 'claimed';

const GAME_DURATION = 60; // 60 seconds for matching game
import { profileService } from '../../services/profileService';

const GAME_PAIRS_COUNT = 6;
const COOLDOWN_HOURS = 12; // 12 hours cooldown
const getStorageKey = () => profileService.getProfileKey('memory_game_last_completion');

// Expanded Pool of Biblical Symbols
const SYMBOL_POOL = [
    { id: 'bible', icon: BookOpen, color: 'text-[#795548]', label: 'Word' },
    { id: 'fish', icon: Fish, color: 'text-[#0288D1]', label: 'Faith' },
    { id: 'spirit', icon: Flame, color: 'text-[#FF5722]', label: 'Spirit' },
    { id: 'love', icon: Heart, color: 'text-[#E91E63]', label: 'Love' },
    { id: 'hope', icon: Anchor, color: 'text-[#1565C0]', label: 'Hope' },
    { id: 'glory', icon: Crown, color: 'text-[#FFB300]', label: 'Glory' },
    { id: 'light', icon: Sun, color: 'text-[#FDB813]', label: 'Light' },
    { id: 'creation', icon: Moon, color: 'text-[#90A4AE]', label: 'Creation' },
    { id: 'worship', icon: Music, color: 'text-[#9C27B0]', label: 'Worship' },
    { id: 'truth', icon: Shield, color: 'text-[#607D8B]', label: 'Truth' },
    { id: 'grace', icon: Gift, color: 'text-[#FF5252]', label: 'Grace' },
    { id: 'kingdom', icon: Key, color: 'text-[#FFD700]', label: 'Kingdom' },
    { id: 'peace', icon: Bird, color: 'text-[#81D4FA]', label: 'Peace' },
    { id: 'life', icon: Droplets, color: 'text-[#00BCD4]', label: 'Life' },
    { id: 'prayer', icon: Mountain, color: 'text-[#4CAF50]', label: 'Prayer' }
];

interface Card {
    id: number;
    symbolId: string;
    icon: React.FC<any>;
    color: string;
    label: string;
    isFlipped: boolean;
    isMatched: boolean;
}

const ChallengeGameModal: React.FC<ChallengeGameModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, playTab, playBack } = useAudio();
  const { t } = useLanguage();
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [isClaiming, setIsClaiming] = useState(false);
  
  // Game Logic
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchesFound, setMatchesFound] = useState(0);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [countDown, setCountDown] = useState<string>('');
  const [earnedStars, setEarnedStars] = useState(0);
  const [timeUntilNext, setTimeUntilNext] = useState<string>(''); // Cooldown timer

  const timerRef = useRef<number | null>(null);
  const flipTimeoutRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);

  // --- SETUP ---
  useEffect(() => {
    if (isOpen) {
      // Check if on cooldown
      if (isOnCooldown()) {
        setGameState('cooldown');
        // Update cooldown timer every second
        const updateCooldown = () => {
          const timeRemaining = getTimeUntilNext();
          setTimeUntilNext(timeRemaining);
          
          // If cooldown expired, allow play
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
      cleanup();
    }
    return cleanup;
  }, [isOpen]);

  const cleanup = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (flipTimeoutRef.current) window.clearTimeout(flipTimeoutRef.current);
      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
  };

  // Helper function to check if cooldown is active
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

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (gameState === 'playing') {
        timerRef.current = window.setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    cleanup();
                    setGameState('game-over');
                    playBack();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else {
        if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [gameState]);

  const initializeGame = () => {
      setGameState('intro');
      setIsClaiming(false);
      setTimeLeft(GAME_DURATION);
      setEarnedStars(0);
      setFlippedIndices([]);
      setMatchesFound(0);

      // 1. Shuffle the full pool
      const shuffledPool = [...SYMBOL_POOL].sort(() => Math.random() - 0.5);
      
      // 2. Select random subset of symbols for this round
      const selectedSymbols = shuffledPool.slice(0, GAME_PAIRS_COUNT);

      // 3. Create Pairs
      const deck = [...selectedSymbols, ...selectedSymbols].map((s, i) => ({
          ...s,
          id: i, // unique id for card instance
          symbolId: s.id,
          isFlipped: false,
          isMatched: false
      }));

      // 4. Shuffle Deck
      for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      setCards(deck);
  };

  const startCountdown = () => {
    playClick();
    setGameState('ready');
    setCountDown('READY');
    setTimeout(() => setCountDown('SET'), 1000);
    setTimeout(() => {
        setCountDown('GO!');
        setTimeout(() => {
             setGameState('playing');
        }, 1000);
    }, 2000);
  };

  const handleCardClick = (index: number) => {
      if (gameState !== 'playing') return;
      if (cards[index].isMatched || cards[index].isFlipped) return;
      if (flippedIndices.length >= 2) return; // Wait for reset

      playTab();

      // Flip the card
      const newCards = [...cards];
      newCards[index].isFlipped = true;
      setCards(newCards);

      const newFlipped = [...flippedIndices, index];
      setFlippedIndices(newFlipped);

      // Check Match
      if (newFlipped.length === 2) {
          const card1 = newCards[newFlipped[0]];
          const card2 = newCards[newFlipped[1]];

          if (card1.symbolId === card2.symbolId) {
              // Match!
              setTimeout(() => {
                 playSuccess(); // Small success for match
                 setCards(prev => prev.map(c => 
                    (c.id === card1.id || c.id === card2.id) ? { ...c, isMatched: true, isFlipped: true } : c
                 ));
                 setFlippedIndices([]);
                 setMatchesFound(prev => {
                     const newCount = prev + 1;
                     if (newCount === GAME_PAIRS_COUNT) {
                         handleWin();
                     }
                     return newCount;
                 });
              }, 300);
          } else {
              // No Match - wait then flip back
              flipTimeoutRef.current = window.setTimeout(() => {
                  setCards(prev => prev.map(c => 
                    (c.id === card1.id || c.id === card2.id) ? { ...c, isFlipped: false } : c
                  ));
                  setFlippedIndices([]);
              }, 1000);
          }
      }
  };

  const handleWin = () => {
      cleanup();
      // Stars based on time
      let stars = 1;
      if (timeLeft > 40) stars = 3;
      else if (timeLeft > 20) stars = 2;
      
      setEarnedStars(stars);
      
      setTimeout(() => {
        playSuccess();
        setGameState('success');
      }, 500);
  };

  const handleClaim = () => {
    setIsClaiming(true);
    // COIN REWARDS: 50/25/10
    const coinReward = earnedStars === 3 ? 50 : earnedStars === 2 ? 25 : 10;
    addCoins(coinReward, `Memory Challenge - ${earnedStars} ⭐`, 'game');
    
    // Store completion timestamp (per-profile)
    localStorage.setItem(getStorageKey(), Date.now().toString());
    
    setTimeout(() => {
        onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={gameState === 'success' && !isClaiming ? onClose : undefined}
      ></div>

      {/* FLYING COINS ANIMATION */}
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
         relative w-full max-w-sm bg-[#1a237e] rounded-3xl p-1 border-4 border-[#3949ab] shadow-2xl 
         transition-all duration-500 transform overflow-hidden
         ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
          {/* Texture Background */}
          <div className="absolute inset-0 rounded-[20px] bg-[#1a237e] overflow-hidden">
              <div className="absolute inset-0 opacity-30" 
                   style={{ backgroundImage: 'radial-gradient(circle at center, #3949ab 0%, transparent 60%)' }}>
              </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white/80 rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center pt-8 pb-8 px-6 text-center min-h-[460px]">
              
              <h2 className="font-display font-extrabold text-2xl text-white drop-shadow-md tracking-wide mb-4 uppercase">
                {t('divinePairs')}
              </h2>

              {/* COOLDOWN SCREEN */}
              {gameState === 'cooldown' && (
                  <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
                      
                      {/* Clock Icon */}
                      <div className="relative w-32 h-32 mb-6">
                          <Clock size={80} className="text-[#90caf9] animate-pulse" />
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                          <p className="text-white/90 font-bold text-lg mb-2">
                            {t('comeBackSoon')}
                          </p>
                          <p className="text-white/60 text-sm leading-relaxed mb-3">
                             {t('memoryChallengeCompleted')}
                          </p>
                          <div className="text-[#90caf9] font-display font-black text-3xl mb-2">
                            {timeUntilNext || '0s'}
                          </div>
                          <p className="text-white/50 text-xs">
                            {t('resetsEvery12Hours')}
                          </p>
                      </div>

                      <WoodButton onClick={onClose} variant="primary" className="px-10 py-4 text-xl bg-[#303f9f] hover:bg-[#3949ab]">
                          {t('close').toUpperCase()}
                      </WoodButton>
                  </div>
              )}

              {/* INTRO */}
              {gameState === 'intro' && (
                  <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
                      <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                           <div className="absolute inset-0 bg-white/10 rounded-full animate-pulse"></div>
                           <Brain size={64} className="text-[#90caf9] relative z-10" strokeWidth={1.5} />
                           <div className="absolute -top-2 right-0">
                               <Star size={24} className="text-yellow-400 fill-yellow-400 animate-bounce" />
                           </div>
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                          <p className="text-white/90 font-bold text-lg mb-1">{t('memoryChallenge')}</p>
                          <p className="text-white/60 text-sm leading-relaxed">
                             {t('flipCardsToMatch')} <br/>
                             {t('findThemQuickly')}
                          </p>
                      </div>

                      <WoodButton onClick={startCountdown} variant="primary" className="px-10 py-4 text-xl shadow-lg bg-[#303f9f] hover:bg-[#3949ab] border-[#1a237e]">
                          {t('startGame')} (60s)
                      </WoodButton>
                  </div>
              )}

               {/* READY SET GO */}
              {gameState === 'ready' && (
                   <div className="flex items-center justify-center flex-1 w-full h-full absolute inset-0 bg-black/40 backdrop-blur-sm z-50 rounded-[20px]">
                       <h1 className="font-display font-black text-6xl text-white animate-[ping_0.5s_ease-in-out] drop-shadow-md">
                           {countDown}
                       </h1>
                   </div>
              )}

              {/* PLAYING */}
              {gameState === 'playing' && (
                  <div className="flex flex-col w-full h-full flex-1">
                       <div className="flex justify-between items-center w-full mb-4 px-2">
                          <div className="text-white/80 text-sm font-bold font-sans">
                             {t('pairs')}: {matchesFound} / {GAME_PAIRS_COUNT}
                          </div>
                          <div className={`font-display font-black text-2xl drop-shadow-sm ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                             00:{timeLeft.toString().padStart(2, '0')}
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 w-full h-full">
                          {cards.map((card, i) => (
                              <div 
                                key={card.id}
                                onClick={() => handleCardClick(i)}
                                className="aspect-square perspective-1000 cursor-pointer"
                              >
                                  <div className={`relative w-full h-full transition-all duration-300 transform-style-3d ${card.isFlipped ? 'rotate-y-180' : ''}`}>
                                      
                                      {/* Front (Hidden) */}
                                      <div className="absolute inset-0 w-full h-full backface-hidden bg-[#283593] rounded-xl border-2 border-[#5c6bc0] shadow-md flex items-center justify-center group hover:brightness-110">
                                          {/* Cross Pattern */}
                                          <div className="opacity-20">
                                              <Cross size={40} className="text-white" />
                                          </div>
                                      </div>

                                      {/* Back (Shown) */}
                                      <div className={`absolute inset-0 w-full h-full backface-hidden bg-[#fff8e1] rounded-xl border-2 border-[#d7ccc8] shadow-md flex flex-col items-center justify-center rotate-y-180 ${card.isMatched ? 'bg-[#f0f4c3] border-[#cddc39]' : ''}`}>
                                           <card.icon size={36} className={card.color} strokeWidth={2.5} />
                                           {/* Optional Label for educational value */}
                                           <span className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${card.color.replace('text-', 'text-opacity-80 text-')}`}>
                                              {card.label}
                                           </span>
                                      </div>

                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

               {/* GAME OVER */}
              {gameState === 'game-over' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in">
                      <div className="text-6xl mb-4">⏳</div>
                      <h3 className="font-display font-bold text-2xl text-white mb-2">{t('timesUp')}</h3>
                      <p className="text-white/70 mb-6">{t('keepPracticing')}</p>
                      <WoodButton onClick={initializeGame} variant="primary" className="bg-[#303f9f] hover:bg-[#3949ab]">{t('tryAgain')}</WoodButton>
                  </div>
              )}

              {/* SUCCESS */}
              {gameState === 'success' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in duration-500">
                      <div className="relative w-32 h-32 mb-4">
                           <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                               <Brain size={80} className="text-[#90caf9]" />
                           </div>
                           <div className="absolute bottom-0 right-0 bg-green-500 rounded-full p-2 border-2 border-white">
                               <Star size={20} fill="white" className="text-white" />
                           </div>
                      </div>

                      <h3 className="font-display font-bold text-3xl text-white mb-1">{t('sharpMind')}</h3>
                      <p className="text-white/70 font-sans font-bold mb-6">{t('foundAllPairs')}</p>
                      
                      <div className="flex gap-2 mb-8">
                          {[1, 2, 3].map((star) => (
                              <div key={star} className={`transform transition-all duration-500 ${star <= earnedStars ? 'scale-110' : 'scale-90 opacity-30'}`}>
                                  <Star 
                                    size={40} 
                                    fill={star <= earnedStars ? "#FFD700" : "none"} 
                                    className={star <= earnedStars ? "text-[#B8860B] drop-shadow-md" : "text-gray-400"} 
                                    strokeWidth={3}
                                  />
                              </div>
                          ))}
                      </div>

                      <div className="w-full px-8">
                          <WoodButton variant="gold" fullWidth onClick={handleClaim} className="py-4 text-xl shadow-[0_0_20px_#FFD700]">
                              {t('claimCoins')} {earnedStars === 3 ? 50 : earnedStars === 2 ? 25 : 10} {t('coins').toUpperCase()}
                          </WoodButton>
                      </div>
                  </div>
              )}

          </div>
      </div>
      <style>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .perspective-1000 { perspective: 1000px; }
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

export default ChallengeGameModal;