import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Sparkles, Star, RotateCcw, Check } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

interface DailyVerseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Collection of kid-friendly Bible verses (short enough for puzzle game)
const DAILY_VERSES = [
  { text: "I am with you always", ref: "Matthew 28:20", theme: "God's Presence" },
  { text: "Love one another as I have loved you", ref: "John 13:34", theme: "Love" },
  { text: "Be strong and courageous do not be afraid", ref: "Joshua 1:9", theme: "Courage" },
  { text: "Trust in the Lord with all your heart", ref: "Proverbs 3:5", theme: "Trust" },
  { text: "The Lord is my shepherd I shall not want", ref: "Psalm 23:1", theme: "God's Care" },
  { text: "Let your light shine before others", ref: "Matthew 5:16", theme: "Being a Light" },
  { text: "God is love", ref: "1 John 4:8", theme: "God's Love" },
  { text: "Rejoice in the Lord always", ref: "Philippians 4:4", theme: "Joy" },
  { text: "For God so loved the world", ref: "John 3:16", theme: "Salvation" },
  { text: "I can do all things through Christ", ref: "Philippians 4:13", theme: "Strength" },
  { text: "The joy of the Lord is your strength", ref: "Nehemiah 8:10", theme: "Joy" },
  { text: "Be kind to one another", ref: "Ephesians 4:32", theme: "Kindness" },
  { text: "Cast all your worries on him", ref: "1 Peter 5:7", theme: "Trust" },
  { text: "Give thanks to the Lord for he is good", ref: "Psalm 107:1", theme: "Gratitude" },
  { text: "The Lord is my light and my salvation", ref: "Psalm 27:1", theme: "Light" },
  { text: "Do to others as you would have them do", ref: "Luke 6:31", theme: "Golden Rule" },
  { text: "Jesus loves the little children", ref: "Matthew 19:14", theme: "Jesus' Love" },
  { text: "Create in me a clean heart O God", ref: "Psalm 51:10", theme: "Purity" },
  { text: "This is the day the Lord has made", ref: "Psalm 118:24", theme: "Gratitude" },
  { text: "God will never leave you nor forsake you", ref: "Hebrews 13:5", theme: "Faithfulness" },
];

type GameState = 'intro' | 'playing' | 'success';

// Get verse based on day of year
const getDailyVerse = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
};

