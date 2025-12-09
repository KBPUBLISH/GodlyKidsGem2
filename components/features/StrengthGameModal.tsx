import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { 
  X, Star, Dumbbell, Zap, Music, RefreshCw, 
  ArrowUp, Heart, Activity, Timer, Trophy, FastForward
} from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';

interface StrengthGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GameState = 'intro' | 'ready' | 'playing' | 'intermission' | 'success' | 'claimed';

const GAME_DURATION = 30; // 30 seconds per round
const TOTAL_ROUNDS = 3;

// Daily Activities Pool
const ACTIVITIES = [
  { id: 'jacks', name: 'Jumping Jacks', icon: Activity, color: 'text-[#FFD700]', desc: 'Jump your feet apart and clap hands overhead!' },
  { id: 'run', name: 'Super Speed Run', icon: Zap, color: 'text-[#FF5722]', desc: 'Run in place as fast as you can!' },
  { id: 'dance', name: 'Crazy Dance', icon: Music, color: 'text-[#E91E63]', desc: 'Show us your best dance moves!' },
  { id: 'windmills', name: 'Arm Windmills', icon: RefreshCw, color: 'text-[#2196F3]', desc: 'Spin your arms in giant circles!' },
  { id: 'knees', name: 'High Knees', icon: ArrowUp, color: 'text-[#4CAF50]', desc: 'March lifting your knees up to your chest!' },
  { id: 'squats', name: 'Frog Jumps', icon: Dumbbell, color: 'text-[#8BC34A]', desc: 'Touch the floor and jump up like a frog!' },
  { id: 'stretch', name: 'Sky Reach', icon: Heart, color: 'text-[#03A9F4]', desc: 'Reach up to the sky, then touch your toes!' },
];

