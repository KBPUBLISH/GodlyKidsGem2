import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import StormySeaError from '../components/ui/StormySeaError';
import DailyRewardModal from '../components/features/DailyRewardModal';
import ChallengeGameModal from '../components/features/ChallengeGameModal';
import PrayerGameModal from '../components/features/PrayerGameModal';
import ReviewPromptModal, { shouldShowReviewPrompt } from '../components/features/ReviewPromptModal';
import EmailSignupModal from '../components/features/EmailSignupModal';
import { Key, Brain, Heart, Video, Lock, Check, Play, CheckCircle, Clock, Coins, BookOpen, Sparkles } from 'lucide-react';
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
import { activityTrackingService } from '../services/activityTrackingService';

// Helper to format date as YYYY-MM-DD in local time
const formatLocalDateKey = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Convert kid age to lesson age group
const ageToLessonAgeGroup = (age?: number): string => {
  if (!age || !Number.isFinite(age)) return 'all';
  if (age <= 6) return '4-6';
  if (age <= 8) return '6-8';
  if (age <= 10) return '8-10';
  if (age <= 12) return '10-12';
  return 'all';
};

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

// Check if a purchasable game has been unlocked
const isGamePurchased = (gameId: string): boolean => {
  const purchasedGames = JSON.parse(localStorage.getItem(profileService.getProfileKey('purchased_games')) || '[]');
  return purchasedGames.includes(gameId);
};

// Mark a game as purchased
const markGamePurchased = (gameId: string): void => {
  const purchasedGames = JSON.parse(localStorage.getItem(profileService.getProfileKey('purchased_games')) || '[]');
  if (!purchasedGames.includes(gameId)) {
    purchasedGames.push(gameId);
    localStorage.setItem(profileService.getProfileKey('purchased_games'), JSON.stringify(purchasedGames));
  }
};