const DailyVerseModal: React.FC<DailyVerseModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { playClick, playSuccess, playTab, playBack } = useAudio();
  
  const [gameState, setGameState] = useState<GameState>('intro');
  const [verse, setVerse] = useState(getDailyVerse());
  const [wordChunks, setWordChunks] = useState<{id: number, text: string, isPlaced: boolean}[]>([]);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [nextTargetIndex, setNextTargetIndex] = useState(0);
  const [shakeItem, setShakeItem] = useState<number | null>(null);
  const [earnedStars, setEarnedStars] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (isOpen) {
      initializeGame();
    } else {
      setGameState('intro');
    }
  }, [isOpen]);

  const initializeGame = () => {
    const dailyVerse = getDailyVerse();
    setVerse(dailyVerse);
    setGameState('intro');
    setNextTargetIndex(0);
    setMistakes(0);
    setEarnedStars(0);
    setShowSparkles(false);
    
    // Split into words
    const chunks = dailyVerse.text.split(' ').map((text, i) => ({
      id: i,
      text,
      isPlaced: false
    }));
    
    setWordChunks(chunks);
    
    // Shuffle the indices
    const indices = chunks.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  };

  const startGame = () => {
    playClick?.();
    setGameState('playing');
  };

  const handleWordClick = (chunkId: number) => {
    if (gameState !== 'playing') return;

    if (chunkId === nextTargetIndex) {
      // Correct word!
      playTab?.();
      
      setWordChunks(prev => prev.map(chunk => 
        chunk.id === chunkId ? { ...chunk, isPlaced: true } : chunk
      ));
      
      const newNext = nextTargetIndex + 1;
      setNextTargetIndex(newNext);

      // Check if complete
      if (newNext >= wordChunks.length) {
        handleWin();
      }
    } else {
      // Wrong word
      playBack?.();
      setMistakes(prev => prev + 1);
      setShakeItem(chunkId);
      setTimeout(() => setShakeItem(null), 500);
    }
  };

  const handleWin = () => {
    // Calculate stars based on mistakes
    let stars = 3;
    if (mistakes > 3) stars = 1;
    else if (mistakes > 1) stars = 2;
    
    setEarnedStars(stars);
    setShowSparkles(true);
    
    setTimeout(() => {
      playSuccess?.();
      setGameState('success');
    }, 300);
  };

  const handleContinue = () => {
    playClick?.();
    onComplete();
  };

  const handleRestart = () => {
    playClick?.();
    initializeGame();
    setTimeout(() => setGameState('playing'), 100);
  };

  if (!isOpen) return null;

  // Get placed words for the "sentence being built" area
  const placedWords = wordChunks.filter(w => w.isPlaced).sort((a, b) => a.id - b.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Sparkles animation on win */}
      {showSparkles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[60]">
          {[...Array(20)].map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-yellow-400"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `sparkle 1s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                width: `${Math.random() * 20 + 16}px`,
              }}
            />
          ))}
        </div>
      )}

      <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] rounded-3xl w-full max-w-md shadow-2xl border-4 border-[#e94560]/30 overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#e94560] to-[#ff6b6b] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-display font-bold text-lg">
                Scripture Puzzle
              </h2>
              <p className="text-white/70 text-xs">{verse.theme}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* INTRO STATE */}
          {gameState === 'intro' && (
            <div className="text-center py-6">
              <div className="text-6xl mb-4">📖</div>
              <h3 className="text-white font-bold text-xl mb-2">Today's Verse</h3>
              <p className="text-white/60 text-sm mb-6">
                Tap the words in the correct order to build the verse!
              </p>
              
              {/* Preview the verse reference */}
              <div className="bg-[#0f3460]/50 rounded-xl p-4 mb-6">
                <p className="text-[#ff6b6b] font-medium">{verse.ref}</p>
              </div>
              
              <button
                onClick={startGame}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Start Puzzle! 🧩
              </button>
            </div>
          )}

          {/* PLAYING STATE */}
          {gameState === 'playing' && (
            <>
              {/* Sentence being built */}
              <div className="bg-[#0f3460]/50 rounded-xl p-4 mb-4 min-h-[80px]">
                <p className="text-white/40 text-xs mb-2 uppercase tracking-wide">Building verse...</p>
                <div className="flex flex-wrap gap-2">
                  {placedWords.map((word) => (
                    <span
                      key={word.id}
                      className="bg-[#e94560] text-white px-3 py-1.5 rounded-lg font-medium text-sm animate-in fade-in zoom-in duration-200"
                    >
                      {word.text}
                    </span>
                  ))}
                  {placedWords.length < wordChunks.length && (
                    <span className="text-white/30 px-3 py-1.5">...</span>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-white/50 text-xs">
                  {nextTargetIndex} / {wordChunks.length} words
                </p>
                {mistakes > 0 && (
                  <p className="text-red-400/70 text-xs">
                    {mistakes} mistake{mistakes !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Word choices */}
              <div className="flex flex-wrap gap-2 justify-center">
                {shuffledIndices.map((idx) => {
                  const chunk = wordChunks[idx];
                  if (chunk.isPlaced) return null;
                  
                  return (
                    <button
                      key={chunk.id}
                      onClick={() => handleWordClick(chunk.id)}
                      className={`
                        px-4 py-2.5 rounded-xl font-medium text-base
                        bg-gradient-to-b from-[#2a2a4a] to-[#1a1a3a]
                        border-2 border-[#3a3a5a] text-white
                        hover:border-[#e94560] hover:scale-105
                        active:scale-95 transition-all duration-150
                        ${shakeItem === chunk.id ? 'animate-shake border-red-500 bg-red-500/20' : ''}
                      `}
                    >
                      {chunk.text}
                    </button>
                  );
                })}
              </div>

              {/* Restart button */}
              <button
                onClick={handleRestart}
                className="mt-6 mx-auto flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
            </>
          )}

          {/* SUCCESS STATE */}
          {gameState === 'success' && (
            <div className="text-center py-4">
              {/* Stars */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={`w-10 h-10 transition-all duration-300 ${
                      star <= earnedStars
                        ? 'text-yellow-400 fill-yellow-400 scale-110'
                        : 'text-gray-600'
                    }`}
                    style={{
                      animationDelay: `${star * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              
              <h3 className="text-white font-bold text-xl mb-2">
                {earnedStars === 3 ? 'Perfect!' : earnedStars === 2 ? 'Great Job!' : 'Well Done!'}
              </h3>
              
              {/* Show completed verse */}
              <div className="bg-[#0f3460]/50 rounded-xl p-4 mb-4">
                <p className="text-white font-medium mb-2">"{verse.text}"</p>
                <p className="text-[#ff6b6b] text-sm">{verse.ref}</p>
              </div>
              
              <p className="text-white/60 text-sm mb-6">
                +10 coins earned! 🪙
              </p>
              
              <button
                onClick={handleContinue}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#e94560] to-[#ff6b6b] text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Continue to Story
              </button>
            </div>
          )}
        </div>

        {/* Decorative bottom border */}
        <div className="h-1.5 bg-gradient-to-r from-[#e94560] via-[#ff6b6b] to-[#e94560]" />
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes sparkle {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
          100% { opacity: 0; transform: scale(0) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DailyVerseModal;
