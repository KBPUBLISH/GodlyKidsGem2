import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WoodButton from '../ui/WoodButton';
import { X, Star, Key, Clock } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useAudio } from '../../context/AudioContext';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// --- DATA ---
// Each verse has 6-15 words for the fill-in-the-blank game
const DAILY_VERSES = [
  { text: "I am with you always to the very end", ref: "Matthew 28:20" }, // 10 words
  { text: "Love one another as I have loved you", ref: "John 13:34" }, // 8 words
  { text: "Be strong and courageous do not be afraid", ref: "Joshua 1:9" }, // 8 words
  { text: "Trust in the Lord with all your heart", ref: "Proverbs 3:5" }, // 8 words
  { text: "The Lord is my shepherd I shall not want", ref: "Psalm 23:1" }, // 10 words
  { text: "Let your light shine before others for good", ref: "Matthew 5:16" }, // 8 words
  { text: "God is love and whoever abides in love abides in God", ref: "1 John 4:8" }, // 12 words
  { text: "Rejoice in the Lord always and again I say rejoice", ref: "Phil 4:4" }, // 10 words
  { text: "For God so loved the world that he gave", ref: "John 3:16" }, // 9 words
  { text: "I can do all things through Christ who strengthens me", ref: "Phil 4:13" }, // 10 words
  { text: "The joy of the Lord is your strength today", ref: "Neh 8:10" }, // 9 words
  { text: "Be kind to one another tenderhearted forgiving each other", ref: "Eph 4:32" }, // 9 words
  { text: "Cast all your anxiety on him because he cares for you", ref: "1 Peter 5:7" }, // 11 words
  { text: "Create in me a clean heart O God and renew", ref: "Psalm 51:10" }, // 10 words
  { text: "Children obey your parents in the Lord for this is right", ref: "Eph 6:1" }, // 11 words
  { text: "Give thanks to the Lord for he is good", ref: "Psalm 107:1" }, // 9 words
];

type GameState = 'cooldown' | 'intro' | 'ready' | 'playing' | 'game-over' | 'success' | 'claimed';

import { profileService } from '../../services/profileService';

const GAME_DURATION = 30; // 30 seconds
const COOLDOWN_HOURS = 12; // 12 hours cooldown
const getStorageKey = () => profileService.getProfileKey('daily_verse_last_completion');

