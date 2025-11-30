
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';
import DailyRewardModal from '../components/features/DailyRewardModal';
import ChallengeGameModal from '../components/features/ChallengeGameModal';
import StrengthGameModal from '../components/features/StrengthGameModal';
import PrayerGameModal from '../components/features/PrayerGameModal';
import { BookOpen, Key, Brain, Dumbbell, Heart } from 'lucide-react';

const MEMORY_GAME_ENGAGED_KEY = 'memory_game_engaged';
const DAILY_KEY_ENGAGED_KEY = 'daily_key_engaged';
const STRENGTH_GAME_ENGAGED_KEY = 'strength_game_engaged';
const PRAYER_GAME_ENGAGED_KEY = 'prayer_game_engaged';


const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading, refreshBooks } = useBooks();

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [showChallengeGame, setShowChallengeGame] = useState(false);
  const [showStrengthGame, setShowStrengthGame] = useState(false);
  const [showPrayerGame, setShowPrayerGame] = useState(false);
  const [hasEngagedMemory, setHasEngagedMemory] = useState(false);
  const [hasEngagedDailyKey, setHasEngagedDailyKey] = useState(false);
  const [hasEngagedStrength, setHasEngagedStrength] = useState(false);
  const [hasEngagedPrayer, setHasEngagedPrayer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  // Check if games have been engaged
  useEffect(() => {
    const memoryEngaged = localStorage.getItem(MEMORY_GAME_ENGAGED_KEY) === 'true';
    const dailyKeyEngaged = localStorage.getItem(DAILY_KEY_ENGAGED_KEY) === 'true';
    const strengthEngaged = localStorage.getItem(STRENGTH_GAME_ENGAGED_KEY) === 'true';
    const prayerEngaged = localStorage.getItem(PRAYER_GAME_ENGAGED_KEY) === 'true';
    setHasEngagedMemory(memoryEngaged);
    setHasEngagedDailyKey(dailyKeyEngaged);
    setHasEngagedStrength(strengthEngaged);
    setHasEngagedPrayer(prayerEngaged);

    // Safeguard: If no books are loaded and we're not loading, try to refresh
    if (!loading && books.length === 0) {
      // Use a small timeout to avoid conflict with initial load
      const timer = setTimeout(() => {
        refreshBooks();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, books, refreshBooks]);

  const handleDailyKeyClick = () => {
    // Mark as engaged when user clicks
    if (!hasEngagedDailyKey) {
      localStorage.setItem(DAILY_KEY_ENGAGED_KEY, 'true');
      setHasEngagedDailyKey(true);
    }
    setShowDailyReward(true);
  };

  const handleMemoryClick = () => {
    // Mark as engaged when user clicks
    if (!hasEngagedMemory) {
      localStorage.setItem(MEMORY_GAME_ENGAGED_KEY, 'true');
      setHasEngagedMemory(true);
    }
    setShowChallengeGame(true);
  };

  const handleStrengthClick = () => {
    // Mark as engaged when user clicks
    if (!hasEngagedStrength) {
      localStorage.setItem(STRENGTH_GAME_ENGAGED_KEY, 'true');
      setHasEngagedStrength(true);
    }
    setShowStrengthGame(true);
  };

  const handlePrayerClick = async () => {
    // Mark as engaged when user clicks
    if (!hasEngagedPrayer) {
      localStorage.setItem(PRAYER_GAME_ENGAGED_KEY, 'true');
      setHasEngagedPrayer(true);
    }

    // Request microphone permission early (on user interaction)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted - stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
    } catch (err) {
      // Permission denied or error - that's okay, modal will handle fallback
      console.log('Microphone permission not available:', err);
    }

    setShowPrayerGame(true);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScrollY = scrollRef.current.scrollTop;

    if (currentScrollY < 50) {
      setIsHeaderVisible(true);
      lastScrollY.current = currentScrollY;
      return;
    }

    if (currentScrollY > lastScrollY.current) {
      setIsHeaderVisible(false);
    } else {
      setIsHeaderVisible(true);
    }

    lastScrollY.current = currentScrollY;
  };

  const handleBookClick = (id: string) => {
    // Pass state to know where to return
    navigate(`/book/${id}`, { state: { from: '/home' } });
  };

  const featuredBooks = books.slice(0, 5); // Top 5 featured
  const activityBooks = books.filter(b => b.category === 'Activity Books');
  const freeBooks = books.filter(b => b.category === 'Books Gone Free');
  const youngReaders = books.filter(b => b.category === 'Young Readers');

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} />

      <DailyRewardModal
        isOpen={showDailyReward}
        onClose={() => setShowDailyReward(false)}
      />

      <ChallengeGameModal
        isOpen={showChallengeGame}
        onClose={() => setShowChallengeGame(false)}
      />

      <StrengthGameModal
        isOpen={showStrengthGame}
        onClose={() => setShowStrengthGame(false)}
      />

      <PrayerGameModal
        isOpen={showPrayerGame}
        onClose={() => setShowPrayerGame(false)}
      />

      <div className="px-4 pt-28 space-y-2 pb-52">

        {/* --- Stories Section --- */}
        <div className="w-full overflow-x-auto no-scrollbar pb-6 pt-2 -mt-2 -mx-4">
          <div className="flex space-x-4 px-4 min-w-min">

            {/* SPECIAL: Daily Key Story */}
            <button
              className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
              onClick={handleDailyKeyClick}
            >
              {/* Ring */}
              <div className={`p-[3px] rounded-full bg-gradient-to-tr from-[#FFD700] via-[#fff] to-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)] relative transition-transform group-active:scale-95 ${!hasEngagedDailyKey
                ? 'animate-[spin_4s_linear_infinite]'
                : 'animate-pulse'
                }`}>
                {/* Avatar Container - Counter-rotates to keep icon static */}
                <div className={`w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-[#8B4513] overflow-hidden bg-[#8B4513] flex items-center justify-center relative ${!hasEngagedDailyKey
                  ? 'animate-[spin_4s_linear_infinite_reverse]'
                  : ''
                  }`}>
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 80%)' }}></div>
                  <Key size={32} className="text-[#FFD700] relative z-10 animate-[bounce_2s_infinite]" fill="#B8860B" />
                </div>
              </div>
              {/* Name */}
              <span className="text-[#FFD700] text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                Daily Key
              </span>
            </button>

            {/* SPECIAL: Memory Challenge Story */}
            <button
              className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
              onClick={handleMemoryClick}
            >
              {/* Ring */}
              <div className={`p-[3px] rounded-full bg-gradient-to-tr from-[#3949ab] via-[#5c6bc0] to-[#3949ab] shadow-[0_0_15px_rgba(57,73,171,0.6)] relative transition-transform group-active:scale-95 ${!hasEngagedMemory
                ? 'animate-[spin_4s_linear_infinite]'
                : 'animate-pulse'
                }`}>
                {/* Avatar Container - Counter-rotates to keep icon static */}
                <div className={`w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-[#1a237e] overflow-hidden bg-[#1a237e] flex items-center justify-center relative ${!hasEngagedMemory
                  ? 'animate-[spin_4s_linear_infinite_reverse]'
                  : ''
                  }`}>
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 80%)' }}></div>
                  <Brain size={32} className="text-[#90caf9] relative z-10 animate-[bounce_2s_infinite]" fill="#64b5f6" />
                </div>
              </div>
              {/* Name */}
              <span className="text-[#90caf9] text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                Memory
              </span>
            </button>

            {/* SPECIAL: Strength Challenge Story */}
            <button
              className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
              onClick={handleStrengthClick}
            >
              {/* Ring */}
              <div className={`p-[3px] rounded-full bg-gradient-to-tr from-[#FF6B35] via-[#F7931E] to-[#FF6B35] shadow-[0_0_15px_rgba(255,107,53,0.6)] relative transition-transform group-active:scale-95 ${!hasEngagedStrength
                ? 'animate-[spin_4s_linear_infinite]'
                : 'animate-pulse'
                }`}>
                {/* Avatar Container - Counter-rotates to keep icon static */}
                <div className={`w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-[#E64A19] overflow-hidden bg-[#E64A19] flex items-center justify-center relative ${!hasEngagedStrength
                  ? 'animate-[spin_4s_linear_infinite_reverse]'
                  : ''
                  }`}>
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 80%)' }}></div>
                  <Dumbbell size={32} className="text-[#FFD700] relative z-10 animate-[bounce_2s_infinite]" fill="#FFB300" />
                </div>
              </div>
              {/* Name */}
              <span className="text-[#FFD700] text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                Strength
              </span>
            </button>

            {/* SPECIAL: Prayer Challenge Story */}
            <button
              className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
              onClick={handlePrayerClick}
            >
              {/* Ring */}
              <div className={`p-[3px] rounded-full bg-gradient-to-tr from-[#AB47BC] via-[#BA68C8] to-[#AB47BC] shadow-[0_0_15px_rgba(171,71,188,0.6)] relative transition-transform group-active:scale-95 ${!hasEngagedPrayer
                ? 'animate-[spin_4s_linear_infinite]'
                : 'animate-pulse'
                }`}>
                {/* Avatar Container - Counter-rotates to keep icon static */}
                <div className={`w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-[#7B1FA2] overflow-hidden bg-[#7B1FA2] flex items-center justify-center relative ${!hasEngagedPrayer
                  ? 'animate-[spin_4s_linear_infinite_reverse]'
                  : ''
                  }`}>
                  <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 80%)' }}></div>
                  <Heart size={32} className="text-[#F06292] relative z-10 animate-[bounce_2s_infinite]" fill="#EC407A" />
                </div>
              </div>
              {/* Name */}
              <span className="text-[#F06292] text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                Prayer
              </span>
            </button>
          </div>
        </div>

        {/* Featured Carousel */}
        {!loading && featuredBooks.length > 0 && (
          <FeaturedCarousel books={featuredBooks} onBookClick={handleBookClick} />
        )}

        <section>
          <SectionTitle title="Activity Books" />
          <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
            {loading ? <div className="text-white p-4 font-display">Loading treasures...</div> :
              (activityBooks.length > 0 ? activityBooks : books.slice(0, 3)).map(book => (
                <BookCard key={book.id} book={book} onClick={handleBookClick} />
              ))
            }
          </div>
        </section>

        <section>
          <SectionTitle title="Books Gone Free" />
          <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
            {loading ? null :
              (freeBooks.length > 0 ? freeBooks : books.slice(3, 5)).map(book => (
                <BookCard key={book.id} book={book} onClick={handleBookClick} />
              ))
            }
          </div>
        </section>

        <section>
          <SectionTitle title="Young Readers" />
          <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
            {loading ? null :
              (youngReaders.length > 0 ? youngReaders : books.slice(2, 6)).map(book => (
                <BookCard key={book.id} book={book} onClick={handleBookClick} />
              ))
            }
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        .animate-\\[spin_4s_linear_infinite_reverse\\] {
          animation: spin-reverse 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default HomePage;
