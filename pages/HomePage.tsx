
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
import { BookOpen, Key, Brain, Dumbbell, Heart, Video, ChevronRight, Lock, Check, Play } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { isCompleted, isLocked } from '../services/lessonService';

// Inline getLessonStatus to avoid circular dependency
const getLessonStatus = (lesson: any): 'available' | 'locked' | 'completed' => {
  if (isCompleted(lesson._id || lesson.id)) {
    return 'completed';
  }
  if (isLocked(lesson)) {
    return 'locked';
  }
  return 'available';
};

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

  // Lessons state
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [weekLessons, setWeekLessons] = useState<Map<string, any>>(new Map());
  
  // Explore categories state
  const [exploreCategories, setExploreCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

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

  const handleItemClick = (item: any) => {
    // Check if it's a playlist (has items array or isAudio flag) or a book
    if (item.isAudio || (item.items && Array.isArray(item.items))) {
      // It's a playlist - use the correct route
      navigate(`/audio/playlist/${item._id || item.id}`);
    } else {
      // It's a book
      handleBookClick(item.id || item._id);
    }
  };

  // Fetch lessons, categories, and playlists
  useEffect(() => {
    fetchLessons();
    fetchExploreCategories();
    fetchPlaylists();
  }, []);

  const fetchLessons = async () => {
    try {
      console.log('📚 Fetching lessons from API...');
      const data = await ApiService.getLessons();
      console.log('📚 Lessons received:', data.length, data);
      setLessons(data);

      // Organize lessons by day for the next 7 days
      const weekMap = new Map<string, any>();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Also include published lessons without scheduled dates (show them as available)
      const publishedLessons = data.filter((l: any) =>
        l.status === 'published' && !l.scheduledDate
      );

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);

        const dateKey = date.toISOString().split('T')[0];

        // Find lesson scheduled for this date
        let lesson = data.find((l: any) => {
          if (!l.scheduledDate) return false;
          const scheduled = new Date(l.scheduledDate);
          scheduled.setHours(0, 0, 0, 0);
          return scheduled.getTime() === date.getTime();
        });

        // If no scheduled lesson for this day and it's today, use first available published lesson
        if (!lesson && i === 0 && publishedLessons.length > 0) {
          lesson = publishedLessons[0];
        }

        if (lesson) {
          weekMap.set(dateKey, lesson);
        }
      }

      console.log('📚 Week lessons map:', Array.from(weekMap.entries()));
      setWeekLessons(weekMap);
    } catch (error) {
      console.error('❌ Error fetching lessons:', error);
    } finally {
      setLessonsLoading(false);
    }
  };

  const getDayLabel = (date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  const getDayNumber = (date: Date): number => {
    return date.getDate();
  };

  const handleLessonClick = (lesson: any) => {
    const status = getLessonStatus(lesson);
    if (status === 'locked') {
      return; // Don't navigate if locked
    }
    navigate(`/lesson/${lesson._id}`);
  };

  // Fetch explore categories
  const fetchExploreCategories = async () => {
    try {
      setCategoriesLoading(true);
      const categories = await ApiService.getCategories(undefined, true); // Get categories with showOnExplore=true
      // Double-check: filter to only include categories with showOnExplore: true
      const exploreOnly = categories.filter(cat => cat.showOnExplore === true);
      setExploreCategories(exploreOnly);
      console.log(`✅ Loaded ${exploreOnly.length} explore categories:`, exploreOnly.map(c => c.name));
      
      // Debug: Log all books and their categories
      console.log('📚 All books:', books.map(b => ({ 
        title: b.title, 
        category: (b as any).category, 
        categories: (b as any).categories,
        status: (b as any).status 
      })));
    } catch (error) {
      console.error('❌ Error fetching explore categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Fetch playlists
  const fetchPlaylists = async () => {
    try {
      setPlaylistsLoading(true);
      const data = await ApiService.getPlaylists('published');
      setPlaylists(data);
    } catch (error) {
      console.error('❌ Error fetching playlists:', error);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  // Group books and playlists by category
  const getBooksByCategory = (categoryName: string) => {
    const matchedBooks = books.filter(book => {
      const bookCategories = (book as any).categories && Array.isArray((book as any).categories) 
        ? (book as any).categories 
        : (book.category ? [book.category] : []);
      const matches = bookCategories.some((cat: string) => 
        cat.toLowerCase() === categoryName.toLowerCase()
      );
      return matches;
    });
    console.log(`📖 Books in category "${categoryName}":`, matchedBooks.map(b => b.title));
    return matchedBooks;
  };

  const getPlaylistsByCategory = (categoryName: string) => {
    const matchedPlaylists = playlists
      .filter(playlist => {
        const playlistCategories = (playlist as any).categories && Array.isArray((playlist as any).categories) 
          ? (playlist as any).categories 
          : (playlist.category ? [playlist.category] : []);
        const matches = playlistCategories.some((cat: string) => 
          cat.toLowerCase() === categoryName.toLowerCase()
        );
        return matches;
      });
    console.log(`🎵 Playlists in category "${categoryName}":`, matchedPlaylists.map(p => p.title));
    return matchedPlaylists
      .map(playlist => ({
        // Transform playlist to match Book interface for BookCard
        id: playlist._id || playlist.id,
        _id: playlist._id,
        title: playlist.title,
        coverUrl: playlist.coverImage, // Map coverImage to coverUrl
        author: playlist.author,
        level: 'All',
        category: playlist.category,
        isAudio: true,
        isRead: false,
        description: playlist.description,
        items: playlist.items, // Keep items for navigation detection
      }));
  };

  const featuredBooks = books.slice(0, 5); // Top 5 featured

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
        <div className="w-screen overflow-x-auto no-scrollbar pb-6 pt-2 -mt-2 -mx-4">
          <div className="flex space-x-4 px-4 pr-8">

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

        {/* Daily Lessons Section */}
        <section>
          <SectionTitle title="Daily Lessons" />
          {lessonsLoading ? (
            <div className="text-white/70 text-center py-4 px-4">Loading lessons...</div>
          ) : (
            <div className="w-screen overflow-x-auto no-scrollbar pb-6 -mx-4">
              <div className="flex space-x-3 px-4">
                {(() => {
                  const today = new Date();
                  const weekDays: Date[] = [];
                  for (let i = 0; i < 7; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() + i);
                    date.setHours(0, 0, 0, 0);
                    weekDays.push(date);
                  }

                  return weekDays.map((date) => {
                    const dateKey = date.toISOString().split('T')[0];
                    const lesson = weekLessons.get(dateKey);
                    const status = lesson ? getLessonStatus(lesson) : 'empty';
                    const isToday = date.toDateString() === today.toDateString();

                    return (
                      <div
                        key={dateKey}
                        className={`relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 ${status === 'locked' ? 'cursor-not-allowed' : status !== 'empty' ? 'cursor-pointer' : ''}`}
                        onClick={() => lesson && status !== 'locked' && handleLessonClick(lesson)}
                      >
                        {/* Day Label - Back to top */}
                        <div className="text-center mb-1.5">
                          <div className={`text-xs font-semibold ${isToday ? 'text-[#FFD700]' : 'text-white/70'}`}>
                            {getDayLabel(date)}
                          </div>
                          <div className={`text-base font-bold ${isToday ? 'text-[#FFD700]' : 'text-white'}`}>
                            {getDayNumber(date)}
                          </div>
                        </div>

                        {/* Portrait Thumbnail Container */}
                        <div className={`relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800/50 border transition-all ${isToday ? 'border-2 border-[#FFD700]' : 'border border-white/20'
                          }`}>
                          {status === 'empty' ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="text-white/20 text-[10px] text-center px-1">
                                No lesson
                              </div>
                            </div>
                          ) : lesson ? (
                            <>
                              {/* Thumbnail */}
                              {lesson.video?.thumbnail ? (
                                <img
                                  src={lesson.video.thumbnail}
                                  alt={lesson.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                                  <Video className="w-8 h-8 text-white/50" />
                                </div>
                              )}

                              {/* Overlay */}
                              <div className={`absolute inset-0 ${status === 'locked'
                                ? 'bg-black/70'
                                : status === 'completed'
                                  ? 'bg-green-500/30'
                                  : 'bg-black/20'
                                }`} />

                              {/* Status Icons */}
                              <div className="absolute top-2 right-2">
                                {status === 'locked' ? (
                                  <div className="bg-black/60 rounded-full p-1.5">
                                    <Lock className="w-4 h-4 text-white" />
                                  </div>
                                ) : status === 'completed' ? (
                                  <div className="bg-green-500 rounded-full p-1.5">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                ) : (
                                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                                    <Play className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </div>

                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </section>

        {/* Explore Categories Sections */}
        {categoriesLoading ? (
          <div className="text-white/70 text-center py-4 px-4">Loading categories...</div>
        ) : exploreCategories.length === 0 ? (
          <div className="text-white/70 text-center py-4 px-4">No explore categories available</div>
        ) : (
          exploreCategories
            .filter(category => category.showOnExplore === true) // Additional safety filter
            .map((category) => {
              const categoryBooks = getBooksByCategory(category.name);
              const categoryPlaylists = getPlaylistsByCategory(category.name);
              const allItems = [...categoryBooks, ...categoryPlaylists];
              
              if (allItems.length === 0) return null;
              
              return (
                <section key={category._id} className="mt-6">
                  <SectionTitle 
                    title={category.name} 
                    icon={category.icon}
                    color={category.color}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {allItems.map((item) => (
                      <BookCard
                        key={item.id || item._id}
                        book={item}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
        )}

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
