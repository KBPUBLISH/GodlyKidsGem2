
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
import { Key, Brain, Dumbbell, Heart, Video, Lock, Check, Play, CheckCircle } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { 
  isCompleted, 
  isLocked, 
  getWeekDays, 
  getTodayIndex, 
  getSelectedDay, 
  setSelectedDay, 
  getLessonsForDay,
  isDayComplete 
} from '../services/lessonService';
import WeeklyLessonTracker from '../components/features/WeeklyLessonTracker';
import { readingProgressService } from '../services/readingProgressService';
import { playHistoryService } from '../services/playHistoryService';
import { bookCompletionService } from '../services/bookCompletionService';
import { profileService } from '../services/profileService';

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

// Profile-specific game engagement keys
const getEngagementKey = (baseKey: string) => profileService.getProfileKey(baseKey);


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
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(getSelectedDay());
  const todayIndex = getTodayIndex();
  
  // Explore categories state
  const [exploreCategories, setExploreCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  
  // Featured content state
  const [featuredContent, setFeaturedContent] = useState<any[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  
  // Recently Read/Played state
  const [recentlyReadBooks, setRecentlyReadBooks] = useState<any[]>([]);
  const [recentlyPlayedPlaylists, setRecentlyPlayedPlaylists] = useState<any[]>([]);
  
  // Top Rated content state
  const [topRatedBooks, setTopRatedBooks] = useState<any[]>([]);
  const [topRatedPlaylists, setTopRatedPlaylists] = useState<any[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  // Check if games have been engaged (per-profile)
  useEffect(() => {
    const memoryEngaged = localStorage.getItem(getEngagementKey('memory_game_engaged')) === 'true';
    const dailyKeyEngaged = localStorage.getItem(getEngagementKey('daily_key_engaged')) === 'true';
    const strengthEngaged = localStorage.getItem(getEngagementKey('strength_game_engaged')) === 'true';
    const prayerEngaged = localStorage.getItem(getEngagementKey('prayer_game_engaged')) === 'true';
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
    // Mark as engaged when user clicks (per-profile)
    if (!hasEngagedDailyKey) {
      localStorage.setItem(getEngagementKey('daily_key_engaged'), 'true');
      setHasEngagedDailyKey(true);
    }
    setShowDailyReward(true);
  };

  const handleMemoryClick = () => {
    // Mark as engaged when user clicks (per-profile)
    if (!hasEngagedMemory) {
      localStorage.setItem(getEngagementKey('memory_game_engaged'), 'true');
      setHasEngagedMemory(true);
    }
    setShowChallengeGame(true);
  };

  const handleStrengthClick = () => {
    // Mark as engaged when user clicks (per-profile)
    if (!hasEngagedStrength) {
      localStorage.setItem(getEngagementKey('strength_game_engaged'), 'true');
      setHasEngagedStrength(true);
    }
    setShowStrengthGame(true);
  };

  const handlePrayerClick = async () => {
    // Mark as engaged when user clicks (per-profile)
    if (!hasEngagedPrayer) {
      localStorage.setItem(getEngagementKey('prayer_game_engaged'), 'true');
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

  // Fetch lessons, categories, playlists, and featured content
  useEffect(() => {
    fetchLessons();
    fetchExploreCategories();
    fetchPlaylists();
    fetchFeaturedContent();
    fetchTopRatedContent();
  }, []);

  const fetchLessons = async () => {
    try {
      console.log('📚 Fetching lessons from API...');
      const data = await ApiService.getLessons();
      console.log('📚 Lessons received:', data.length, data);
      setLessons(data);

      // Organize lessons by day for the fixed week (Monday to Sunday)
      const weekMap = new Map<string, any>();
      const weekDays = getWeekDays(); // Get Monday through Sunday of current week

      // Also include published lessons without scheduled dates
      const publishedLessons = data.filter((l: any) =>
        l.status === 'published' && !l.scheduledDate
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      weekDays.forEach((date, index) => {
        const dateKey = date.toISOString().split('T')[0];

        // Find lesson scheduled for this date
        // Compare date strings directly to avoid timezone conversion issues
        let lesson = data.find((l: any) => {
          if (!l.scheduledDate) return false;
          // Extract date portion directly from the stored date string (UTC)
          const scheduledStr = typeof l.scheduledDate === 'string'
            ? l.scheduledDate.split('T')[0]
            : new Date(l.scheduledDate).toISOString().split('T')[0];
          return scheduledStr === dateKey;
        });

        // If no scheduled lesson and we have published lessons without dates,
        // assign them in order to days without lessons (for the current week)
        if (!lesson && publishedLessons[index]) {
          lesson = publishedLessons[index];
        }

        if (lesson) {
          weekMap.set(dateKey, lesson);
        }
      });

      console.log('📚 Week lessons map (Mon-Sun):', Array.from(weekMap.entries()));
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
      // First fetch ALL categories to see what's available
      const allCategories = await ApiService.getCategories(undefined, false);
      console.log('📂 ALL categories from API:', allCategories.map(c => ({ 
        name: c.name, 
        showOnExplore: c.showOnExplore,
        type: (c as any).type 
      })));
      
      // Now fetch only explore categories
      const categories = await ApiService.getCategories(undefined, true); // Get categories with showOnExplore=true
      console.log('🔍 Categories with explore=true param:', categories.map(c => ({ 
        name: c.name, 
        showOnExplore: c.showOnExplore 
      })));
      
      // Double-check: filter to only include categories with showOnExplore: true
      const exploreOnly = categories.filter(cat => cat.showOnExplore === true);
      setExploreCategories(exploreOnly);
      console.log(`✅ Final explore categories (${exploreOnly.length}):`, exploreOnly.map(c => c.name));
      
    } catch (error) {
      console.error('❌ Error fetching explore categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };
  
  // Log books whenever they change
  useEffect(() => {
    if (books.length > 0) {
      console.log('📚 Books loaded:', books.map(b => ({ 
        title: b.title, 
        category: (b as any).category, 
        categories: (b as any).categories,
        status: (b as any).status 
      })));
    }
  }, [books]);

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

  // Fetch featured content for carousel
  const fetchFeaturedContent = async () => {
    try {
      setFeaturedLoading(true);
      const data = await ApiService.getFeaturedContent();
      console.log('⭐ Featured content loaded:', data.length, 'items');
      setFeaturedContent(data);
    } catch (error) {
      console.error('❌ Error fetching featured content:', error);
    } finally {
      setFeaturedLoading(false);
    }
  };

  // Fetch top-rated content (15%+ engagement ratio)
  const fetchTopRatedContent = async () => {
    try {
      const [topBooks, topPlaylists] = await Promise.all([
        ApiService.getTopRatedBooks(0.15),
        ApiService.getTopRatedPlaylists(0.15),
      ]);
      console.log('🏆 Top rated books:', topBooks.length, 'playlists:', topPlaylists.length);
      setTopRatedBooks(topBooks);
      setTopRatedPlaylists(topPlaylists);
    } catch (error) {
      console.error('❌ Error fetching top-rated content:', error);
    }
  };

  // Compute recently read books when books are loaded
  useEffect(() => {
    if (books.length > 0) {
      const recentBookIds = readingProgressService.getRecentlyReadBookIds(10);
      const recentBooks = recentBookIds
        .map(id => books.find(b => (b.id === id || (b as any)._id === id)))
        .filter(Boolean);
      setRecentlyReadBooks(recentBooks);
      console.log('📚 Recently read books:', recentBooks.length);
    }
  }, [books]);

  // Compute recently played playlists when playlists are loaded
  useEffect(() => {
    if (playlists.length > 0) {
      const recentPlaylistIds = playHistoryService.getRecentlyPlayedIds(10);
      const recentPlaylists = recentPlaylistIds
        .map(id => playlists.find(p => (p._id === id || p.id === id)))
        .filter(Boolean);
      setRecentlyPlayedPlaylists(recentPlaylists);
      console.log('🎵 Recently played playlists:', recentPlaylists.length);
    }
  }, [playlists]);

  // Group books and playlists by category
  // Find the category ID for a given name (for matching books that use category IDs)
  const getCategoryId = (categoryName: string) => {
    const cat = exploreCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    return cat?._id;
  };

  const getBooksByCategory = (categoryName: string) => {
    const categoryId = getCategoryId(categoryName);
    console.log(`🔎 Looking for books in category: "${categoryName}" (ID: ${categoryId || 'none'})`);
    
    const matchedBooks = books.filter(book => {
      const bookCategories = (book as any).categories && Array.isArray((book as any).categories) 
        ? (book as any).categories 
        : ((book as any).category ? [(book as any).category] : []);
      
      // Match by name (case-insensitive) OR by category ID
      const matches = bookCategories.some((cat: string) => {
        const nameMatch = cat.toLowerCase() === categoryName.toLowerCase();
        const idMatch = categoryId && cat === categoryId;
        return nameMatch || idMatch;
      });
      
      // Debug: Log each book's category info
      if (bookCategories.length > 0) {
        console.log(`   📕 "${book.title}" has categories: [${bookCategories.join(', ')}] - Match: ${matches}`);
      }
      
      return matches;
    });
    
    console.log(`   ✅ Found ${matchedBooks.length} books in "${categoryName}"`);
    return matchedBooks;
  };

  const getPlaylistsByCategory = (categoryName: string) => {
    const categoryId = getCategoryId(categoryName);
    const matchedPlaylists = playlists
      .filter(playlist => {
        const playlistCategories = (playlist as any).categories && Array.isArray((playlist as any).categories) 
          ? (playlist as any).categories 
          : (playlist.category ? [playlist.category] : []);
        // Match by name (case-insensitive) OR by category ID
        const matches = playlistCategories.some((cat: string) => 
          cat.toLowerCase() === categoryName.toLowerCase() ||
          (categoryId && cat === categoryId)
        );
        return matches;
      });
    if (matchedPlaylists.length > 0) {
      console.log(`🎵 Playlists in category "${categoryName}":`, matchedPlaylists.map(p => p.title));
    }
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

  // Use manually selected featured content, or fallback to first 5 books
  const featuredBooks = featuredContent.length > 0 
    ? featuredContent.map(item => ({
        ...item,
        id: item._id || item.id,
        coverUrl: item.coverImage || (item as any).files?.coverImage || '',
      }))
    : books.slice(0, 5);

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

        {/* Weekly Progress Tracker + Daily Lessons Section */}
        <section className="pb-2">
          {/* Weekly Tracker - Compact Mon-Sat progress */}
          <WeeklyLessonTracker
            selectedDay={selectedDayIndex}
            onDaySelect={(dayIndex) => {
              setSelectedDayIndex(dayIndex);
              setSelectedDay(dayIndex);
            }}
            dayCompletions={[0, 1, 2, 3, 4].map(i => isDayComplete(lessons, i))}
            todayIndex={todayIndex}
          />

          {/* Daily Lessons Header */}
          <div className="flex items-center justify-between mb-2">
            <SectionTitle 
              title="Daily Lessons" 
              icon="📚"
              color="#7c4dff"
            />
            {(() => {
              const dayLessons = getLessonsForDay(lessons, selectedDayIndex);
              const completedCount = dayLessons.filter((l: any) => isCompleted(l._id || l.id)).length;
              return dayLessons.length > 0 ? (
                <span className="text-white/60 text-xs font-semibold">
                  {completedCount}/{dayLessons.length} Complete
                </span>
              ) : null;
            })()}
          </div>

          {/* Lessons Grid - 3.5 per row */}
          {lessonsLoading ? (
            <div className="text-white/70 text-center py-8 px-4">Loading lessons...</div>
          ) : (() => {
            const dayLessons = getLessonsForDay(lessons, selectedDayIndex);
            const isFutureDay = selectedDayIndex > todayIndex && todayIndex !== -1;

            if (dayLessons.length === 0) {
              return (
                <div className="bg-gradient-to-br from-[#1a237e]/50 to-[#283593]/50 rounded-xl p-6 text-center border border-white/10">
                  <div className="text-4xl mb-2">🌟</div>
                  <h3 className="text-white font-bold text-lg mb-1">Rest & Play Day!</h3>
                  <p className="text-white/60 text-sm">No lessons today. Enjoy reading stories or playing games with family!</p>
                  <p className="text-white/40 text-xs mt-2">Tap another day above to view those lessons.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-3 gap-2">
                {dayLessons.map((lesson: any) => {
                  const status = getLessonStatus(lesson);
                  const isLessonLocked = isFutureDay || status === 'locked';

                  return (
                    <div
                      key={lesson._id || lesson.id}
                      className={`relative cursor-pointer transition-transform active:scale-95 ${isLessonLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !isLessonLocked && handleLessonClick(lesson)}
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-gray-800/50 border border-white/10">
                        {lesson.video?.thumbnail ? (
                          <img
                            src={lesson.video.thumbnail}
                            alt={lesson.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600">
                            <Video className="w-6 h-6 text-white/50" />
                          </div>
                        )}

                        {/* Completed Overlay */}
                        {status === 'completed' && (
                          <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                            <div className="bg-green-500 rounded-full p-1.5">
                              <Check className="w-4 h-4 text-white" strokeWidth={3} />
                            </div>
                          </div>
                        )}

                        {/* Locked Overlay */}
                        {isLessonLocked && status !== 'completed' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-white/70" />
                          </div>
                        )}

                        {/* Play Button (for available lessons) */}
                        {!isLessonLocked && status !== 'completed' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                              <Play className="w-5 h-5 text-white" fill="white" />
                            </div>
                          </div>
                        )}

                        {/* Type Badge */}
                        {lesson.type && (
                          <div className="absolute top-1 left-1">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                              lesson.type === 'Bible Study' || lesson.type === 'Bible' ? 'bg-purple-500 text-white' :
                              lesson.type === 'Science' || lesson.type === 'Nature' ? 'bg-green-500 text-white' :
                              lesson.type === 'History' || lesson.type === 'Social Studies' ? 'bg-amber-500 text-white' :
                              lesson.type === 'Math' ? 'bg-blue-500 text-white' :
                              lesson.type === 'English' || lesson.type === 'Reading' ? 'bg-indigo-500 text-white' :
                              lesson.type === 'Arts & Crafts' || lesson.type === 'Art' ? 'bg-pink-500 text-white' :
                              lesson.type === 'Music' ? 'bg-rose-500 text-white' :
                              lesson.type === 'Physical Education' ? 'bg-orange-500 text-white' :
                              lesson.type === 'Life Skills' ? 'bg-teal-500 text-white' :
                              lesson.type === 'Technology' ? 'bg-cyan-500 text-white' :
                              'bg-gray-500 text-white'
                            }`}>
                              {lesson.type}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title (truncated) */}
                      <p className="text-white/80 text-[10px] font-medium mt-1 truncate px-0.5">
                        {lesson.title}
                      </p>
                    </div>
                  );
                })}

                {/* Fill remaining space if less than 3 lessons */}
                {dayLessons.length < 3 && Array.from({ length: 3 - dayLessons.length }).map((_, i) => (
                  <div key={`placeholder-${i}`} className="aspect-[9/16] rounded-lg bg-white/5 border border-dashed border-white/10" />
                ))}
              </div>
            );
          })()}
        </section>

        {/* Featured Carousel */}
        {!loading && featuredBooks.length > 0 && (
          <>
            <SectionTitle 
              title="Featured Stories" 
              icon="⭐"
              color="#FFD700"
            />
            <FeaturedCarousel 
              books={featuredBooks} 
              onBookClick={(id, isPlaylist) => {
                if (isPlaylist) {
                  navigate(`/audio/playlist/${id}`);
                } else {
                  handleBookClick(id);
                }
              }} 
            />
          </>
        )}

        {/* Daily Tasks Section - Portrait Thumbnail Carousel Style */}
        <section className="mt-4">
          <SectionTitle 
            title="Daily Tasks" 
            icon="✅"
            color="#4CAF50"
          />
          <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
            <div className="flex space-x-3 px-4">
              
              {/* Daily Key Task */}
              <div
                className={`relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 ${
                  hasEngagedDailyKey ? 'cursor-default' : 'cursor-pointer'
                }`}
                onClick={() => !hasEngagedDailyKey && handleDailyKeyClick()}
              >
                <div className={`relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 ${
                  hasEngagedDailyKey ? 'border-[#FFD700]/30' : 'border-[#FFD700]'
                }`}>
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8B4513] to-[#5c2e0b]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 30% 20%, #FFD700 2%, transparent 8%), radial-gradient(circle at 70% 80%, #FFD700 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center mb-2">
                      <Key size={36} className="text-[#FFD700]" fill="#B8860B" />
                    </div>
                    <span className="text-[#FFD700] text-sm font-bold font-display text-center px-2">
                      Daily Key
                    </span>
                    <span className="text-white/60 text-[10px] text-center px-2 mt-1">
                      Unlock rewards
                    </span>
                  </div>
                  
                  {/* Completed Overlay - Faded when done */}
                  {hasEngagedDailyKey && (
                    <>
                      <div className="absolute inset-0 bg-black/50" />
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Memory Task */}
              <div
                className={`relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 ${
                  hasEngagedMemory ? 'cursor-default' : 'cursor-pointer'
                }`}
                onClick={() => !hasEngagedMemory && handleMemoryClick()}
              >
                <div className={`relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 ${
                  hasEngagedMemory ? 'border-[#3949ab]/30' : 'border-[#5c6bc0]'
                }`}>
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e] to-[#0d1442]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 20% 30%, #90caf9 2%, transparent 8%), radial-gradient(circle at 80% 70%, #90caf9 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#5c6bc0]/30 flex items-center justify-center mb-2">
                      <Brain size={36} className="text-[#90caf9]" fill="#64b5f6" />
                    </div>
                    <span className="text-[#90caf9] text-sm font-bold font-display text-center px-2">
                      Memory
                    </span>
                    <span className="text-white/60 text-[10px] text-center px-2 mt-1">
                      Bible challenge
                    </span>
                  </div>
                  
                  {/* Completed Overlay - Faded when done */}
                  {hasEngagedMemory && (
                    <>
                      <div className="absolute inset-0 bg-black/50" />
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Strength Task */}
              <div
                className={`relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 ${
                  hasEngagedStrength ? 'cursor-default' : 'cursor-pointer'
                }`}
                onClick={() => !hasEngagedStrength && handleStrengthClick()}
              >
                <div className={`relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 ${
                  hasEngagedStrength ? 'border-[#FF6B35]/30' : 'border-[#F7931E]'
                }`}>
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#E64A19] to-[#BF360C]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 25% 25%, #FFD700 2%, transparent 8%), radial-gradient(circle at 75% 75%, #FFD700 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center mb-2">
                      <Dumbbell size={36} className="text-[#FFD700]" fill="#FFB300" />
                    </div>
                    <span className="text-[#FFD700] text-sm font-bold font-display text-center px-2">
                      Strength
                    </span>
                    <span className="text-white/60 text-[10px] text-center px-2 mt-1">
                      Build faith
                    </span>
                  </div>
                  
                  {/* Completed Overlay - Faded when done */}
                  {hasEngagedStrength && (
                    <>
                      <div className="absolute inset-0 bg-black/50" />
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Prayer Task */}
              <div
                className={`relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 ${
                  hasEngagedPrayer ? 'cursor-default' : 'cursor-pointer'
                }`}
                onClick={() => !hasEngagedPrayer && handlePrayerClick()}
              >
                <div className={`relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 ${
                  hasEngagedPrayer ? 'border-[#AB47BC]/30' : 'border-[#BA68C8]'
                }`}>
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#7B1FA2] to-[#4A148C]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 30% 40%, #F06292 2%, transparent 8%), radial-gradient(circle at 70% 60%, #F06292 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#F06292]/20 flex items-center justify-center mb-2">
                      <Heart size={36} className="text-[#F06292]" fill="#EC407A" />
                    </div>
                    <span className="text-[#F06292] text-sm font-bold font-display text-center px-2">
                      Prayer
                    </span>
                    <span className="text-white/60 text-[10px] text-center px-2 mt-1">
                      Connect with God
                    </span>
                  </div>
                  
                  {/* Completed Overlay - Faded when done */}
                  {hasEngagedPrayer && (
                    <>
                      <div className="absolute inset-0 bg-black/50" />
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Recently Read Section - Horizontal Carousel */}
        {recentlyReadBooks.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Recently Read" 
              icon="📖"
              color="#4CAF50"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
              <div className="flex space-x-3 px-4">
                {recentlyReadBooks.map((book) => {
                  const isComplete = bookCompletionService.isBookCompleted(book.id || book._id);
                  return (
                    <div 
                      key={book.id || book._id} 
                      className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                    >
                      <BookCard
                        book={book}
                        onClick={() => handleBookClick(book.id || book._id)}
                      />
                      {isComplete && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Recently Played Section - Horizontal Carousel */}
        {recentlyPlayedPlaylists.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Recently Played" 
              icon="🎵"
              color="#9C27B0"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
              <div className="flex space-x-3 px-4">
                {recentlyPlayedPlaylists.map((playlist) => {
                  const playlistItem = {
                    id: playlist._id || playlist.id,
                    title: playlist.title,
                    author: playlist.author || 'Kingdom Builders',
                    coverUrl: playlist.coverImage,
                    isAudio: true,
                  };
                  return (
                    <div 
                      key={playlist._id || playlist.id} 
                      className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                    >
                      <BookCard
                        book={playlistItem}
                        onClick={() => navigate(`/audio/playlist/${playlist._id || playlist.id}`)}
                      />
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1 shadow-lg">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Top Rated Books Section */}
        {topRatedBooks.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Top Rated Books" 
              icon="🏆"
              color="#FFD700"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
              <div className="flex space-x-3 px-4">
                {topRatedBooks.map((book) => (
                  <div 
                    key={book.id || book._id} 
                    className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                  >
                    <BookCard
                      book={book}
                      onClick={() => handleBookClick(book.id || book._id)}
                    />
                    {/* Star badge for top rated */}
                    <div className="absolute top-2 left-2 bg-[#FFD700] rounded-full p-1 shadow-lg">
                      <span className="text-xs">⭐</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Top Rated Playlists Section */}
        {topRatedPlaylists.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Top Rated Playlists" 
              icon="🎵"
              color="#FFD700"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
              <div className="flex space-x-3 px-4">
                {topRatedPlaylists.map((playlist) => {
                  const playlistItem = {
                    id: playlist._id || playlist.id,
                    title: playlist.title,
                    author: playlist.author || 'Kingdom Builders',
                    coverUrl: playlist.coverImage,
                    isAudio: true,
                  };
                  return (
                    <div 
                      key={playlist._id || playlist.id} 
                      className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                    >
                      <BookCard
                        book={playlistItem}
                        onClick={() => navigate(`/audio/playlist/${playlist._id || playlist.id}`)}
                      />
                      {/* Star badge for top rated */}
                      <div className="absolute top-2 left-2 bg-[#FFD700] rounded-full p-1 shadow-lg">
                        <span className="text-xs">⭐</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Explore Categories Sections - Horizontal Carousels */}
        {categoriesLoading ? (
          <div className="text-white/70 text-center py-4 px-4">Loading categories...</div>
        ) : exploreCategories.length === 0 ? (
          <div className="text-white/70 text-center py-4 px-4">No explore categories available</div>
        ) : (
          exploreCategories
            .filter(category => category.showOnExplore === true)
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
                  <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
                    <div className="flex space-x-3 px-4">
                      {allItems.map((item) => (
                        <div 
                          key={item.id || item._id}
                          className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                        >
                          <BookCard
                            book={item}
                            onClick={() => handleItemClick(item)}
                          />
                        </div>
                      ))}
                    </div>
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