const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { coins, spendCoins, kids, currentProfileId } = useUser();
  const [isRetrying, setIsRetrying] = useState(false);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [showChallengeGame, setShowChallengeGame] = useState(false);
  const [showPrayerGame, setShowPrayerGame] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  
  // Coin reward animation state (triggered when returning from lessons)
  const [showCoinReward, setShowCoinReward] = useState(false);
  const [coinRewardAmount, setCoinRewardAmount] = useState(0);
  const [coinRewardSource, setCoinRewardSource] = useState('');
  
  // Clear any old game engagement localStorage on mount (legacy cleanup)
  useEffect(() => {
    localStorage.removeItem('memory_game_engaged');
    localStorage.removeItem('daily_key_engaged');
    localStorage.removeItem('strength_game_engaged');
    localStorage.removeItem('prayer_game_engaged');
  }, []);

  // Fix scroll lock: Reset body overflow when page mounts (in case modal left it stuck)
  useEffect(() => {
    // Reset any stuck overflow on mount
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // Also reset when page becomes visible (e.g., returning from another tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check for pending coin reward animation (from lessons)
  useEffect(() => {
    const pendingReward = localStorage.getItem('godlykids_pending_coin_reward');
    if (pendingReward) {
      try {
        const { amount, source } = JSON.parse(pendingReward);
        localStorage.removeItem('godlykids_pending_coin_reward');
        
        // Small delay to let the page render first
        setTimeout(() => {
          setCoinRewardAmount(amount);
          setCoinRewardSource(source);
          setShowCoinReward(true);
          
          // Auto-hide after 3.5 seconds
          setTimeout(() => {
            setShowCoinReward(false);
          }, 3500);
        }, 300);
      } catch (e) {
        localStorage.removeItem('godlykids_pending_coin_reward');
      }
    }
  }, []);
  
  // Game purchase state - tracks purchased games to update UI without reload
  const [purchasedGamesState, setPurchasedGamesState] = useState<string[]>(() => {
    const stored = localStorage.getItem(profileService.getProfileKey('purchased_games'));
    return stored ? JSON.parse(stored) : [];
  });
  
  // Success notification state
  const [unlockSuccess, setUnlockSuccess] = useState<{ show: boolean; gameName: string }>({ show: false, gameName: '' });

  // Helper to get cached data from sessionStorage
  // Validates cache to prevent showing incomplete/stale data on mobile
  const getCached = (key: string): any[] => {
    try {
      const cached = sessionStorage.getItem(`godlykids_home_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Don't trust cache with suspiciously few items for trending/featured sections
        if ((key.includes('trending') || key.includes('featured')) && Array.isArray(data) && data.length < 2) {
          console.log(`⚠️ Cache for ${key} looks incomplete (${data.length} items), ignoring`);
          sessionStorage.removeItem(`godlykids_home_${key}`); // Clear bad cache
          return [];
        }
        return data;
      }
      return [];
    } catch { return []; }
  };
  
  // Lessons state - initialize from cache if available
  const [lessons, setLessons] = useState<any[]>(() => getCached('lessons'));
  const [lessonsLoading, setLessonsLoading] = useState(() => getCached('lessons').length === 0);
  
  // Debug: Log profile and lessons on mount
  console.log('🏠 HomePage MOUNT - Profile:', currentProfileId, 'Kids:', kids.length, 'Cached lessons:', getCached('lessons').length);
  
  // When profile changes, clear the debounce so we refetch
  useEffect(() => {
    console.log('👤 Profile changed to:', currentProfileId);
    // Clear fetch debounce to allow fresh fetch
    sessionStorage.removeItem('godlykids_home_last_fetch');
  }, [currentProfileId]);

  // Daily planner state: one locked plan per day (3 lessons/day) per kid profile
  const [dayPlans, setDayPlans] = useState<Map<string, any>>(new Map());
  const loadedDaysRef = useRef<Set<string>>(new Set());

  const [weekLessons, setWeekLessons] = useState<Map<string, any>>(new Map());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(getSelectedDay());
  const todayIndex = getTodayIndex();
  
  // Welcome video state - plays once per app session when returning to home
  // Disabled on Android due to video playback issues
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(() => {
    // Check if running on Android
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes('android');
    
    // Disable welcome video on Android
    if (isAndroid) {
      return false;
    }
    
    const hasShownThisSession = sessionStorage.getItem('godlykids_welcome_shown');
    return !hasShownThisSession;
  });
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);
  
  // Explore categories state - initialize from cache if available
  const [exploreCategories, setExploreCategories] = useState<any[]>(() => getCached('categories'));
  const [categoriesLoading, setCategoriesLoading] = useState(() => getCached('categories').length === 0);
  const [playlists, setPlaylists] = useState<any[]>(() => getCached('playlists'));
  const [playlistsLoading, setPlaylistsLoading] = useState(() => getCached('playlists').length === 0);
  
  // Featured content state - initialize from cache if available
  const [featuredContent, setFeaturedContent] = useState<any[]>(() => getCached('featured'));
  const [featuredLoading, setFeaturedLoading] = useState(() => getCached('featured').length === 0);
  
  // Trending episodes state (top 10 by play count) - always fresh, no cache
  const [trendingEpisodes, setTrendingEpisodes] = useState<any[]>([]);
  const [trendingEpisodesLoading, setTrendingEpisodesLoading] = useState(true);
  
  // Trending books state (top 10 by read count) - always fresh, no cache
  const [trendingBooks, setTrendingBooks] = useState<any[]>([]);
  const [trendingBooksLoading, setTrendingBooksLoading] = useState(true);
  
  // Recently Read/Played state
  const [recentlyReadBooks, setRecentlyReadBooks] = useState<any[]>([]);
  const [recentlyPlayedPlaylists, setRecentlyPlayedPlaylists] = useState<any[]>([]);
  
  // Top Rated content state - initialize from cache if available
  const [topRatedBooks, setTopRatedBooks] = useState<any[]>(() => getCached('topBooks'));
  const [topRatedPlaylists, setTopRatedPlaylists] = useState<any[]>(() => getCached('topPlaylists'));
  
  // Book Series state - initialize from cache if available
  const [bookSeries, setBookSeries] = useState<any[]>(() => getCached('series'));
  
  // Dynamic games from backend - initialize from cache if available
  const [dynamicGames, setDynamicGames] = useState<any[]>(() => getCached('games'));
  const [gamesLoading, setGamesLoading] = useState(() => getCached('games').length === 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  
  // Diagnostic: Log every time HomePage mounts
  useEffect(() => {
    const mountId = Math.random().toString(36).slice(2, 8);
    console.log(`🏠 HomePage MOUNT [${mountId}]`, new Date().toISOString());
    return () => {
      console.log(`🏠 HomePage UNMOUNT [${mountId}]`, new Date().toISOString());
    };
  }, []);
  
  // Track last fetch time to prevent excessive refetching (debounce)
  // Use sessionStorage so it persists across component remounts
  const FETCH_DEBOUNCE_MS = 120000; // Don't refetch within 2 minutes

  // Check if we should show the review prompt (immediately on home page)
  useEffect(() => {
    // Skip in DeSpia to reduce crash surface
    const isDespia = /despia/i.test(navigator.userAgent);
    if (isDespia) {
      console.log('⏭️ Skipping review prompt in DeSpia wrapper');
      return;
    }
    
    // Short delay to let the page render first
    const timer = setTimeout(() => {
      try {
        if (shouldShowReviewPrompt()) {
          console.log('🌟 Showing review prompt on home page!');
          setShowReviewPrompt(true);
        }
      } catch (e) {
        console.error('Review prompt error:', e);
      }
    }, 1000); // 1 second delay after page load
    
    return () => clearTimeout(timer);
  }, []);

  // Show email signup popup for web users after 30 seconds
  useEffect(() => {
    // Skip in DeSpia native app
    const isDespia = /despia/i.test(navigator.userAgent);
    if (isDespia) return;

    // Skip if already submitted or dismissed this session
    const hasSubmitted = localStorage.getItem('gk_email_signup_submitted');
    const hasDismissed = sessionStorage.getItem('gk_email_signup_dismissed');
    if (hasSubmitted || hasDismissed) return;

    // Show after 30 seconds in the app
    const timer = setTimeout(() => {
      setShowEmailSignup(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  // Safeguard: If no books are loaded and we're not loading, try to refresh
  useEffect(() => {
    if (!loading && books.length === 0) {
      // Use a small timeout to avoid conflict with initial load
      const timer = setTimeout(() => {
        refreshBooks();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, books, refreshBooks]);

  const handleDailyKeyClick = () => {
    // Track game play for Report Card
    activityTrackingService.trackGamePlayed('daily_key', 'Daily Key');
    setShowDailyReward(true);
  };

  const handleMemoryClick = () => {
    // Track game play for Report Card
    activityTrackingService.trackGamePlayed('memory_challenge', 'Memory Challenge');
    setShowChallengeGame(true);
  };

  const handlePrayerClick = async () => {
    // Track game play for Report Card
    activityTrackingService.trackGamePlayed('prayer_game', 'Prayer Game');

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

  // Fetch lessons, categories, playlists, featured content, and games
  // With debounce to prevent excessive refetching when app comes back from background
  // IMPORTANT: debounce is per-profile so switching parent<->kid always triggers fetch.
  useEffect(() => {
    const now = Date.now();
    const profileKey = currentProfileId ?? 'parent';
    const lastFetchKey = `godlykids_home_last_fetch_${profileKey}`;
    const lastFetchTimeStr = sessionStorage.getItem(lastFetchKey);
    const lastFetch = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;
    const timeSinceLastFetch = now - lastFetch;
    
    // Get cached lessons to check if we have data
    const cachedLessons = getCached('lessons');
    const hasLessonsData = cachedLessons && cachedLessons.length > 0;
    
    // Skip if we fetched recently AND we have cached data
    // Always fetch if cache is empty (even within debounce window)
    if (timeSinceLastFetch < FETCH_DEBOUNCE_MS && lastFetch > 0 && hasLessonsData) {
      console.log(`⏸️ HomePage(${profileKey}): Using cached data, last fetch was ${Math.round(timeSinceLastFetch / 1000)}s ago, cached lessons: ${cachedLessons.length}`);
      setLessons(cachedLessons);
      setLessonsLoading(false);
      setCategoriesLoading(false);
      setPlaylistsLoading(false);
      setFeaturedLoading(false);
      setGamesLoading(false);
      
      // Always fetch trending data since it's not cached (real-time updates)
      fetchTrendingEpisodes();
      fetchTrendingBooks();
      return;
    }
    
    console.log(`🔄 HomePage(${profileKey}): Fetching all data... (cached lessons: ${hasLessonsData ? cachedLessons.length : 0})`);
    sessionStorage.setItem(lastFetchKey, now.toString());
    
    fetchLessons();
    fetchExploreCategories();
    fetchPlaylists();
    fetchFeaturedContent();
    fetchTrendingEpisodes();
    fetchTrendingBooks();
    fetchTopRatedContent();
    fetchDynamicGames();
    fetchBookSeries();
  }, [currentProfileId]);
  
  // Helper to cache data in sessionStorage
  const cacheData = (key: string, data: any[]) => {
    try {
      sessionStorage.setItem(`godlykids_home_${key}`, JSON.stringify(data));
    } catch (e) {
      console.log('⚠️ Failed to cache data:', key);
    }
  };
  
  // Fetch dynamic games from backend
  const fetchDynamicGames = async () => {
    try {
      console.log('🎮 Fetching dynamic games...');
      const games = await ApiService.getDailyTaskGames();
      console.log('🎮 Dynamic games received:', games.length, games);
      setDynamicGames(games);
      cacheData('games', games);
    } catch (error) {
      console.error('❌ Error fetching dynamic games:', error);
    } finally {
      setGamesLoading(false);
    }
  };

  // Load a single day's plan using the daily planner API (3 lessons/day, avoids repeats, prefers unwatched)
  const loadDayPlan = async (dateKey: string, forceLoad = false) => {
    if (!currentProfileId) return null;

    if (!forceLoad && loadedDaysRef.current.has(dateKey)) {
      return dayPlans.get(dateKey);
    }

    loadedDaysRef.current.add(dateKey);
    const kid = kids?.find((k: any) => String(k.id) === String(currentProfileId));
    const ageGroup = ageToLessonAgeGroup(kid?.age);

    try {
      const plan = await ApiService.getLessonPlannerDay(currentProfileId, dateKey, ageGroup);
      if (plan && plan.slots) {
        setDayPlans(prev => {
          const next = new Map(prev);
          next.set(dateKey, plan);
          return next;
        });
        return plan;
      }
      loadedDaysRef.current.delete(dateKey);
      return null;
    } catch (e) {
      loadedDaysRef.current.delete(dateKey);
      return null;
    }
  };

  const fetchLessons = async () => {
    try {
      // For kid profiles, use daily planner (3 lessons/day)
      if (currentProfileId) {
        const weekDays = getWeekDays();
        const selectedDate = weekDays[selectedDayIndex] || new Date();
        selectedDate.setHours(0, 0, 0, 0);
        const dateKey = formatLocalDateKey(selectedDate);

        const plan = await loadDayPlan(dateKey);
        const lessonsFromPlan = plan?.slots?.map((s: any) => s.lesson).filter(Boolean) || [];
        setLessons(lessonsFromPlan);
        cacheData('lessons', lessonsFromPlan);
        setWeekLessons(new Map()); // not used in planner mode
        return;
      }

      // Parent profile fallback: fetch all lessons (used mainly for portal/dev)
      const data = await ApiService.getLessons();
      setLessons(data);
      cacheData('lessons', data);
    } catch (error) {
      console.error('❌ Error fetching lessons:', error);
    } finally {
      setLessonsLoading(false);
    }
  };

  // Handle app resume from background (iOS/mobile) - refetch data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 App became visible again - refreshing data');
        
        // Check lessons cache
        const cachedLessons = getCached('lessons');
        if (!cachedLessons || cachedLessons.length === 0) {
          console.log('📱 No cached lessons on resume, fetching...');
          fetchLessons();
        }
        
        // Always refresh trending data on app resume for real-time updates
        console.log('📱 Refreshing trending data...');
        fetchTrendingEpisodes();
        fetchTrendingBooks();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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

  // Handle welcome video end - mark as shown and hide video
  const handleWelcomeVideoEnd = () => {
    sessionStorage.setItem('godlykids_welcome_shown', 'true');
    setShowWelcomeVideo(false);
  };

  // Auto-play welcome video when component mounts
  useEffect(() => {
    if (showWelcomeVideo && welcomeVideoRef.current) {
      welcomeVideoRef.current.play().catch(() => {
        // If autoplay fails (browser policy), skip the video
        handleWelcomeVideoEnd();
      });
    }
  }, [showWelcomeVideo]);

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
      cacheData('categories', exploreOnly);
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
      cacheData('playlists', data);
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
      cacheData('featured', data);
    } catch (error) {
      console.error('❌ Error fetching featured content:', error);
    } finally {
      setFeaturedLoading(false);
    }
  };

  // Fetch trending episodes (top 10 by play count)
  const fetchTrendingEpisodes = async () => {
    try {
      setTrendingEpisodesLoading(true);
      const data = await ApiService.getTrendingEpisodes(10);
      console.log('📈 Trending episodes loaded:', data.length, 'items');
      setTrendingEpisodes(data);
      // No caching - always fetch fresh for real-time trending
    } catch (error) {
      console.error('❌ Error fetching trending episodes:', error);
    } finally {
      setTrendingEpisodesLoading(false);
    }
  };

  // Fetch trending books (top 10 by read count)
  const fetchTrendingBooks = async () => {
    try {
      setTrendingBooksLoading(true);
      const data = await ApiService.getTrendingBooks(10);
      console.log('📚 Trending books loaded:', data.length, 'items');
      setTrendingBooks(data);
      // No caching - always fetch fresh for real-time trending
    } catch (error) {
      console.error('❌ Error fetching trending books:', error);
    } finally {
      setTrendingBooksLoading(false);
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
      cacheData('topBooks', topBooks);
      cacheData('topPlaylists', topPlaylists);
    } catch (error) {
      console.error('❌ Error fetching top-rated content:', error);
    }
  };

  // Fetch book series
  const fetchBookSeries = async () => {
    try {
      const data = await ApiService.getBookSeries();
      console.log('📚 Book series loaded:', data.length);
      setBookSeries(data);
      cacheData('series', data);
    } catch (error) {
      console.error('❌ Error fetching book series:', error);
    }
  };

  // Compute recently read items (books or series) when books and series are loaded
  useEffect(() => {
    if (books.length > 0) {
      const recentBookIds = readingProgressService.getRecentlyReadBookIds(20);
      
      // Build a map of bookId -> series for quick lookup
      const bookToSeriesMap = new Map<string, any>();
      bookSeries.forEach(series => {
        series.books?.forEach((bookRef: any) => {
          const bookId = bookRef.book?._id || bookRef.book;
          if (bookId) {
            bookToSeriesMap.set(bookId.toString(), series);
          }
        });
      });
      
      // Track which series we've already added to avoid duplicates
      const addedSeriesIds = new Set<string>();
      const recentItems: any[] = [];
      
      recentBookIds.forEach(id => {
        const book = books.find(b => (b.id === id || (b as any)._id === id));
        if (!book) return;
        
        const bookId = book.id || (book as any)._id;
        const series = bookToSeriesMap.get(bookId);
        
        if (series && !addedSeriesIds.has(series._id)) {
          // This book is part of a series - show the series instead
          addedSeriesIds.add(series._id);
          recentItems.push({ ...series, _isSeries: true });
        } else if (!series) {
          // This book is standalone - show it directly
          recentItems.push({ ...book, _isSeries: false });
        }
        // If series already added, skip this book
      });
      
      setRecentlyReadBooks(recentItems.slice(0, 10));
      console.log('📚 Recently read items:', recentItems.length, '(books + series)');
    }
  }, [books, bookSeries]);

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
        // coverUrl is already set by transformBook, fallback to coverImage if not
        coverUrl: item.coverUrl || item.coverImage || (item as any).files?.coverImage || '',
      }))
    : books.slice(0, 5);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
      style={{ 
        WebkitOverflowScrolling: 'touch', 
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}
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

      <PrayerGameModal
        isOpen={showPrayerGame}
        onClose={() => setShowPrayerGame(false)}
      />

      <ReviewPromptModal
        isOpen={showReviewPrompt}
        onReviewSubmitted={() => setShowReviewPrompt(false)}
      />

      <EmailSignupModal
        isOpen={showEmailSignup}
        onClose={() => setShowEmailSignup(false)}
      />

      <div className="px-4 pt-28 space-y-2 pb-52">

        {/* Welcome Video - Plays once per session above Week's Progress */}
        {showWelcomeVideo && (
          <div className="flex flex-col items-center mb-4">
            <div className="relative aspect-[9/16] w-[calc((100%-16px)/3)] rounded-lg overflow-hidden bg-transparent">
              <video
                ref={welcomeVideoRef}
                src="/assets/videos/welcome.mp4"
                className="w-full h-full object-contain bg-transparent"
                autoPlay
                muted
                playsInline
                onEnded={handleWelcomeVideoEnd}
                onError={handleWelcomeVideoEnd}
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
            <p className="mt-3 text-white font-display font-bold text-lg text-center">
              Hi Explorer! Let's Dive in. 🌊
            </p>
          </div>
        )}

        {/* ✨ Verse of the Day - Featured Section */}
        {(() => {
          // Filter Daily Verse lessons and apply auto-rotate logic
          const dailyVerseLessons = lessons.filter((l: any) => l.type === 'Daily Verse' && !isLocked(l));
          
          if (dailyVerseLessons.length === 0) return null;
          
          // Sort by _id for consistent ordering
          const sortedVerses = [...dailyVerseLessons].sort((a: any, b: any) => 
            (a._id || '').localeCompare(b._id || '')
          );
          
          // Get day of year for rotation
          const now = new Date();
          const start = new Date(now.getFullYear(), 0, 0);
          const diff = now.getTime() - start.getTime();
          const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
          const todayIndex = dayOfYear % sortedVerses.length;
          
          // Get today's verse, prefer unwatched
          let todaysVerse = sortedVerses[todayIndex];
          if (todaysVerse && isCompleted(todaysVerse._id)) {
            const unwatched = sortedVerses.find((v: any) => !isCompleted(v._id));
            if (unwatched) todaysVerse = unwatched;
          }
          
          if (!todaysVerse) return null;
          
          const verseCompleted = isCompleted(todaysVerse._id);
          
          return (
            <section className="mb-4">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-6 h-6 text-[#FFD700]" />
                <h2 className="text-xl font-bold text-[#FFD700] font-display">Verse of the Day</h2>
                <div className="flex items-center gap-1 ml-auto bg-[#FFD700]/20 rounded-full px-3 py-1">
                  <Coins className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-[#FFD700] text-sm font-bold">+50</span>
                </div>
              </div>
              
              {/* Large Featured Card - constrained for web */}
              <div
                className="relative w-full max-w-md mx-auto sm:max-w-lg md:max-w-xl aspect-video rounded-2xl overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-[#FFD700]/20 border-2 border-[#FFD700]/30"
                onClick={() => navigate(`/lesson/${todaysVerse._id}`)}
              >
                {/* Background Image */}
                {todaysVerse.video?.thumbnail ? (
                  <img
                    src={todaysVerse.video.thumbnail}
                    alt={todaysVerse.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-500">
                    <Sparkles className="w-24 h-24 text-white/30" />
                  </div>
                )}
                
                {/* Golden Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-amber-500/20" />
                
                {/* Completed Overlay */}
                {verseCompleted && (
                  <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                    <div className="bg-green-500 rounded-full p-4">
                      <Check className="w-12 h-12 text-white" />
                    </div>
                  </div>
                )}
                
                {/* Play Button */}
                {!verseCompleted && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-[#FFD700] rounded-full p-5 shadow-lg shadow-black/30 transform hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-[#5c2e0b] fill-[#5c2e0b]" />
                    </div>
                  </div>
                )}
                
                {/* Title & Badge */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-[#FFD700] rounded-full px-3 py-1">
                      <span className="text-[#5c2e0b] text-xs font-bold">✨ TODAY'S VERSE</span>
                    </div>
                  </div>
                  <h3 className="text-white text-xl font-bold mb-1 drop-shadow-lg font-display">
                    {todaysVerse.title}
                  </h3>
                  {todaysVerse.description && (
                    <p className="text-white/80 text-sm line-clamp-2">
                      {todaysVerse.description}
                    </p>
                  )}
                </div>
                
                {/* Sparkle decoration */}
                <div className="absolute top-4 right-4">
                  <Sparkles className="w-8 h-8 text-[#FFD700] animate-pulse" />
                </div>
              </div>
            </section>
          );
        })()}

        {/* Weekly Progress Tracker + Daily Lessons Section */}
        <section className="pb-2">
          {/* Weekly Tracker - Compact Mon-Sat progress */}
          <WeeklyLessonTracker
            selectedDay={selectedDayIndex}
            onDaySelect={(dayIndex) => {
              setSelectedDayIndex(dayIndex);
              setSelectedDay(dayIndex);
              // In kid profile, load the selected day's plan immediately
              if (currentProfileId) {
                const weekDays = getWeekDays();
                const selectedDate = weekDays[dayIndex] || new Date();
                selectedDate.setHours(0, 0, 0, 0);
                const dateKey = formatLocalDateKey(selectedDate);
                loadDayPlan(dateKey).then((plan) => {
                  const lessonsFromPlan = plan?.slots?.map((s: any) => s.lesson).filter(Boolean) || [];
                  setLessons(lessonsFromPlan);
                  cacheData('lessons', lessonsFromPlan);
                });
              }
            }}
            dayCompletions={[0, 1, 2, 3, 4, 5, 6].map(i => isDayComplete(lessons, i))}
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
              // In kid profile we already loaded the selected day's planner lessons into `lessons`.
              // Exclude Daily Verse lessons - they have their own featured section
              const allLessons = currentProfileId ? lessons : getLessonsForDay(lessons, selectedDayIndex);
              const dayLessons = allLessons.filter((l: any) => l.type !== 'Daily Verse');
              const completedCount = dayLessons.filter((l: any) => isCompleted(l._id || l.id)).length;
              return dayLessons.length > 0 ? (
                <span className="text-white/60 text-xs font-semibold">
                  {completedCount}/{dayLessons.length} Complete
                </span>
              ) : null;
            })()}
          </div>

          {/* Parent CTA - always show a single "Create Child Profile" card (clean white UI) */}
          {currentProfileId === null && (
            <div className="rounded-2xl p-6 mb-4 shadow-lg bg-white text-center border border-black/5">
              <div className="flex justify-center gap-2 mb-3">
                <span className="text-4xl">👦</span>
                <span className="text-4xl">👧</span>
              </div>

              <h3 className="text-[#1a3a52] font-bold text-xl mb-2 font-display">
                Create a Child Profile
              </h3>
              <p className="text-black/60 text-sm mb-4">
                Daily Lessons are personalized for kids. Create a child profile to start watching.
              </p>

              <button
                onClick={() => navigate('/profile')}
                className="inline-flex items-center justify-center gap-2 bg-[#1a3a52] text-white font-bold px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <span className="text-lg">+</span>
                Create Child Profile
              </button>
            </div>
          )}

          {/* Lessons Path - Gamified Learning Path Style */}
          {currentProfileId === null ? null : lessonsLoading ? (
            <div className="text-white/70 text-center py-8 px-4">Loading lessons...</div>
          ) : (() => {
            // In kid profile we already loaded the selected day's planner lessons into `lessons`.
            // Exclude Daily Verse lessons - they have their own featured section
            const dayLessons = lessons.filter((l: any) => l.type !== 'Daily Verse');
            const isFutureDay = selectedDayIndex > todayIndex && todayIndex !== -1;

            if (dayLessons.length === 0) {
              return (
                <div className="rounded-2xl p-6 text-center border-2 border-[#1E88E5]/50 shadow-lg" style={{ background: 'linear-gradient(135deg, #1565C0 0%, #1976D2 50%, #2196F3 100%)' }}>
                  <div className="text-4xl mb-2">🌟</div>
                  <h3 className="text-white font-bold text-lg mb-1 drop-shadow-md">Rest & Play Day!</h3>
                  <p className="text-white/90 text-sm">No lessons today. Enjoy reading stories or playing games with family!</p>
                  <p className="text-white/70 text-xs mt-2">Tap another day above to view those lessons.</p>
                </div>
              );
            }

            return (
              <div 
                className="relative rounded-2xl overflow-hidden py-6 px-4 border-2 border-[#1E88E5]/50 shadow-lg"
                style={{
                  background: 'linear-gradient(180deg, #1565C0 0%, #1976D2 40%, #42A5F5 70%, #64B5F6 100%)'
                }}
              >
                {/* Sun decoration */}
                <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-gradient-to-br from-[#FFE44D] to-[#FFA500] opacity-80 blur-sm" />
                <div className="absolute top-5 right-5 w-14 h-14 rounded-full bg-gradient-to-br from-[#FFFACD] to-[#FFD700] opacity-90" />
                
                {/* Decorative clouds/bubbles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-8 left-6 w-12 h-5 bg-white/40 rounded-full blur-sm" />
                  <div className="absolute top-6 left-10 w-8 h-4 bg-white/50 rounded-full blur-[2px]" />
                  <div className="absolute top-20 left-4 w-6 h-3 bg-white/30 rounded-full blur-sm" />
                  <div className="absolute top-16 right-24 w-10 h-4 bg-white/35 rounded-full blur-sm" />
                  
                  {/* Sparkle effects */}
                  <div className="absolute top-12 left-[40%] w-2 h-2 bg-white/60 rounded-full animate-pulse" />
                  <div className="absolute top-24 right-[30%] w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute bottom-16 left-[20%] w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                {/* Path container - max width for iPad/larger screens */}
                <div className="relative flex flex-col items-center max-w-lg mx-auto">
                  {dayLessons.map((lesson: any, index: number) => {
                    const status = getLessonStatus(lesson);
                    const isLessonLocked = status === 'locked';
                    const canWatch = !isFutureDay && !isLessonLocked;
                    const isEven = index % 2 === 0;
                    const isCompleted = status === 'completed';

                    return (
                      <div 
                        key={lesson._id || lesson.id} 
                        className="relative w-full animate-[lessonPop_0.5s_ease-out_forwards]"
                        style={{ 
                          opacity: 0,
                          animationDelay: `${index * 0.15}s`
                        }}
                      >
                        {/* Connecting path line */}
                        {index < dayLessons.length - 1 && (
                          <div 
                            className="absolute left-1/2 top-[70px] md:top-[85px] -translate-x-1/2 z-0 animate-[pathDraw_0.3s_ease-out_forwards]"
                            style={{ 
                              opacity: 0,
                              animationDelay: `${(index * 0.15) + 0.3}s`
                            }}
                          >
                            <svg width="60" height="50" viewBox="0 0 60 50" className="overflow-visible md:scale-125">
                              <path 
                                d={isEven ? "M30 0 Q30 25, 45 50" : "M30 0 Q30 25, 15 50"}
                                stroke={isCompleted ? "#4CAF50" : "rgba(255,255,255,0.4)"}
                                strokeWidth="4"
                                strokeDasharray={isCompleted ? "0" : "8 4"}
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Lesson node */}
                        <div 
                          className={`flex items-center gap-4 md:gap-6 mb-4 md:mb-6 px-2 md:px-4 ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
                        >
                          {/* Circle thumbnail */}
                          <div 
                            className={`relative cursor-pointer transition-all duration-300 flex-shrink-0 ${canWatch ? 'hover:scale-110 active:scale-95' : ''}`}
                            onClick={() => {
                              if (isFutureDay) {
                                alert(`📅 Coming soon!\n\nThis lesson "${lesson.title}" will be available on ${
                                  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
                                    getWeekDays()[selectedDayIndex]?.getDay() || 0
                                  ]
                                }.`);
                              } else if (canWatch) {
                                handleLessonClick(lesson);
                              }
                            }}
                          >
                            {/* Glow effect for current available */}
                            {canWatch && !isCompleted && (
                              <div className="absolute -inset-2 rounded-full bg-[#FFD700]/30 animate-pulse" />
                            )}

                            {/* Main circle - responsive sizing */}
                            <div className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 shadow-xl ${
                              isCompleted 
                                ? 'border-green-500 ring-4 ring-green-500/30' 
                                : isLessonLocked || isFutureDay
                                  ? 'border-gray-500/50 grayscale opacity-60' 
                                  : 'border-[#FFD700] ring-4 ring-[#FFD700]/30'
                            }`}>
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

                              {/* Completed overlay */}
                              {isCompleted && (
                                <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                                  <div className="bg-green-500 rounded-full p-2 shadow-lg">
                                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                                  </div>
                                </div>
                              )}

                              {/* Locked overlay */}
                              {(isLessonLocked || isFutureDay) && !isCompleted && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                  {isFutureDay ? (
                                    <Clock className="w-6 h-6 text-white/70" />
                                  ) : (
                                    <Lock className="w-6 h-6 text-white/70" />
                                  )}
                                </div>
                              )}

                              {/* Play button for available */}
                              {canWatch && !isCompleted && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <div className="bg-white/90 rounded-full p-2 shadow-lg">
                                    <Play className="w-5 h-5 text-[#3E1F07] ml-0.5" fill="#3E1F07" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Lesson number badge - responsive */}
                            <div className={`absolute -top-1 -left-1 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold shadow-md border-2 border-white ${
                              isCompleted 
                                ? 'bg-green-500 text-white' 
                                : isLessonLocked || isFutureDay
                                  ? 'bg-gray-500 text-white' 
                                  : 'bg-[#FFD700] text-[#3E1F07]'
                            }`}>
                              {index + 1}
                            </div>
                          </div>

                          {/* Lesson info card - responsive width */}
                          <div 
                            className={`flex-1 max-w-[180px] md:max-w-[240px] ${isEven ? 'text-left' : 'text-right'}`}
                            onClick={() => {
                              if (!isFutureDay && canWatch) {
                                handleLessonClick(lesson);
                              }
                            }}
                          >
                            <div className={`inline-block px-3 py-2 rounded-xl shadow-lg cursor-pointer transition-all hover:scale-105 ${
                              isCompleted 
                                ? 'bg-green-500/20 border border-green-500/30' 
                                : isLessonLocked || isFutureDay
                                  ? 'bg-white/5 border border-white/10' 
                                  : 'bg-[#FFD700]/20 border border-[#FFD700]/30'
                            }`}>
                              {/* Type badge */}
                              {lesson.type && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mb-1 ${
                                  lesson.type === 'Bible Study' || lesson.type === 'Bible' ? 'bg-purple-500 text-white' :
                                  lesson.type === 'Science' || lesson.type === 'Nature' ? 'bg-green-500 text-white' :
                                  lesson.type === 'History' || lesson.type === 'Social Studies' ? 'bg-amber-500 text-white' :
                                  lesson.type === 'Math' ? 'bg-blue-500 text-white' :
                                  lesson.type === 'English' || lesson.type === 'Reading' ? 'bg-indigo-500 text-white' :
                                  lesson.type === 'Arts & Crafts' || lesson.type === 'Art' ? 'bg-pink-500 text-white' :
                                  lesson.type === 'Music' ? 'bg-rose-500 text-white' :
                                  'bg-gray-500 text-white'
                                }`}>
                                  {lesson.type}
                                </span>
                              )}
                              <h4 className={`text-sm md:text-base font-bold font-display leading-tight ${
                                isCompleted ? 'text-green-400' : isLessonLocked || isFutureDay ? 'text-white/50' : 'text-white'
                              }`}>
                                {lesson.title}
                              </h4>
                              {isCompleted && (
                                <p className="text-green-400 text-[10px] font-semibold mt-1">✓ Completed</p>
                              )}
                              {isFutureDay && !isCompleted && (
                                <p className="text-white/40 text-[10px] mt-1">Coming soon</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Completion message if all done */}
                  {dayLessons.every((l: any) => getLessonStatus(l) === 'completed') && (
                    <div className="mt-4 text-center animate-bounce">
                      <div className="inline-block bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-4 py-2 rounded-full shadow-lg">
                        <span className="text-[#3E1F07] font-bold text-sm">🎉 All Done for Today!</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ocean waves at bottom of lessons container */}
                <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden pointer-events-none">
                  {/* Deep water base */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1a4a6e] to-transparent" />
                  
                  {/* Back wave */}
                  <svg
                    className="absolute bottom-8 left-0 w-[200%] h-12 animate-[wave_8s_ease-in-out_infinite]"
                    viewBox="0 0 1200 60"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,30 Q150,50 300,30 T600,30 T900,30 T1200,30 L1200,60 L0,60 Z"
                      fill="rgba(30, 80, 120, 0.5)"
                    />
                  </svg>
                  
                  {/* Front wave */}
                  <svg
                    className="absolute bottom-4 left-0 w-[200%] h-10 animate-[wave_6s_ease-in-out_infinite_reverse]"
                    viewBox="0 0 1200 60"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,30 Q150,10 300,30 T600,30 T900,30 T1200,30 L1200,60 L0,60 Z"
                      fill="rgba(40, 100, 140, 0.6)"
                    />
                  </svg>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Error State - Show when books fail to load */}
        {booksError && !loading && (
          <StormySeaError 
            onRetry={async () => {
              setIsRetrying(true);
              await refreshBooks();
              setIsRetrying(false);
            }}
            message="Something rocked the boat!"
            isLoading={isRetrying}
          />
        )}

        {/* Featured Carousel */}
        {!loading && !booksError && featuredBooks.length > 0 && (
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

        {/* Trending Episodes Section - Top 10 by play count */}
        {!trendingEpisodesLoading && trendingEpisodes.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Trending Episodes" 
              icon="📈"
              color="#FF6B35"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-2 -mx-4 snap-x snap-mandatory">
              <div className="flex space-x-4 px-4">
                {trendingEpisodes.map((episode: any, index: number) => (
                  <div
                    key={episode._id}
                    onClick={() => navigate(`/audio/playlist/${episode.playlist._id}/play/${episode.itemIndex}`)}
                    className="relative flex-shrink-0 w-44 snap-center cursor-pointer group"
                  >
                    {/* Cover Image - Same 3:4 aspect ratio as books */}
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 group-hover:border-orange-400/50 transition-all">
                      <img
                        src={episode.coverImage || episode.playlist.coverImage}
                        alt={episode.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x200/FF6B35/FFFFFF?text=🎵';
                        }}
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white fill-white" />
                      </div>
                      {/* Ranking badge - Top left */}
                      <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white text-base font-black shadow-lg">
                        {index + 1}
                      </div>
                      {/* Premium badge */}
                      {episode.isMembersOnly && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/90 rounded-full text-xs font-bold text-white flex items-center gap-0.5">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    {/* Title */}
                    <div className="mt-2 px-1">
                      <h3 className="text-base font-bold text-white truncate">
                        {episode.title}
                      </h3>
                      <p className="text-sm text-white/60 truncate">
                        {episode.playlist.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Top 10 Books Section - by read count */}
        {!trendingBooksLoading && trendingBooks.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Top 10 Books" 
              icon="📚"
              color="#4CAF50"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-2 -mx-4 snap-x snap-mandatory">
              <div className="flex space-x-4 px-4">
                {trendingBooks.map((book: any, index: number) => (
                  <div
                    key={book._id}
                    onClick={() => navigate(`/book/${book._id}`)}
                    className="relative flex-shrink-0 w-44 snap-center cursor-pointer group"
                  >
                    {/* Cover Image */}
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 group-hover:border-green-400/50 transition-all">
                      <img
                        src={book.coverUrl || book.coverImage || book.files?.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x200/4CAF50/FFFFFF?text=📚';
                        }}
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-white" />
                      </div>
                      {/* Ranking badge - Top left */}
                      <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white text-base font-black shadow-lg">
                        {index + 1}
                      </div>
                      {/* Premium badge */}
                      {book.isMembersOnly && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/90 rounded-full text-xs font-bold text-white flex items-center gap-0.5">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    {/* Title */}
                    <div className="mt-2 px-1">
                      <h3 className="text-base font-bold text-white truncate">
                        {book.title}
                      </h3>
                      <p className="text-sm text-white/60 truncate">
                        {book.author}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Daily Tasks & IQ Games Section - Vertical 9:16 Sliding Cards */}
        <section className="mt-4">
          <SectionTitle 
            title="Daily Tasks & IQ Games" 
            icon="🧠"
            color="#4CAF50"
          />
          <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4 snap-x snap-mandatory">
            <div className="flex space-x-4 px-4">
              
              {/* Daily Key Task */}
              <div
                className="relative w-[52vw] max-w-[220px] flex-shrink-0 snap-center cursor-pointer"
                onClick={handleDailyKeyClick}
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden transition-all border-3 shadow-xl border-[#FFD700] hover:scale-[1.02] active:scale-[0.98]">
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8B4513] to-[#5c2e0b]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 30% 20%, #FFD700 3%, transparent 10%), radial-gradient(circle at 70% 80%, #FFD700 3%, transparent 10%), radial-gradient(circle at 50% 50%, #FFD700 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon & Content - Centered */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center mb-3 border-2 border-[#FFD700]/30">
                      <Key size={36} className="text-[#FFD700]" fill="#B8860B" />
                    </div>
                    <span className="text-[#FFD700] text-lg font-bold font-display text-center px-3">
                      Daily Key
                    </span>
                    <span className="text-white/70 text-xs text-center px-3 mt-1">
                      Unlock rewards
                    </span>
                  </div>
                </div>
              </div>

              {/* Memory Task */}
              <div
                className="relative w-[52vw] max-w-[220px] flex-shrink-0 snap-center cursor-pointer"
                onClick={handleMemoryClick}
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden transition-all border-3 shadow-xl border-[#5c6bc0] hover:scale-[1.02] active:scale-[0.98]">
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e] to-[#0d1442]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 20% 30%, #90caf9 3%, transparent 10%), radial-gradient(circle at 80% 70%, #90caf9 3%, transparent 10%), radial-gradient(circle at 50% 50%, #90caf9 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon & Content - Centered */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#5c6bc0]/30 flex items-center justify-center mb-3 border-2 border-[#5c6bc0]/30">
                      <Brain size={36} className="text-[#90caf9]" fill="#64b5f6" />
                    </div>
                    <span className="text-[#90caf9] text-lg font-bold font-display text-center px-3">
                      Memory
                    </span>
                    <span className="text-white/70 text-xs text-center px-3 mt-1">
                      Bible challenge
                    </span>
                  </div>
                </div>
              </div>

              {/* Prayer Task */}
              <div
                className="relative w-[52vw] max-w-[220px] flex-shrink-0 snap-center cursor-pointer"
                onClick={handlePrayerClick}
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden transition-all border-3 shadow-xl border-[#BA68C8] hover:scale-[1.02] active:scale-[0.98]">
                  {/* Background Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#7B1FA2] to-[#4A148C]" />
                  
                  {/* Decorative Pattern */}
                  <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(circle at 30% 40%, #F06292 3%, transparent 10%), radial-gradient(circle at 70% 60%, #F06292 3%, transparent 10%), radial-gradient(circle at 50% 50%, #F06292 2%, transparent 8%)'
                  }} />
                  
                  {/* Icon & Content - Centered */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-[#F06292]/20 flex items-center justify-center mb-3 border-2 border-[#F06292]/30">
                      <Heart size={36} className="text-[#F06292]" fill="#EC407A" />
                    </div>
                    <span className="text-[#F06292] text-lg font-bold font-display text-center px-3">
                      Prayer
                    </span>
                    <span className="text-white/70 text-xs text-center px-3 mt-1">
                      Connect with God
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Games from Backend */}
              {dynamicGames.map((game) => {
                const isPurchasable = game.isPurchasable === true;
                const gameId = game._id || game.gameId;
                // Check both localStorage helper and React state for purchased status
                const hasUnlocked = isGamePurchased(gameId) || purchasedGamesState.includes(gameId);
                const isLocked = isPurchasable && !hasUnlocked;
                const canAfford = coins >= (game.goldCoinPrice || 0);
                
                return (
                  <div
                    key={gameId}
                    className="relative w-[52vw] max-w-[220px] flex-shrink-0 snap-center cursor-pointer"
                    onClick={() => {
                      if (isLocked) {
                        // Show purchase confirmation
                        if (canAfford) {
                          if (window.confirm(`Unlock "${game.name}" for ${game.goldCoinPrice} gold coins?`)) {
                            // Spend coins and unlock game
                            spendCoins(game.goldCoinPrice || 0, `Unlocked game: ${game.name}`);
                            markGamePurchased(gameId);
                            // Update React state to trigger re-render (no page reload!)
                            setPurchasedGamesState(prev => [...prev, gameId]);
                            // Show success notification
                            setUnlockSuccess({ show: true, gameName: game.name });
                            // Auto-hide after 3 seconds
                            setTimeout(() => setUnlockSuccess({ show: false, gameName: '' }), 3000);
                          }
                        } else {
                          alert(`You need ${game.goldCoinPrice} gold coins to unlock this game. You have ${coins} coins.`);
                        }
                        return;
                      }
                      
                      // Game is unlocked - handle click
                      if (game.url) {
                        // Navigate to in-app webview
                        navigate(`/game?url=${encodeURIComponent(game.url)}&name=${encodeURIComponent(game.name)}`);
                      } else {
                        // No URL - show a message
                        alert(`${game.name} is ready to play! Game content coming soon.`);
                      }
                    }}
                  >
                    <div className={`relative aspect-[9/16] rounded-2xl overflow-hidden transition-all border-3 shadow-xl ${isLocked ? 'border-[#FFD700]' : 'border-[#4CAF50]'}`}>
                      {/* Cover Image or Gradient Background */}
                      {game.coverImage ? (
                        <img 
                          src={game.coverImage} 
                          alt={game.name}
                          className={`absolute inset-0 w-full h-full object-cover ${isLocked ? 'brightness-50' : ''}`}
                        />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${isLocked ? 'from-[#8B4513] to-[#5c2e0b]' : 'from-[#4CAF50] to-[#2E7D32]'}`} />
                      )}
                      
                      {/* Age Rating Badge - Always show */}
                      {game.ageRating && (
                        <div className="absolute top-2 left-2 bg-blue-500/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full z-20 shadow-lg">
                          {game.ageRating === 'All Ages' ? 'Ages 3+' : game.ageRating}
                        </div>
                      )}
                      
                      {/* Lock Overlay for Purchasable Games */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center z-10">
                          <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700] mb-2">
                            <Lock size={24} className="text-[#FFD700]" />
                          </div>
                          <div className="bg-[#FFD700] rounded-full px-3 py-1.5 flex items-center gap-1.5">
                            <Coins size={14} className="text-[#5c2e0b]" />
                            <span className="text-sm font-bold text-[#5c2e0b]">{game.goldCoinPrice}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay with game info */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-4 px-3">
                        <span className="text-white text-base font-bold font-display text-center block drop-shadow-lg">
                          {game.name}
                        </span>
                        {game.description && !isLocked && (
                          <span className="text-white/80 text-xs text-center block mt-1 drop-shadow">
                            {game.description.substring(0, 40)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

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
                {recentlyReadBooks.map((item) => {
                  // Check if this is a series or a standalone book
                  if (item._isSeries) {
                    // Render series card
                    return (
                      <div 
                        key={`series-${item._id}`} 
                        className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] cursor-pointer"
                        onClick={() => navigate(`/book-series/${item._id}`)}
                      >
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all">
                          <div className="aspect-square bg-gradient-to-br from-purple-500 to-indigo-600 relative overflow-hidden">
                            {item.coverImage ? (
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-6xl">📚</span>
                              </div>
                            )}
                            {/* Series badge */}
                            <div className="absolute top-2 left-2 bg-purple-500/90 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                              📚 Series
                            </div>
                            {/* Books count badge */}
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                              {item.books?.length || 0} books
                            </div>
                          </div>
                          <div className="p-2">
                            <h3 className="text-white text-sm font-bold mb-0.5 truncate font-display">
                              {item.title}
                            </h3>
                            {item.author && (
                              <p className="text-white/70 text-xs truncate">{item.author}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // Render standalone book card
                    const isComplete = bookCompletionService.isBookCompleted(item.id || item._id);
                    return (
                      <div 
                        key={item.id || item._id} 
                        className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                      >
                        <BookCard
                          book={item}
                          onClick={() => handleBookClick(item.id || item._id)}
                        />
                        {isComplete && (
                          <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  }
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
                  const isAudiobook = playlist.type === 'Audiobook';
                  return (
                    <div 
                      key={playlist._id || playlist.id} 
                      className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                    >
                      <BookCard
                        book={playlistItem}
                        onClick={() => navigate(`/audio/playlist/${playlist._id || playlist.id}`)}
                      />
                      {/* Type badge */}
                      <div className={`absolute top-2 left-2 ${isAudiobook ? 'bg-amber-600' : 'bg-purple-500'} rounded-full p-1.5 shadow-lg`}>
                        {isAudiobook ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
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
                  const isAudiobook = playlist.type === 'Audiobook';
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
                      {/* Type badge */}
                      <div className={`absolute top-2 right-2 ${isAudiobook ? 'bg-amber-600' : 'bg-purple-500'} rounded-full p-1.5 shadow-lg`}>
                        {isAudiobook ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Book Series Section - At bottom before categories */}
        {bookSeries.length > 0 && (
          <section className="mt-6">
            <SectionTitle 
              title="Book Series" 
              icon="📚"
              color="#9C27B0"
            />
            <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
              <div className="flex space-x-3 px-4">
                {bookSeries.map((series) => (
                  <div 
                    key={series._id} 
                    className="relative flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] cursor-pointer"
                    onClick={() => navigate(`/book-series/${series._id}`)}
                  >
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all">
                      <div className="aspect-square bg-gradient-to-br from-purple-500 to-indigo-600 relative overflow-hidden">
                        {series.coverImage ? (
                          <img 
                            src={series.coverImage} 
                            alt={series.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-6xl">📚</span>
                          </div>
                        )}
                        {/* Books count badge */}
                        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                          {series.books?.length || 0} books
                        </div>
                        {/* Premium badge */}
                        {series.isMembersOnly && (
                          <div className="absolute top-2 right-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b] text-[10px] font-bold px-2 py-1 rounded-full">
                            👑 PREMIUM
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <h3 className="text-white text-sm font-bold mb-0.5 truncate font-display">
                          {series.title}
                        </h3>
                        {series.author && (
                          <p className="text-white/70 text-xs truncate">{series.author}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
        @keyframes wave {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-25%);
          }
        }
      `}</style>

      {/* Game Unlock Success Notification */}
      {unlockSuccess.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-6 py-3 rounded-2xl shadow-2xl border-2 border-white/30 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
            <div>
              <p className="text-[#5c2e0b] font-display font-bold text-sm">Game Unlocked!</p>
              <p className="text-[#5c2e0b]/80 font-display text-xs">{unlockSuccess.gameName} is now available</p>
            </div>
          </div>
        </div>
      )}

      {/* Coin Reward Animation (from lessons) */}
      {showCoinReward && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="animate-in zoom-in-50 fade-in duration-500 flex flex-col items-center">
            {/* Floating coins animation */}
            <div className="relative w-32 h-32 mb-4">
              {/* Background glow */}
              <div className="absolute inset-0 bg-[#FFD700]/30 rounded-full animate-pulse blur-xl"></div>
              {/* Coin icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#FFD700] via-[#FFC107] to-[#FF8F00] rounded-full shadow-lg shadow-[#FFD700]/50 flex items-center justify-center border-4 border-[#FFE082] animate-bounce">
                    <span className="text-[#5c2e0b] font-black text-4xl">$</span>
                  </div>
                  {/* Sparkles */}
                  <div className="absolute -top-2 -right-2 text-[#FFD700] animate-ping">✨</div>
                  <div className="absolute -bottom-2 -left-2 text-[#FFD700] animate-ping" style={{ animationDelay: '0.1s' }}>✨</div>
                  <div className="absolute top-1/2 -right-4 text-[#FFD700] animate-ping" style={{ animationDelay: '0.2s' }}>✨</div>
                </div>
              </div>
            </div>
            
            {/* Text */}
            <div className="bg-[#5c2e0b]/90 backdrop-blur-md rounded-2xl px-8 py-4 shadow-lg border-2 border-[#FFD700]">
              <p className="text-[#FFD700] font-black text-3xl text-center font-display">
                +{coinRewardAmount} COINS!
              </p>
              <p className="text-white/80 text-sm text-center mt-1">
                {coinRewardSource} 🌟
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add lesson pop animation keyframes
const lessonAnimationStyles = document.createElement('style');
lessonAnimationStyles.textContent = `
@keyframes lessonPop {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(20px);
  }
  50% {
    transform: scale(1.1) translateY(-5px);
  }
  70% {
    transform: scale(0.95) translateY(2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
@keyframes pathDraw {
  0% {
    opacity: 0;
    transform: translateX(-50%) scaleY(0);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scaleY(1);
  }
}
`;
if (!document.getElementById('homepage-lesson-animations')) {
  lessonAnimationStyles.id = 'homepage-lesson-animations';
  document.head.appendChild(lessonAnimationStyles);
}

export default HomePage;
