import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Sparkles, Star, RotateCcw, Check, HelpCircle, Lightbulb } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

interface DailyVerseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Collection of kid-friendly Bible verses with discussion questions
const DAILY_VERSES = [
  { 
    text: "I am with you always even to the end of the age", 
    ref: "Matthew 28:20", 
    theme: "God's Presence",
    question: "When do you feel like you need God to be with you the most?"
  },
  { 
    text: "Love one another just as I have loved you", 
    ref: "John 13:34", 
    theme: "Love",
    question: "How can you show love to someone in your family today?"
  },
  { 
    text: "Be strong and courageous for the Lord your God is with you", 
    ref: "Joshua 1:9", 
    theme: "Courage",
    question: "What is something that feels scary but you could try with God's help?"
  },
  { 
    text: "Trust in the Lord with all your heart and lean not on your own understanding", 
    ref: "Proverbs 3:5", 
    theme: "Trust",
    question: "What does it mean to trust God even when we don't understand everything?"
  },
  { 
    text: "The Lord is my shepherd I lack nothing He makes me lie down in green pastures", 
    ref: "Psalm 23:1-2", 
    theme: "God's Care",
    question: "How does God take care of you like a shepherd takes care of sheep?"
  },
  { 
    text: "Let your light shine before others that they may see your good deeds", 
    ref: "Matthew 5:16", 
    theme: "Being a Light",
    question: "What is one good deed you can do to let your light shine this week?"
  },
  { 
    text: "God is love and whoever lives in love lives in God", 
    ref: "1 John 4:16", 
    theme: "God's Love",
    question: "How do you know that God loves you?"
  },
  { 
    text: "Rejoice in the Lord always and again I say rejoice", 
    ref: "Philippians 4:4", 
    theme: "Joy",
    question: "What are three things you are thankful for that make you joyful?"
  },
  { 
    text: "For God so loved the world that he gave his only Son", 
    ref: "John 3:16", 
    theme: "Salvation",
    question: "Why do you think God loves us so much that He gave us Jesus?"
  },
  { 
    text: "I can do all things through Christ who gives me strength", 
    ref: "Philippians 4:13", 
    theme: "Strength",
    question: "What is something hard that you could ask Jesus to help you with?"
  },
  { 
    text: "The joy of the Lord is your strength today and always", 
    ref: "Nehemiah 8:10", 
    theme: "Joy",
    question: "How does feeling happy about God help you feel stronger?"
  },
  { 
    text: "Be kind to one another tenderhearted forgiving each other", 
    ref: "Ephesians 4:32", 
    theme: "Kindness",
    question: "Is there someone you need to forgive or be kinder to?"
  },
  { 
    text: "Cast all your worries on Him because He cares for you", 
    ref: "1 Peter 5:7", 
    theme: "Trust",
    question: "What worries can you give to God in prayer right now?"
  },
  { 
    text: "Give thanks to the Lord for He is good and His love endures forever", 
    ref: "Psalm 107:1", 
    theme: "Gratitude",
    question: "What is something good that God has done for your family?"
  },
  { 
    text: "The Lord is my light and my salvation whom shall I fear", 
    ref: "Psalm 27:1", 
    theme: "Light",
    question: "When you feel afraid what can you remember about God?"
  },
  { 
    text: "Do to others as you would have them do to you", 
    ref: "Luke 6:31", 
    theme: "Golden Rule",
    question: "How would you like your friends to treat you? How can you treat them that way?"
  },
  { 
    text: "Jesus said let the little children come to me for the kingdom belongs to them", 
    ref: "Matthew 19:14", 
    theme: "Jesus' Love",
    question: "How does it feel to know that Jesus wants you to come to Him?"
  },
  { 
    text: "Create in me a clean heart O God and renew a right spirit within me", 
    ref: "Psalm 51:10", 
    theme: "Purity",
    question: "What can we ask God to help us change in our hearts?"
  },
  { 
    text: "This is the day the Lord has made let us rejoice and be glad in it", 
    ref: "Psalm 118:24", 
    theme: "Gratitude",
    question: "What is one special thing about today that God made for you?"
  },
  { 
    text: "God will never leave you He will never forsake you so do not be afraid", 
    ref: "Hebrews 13:5", 
    theme: "Faithfulness",
    question: "How does it make you feel knowing God will never leave you?"
  },
];

type GameState = 'intro' | 'preview' | 'scrambling' | 'playing' | 'success' | 'discussion';

// Storage key for tracking used verses
const USED_VERSES_KEY = 'godlykids_used_verse_indices';