const StrengthGameModal: React.FC<StrengthGameModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, setGameMode, musicEnabled, toggleMusic } = useAudio();
  const { t } = useLanguage();
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [isClaiming, setIsClaiming] = useState(false);
  
  // Workout State
  const [workoutPlan, setWorkoutPlan] = useState<typeof ACTIVITIES>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [earnedStars, setEarnedStars] = useState(0);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [countDown, setCountDown] = useState<string>('');
  
  const timerRef = useRef<number | null>(null);

  // --- SETUP ---
  useEffect(() => {
    if (isOpen) {
      setGameMode(true, 'workout');
      initializeGame();
      
      // Try to start music immediately when modal opens (after a short delay to allow audio context to initialize)
      setTimeout(() => {
        // Trigger a user interaction event to unlock audio if needed
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          if (audio.dataset.needsPlay === 'true') {
            audio.play().catch(e => console.log('Music play attempt:', e));
          }
        });
      }, 100);
    } else {
      setGameMode(false);
      setGameState('intro');
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const initializeGame = () => {
      setGameState('intro');
      setIsClaiming(false);
      setTimeLeft(GAME_DURATION);
      setCurrentRound(1);
      setEarnedStars(0);
      
      // Pick 3 random unique activities
      const shuffled = [...ACTIVITIES].sort(() => 0.5 - Math.random());
      setWorkoutPlan(shuffled.slice(0, TOTAL_ROUNDS));
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (gameState === 'playing') {
        timerRef.current = window.setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) window.clearInterval(timerRef.current);
                    handleRoundComplete(false); // Completed successfully
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [gameState]);

  const startCountdown = () => {
    playClick();
    // Ensure workout music is playing when user starts
    setGameMode(true, 'workout');
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

  const handleRoundComplete = (skipped: boolean) => {
      // Increment stars only if not skipped
      if (!skipped) {
          setEarnedStars(prev => prev + 1);
          playSuccess();
      }
      
      if (currentRound < TOTAL_ROUNDS) {
          setGameState('intermission');
      } else {
          // All rounds done
          setGameState('success');
      }
  };

  const handleSkip = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      handleRoundComplete(true); // Skipped
  };

  const startNextRound = () => {
      setCurrentRound(prev => prev + 1);
      setTimeLeft(GAME_DURATION);
      startCountdown();
  };

  const stopEarly = () => {
      // User chooses to stop after 1 or 2 rounds
      setGameState('success');
  };

  const handleClaim = () => {
    setIsClaiming(true);
    // Reward based on stars: 50, 25, 10, or 5 for participation
    let reward = 5;
    if (earnedStars === 3) reward = 50;
    else if (earnedStars === 2) reward = 25;
    else if (earnedStars === 1) reward = 10;
    
    addCoins(reward, `Strength Challenge - ${earnedStars} ⭐`, 'game'); 
    setTimeout(() => {
        onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  // Current activity based on round (index is round - 1)
  const currentActivity = workoutPlan[currentRound - 1] || workoutPlan[0];
  const nextActivity = workoutPlan[currentRound] || null; // Next one in list (index = currentRound)
  const ActivityIcon = currentActivity ? currentActivity.icon : Activity;

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
         relative w-full max-w-sm bg-[#bf360c] rounded-3xl p-1 border-4 border-[#e64a19] shadow-2xl 
         transition-all duration-500 transform overflow-hidden
         ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
          {/* Texture Background */}
          <div className="absolute inset-0 rounded-[20px] bg-[#bf360c] overflow-hidden">
              <div className="absolute inset-0 opacity-20" 
                   style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #e64a19 0px, #e64a19 10px, #bf360c 10px, #bf360c 20px)' }}>
              </div>
          </div>

          {/* Music Toggle Button */}
          <button 
            onClick={() => {
              playClick();
              toggleMusic();
            }}
            className="absolute top-4 right-14 z-20 bg-black/20 hover:bg-black/40 text-white/80 rounded-full p-2 transition-colors"
            title={musicEnabled ? "Music On" : "Music Off"}
          >
            <Music size={20} className={musicEnabled ? "text-[#FFD700]" : "text-white/50"} fill={musicEnabled ? "#FFD700" : "none"} />
          </button>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white/80 rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center pt-8 pb-8 px-6 text-center min-h-[460px]">
              
              <h2 className="font-display font-extrabold text-2xl text-white drop-shadow-md tracking-wide mb-2 uppercase flex items-center gap-2">
                 Daily Strength
              </h2>
              
              {/* Progress Dots */}
              {gameState !== 'success' && gameState !== 'intro' && (
                  <div className="flex gap-2 mb-4">
                      {[1, 2, 3].map(r => (
                          <div key={r} className={`w-3 h-3 rounded-full border border-white/50 ${r < currentRound ? (earnedStars >= r ? 'bg-[#FFD700]' : 'bg-red-500') : r === currentRound ? 'bg-white animate-pulse' : 'bg-black/30'}`}></div>
                      ))}
                  </div>
              )}

              {/* --- INTRO --- */}
              {gameState === 'intro' && currentActivity && (
                  <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
                      <div className="relative w-32 h-32 mb-6 flex items-center justify-center bg-white/10 rounded-full border-4 border-white/20 shadow-inner">
                           <ActivityIcon size={64} className="text-white relative z-10" />
                           <div className="absolute -bottom-2 -right-2 bg-[#FFD700] rounded-full p-2 border-2 border-[#e64a19] shadow-lg">
                               <Dumbbell size={20} className="text-[#e64a19]" />
                           </div>
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10 w-full">
                          <div className="text-white/60 text-xs font-bold uppercase mb-1">Round 1 of 3</div>
                          <p className="text-[#FFD700] font-bold text-xl mb-2 uppercase tracking-wide">{currentActivity.name}</p>
                          <p className="text-white/90 text-sm leading-relaxed font-medium">
                             {currentActivity.desc}
                          </p>
                      </div>
                      
                      <div className="text-white/70 text-xs font-bold mb-4 bg-black/20 px-3 py-1 rounded-full">
                          Complete 3 rounds for max reward!
                      </div>

                      <WoodButton 
                        onClick={() => {
                          // Force music to start on user click (user interaction unlocks audio)
                          setGameMode(true, 'workout');
                          startCountdown();
                        }} 
                        variant="primary" 
                        className="px-10 py-4 text-xl shadow-lg bg-[#d84315] hover:bg-[#e64a19] border-[#bf360c]"
                      >
                          START WORKOUT
                      </WoodButton>
                  </div>
              )}

               {/* --- READY COUNTDOWN --- */}
              {gameState === 'ready' && (
                   <div className="flex items-center justify-center flex-1 w-full h-full absolute inset-0 bg-black/40 backdrop-blur-sm z-50 rounded-[20px]">
                       <h1 className="font-display font-black text-6xl text-[#FFD700] animate-[ping_0.5s_ease-in-out] drop-shadow-md">
                           {countDown}
                       </h1>
                   </div>
              )}

              {/* --- PLAYING --- */}
              {gameState === 'playing' && currentActivity && (
                  <div className="flex flex-col w-full h-full flex-1 items-center justify-center relative">
                      
                      {/* Skip Button */}
                      <button 
                        onClick={handleSkip}
                        className="absolute top-0 left-0 flex items-center gap-1 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider bg-black/20 px-3 py-1.5 rounded-full transition-all active:scale-95 hover:bg-black/30"
                      >
                          Skip <FastForward size={12} fill="currentColor" />
                      </button>

                      {/* Large Animated Icon */}
                      <div className="mb-6 animate-bounce duration-[1000ms] mt-8">
                          <ActivityIcon size={100} className="text-white drop-shadow-lg" />
                      </div>

                      <div className="text-white/60 text-xs font-bold uppercase mb-1">Round {currentRound}</div>
                      <h3 className="text-[#FFD700] font-display font-bold text-2xl mb-4 uppercase tracking-wide animate-pulse">
                          {currentActivity.name}
                      </h3>

                      {/* Timer Bar */}
                      <div className="w-full bg-black/30 rounded-full h-6 mb-6 p-1 border border-white/20">
                          <div 
                             className="h-full bg-[#FFD700] rounded-full transition-all duration-1000 ease-linear"
                             style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
                          ></div>
                      </div>

                      <div className="flex items-center gap-3 bg-black/20 px-6 py-2 rounded-xl backdrop-blur-sm">
                          <Timer size={24} className="text-white/70" />
                          <span className="font-display font-black text-4xl text-white">
                             00:{timeLeft.toString().padStart(2, '0')}
                          </span>
                      </div>

                      <p className="text-white/60 font-bold mt-6 animate-pulse">Move your body!</p>
                  </div>
              )}

              {/* --- INTERMISSION --- */}
              {gameState === 'intermission' && nextActivity && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in">
                      
                      {/* Stars So Far */}
                      <div className="flex gap-2 mb-4">
                          {[1, 2, 3].map(s => (
                             <Star key={s} size={32} fill={s <= earnedStars ? "#FFD700" : "none"} className={s <= earnedStars ? "text-[#d84315]" : "text-white/20"} />
                          ))}
                      </div>
                      
                      <h3 className="font-display font-bold text-2xl text-white mb-1">
                          {earnedStars === currentRound ? "GREAT JOB!" : "ROUND SKIPPED"}
                      </h3>
                      <p className="text-white/80 font-sans text-sm mb-6">
                          {earnedStars === currentRound ? "Take a breath. You earned a star!" : "No star for that one, but keep going!"}
                      </p>

                      {/* Next Up Card */}
                      <div className="bg-white/10 rounded-xl p-4 mb-6 w-full border border-white/10 flex items-center gap-4 text-left">
                           <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center shrink-0">
                               <nextActivity.icon size={24} className="text-[#FFD700]" />
                           </div>
                           <div>
                               <div className="text-white/50 text-[10px] font-bold uppercase">Up Next: Round {currentRound + 1}</div>
                               <div className="text-white font-bold leading-tight">{nextActivity.name}</div>
                           </div>
                      </div>

                      <div className="w-full space-y-3">
                          <WoodButton onClick={startNextRound} variant="primary" fullWidth className="py-3 text-lg shadow-lg bg-[#d84315] hover:bg-[#e64a19]">
                             START ROUND {currentRound + 1}
                          </WoodButton>
                          
                          <button 
                            onClick={stopEarly}
                            className="text-white/60 text-xs font-bold underline hover:text-white py-2"
                          >
                             Stop & Claim {earnedStars} Star{earnedStars !== 1 ? 's' : ''}
                          </button>
                      </div>
                  </div>
              )}

              {/* --- SUCCESS / VICTORY --- */}
              {gameState === 'success' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in duration-500">
                      <div className="relative w-32 h-32 mb-4">
                           <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                               <Trophy size={80} className="text-[#FFD700] drop-shadow-lg" />
                           </div>
                      </div>

                      <h3 className="font-display font-bold text-3xl text-white mb-1">WORKOUT COMPLETE!</h3>
                      <p className="text-white/80 font-sans font-bold mb-6">
                          {earnedStars === 3 ? "Full Power! Incredible effort!" : earnedStars > 0 ? "Good hustle today!" : "Nice try! Keep moving!"}
                      </p>
                      
                      <div className="flex gap-2 mb-8">
                          {[1, 2, 3].map(s => (
                              <div key={s} className={`transform transition-all duration-500 ${s <= earnedStars ? 'scale-110' : 'scale-90 opacity-30'}`}>
                                  <Star 
                                    size={40} 
                                    fill={s <= earnedStars ? "#FFD700" : "none"} 
                                    className={s <= earnedStars ? "text-[#d84315] drop-shadow-md" : "text-gray-400"} 
                                    strokeWidth={2}
                                  />
                              </div>
                          ))}
                      </div>

                      <div className="w-full px-8">
                          <WoodButton variant="gold" fullWidth onClick={handleClaim} className="py-4 text-xl shadow-[0_0_20px_#FFD700]">
                              CLAIM {earnedStars === 3 ? 50 : earnedStars === 2 ? 25 : earnedStars === 1 ? 10 : 5} COINS
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
