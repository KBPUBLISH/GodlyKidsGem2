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
import { Key, Brain, Heart, Video, Lock, Check, Play, CheckCircle, Clock, Coins } from 'lucide-react';
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

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { coins, spendCoins, currentProfileId, kids } = useUser();
  const [isRetrying, setIsRetrying] = useState(false);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [showChallengeGame, setShowChallengeGame] = useState(false);
  const [showPrayerGame, setShowPrayerGame] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  
  // Game purchase state - tracks purchased games to update UI without reload
  const [purchasedGamesState, setPurchasedGamesState] = useState<string[]>(() => {
    const stored = localStorage.getItem(profileService.getProfileKey('purchased_games'));
    return stored ? JSON.parse(stored) : [];
  });
  
  // Success notification state
  const [unlockSuccess, setUnlockSuccess] = useState<{ show: boolean; gameName: string }>({ show: false, gameName: '' });

  // Helper to get cached data from sessionStorage
  const getCached = (key: string): any[] => {
    try {
      const cached = sessionStorage.getItem(`godlykids_home_${key}`);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  };
  
  // Lessons state - using daily planner API with sessionStorage cache for navigation
  const [lessons, setLessons] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('godlykids_home_lessons');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [lessonsLoading, setLessonsLoading] = useState(() => {
    // If we have cached lessons, don't show loading initially
    try {
      const cached = sessionStorage.getItem('godlykids_home_lessons');
      return !cached || JSON.parse(cached).length === 0;
    } catch { return true; }
  });
  const [weekLessons, setWeekLessons] = useState<Map<string, any>>(new Map());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(getSelectedDay());
  const todayIndex = getTodayIndex();
  
  // Daily planner state - restore from sessionStorage for navigation
  const [dayPlans, setDayPlans] = useState<Map<string, any>>(() => {
    try {
      const cached = sessionStorage.getItem('godlykids_home_dayPlans');
      if (cached) {
        const parsed = JSON.parse(cached);
        return new Map(Object.entries(parsed));
      }
    } catch {}
    return new Map();
  });
  const loadedDaysRef = useRef<Set<string>>(() => {
    try {
      const cached = sessionStorage.getItem('godlykids_home_loadedDays');
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch { return new Set(); }
  }());
  // Use sessionStorage to track last profile across navigation (refs reset on remount)
  const lastProfileRef = useRef<string | null | undefined>(() => {
    try {
      return sessionStorage.getItem('godlykids_home_lastProfile');
    } catch {
      return undefined;
    }
  }());
  
  // Reset planner state when profile changes (but not on initial mount or navigation return)
  useEffect(() => {
    // Get the cached profile from sessionStorage
    let cachedProfile: string | null = null;
    try {
      cachedProfile = sessionStorage.getItem('godlykids_home_lastProfile');
    } catch {}
    
    console.log('📚 Profile check - current:', currentProfileId, 'cached:', cachedProfile, 'ref:', lastProfileRef.current);
    
    // If we have a valid profile and it matches the cache, we're returning from navigation
    // Keep the cached lessons and don't reset anything
    if (currentProfileId && cachedProfile === currentProfileId) {
      console.log('📚 Same profile on return, keeping cached lessons');
      lastProfileRef.current = currentProfileId;
      return;
    }
    
    // First mount with a profile - just store it, don't clear lessons
    // (lessons were initialized from cache which is the correct data)
    if (lastProfileRef.current === null || lastProfileRef.current === undefined) {
      console.log('📚 First mount, storing profile');
      lastProfileRef.current = currentProfileId;
      try {
        if (currentProfileId) {
          sessionStorage.setItem('godlykids_home_lastProfile', currentProfileId);
        }
      } catch {}
      return;
    }
    
    // Profile actually changed (different from what we had before)
    if (currentProfileId !== lastProfileRef.current) {
      console.log('📚 Profile changed from', lastProfileRef.current, 'to', currentProfileId, '- resetting');
      lastProfileRef.current = currentProfileId;
      try {
        if (currentProfileId) {
          sessionStorage.setItem('godlykids_home_lastProfile', currentProfileId);
        } else {
          sessionStorage.removeItem('godlykids_home_lastProfile');
        }
      } catch {}
      setDayPlans(new Map());
      loadedDaysRef.current = new Set();
      setLessons([]);
      // Clear cache when profile changes
      sessionStorage.removeItem('godlykids_home_lessons');
      sessionStorage.removeItem('godlykids_home_dayPlans');
      sessionStorage.removeItem('godlykids_home_loadedDays');
      // Trigger a refetch for the new profile
      sessionStorage.removeItem('godlykids_home_last_fetch');
    }
  }, [currentProfileId]);
  
  // Welcome video state - plays once per app session when returning to home
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(() => {
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
    // Short delay to let the page render first
    const timer = setTimeout(() => {
      if (shouldShowReviewPrompt()) {
        console.log('🌟 Showing review prompt on home page!');
        setShowReviewPrompt(true);
      }
    }, 1000); // 1 second delay after page load
    
    return () => clearTimeout(timer);
  }, []);

  // Check if games have been engaged today (per-profile) - resets daily
  useEffect(() => {
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
    // Track game play for Report Card
    activityTrackingService.trackGamePlayed('daily_key', 'Key of Truth');
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
  useEffect(() => {
    const now = Date.now();
    const lastFetchTimeStr = sessionStorage.getItem('godlykids_home_last_fetch');
    const lastFetch = lastFetchTimeStr ? parseInt(lastFetchTimeStr, 10) : 0;
    const timeSinceLastFetch = now - lastFetch;
    
    // Skip if we fetched recently (prevents memory spikes from rapid refetches)
    if (timeSinceLastFetch < FETCH_DEBOUNCE_MS && lastFetch > 0) {
      console.log(`⏸️ HomePage: Skipping fetch, last fetch was ${Math.round(timeSinceLastFetch / 1000)}s ago`);
      // Still set loading to false since we're using cached data
      setLessonsLoading(false);
      setCategoriesLoading(false);
      setPlaylistsLoading(false);
      setFeaturedLoading(false);
      setGamesLoading(false);
      return;
    }
    
    console.log('🔄 HomePage: Fetching all data...');
    sessionStorage.setItem('godlykids_home_last_fetch', now.toString());
    
    fetchLessons();
    fetchExploreCategories();
    fetchPlaylists();
    fetchFeaturedContent();
    fetchTopRatedContent();
    fetchDynamicGames();
    fetchBookSeries();
  }, []);
  
  // Helper to cache data in sessionStorage
  const cacheData = (key: string, data: any[]) => {
    try {
      sessionStorage.setItem(`godlykids_home_${key}`, JSON.stringify(data));
    } catch (e) {
      console.log('⚠️ Failed to cache data:', key);
    }
  };
  
  // Helper to cache lessons with sessionStorage for navigation persistence
  const cacheLessons = (lessonsData: any[]) => {
    try {
      sessionStorage.setItem('godlykids_home_lessons', JSON.stringify(lessonsData));
    } catch (e) {
      console.log('⚠️ Failed to cache lessons');
    }
  };
  
  // Helper to cache day plans
  const cacheDayPlans = (plans: Map<string, any>) => {
    try {
      const obj: Record<string, any> = {};
      plans.forEach((value, key) => { obj[key] = value; });
      sessionStorage.setItem('godlykids_home_dayPlans', JSON.stringify(obj));
      sessionStorage.setItem('godlykids_home_loadedDays', JSON.stringify([...loadedDaysRef.current]));
    } catch (e) {
      console.log('⚠️ Failed to cache day plans');
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

  // Load a single day's plan using the daily planner API
  const loadDayPlan = async (dateKey: string, forceLoad = false) => {
    if (!currentProfileId) {
      console.log('📚 loadDayPlan: No currentProfileId, skipping');
      return null;
    }
    
    // Skip if already loaded
    if (!forceLoad && loadedDaysRef.current.has(dateKey)) {
      return dayPlans.get(dateKey);
    }
    
    loadedDaysRef.current.add(dateKey);
    console.log('📚 loadDayPlan: Fetching plan for', dateKey, 'profile:', currentProfileId);
    
    const kid = kids?.find((k: any) => String(k.id) === String(currentProfileId));
    const ageGroup = ageToLessonAgeGroup(kid?.age);
    
    try {
      const plan = await ApiService.getLessonPlannerDay(currentProfileId, dateKey, ageGroup);
      console.log('📚 loadDayPlan: Got plan for', dateKey, ':', plan);
      
      if (plan && plan.slots) {
        setDayPlans(prev => {
          const next = new Map(prev);
          next.set(dateKey, plan);
          // Cache for navigation persistence
          setTimeout(() => cacheDayPlans(next), 0);
          return next;
        });
        return plan;
      }
      return null;
    } catch (error) {
      console.error('📚 loadDayPlan: Error:', error);
      loadedDaysRef.current.delete(dateKey);
      return null;
    }
  };

  const fetchLessons = async () => {
    try {
      console.log('📚 Fetching lessons - using daily planner API...');
      console.log('📚 currentProfileId:', currentProfileId);
      
      // If we have a profile, use the daily planner
      if (currentProfileId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDateKey = formatLocalDateKey(today);
        
        // Load today's plan
        const plan = await loadDayPlan(todayDateKey);
        
        if (plan && plan.slots) {
          // Convert planner slots to lessons array for backward compatibility
          const lessonsFromPlan = plan.slots.map((slot: any) => slot.lesson).filter(Boolean);
          setLessons(lessonsFromPlan);
          cacheLessons(lessonsFromPlan); // Cache for navigation persistence
          console.log('📚 Lessons from planner:', lessonsFromPlan.length);
        }
      } else {
        // No profile - show empty state (user needs to select a child profile)
        console.log('📚 No profile selected - lessons require a child profile');
        setLessons([]);
      }
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
        // coverUrl is already set by transformBook, fallback to coverImage if not
        coverUrl: item.coverUrl || item.coverImage || (item as any).files?.coverImage || '',
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

      <PrayerGameModal
        isOpen={showPrayerGame}
        onClose={() => setShowPrayerGame(false)}
      />

      <ReviewPromptModal
        isOpen={showReviewPrompt}
        onReviewSubmitted={() => setShowReviewPrompt(false)}
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

        {/* Weekly Progress Tracker + Daily Lessons Section */}
        <section className="pb-2">
          {/* Weekly Tracker - Compact Mon-Sat progress */}
          <WeeklyLessonTracker
            selectedDay={selectedDayIndex}
            onDaySelect={async (dayIndex) => {
              setSelectedDayIndex(dayIndex);
              setSelectedDay(dayIndex);
              
              // Load plan for selected day
              if (currentProfileId) {
                const weekDays = getWeekDays();
                const selectedDate = weekDays[dayIndex];
                if (selectedDate) {
                  const dateKey = formatLocalDateKey(selectedDate);
                  console.log('📚 Day selected:', dayIndex, 'dateKey:', dateKey);
                  setLessonsLoading(true);
                  const plan = await loadDayPlan(dateKey);
                  if (plan && plan.slots) {
                    const lessonsFromPlan = plan.slots.map((slot: any) => slot.lesson).filter(Boolean);
                    setLessons(lessonsFromPlan);
                    cacheLessons(lessonsFromPlan); // Cache for navigation persistence
                  }
                  setLessonsLoading(false);
                }
              }
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
              // Use lessons directly from planner
              const completedCount = lessons.filter((l: any) => isCompleted(l._id || l.id)).length;
              return lessons.length > 0 ? (
                <span className="text-white/60 text-xs font-semibold">
                  {completedCount}/{lessons.length} Complete
                </span>
              ) : null;
            })()}
          </div>

          {/* Lessons Path - Gamified Learning Path Style */}
          {lessonsLoading ? (
            <div className="text-white/70 text-center py-8 px-4">Loading lessons...</div>
          ) : (() => {
            // Use lessons directly from planner (already loaded for selected day)
            const dayLessons = lessons;
            const isFutureDay = selectedDayIndex > todayIndex && todayIndex !== -1;

            // No profile selected - prompt to switch or create
            if (!currentProfileId) {
              const hasKids = kids && kids.length > 0;
              return (
                <div className="rounded-2xl p-6 text-center border-2 border-[#FFD700]/50 shadow-lg" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)' }}>
                  <div className="text-5xl mb-3">👧👦</div>
                  <h3 className="text-white font-bold text-xl mb-2 drop-shadow-md">
                    {hasKids ? 'Switch to a Child Profile' : 'Create a Child Profile'}
                  </h3>
                  <p className="text-white/90 text-sm mb-4">
                    {hasKids 
                      ? 'Daily lessons are personalized for each child. Select a child profile to see their lessons!'
                      : 'Set up a profile for your child to unlock personalized daily video lessons!'}
                  </p>
                  <button
                    onClick={() => navigate('/profiles')}
                    className="px-6 py-3 bg-[#FFD700] text-[#3E1F07] font-bold rounded-full shadow-lg hover:bg-[#FFC000] transition-all transform hover:scale-105"
                  >
                    {hasKids ? '👤 Switch Profile' : '➕ Create Child Profile'}
                  </button>
                </div>
              );
            }

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

        {/* Daily Tasks & IQ Games Section - Portrait Thumbnail Carousel Style */}
        <section className="mt-4">
          <SectionTitle 
            title="Daily Tasks & IQ Games" 
            icon="🧠"
            color="#4CAF50"
          />
          <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
            <div className="flex space-x-3 px-4">
              
              {/* Daily Key Task */}
              <div
                className="relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 cursor-pointer"
                onClick={() => handleDailyKeyClick()}
              >
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 border-[#FFD700]">
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
                  
                </div>
              </div>

              {/* Memory Task */}
              <div
                className="relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 cursor-pointer"
                onClick={() => handleMemoryClick()}
              >
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 border-[#5c6bc0]">
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
                  
                </div>
              </div>

              {/* Prayer Task */}
              <div
                className="relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 cursor-pointer"
                onClick={() => handlePrayerClick()}
              >
                <div className="relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 border-[#BA68C8]">
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
                    className="relative w-[calc((100vw-48px-40px)/4)] flex-shrink-0 cursor-pointer"
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
                    <div className={`relative aspect-[9/16] rounded-xl overflow-hidden transition-all border-2 ${isLocked ? 'border-[#FFD700]' : 'border-[#4CAF50]'}`}>
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
                      
                      {/* Lock Overlay for Purchasable Games */}
                      {isLocked && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center z-10">
                          <div className="bg-black/70 rounded-full p-2 border-2 border-[#FFD700] mb-2">
                            <Lock size={20} className="text-[#FFD700]" />
                          </div>
                          <div className="bg-[#FFD700] rounded-full px-2 py-1 flex items-center gap-1">
                            <Coins size={12} className="text-[#5c2e0b]" />
                            <span className="text-[10px] font-bold text-[#5c2e0b]">{game.goldCoinPrice}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay with game info */}
                      <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-end pb-3">
                        <span className="text-white text-sm font-bold font-display text-center px-2 drop-shadow-lg">
                          {game.name}
                        </span>
                        {game.description && !isLocked && (
                          <span className="text-white/80 text-[10px] text-center px-2 mt-1 drop-shadow">
                            {game.description.substring(0, 30)}...
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