// Get a random verse, avoiding recently used ones
const getDailyVerse = () => {
  // Get list of recently used verse indices (last 5)
  let usedIndices: number[] = [];
  try {
    const saved = localStorage.getItem(USED_VERSES_KEY);
    if (saved) {
      usedIndices = JSON.parse(saved);
    }
  } catch (e) {
    usedIndices = [];
  }
  
  // Get available indices (not recently used)
  let availableIndices = DAILY_VERSES.map((_, i) => i).filter(i => !usedIndices.includes(i));
  
  // If all verses have been used recently, reset and use all
  if (availableIndices.length === 0) {
    availableIndices = DAILY_VERSES.map((_, i) => i);
    usedIndices = [];
  }
  
  // Pick a random verse from available ones
  const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  
  // Update used indices (keep last 5)
  usedIndices.push(randomIndex);
  if (usedIndices.length > 5) {
    usedIndices = usedIndices.slice(-5);
  }
  localStorage.setItem(USED_VERSES_KEY, JSON.stringify(usedIndices));
  
  return DAILY_VERSES[randomIndex];
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
  const [hintWordId, setHintWordId] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [previewCountdown, setPreviewCountdown] = useState(3);

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
    setHintWordId(null);
    setHintsUsed(0);
    setPreviewCountdown(3);
    
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
    setPreviewCountdown(3);
    setGameState('preview');
    
    // Start countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setPreviewCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        // Trigger scramble animation
        setGameState('scrambling');
        setTimeout(() => {
          setGameState('playing');
        }, 800); // Scramble animation duration
      }
    }, 1000);
  };

  const useHint = () => {
    if (hintWordId !== null) return; // Already showing hint
    
    playTab?.();
    setHintWordId(nextTargetIndex);
    setHintsUsed(prev => prev + 1);
    
    // Remove hint highlight after 2 seconds
    setTimeout(() => {
      setHintWordId(null);
    }, 2000);
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
    // Calculate stars based on mistakes and hints used
    let stars = 3;
    const totalPenalties = mistakes + hintsUsed;
    if (totalPenalties > 3) stars = 1;
    else if (totalPenalties > 1) stars = 2;
    
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
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#D4A574] via-[#C4956A] to-[#8B6914]">
      
      {/* Safe area top */}
      <div className="flex-shrink-0" style={{ height: 'var(--safe-area-top, 0px)' }} />
      
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

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-20 w-10 h-10 bg-[#5D4E37]/80 rounded-full flex items-center justify-center text-[#F5E6D3] hover:bg-[#5D4E37] transition-colors border-2 border-[#8B6914]"
        style={{ marginTop: 'var(--safe-area-top, 0px)' }}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Header */}
      <div className="text-center pt-8 pb-4 px-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5D4E37] to-[#8B6914] px-4 py-2 rounded-full mb-2 border-2 border-[#D4A574] shadow-lg">
          <BookOpen className="w-5 h-5 text-[#F5E6D3]" />
          <span className="text-[#F5E6D3] font-display font-bold">Scripture Puzzle</span>
        </div>
        <p className="text-[#5D4E37] text-sm font-medium">{verse.theme}</p>
      </div>

      {/* Content - Full screen */}
      <div className="flex-1 flex flex-col px-6 pb-6 overflow-auto">
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          {/* INTRO STATE */}
          {gameState === 'intro' && (
            <div className="text-center py-8">
              <div className="text-8xl mb-6">📜</div>
              <h3 className="text-[#3D2914] font-bold text-3xl mb-3">Today's Verse</h3>
              <p className="text-[#5D4E37] text-lg mb-8">
                Tap the words in the correct order to build the verse!
              </p>
              
              {/* Preview the verse reference - scroll/parchment style */}
              <div className="bg-[#F5E6D3] rounded-2xl p-6 mb-8 shadow-inner border-2 border-[#C4956A]">
                <p className="text-[#8B4513] font-medium text-xl">{verse.ref}</p>
              </div>
              
              <button
                onClick={startGame}
                className="w-full py-5 rounded-2xl font-bold text-xl bg-gradient-to-r from-[#5D4E37] to-[#8B6914] text-[#F5E6D3] hover:brightness-110 active:scale-[0.98] transition-all shadow-lg border-2 border-[#D4A574]"
              >
                Start Puzzle! 🧩
              </button>
            </div>
          )}

          {/* PREVIEW STATE - Show verse for 3 seconds */}
          {gameState === 'preview' && (
            <div className="text-center py-6">
              <div className="text-6xl mb-4">📖</div>
              <h3 className="text-[#3D2914] font-bold text-2xl mb-2">Memorize the Verse!</h3>
              <p className="text-[#5D4E37] text-base mb-6">
                Read it carefully before it scrambles...
              </p>
              
              {/* Full verse display */}
              <div className="bg-[#F5E6D3] rounded-2xl p-6 mb-6 shadow-inner border-2 border-[#C4956A]">
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {wordChunks.map((word) => (
                    <span
                      key={word.id}
                      className="bg-[#5D4E37] text-[#F5E6D3] px-4 py-2 rounded-xl font-medium text-lg shadow-md"
                    >
                      {word.text}
                    </span>
                  ))}
                </div>
                <p className="text-[#8B4513] font-medium text-base mt-4">— {verse.ref}</p>
              </div>
              
              {/* Countdown */}
              <div className="flex items-center justify-center gap-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5D4E37] to-[#8B6914] flex items-center justify-center border-4 border-[#D4A574] shadow-lg">
                  <span className="text-[#F5E6D3] font-bold text-3xl">{previewCountdown}</span>
                </div>
              </div>
              <p className="text-[#5D4E37] text-sm mt-2">Scrambling in {previewCountdown}...</p>
            </div>
          )}

          {/* SCRAMBLING STATE - Animation transition */}
          {gameState === 'scrambling' && (
            <div className="text-center py-6">
              <div className="text-6xl mb-4 animate-bounce">🔀</div>
              <h3 className="text-[#3D2914] font-bold text-2xl mb-4">Scrambling!</h3>
              
              {/* Scrambling animation */}
              <div className="bg-[#F5E6D3] rounded-2xl p-6 shadow-inner border-2 border-[#C4956A] overflow-hidden">
                <div className="flex flex-wrap gap-2 justify-center">
                  {shuffledIndices.map((idx, i) => {
                    const word = wordChunks[idx];
                    return (
                      <span
                        key={word.id}
                        className="bg-gradient-to-b from-[#8B6914] to-[#5D4E37] text-[#F5E6D3] px-4 py-2 rounded-xl font-medium text-lg shadow-md animate-scramble"
                        style={{
                          animationDelay: `${i * 50}ms`,
                        }}
                      >
                        {word.text}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PLAYING STATE */}
          {gameState === 'playing' && (
            <>
              {/* Sentence being built - parchment style */}
              <div className="bg-[#F5E6D3] rounded-2xl p-5 mb-6 min-h-[100px] shadow-inner border-2 border-[#C4956A]">
                <p className="text-[#8B4513]/60 text-sm mb-3 uppercase tracking-wide">Building verse...</p>
                <div className="flex flex-wrap gap-2">
                  {placedWords.map((word) => (
                    <span
                      key={word.id}
                      className="bg-[#5D4E37] text-[#F5E6D3] px-4 py-2 rounded-xl font-medium text-base animate-in fade-in zoom-in duration-200 shadow-md"
                    >
                      {word.text}
                    </span>
                  ))}
                  {placedWords.length < wordChunks.length && (
                    <span className="text-[#8B4513]/30 px-4 py-2">...</span>
                  )}
                </div>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-[#3D2914] text-sm font-medium">
                  {nextTargetIndex} / {wordChunks.length} words
                </p>
                <div className="flex items-center gap-3">
                  {mistakes > 0 && (
                    <p className="text-red-700 text-sm font-medium">
                      {mistakes} mistake{mistakes !== 1 ? 's' : ''}
                    </p>
                  )}
                  {/* Help button */}
                  <button
                    onClick={useHint}
                    disabled={hintWordId !== null}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                      transition-all duration-200
                      ${hintWordId !== null 
                        ? 'bg-yellow-400/50 text-yellow-800 cursor-not-allowed' 
                        : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300 active:scale-95 shadow-md'
                      }
                    `}
                  >
                    <Lightbulb className="w-4 h-4" />
                    Hint
                  </button>
                </div>
              </div>

              {/* Word choices - wooden plank style */}
              <div className="flex flex-wrap gap-3 justify-center">
                {shuffledIndices.map((idx) => {
                  const chunk = wordChunks[idx];
                  if (chunk.isPlaced) return null;
                  
                  const isHinted = hintWordId === chunk.id;
                  
                  return (
                    <button
                      key={chunk.id}
                      onClick={() => handleWordClick(chunk.id)}
                      className={`
                        px-5 py-3 rounded-xl font-medium text-lg
                        transition-all duration-150 shadow-md
                        ${isHinted 
                          ? 'bg-gradient-to-b from-yellow-400 to-yellow-500 border-2 border-yellow-300 text-yellow-900 scale-110 animate-pulse ring-4 ring-yellow-300/50' 
                          : 'bg-gradient-to-b from-[#8B6914] to-[#5D4E37] border-2 border-[#D4A574] text-[#F5E6D3] hover:border-[#F5E6D3] hover:scale-105'
                        }
                        active:scale-95
                        ${shakeItem === chunk.id ? 'animate-shake border-red-500 !bg-red-700/50' : ''}
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
                className="mt-8 mx-auto flex items-center gap-2 text-[#3D2914] hover:text-[#5D4E37] transition-colors text-base"
              >
                <RotateCcw className="w-5 h-5" />
                Restart
              </button>
            </>
          )}

          {/* SUCCESS STATE */}
          {gameState === 'success' && (
            <div className="text-center py-6">
              {/* Stars */}
              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    className={`w-14 h-14 transition-all duration-300 ${
                      star <= earnedStars
                        ? 'text-yellow-500 fill-yellow-500 scale-110 drop-shadow-lg'
                        : 'text-[#8B6914]/40'
                    }`}
                    style={{
                      animationDelay: `${star * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              
              <h3 className="text-[#3D2914] font-bold text-3xl mb-4">
                {earnedStars === 3 ? 'Perfect!' : earnedStars === 2 ? 'Great Job!' : 'Well Done!'}
              </h3>
              
              {/* Show completed verse - scroll style */}
              <div className="bg-[#F5E6D3] rounded-2xl p-6 mb-6 shadow-inner border-2 border-[#C4956A]">
                <p className="text-[#3D2914] font-medium text-lg mb-3">"{verse.text}"</p>
                <p className="text-[#8B4513] text-base">{verse.ref}</p>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-xl mb-8">
                <span className="text-[#5D4E37]">+10 coins earned!</span>
                <div className="w-7 h-7 bg-gradient-to-br from-[#FFD700] to-[#FFA000] rounded-full flex items-center justify-center shadow-md border-2 border-[#FF8F00]">
                  <span className="text-[#8B4513] font-bold text-sm">$</span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  playClick?.();
                  setGameState('discussion');
                }}
                className="w-full py-5 rounded-2xl font-bold text-xl bg-gradient-to-r from-[#5D4E37] to-[#8B6914] text-[#F5E6D3] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg border-2 border-[#D4A574]"
              >
                💬 Discuss Together
              </button>
            </div>
          )}

          {/* DISCUSSION STATE */}
          {gameState === 'discussion' && (
            <div className="py-4">
              {/* Header */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">💬</div>
                <h3 className="text-[#3D2914] font-bold text-2xl mb-1">Let's Talk About It!</h3>
                <p className="text-[#5D4E37] text-sm">Parent & Child Discussion</p>
              </div>
              
              {/* Verse reminder - parchment style */}
              <div className="bg-[#F5E6D3]/70 rounded-xl p-4 mb-4 border border-[#C4956A]">
                <p className="text-[#5D4E37] text-base italic">"{verse.text}"</p>
                <p className="text-[#8B4513] text-sm mt-2">{verse.ref}</p>
              </div>
              
              {/* Discussion question - wooden frame style */}
              <div className="bg-gradient-to-br from-[#5D4E37] to-[#3D2914] rounded-2xl p-6 mb-6 border-2 border-[#D4A574] shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🤔</span>
                  <div>
                    <p className="text-[#D4A574] text-xs uppercase tracking-wide mb-2">Discussion Question</p>
                    <p className="text-[#F5E6D3] font-medium text-xl leading-relaxed">
                      {verse.question}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Tip for parents */}
              <div className="bg-[#6B8E6B]/30 rounded-xl p-4 mb-6 border border-[#6B8E6B]/50">
                <p className="text-[#3D5A3D] text-sm flex items-start gap-2">
                  <span>💡</span>
                  <span>Take your time! Let your child share their thoughts. There are no wrong answers.</span>
                </p>
              </div>
              
              <button
                onClick={handleContinue}
                className="w-full py-5 rounded-2xl font-bold text-xl bg-gradient-to-r from-[#5D4E37] to-[#8B6914] text-[#F5E6D3] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg border-2 border-[#D4A574]"
              >
                <Check className="w-6 h-6" />
                Continue to Story
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Safe area bottom */}
      <div className="flex-shrink-0" style={{ height: 'var(--safe-area-bottom, 0px)' }} />

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
        @keyframes scramble {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          25% { transform: translateY(-20px) rotate(-10deg); opacity: 0.7; }
          50% { transform: translateY(10px) rotate(5deg); opacity: 0.8; }
          75% { transform: translateY(-10px) rotate(-3deg); opacity: 0.9; }
          100% { transform: translateY(0) rotate(0deg); opacity: 1; }
        }
        .animate-scramble {
          animation: scramble 0.6s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DailyVerseModal;