const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ isOpen, onClose }) => {
  const { addCoins } = useUser();
  const { playClick, playSuccess, playTab, playBack } = useAudio();
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [shakeItem, setShakeItem] = useState<number | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  
  // Game Logic State
  const [verseIndex, setVerseIndex] = useState(0);
  const [wordChunks, setWordChunks] = useState<{id: number, text: string, isPlaced: boolean}[]>([]);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [nextTargetIndex, setNextTargetIndex] = useState(0);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [countDown, setCountDown] = useState<string>(''); // For "Ready Set Go"
  const [earnedStars, setEarnedStars] = useState(0);
  const [timeUntilNext, setTimeUntilNext] = useState<string>(''); // Cooldown timer

  // Keep track of interval to clear it properly
  const timerRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);

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
      setGameState('intro'); // Reset on close
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    }
    
    return () => {
       if (timerRef.current) window.clearInterval(timerRef.current);
       if (cooldownTimerRef.current) window.clearInterval(cooldownTimerRef.current);
    };
  }, [isOpen]);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (gameState === 'playing') {
        timerRef.current = window.setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) window.clearInterval(timerRef.current);
                    setGameState('game-over');
                    playBack(); // Sad sound
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
      setNextTargetIndex(0);
      setTimeLeft(GAME_DURATION);
      setEarnedStars(0);
      
      // Pick random verse
      const idx = Math.floor(Math.random() * DAILY_VERSES.length);
      setVerseIndex(idx);
      
      // Split into words/chunks
      const rawText = DAILY_VERSES[idx].text;
      const chunks = rawText.split(' ').map((text, i) => ({
        id: i,
        text,
        isPlaced: false
      }));
      
      setWordChunks(chunks);
      
      // Create shuffled indices properly
      const indices = chunks.map((_, i) => i);
      // Fisher-Yates Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setShuffledIndices(indices);
  };

  const currentVerse = DAILY_VERSES[verseIndex];

  // --- GAME FLOW HANDLERS ---

  const startCountdown = () => {
    playClick();
    setGameState('ready');
    
    // Sequence: Ready -> Set -> GO!
    setCountDown('READY');
    
    setTimeout(() => setCountDown('SET'), 1000);
    setTimeout(() => {
        setCountDown('GO!');
        // Start Actual Game after GO
        setTimeout(() => {
             setGameState('playing');
        }, 1000);
    }, 2000);
  };

  const handleRestart = () => {
      playClick();
      initializeGame(); // Reset everything to intro
  };

  const handleWordClick = (chunkId: number) => {
     if (gameState !== 'playing') return;

     // If clicking the correct next word
     if (chunkId === nextTargetIndex) {
        playTab();
        
        // Mark as placed using immutable update to ensure React re-renders
        setWordChunks(prev => prev.map(chunk => 
            chunk.id === chunkId ? { ...chunk, isPlaced: true } : chunk
        ));
        
        const newNext = nextTargetIndex + 1;
        setNextTargetIndex(newNext);

        // Check Win (Use wordChunks.length from state reference in closure)
        if (newNext >= wordChunks.length) {
            handleWin();
        }
     } else {
         // Wrong word
         setShakeItem(chunkId);
         setTimeout(() => setShakeItem(null), 500);
     }
  };

  const handleWin = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      
      // Calculate Stars based on time left
      let stars = 1;
      if (timeLeft > 20) stars = 3;
      else if (timeLeft > 10) stars = 2;
      
      setEarnedStars(stars);
      
      setTimeout(() => {
        playSuccess();
        setGameState('success');
      }, 500);
  };

  const handleClaim = () => {
    setIsClaiming(true);
    // UPDATED COIN REWARDS: 50/25/10
    const coinReward = earnedStars === 3 ? 50 : earnedStars === 2 ? 25 : 10;
    addCoins(coinReward, `Daily Verse - ${earnedStars} ⭐`, 'daily');
    
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

      {/* FLYING COINS ANIMATION OVERLAY */}
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
         relative w-full max-w-sm bg-[#3E1F07] rounded-3xl p-1 border-4 border-[#8B4513] shadow-2xl 
         transition-all duration-500 transform overflow-hidden
         ${isClaiming ? 'scale-90 opacity-0 duration-700' : 'animate-in zoom-in-95 slide-in-from-bottom-10'}
      `}>
          
          {/* Wood Texture Background */}
          <div className="absolute inset-0 rounded-[20px] bg-[#8B4513] overflow-hidden">
              <div className="absolute inset-0 opacity-20" 
                   style={{ backgroundImage: 'repeating-linear-gradient(45deg, #3E1F07 0px, #3E1F07 20px, #5c2e0b 20px, #5c2e0b 40px)' }}>
              </div>
              
              {/* Light Burst Effect (Behind Chest) */}
              <div className={`
                  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] 
                  bg-gradient-to-r from-transparent via-[#FFD700]/30 to-transparent
                  transition-opacity duration-1000
                  ${gameState === 'success' ? 'opacity-100 animate-[spin_10s_linear_infinite]' : 'opacity-0'}
              `} style={{clipPath: 'polygon(50% 50%, 0 0, 100% 0, 50% 50%, 100% 100%, 0 100%)'}}></div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-[#eecaa0] rounded-full p-1 transition-colors"
          >
            <X size={24} />
          </button>

          {/* Content Container */}
          <div className="relative z-10 flex flex-col items-center pt-8 pb-8 px-6 text-center min-h-[420px]">
              
              <h2 className="font-display font-extrabold text-2xl text-[#FFD700] drop-shadow-md tracking-wide mb-4 uppercase">
                Key of Truth
              </h2>

              {/* --- PHASE 0: COOLDOWN SCREEN --- */}
              {gameState === 'cooldown' && (
                  <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
                      
                      {/* Clock Icon */}
                      <div className="relative w-32 h-32 mb-6">
                          <Clock size={80} className="text-[#FFD700] animate-pulse" />
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-[#eecaa0]/20">
                          <p className="text-[#eecaa0] font-bold text-lg mb-2">
                            Come Back Soon!
                          </p>
                          <p className="text-white/70 text-sm leading-relaxed mb-3">
                             You've already completed today's verse. The next challenge will be available in:
                          </p>
                          <div className="text-[#FFD700] font-display font-black text-3xl mb-2">
                            {timeUntilNext || '0s'}
                          </div>
                          <p className="text-white/60 text-xs">
                            (Resets every 12 hours)
                          </p>
                      </div>

                      <WoodButton onClick={onClose} className="px-10 py-4 text-xl">
                          CLOSE
                      </WoodButton>
                  </div>
              )}

              {/* --- PHASE 1: INTRO SCREEN --- */}
              {gameState === 'intro' && (
                  <div className="flex flex-col items-center animate-in fade-in w-full flex-1 justify-center">
                      
                      {/* Locked Chest Icon */}
                      <div className="relative w-32 h-32 mb-6 animate-bounce-slow">
                          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl filter contrast-125">
                            <path d="M30,80 L170,80 L165,130 L35,130 Z" fill="#2a1201" />
                            <path d="M20,80 L180,80 L160,20 Q100,10 40,20 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                            <rect x="20" y="80" width="160" height="10" fill="#5c2e0b" />
                            <path d="M20,80 L180,80 L175,150 Q100,165 25,150 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                            {/* Lock Shackle */}
                            <path d="M85,70 L85,60 Q85,45 100,45 Q115,45 115,60 L115,70" fill="none" stroke="#FFD700" strokeWidth="6" />
                            {/* Lock Body */}
                            <rect x="80" y="70" width="40" height="30" rx="4" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
                            <circle cx="100" cy="85" r="4" fill="#3E1F07" />
                          </svg>
                      </div>

                      <div className="bg-black/20 rounded-xl p-4 mb-6 backdrop-blur-sm border border-[#eecaa0]/20">
                          <p className="text-[#eecaa0] font-bold text-lg mb-1 flex items-center justify-center gap-2">
                            <Key size={18} /> Verse Builder
                          </p>
                          <p className="text-white/70 text-sm leading-relaxed">
                             Tap the floating words in order to build the Key of Truth and unlock the chest!
                          </p>
                      </div>

                      <WoodButton onClick={startCountdown} className="px-10 py-4 text-xl shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                          START (30s)
                      </WoodButton>
                  </div>
              )}

              {/* --- PHASE 2: READY SET GO --- */}
              {gameState === 'ready' && (
                   <div className="flex items-center justify-center flex-1 w-full h-full absolute inset-0 bg-black/40 backdrop-blur-sm z-50 rounded-[20px]">
                       <h1 className="font-display font-black text-6xl text-[#FFD700] animate-[ping_0.5s_ease-in-out] drop-shadow-[0_4px_0_#B8860B]">
                           {countDown}
                       </h1>
                   </div>
              )}

              {/* --- PHASE 3: PLAYING --- */}
              {gameState === 'playing' && (
                  <div className="flex flex-col w-full h-full flex-1">
                      {/* HUD */}
                      <div className="flex justify-between items-center w-full mb-6 px-2">
                          <div className="bg-black/30 px-3 py-1 rounded-full border border-white/10 text-white text-sm font-bold font-sans">
                             {currentVerse.ref}
                          </div>
                          <div className={`font-display font-black text-2xl drop-shadow-sm ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-[#FFD700]'}`}>
                             00:{timeLeft.toString().padStart(2, '0')}
                          </div>
                      </div>

                      {/* Slots (Target) */}
                      <div className="flex flex-wrap gap-2 justify-center mb-8 min-h-[60px]">
                          {wordChunks.map((chunk, i) => (
                              <div 
                                key={`slot-${i}`}
                                className={`
                                    h-10 px-3 rounded-lg border-2 flex items-center justify-center font-bold text-sm font-sans transition-all duration-300
                                    ${chunk.isPlaced 
                                        ? 'bg-[#FFD700] border-[#B8860B] text-[#3E1F07] shadow-md scale-100' 
                                        : 'bg-black/20 border-white/10 border-dashed text-transparent scale-95'}
                                `}
                              >
                                  {chunk.text}
                              </div>
                          ))}
                      </div>

                      {/* Word Bank (Sources) */}
                      <div className="flex flex-wrap gap-3 justify-center mt-auto mb-4 content-start min-h-[120px]">
                          {shuffledIndices.map((idx) => {
                              const chunk = wordChunks[idx];
                              if (chunk.isPlaced) return <div key={`word-${idx}`} className="w-16 h-10"></div>; // Placeholder to keep layout stable-ish
                              
                              return (
                                  <button
                                      key={`word-${idx}`}
                                      onClick={() => handleWordClick(idx)}
                                      className={`
                                          bg-[#f3e5ab] border-b-4 border-[#d4a373] text-[#5c2e0b] font-bold font-sans px-4 py-2 rounded-xl shadow-lg
                                          active:border-b-0 active:translate-y-1 transition-all
                                          ${shakeItem === idx ? 'animate-[shake_0.4s_ease-in-out] bg-red-100 border-red-300' : ''}
                                      `}
                                  >
                                      {chunk.text}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}

              {/* --- PHASE 4: GAME OVER --- */}
              {gameState === 'game-over' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in">
                      <div className="text-6xl mb-4">😢</div>
                      <h3 className="font-display font-bold text-2xl text-white mb-2">Time's Up!</h3>
                      <p className="text-[#eecaa0] mb-6">You were so close to unlocking the truth.</p>
                      <WoodButton onClick={handleRestart}>TRY AGAIN</WoodButton>
                  </div>
              )}

              {/* --- PHASE 5: SUCCESS / CLAIM --- */}
              {gameState === 'success' && (
                  <div className="flex flex-col items-center justify-center flex-1 w-full animate-in zoom-in duration-500">
                      
                      {/* Open Chest Animation */}
                       <div className="relative w-32 h-32 mb-6">
                          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl filter contrast-125">
                             {/* Lid Open */}
                             <g className="origin-bottom transition-transform duration-1000 -translate-y-4 -rotate-12">
                                <path d="M20,80 L180,80 L160,20 Q100,10 40,20 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="2" />
                                <path d="M85,60 L115,60 L115,70 L85,70 Z" fill="#FFD700" />
                             </g>
                             {/* Chest Body */}
                             <path d="M30,80 L170,80 L165,130 L35,130 Z" fill="#2a1201" /> 
                             <path d="M20,80 L180,80 L175,150 Q100,165 25,150 Z" fill="#8B4513" stroke="#3E1F07" strokeWidth="3" />
                             {/* Coins overflowing */}
                             <circle cx="60" cy="90" r="10" fill="#FFD700" stroke="#B8860B" />
                             <circle cx="80" cy="85" r="12" fill="#FFD700" stroke="#B8860B" />
                             <circle cx="100" cy="90" r="10" fill="#FFD700" stroke="#B8860B" />
                             <circle cx="120" cy="85" r="11" fill="#FFD700" stroke="#B8860B" />
                             <circle cx="140" cy="92" r="9" fill="#FFD700" stroke="#B8860B" />
                          </svg>
                      </div>

                      <h3 className="font-display font-bold text-3xl text-[#FFD700] mb-1 drop-shadow-sm">CHEST UNLOCKED!</h3>
                      <p className="text-white/80 font-sans font-bold mb-6">{currentVerse.ref}</p>
                      
                      {/* Star Rating */}
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
                              CLAIM {earnedStars === 3 ? 50 : earnedStars === 2 ? 25 : 10} COINS
                          </WoodButton>
                      </div>
                  </div>
              )}

          </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
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

export default DailyRewardModal;
