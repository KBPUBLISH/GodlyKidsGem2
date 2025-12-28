
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, BookOpen, Crown, PlayCircle, Headphones, Disc, Lock, Globe, Bookmark, Plus, ArrowLeft } from 'lucide-react';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { Book } from '../types';
import { readingProgressService } from '../services/readingProgressService';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import { ApiService } from '../services/apiService';
import { readCountService } from '../services/readCountService';
import { bookCompletionService } from '../services/bookCompletionService';
import { favoritesService } from '../services/favoritesService';
import { libraryService } from '../services/libraryService';
import { analyticsService } from '../services/analyticsService';
import { pinnedColoringService } from '../services/pinnedColoringService';
import GameWebView from '../components/features/GameWebView';
import ChallengeGameModal from '../components/features/ChallengeGameModal';
import StrengthGameModal from '../components/features/StrengthGameModal';
import PrayerGameModal from '../components/features/PrayerGameModal';
import CommentSection from '../components/features/CommentSection';

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

// Mock Chapters Data for Audio Books
const AUDIO_CHAPTERS = [
  {
    id: 1,
    title: "Chapter 1 — In the Beginning",
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch1/150/150"
  },
  {
    id: 2,
    title: "Chapter 2 — Tom and the Clock Shop",
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch2/150/150"
  },
  {
    id: 3,
    title: "Chapter 3 — The Prince's Slippers",
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch3/150/150"
  }
];

const BookDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { books, loading } = useBooks();
  useAudio(); // keep hook call if needed elsewhere; background music UI is removed
  const { t, translateText, currentLanguage } = useLanguage();
  const { isSubscribed, isVoiceUnlocked, unlockVoice } = useUser();
  const [translatedTitle, setTranslatedTitle] = useState<string>('');
  const [translatedDescription, setTranslatedDescription] = useState<string>('');
  const [book, setBook] = useState<Book | null>(null);
  const [imageError, setImageError] = useState(false);
  const [savedPageIndex, setSavedPageIndex] = useState<number | null>(null);
  const [bookGames, setBookGames] = useState<Array<{ _id?: string; title: string; url: string; coverImage?: string; description?: string }>>([]);
  const [associatedGames, setAssociatedGames] = useState<Array<{ gameId: string; name: string; url?: string; coverImage?: string; gameType?: 'modal' | 'webview' }>>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [selectedGame, setSelectedGame] = useState<{ title: string; url: string } | null>(null);
  const [showChallengeGame, setShowChallengeGame] = useState(false);
  const [showStrengthGame, setShowStrengthGame] = useState(false);
  const [showPrayerGame, setShowPrayerGame] = useState(false);
  const [readCount, setReadCount] = useState<number>(0);
  const [favoriteCount, setFavoriteCount] = useState<number>(0);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [isInLibrary, setIsInLibrary] = useState<boolean>(false);
  const [isMembersOnly, setIsMembersOnly] = useState<boolean>(false);
  const [bookDetailsLoaded, setBookDetailsLoaded] = useState<boolean>(false); // Prevent race condition on premium check
  const [pinnedDrawing, setPinnedDrawing] = useState<{ pageRef: string; pageId: string; dataUrl: string; backgroundUrl?: string } | null>(null);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  
  // Voice reward info
  const [rewardVoice, setRewardVoice] = useState<{ voiceId: string; name: string; characterImage?: string } | null>(null);
  
  // Check if book is locked (members only and user not subscribed)
  const isLocked = isMembersOnly && !isSubscribed;

  // Background music toggle has been removed from Header. Nothing to restore here.

  useEffect(() => {
    const findOrFetchBook = async () => {
      // First try to find in context
      if (books.length > 0) {
        const found = books.find(b => b.id === id);
        if (found) {
          setBook(found);
          
          // Track book view analytics when book is loaded
          if (id) {
            analyticsService.bookView(id, found.title);
          }
          
          // Translate title and description
          if (currentLanguage !== 'en') {
            translateText(found.title).then(setTranslatedTitle);
            if (found.description) {
              translateText(found.description).then(setTranslatedDescription);
            }
          } else {
            setTranslatedTitle(found.title);
            setTranslatedDescription(found.description || '');
          }

          // Load reading progress for this book
          if (id) {
            const progress = readingProgressService.getProgress(id);
            if (progress) {
              setSavedPageIndex(progress.currentPageIndex);
            } else {
              setSavedPageIndex(null);
            }
          }
          return;
        }
      }
      
      // If not found in context and we have an ID, try fetching directly from API
      // This handles the case where user navigates directly (e.g., from welcome screen)
      if (id && !book) {
        try {
          console.log('📖 Book not in context, fetching from API:', id);
          const allBooks = await ApiService.getBooks();
          const found = allBooks.find(b => b.id === id);
          if (found) {
            console.log('✅ Found book from API:', found.title);
            setBook(found);
            
            if (id) {
              analyticsService.bookView(id, found.title);
            }
            
            if (currentLanguage !== 'en') {
              translateText(found.title).then(setTranslatedTitle);
              if (found.description) {
                translateText(found.description).then(setTranslatedDescription);
              }
            } else {
              setTranslatedTitle(found.title);
              setTranslatedDescription(found.description || '');
            }

            if (id) {
              const progress = readingProgressService.getProgress(id);
              if (progress) {
                setSavedPageIndex(progress.currentPageIndex);
              } else {
                setSavedPageIndex(null);
              }
            }
          } else {
            console.log('❌ Book not found even after API fetch:', id);
          }
        } catch (error) {
          console.error('Error fetching book from API:', error);
        }
      }
    };
    
    findOrFetchBook();
  }, [id, books, book]);

  // Load pinned coloring drawing ("fridge") for this book
  useEffect(() => {
    if (!id) return;
    const pinned = pinnedColoringService.getPinned(id);
    console.log('🖼️ Loaded pinned coloring for book', id, ':', pinned);
    if (!pinned) {
      setPinnedDrawing(null);
      return;
    }
    
    // Try to get the composite image first (new format)
    if (pinned.hasComposite) {
      const compositeUrl = pinnedColoringService.getCompositeUrl(id);
      if (compositeUrl) {
        console.log('🖼️ Using pre-composited fridge image');
        setPinnedDrawing({ 
          pageRef: pinned.pageRef, 
          pageId: pinned.pageId, 
          dataUrl: compositeUrl,
          // No backgroundUrl needed - it's already baked into the composite
        });
        return;
      }
    }
    
    // Fallback: old format with separate drawing + overlay
    const dataUrl = pinnedColoringService.getDrawingDataUrl(pinned.pageId);
    if (!dataUrl) {
      console.log('🖼️ Drawing data not found for pageId:', pinned.pageId);
      setPinnedDrawing(null);
      return;
    }
    console.log('🖼️ Using legacy format with backgroundUrl:', pinned.backgroundUrl);
    setPinnedDrawing({ 
      pageRef: pinned.pageRef, 
      pageId: pinned.pageId, 
      dataUrl,
      backgroundUrl: pinned.backgroundUrl 
    });
  }, [id]);

  // Fun encouraging messages that rotate based on the pageId hash
  const getFridgeMessage = (pageId: string): string => {
    const messages = [
      "Wow, Great Job! 🌟",
      "Amazing artwork! ✨",
      "You're so creative! 🎨",
      "Beautiful colors! 🌈",
      "A masterpiece! 🏆",
      "Super talented! ⭐",
      "I love it! 💖",
      "Fantastic work! 🎉",
      "You're an artist! 🖌️",
      "So pretty! 💫",
    ];
    // Simple hash to pick a consistent message for each drawing
    let hash = 0;
    for (let i = 0; i < pageId.length; i++) {
      hash = ((hash << 5) - hash) + pageId.charCodeAt(i);
      hash = hash & hash;
    }
    return messages[Math.abs(hash) % messages.length];
  };

  // Fetch book details including bookGames and total pages
  useEffect(() => {
    const fetchBookDetails = async () => {
      if (!id) return;
      
      // Reset loaded state when ID changes
      setBookDetailsLoaded(false);

      try {
        // Fetch full book data from API
        const fullBook = await ApiService.getBookById(id);
        
        // Store members-only status for UI display (don't redirect - show locked button instead)
        const bookIsMembersOnly = (fullBook as any)?.isMembersOnly === true;
        setIsMembersOnly(bookIsMembersOnly);
        setBookDetailsLoaded(true); // Mark as loaded AFTER setting isMembersOnly
        
        if (fullBook && (fullBook as any).rawData) {
          const rawData = (fullBook as any).rawData;
          if (rawData.bookGames && Array.isArray(rawData.bookGames)) {
            setBookGames(rawData.bookGames);
          }

          // Fetch associated games from Games management
          if (rawData.games && Array.isArray(rawData.games) && rawData.games.length > 0) {
            try {
              const gamesResponse = await fetch('http://localhost:5001/api/games/enabled');
              if (gamesResponse.ok) {
                const allGames = await gamesResponse.json();
                // Filter to only games that are associated with this book
                const bookAssociatedGames = allGames.filter((game: any) =>
                  rawData.games.includes(game.gameId)
                );
                setAssociatedGames(bookAssociatedGames);
              }
            } catch (error) {
              console.error('Error fetching associated games:', error);
            }
          }
          
        }
        
        // Load reward voice info if book has one (check multiple locations)
        const rawData2 = (fullBook as any)?.rawData;
        const rewardVoiceId = rawData2?.rewardVoiceId || (fullBook as any)?.rewardVoiceId;
        console.log('🎁 Book reward voice check:', { 
          hasRawData: !!rawData2, 
          rewardVoiceId,
          rawDataRewardVoiceId: rawData2?.rewardVoiceId,
          directRewardVoiceId: (fullBook as any)?.rewardVoiceId
        });
        
        if (rewardVoiceId) {
          try {
            const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
            // Remove trailing /api if present, then add /api/voices
            const baseUrl = API_BASE.replace(/\/api\/?$/, '');
            const voicesResponse = await fetch(`${baseUrl}/api/voices`);
            if (voicesResponse.ok) {
              const allVoices = await voicesResponse.json();
              console.log('🎁 Looking for voice:', rewardVoiceId, 'in', allVoices.length, 'voices');
              const voice = allVoices.find((v: any) => v.voiceId === rewardVoiceId);
              console.log('🎁 Found voice:', voice);
              if (voice) {
                setRewardVoice({
                  voiceId: voice.voiceId,
                  name: voice.customName || voice.name,
                  characterImage: voice.characterImage,
                });
              }
            }
          } catch (error) {
            console.error('Error fetching reward voice:', error);
          }
        }

        // Fetch pages to determine total count
        const pages = await ApiService.getBookPages(id);
        setTotalPages(pages.length);
      } catch (error) {
        console.error('Error fetching book details:', error);
      }
    };

    fetchBookDetails();
  }, [id]);

  // Load read count and favorite count
  useEffect(() => {
    if (id) {
      const count = readCountService.getReadCount(id);
      setReadCount(count);

      // Get favorite status
      const favorites = favoritesService.getFavorites();
      const favorited = favorites.includes(id);
      setIsFavorited(favorited);

      // Get library status
      const inLibrary = libraryService.isInLibrary(id);
      setIsInLibrary(inLibrary);

      // Try to get stored favorite count for this book
      // In production, this should come from the backend API
      const storedCount = localStorage.getItem(`book_fav_count_${id}`);
      if (storedCount) {
        setFavoriteCount(parseInt(storedCount, 10));
      } else {
        // Initialize with 0 (in production, this comes from backend)
        const baseCount = 0;
        setFavoriteCount(baseCount);
        localStorage.setItem(`book_fav_count_${id}`, baseCount.toString());
      }
    }
  }, [id]);

  // Refresh read count when returning from book reader
  useEffect(() => {
    const handleFocus = () => {
      if (id) {
        const count = readCountService.getReadCount(id);
        setReadCount(count);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  // Update favorite count when user favorites/unfavorites
  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    e.preventDefault(); // Prevent any default behavior
    if (!id) {
      console.warn('No book ID for favorite toggle');
      return;
    }
    console.log('❤️ Toggling favorite for book:', id);
    const newFavoriteState = favoritesService.toggleFavorite(id);
    setIsFavorited(newFavoriteState);
    console.log('❤️ New favorite state:', newFavoriteState);

    // Track favorite/unfavorite analytics
    if (newFavoriteState) {
      analyticsService.bookFavorite(id, book?.title);
    } else {
      analyticsService.bookUnfavorite(id, book?.title);
    }

    // Update the displayed count
    const currentCount = parseInt(localStorage.getItem(`book_fav_count_${id}`) || '0', 10);
    const newCount = newFavoriteState ? currentCount + 1 : Math.max(0, currentCount - 1);
    setFavoriteCount(newCount);
    localStorage.setItem(`book_fav_count_${id}`, newCount.toString());
    console.log('❤️ Updated favorite count:', newCount);
  };

  // Handle save to library
  const handleSaveToLibrary = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    e.preventDefault(); // Prevent any default behavior
    if (!id) {
      console.warn('No book ID for save to library');
      return;
    }
    console.log('📚 Saving to library:', id);
    const newLibraryState = libraryService.toggleLibrary(id);
    setIsInLibrary(newLibraryState);
    console.log('📚 New library state:', newLibraryState);
    
    // Also add to favorites when saving to library
    if (newLibraryState && !isFavorited) {
      const favState = favoritesService.toggleFavorite(id);
      setIsFavorited(favState);
      // Track favorite analytics
      if (favState) {
        analyticsService.bookFavorite(id, book?.title);
      }
      const currentCount = parseInt(localStorage.getItem(`book_fav_count_${id}`) || '0', 10);
      const newCount = favState ? currentCount + 1 : currentCount;
      setFavoriteCount(newCount);
      localStorage.setItem(`book_fav_count_${id}`, newCount.toString());
      console.log('📚 Also added to favorites, new count:', newCount);
    }
  };

  // Check if book has EVER been completed (permanent unlock for games)
  // Once a book is completed, games stay unlocked forever regardless of re-reading progress
  const isBookCompleted = () => {
    if (!id) return false;
    return bookCompletionService.isBookCompleted(id);
  };

  const handleContinue = () => {
    if (id && savedPageIndex !== null && savedPageIndex >= 0) {
      // Navigate with page number to resume from saved progress
      // Use page number instead of continue=true for more reliable navigation
      const pageNum = savedPageIndex + 1; // Convert 0-based index to 1-based page number
      console.log(`📖 Continue reading: navigating to page ${pageNum} (savedPageIndex: ${savedPageIndex})`);
      navigate(`/read/${id}?page=${pageNum}`);
    } else {
      // No saved progress, just start from beginning
      console.log('📖 No saved progress, starting from beginning');
      navigate(`/read/${id}`);
    }
  };

  if (loading && !book) return <div className="h-full flex items-center justify-center text-white font-display">Loading...</div>;

  if (!book) return <div className="h-full flex items-center justify-center text-white font-display">Book not found</div>;

  const isAudio = book.isAudio;

  const handleChapterClick = (chapterId: number) => {
    navigate(`/player/${id}/${chapterId}`);
  };

  const handleBack = () => {
    // Navigate back to the previous main tab (passed via state) or default to Home
    const backPath = (location.state as any)?.from || '/home';
    navigate(backPath);
  };

  return (
    // Opaque background to hide panorama
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-[#fdf6e3]">

      {/* TOP SECTION - WOOD BACKGROUND */}
      {/* Full width, removed margins and top rounded corners */}
      <div className="relative pb-8 shadow-2xl z-10 overflow-hidden shrink-0 w-full">
        {/* Vertical Wood Plank Pattern CSS */}
        <div className="absolute inset-0 bg-[#8B4513]" style={{
          backgroundImage: `repeating-linear-gradient(
                90deg, 
                #a05f2c 0%, #a05f2c 14%, 
                #3e1f07 14%, #3e1f07 15%, 
                #c28246 15%, #c28246 29%, 
                #3e1f07 29%, #3e1f07 30%, 
                #945829 30%, #945829 49%, 
                #3e1f07 49%, #3e1f07 50%, 
                #b06d36 50%, #b06d36 74%, 
                #3e1f07 74%, #3e1f07 75%,
                #a05f2c 75%, #a05f2c 100%
            )`
        }}></div>

        {/* Subtle Grain Overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}></div>

        {/* Header Icons */}
        <div className="relative z-20 flex justify-between items-center px-4 pt-6 pb-2">
          {/* Back Button */}
          <button onClick={handleBack} className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center transform transition-all active:scale-95 hover:bg-black/60 border border-white/20 shadow-lg">
            <ArrowLeft className="w-5 h-5 text-white" strokeWidth={2.5} />
          </button>

        </div>

        {/* Main Content Area - Swaps based on type */}
        <div className="relative z-20 px-6 pt-2 flex flex-col items-center space-y-5">

          {/* Book Cover - Aspect Square 1:1 - Increased max-width by another 7% */}
          <div className="w-full aspect-square max-w-[20.6rem] md:max-w-[28rem] lg:max-w-[32rem] rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-[3px] border-[#5c2e0b] relative bg-gray-800">
            <img
              src={imageError || !book.coverUrl ? DEFAULT_COVER : book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            {/* Decorative Sparkles */}
            <div className="absolute top-3 right-4 text-white/90 text-2xl animate-pulse filter drop-shadow-md">✦</div>
            <div className="absolute bottom-3 left-4 text-white/80 text-xl animate-pulse delay-700 filter drop-shadow-md">✨</div>
          </div>

          {/* Premium Badge for Members Only Content */}
          {isMembersOnly && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#5c2e0b] px-4 py-2 rounded-full shadow-lg border-2 border-[#B8860B]">
              <Crown size={18} />
              <span className="font-display font-bold text-sm">{t('premiumContent') || 'PREMIUM CONTENT'}</span>
            </div>
          )}

          {isAudio ? (
            // --- AUDIO BOOK SPECIFIC ACTIONS ---
            <>
              {/* Listen Button - Locked or Normal */}
              <div className="w-full max-w-sm">
                {!bookDetailsLoaded ? (
                  // Loading state - disable buttons until we know if book is premium
                  <button
                    disabled
                    className="w-full bg-gray-300 text-gray-500 font-display font-bold text-xl py-3 rounded-full shadow-[0_4px_0_#aaa] border-2 border-gray-400 transition-all text-center cursor-not-allowed"
                  >
                    Loading...
                  </button>
                ) : isLocked ? (
                  <button
                    onClick={() => navigate('/paywall', { state: { from: `/book-details/${id}` } })}
                    className="w-full bg-gradient-to-b from-[#FFD700] to-[#FFA500] hover:from-[#FFE44D] hover:to-[#FFB733] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-full shadow-[0_4px_0_#B8860B,0_8px_15px_rgba(0,0,0,0.4)] border-2 border-[#B8860B] active:translate-y-[4px] active:shadow-[0_0_0_#B8860B] transition-all text-center flex items-center justify-center gap-2"
                  >
                    <Lock size={20} />
                    <span>{t('unlockToListen') || 'Unlock to Listen'}</span>
                    <Crown size={18} />
                  </button>
                ) : (
                  <button
                    onClick={handleSaveToLibrary}
                    className={`w-full bg-gradient-to-b ${isInLibrary 
                      ? 'from-[#6da34d] to-[#5a8a3f] hover:from-[#7db85b] hover:to-[#6a9a4f]' 
                      : 'from-[#8B4513] to-[#5c2e0b] hover:from-[#A0522D] hover:to-[#70380d]'
                    } text-[#f3e5ab] font-display font-bold text-xl py-3 rounded-full shadow-[0_4px_0_#3e1f07,0_8px_15px_rgba(0,0,0,0.4)] border-2 border-[#a05f2c] active:translate-y-[4px] active:shadow-[0_0_0_#3e1f07] transition-all text-center flex items-center justify-center gap-2`}
                  >
                    {isInLibrary ? (
                      <>
                        <Bookmark size={20} fill="currentColor" />
                        <span>{t('savedToLibrary') || 'Saved to Library'}</span>
                      </>
                    ) : (
                      <>
                        <Plus size={20} />
                        <span>{t('saveToLibrary') || 'Save to Library'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Stats Row (Audio) */}
              <div className="w-full max-w-sm flex justify-between items-center px-4 text-[#e2cba5] font-bold drop-shadow-md">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-default"
                >
                  <Headphones size={20} />
                  <span className="text-lg">{t('myListens') || 'My Listens'}: {readCount}</span>
                </button>
                <div className="h-6 w-px bg-white/20"></div>
                <button
                  onClick={handleFavoriteToggle}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95 cursor-pointer"
                >
                  <Heart 
                    size={20} 
                    className={`${isFavorited ? 'text-[#FF5252] fill-[#FF5252]' : 'text-[#FF5252]'}`}
                    fill={isFavorited ? '#FF5252' : 'none'}
                  />
                  <span className="text-lg">{favoriteCount} {t('favorites') || 'Favs'}</span>
                </button>
              </div>
            </>
          ) : (
            // --- STANDARD BOOK ACTIONS ---
            <>
              {/* Voice Reward Indicator with Progress */}
              {rewardVoice && (() => {
                // Calculate pages read - cap at totalPages to avoid "5/4 pages" bug
                const pagesRead = savedPageIndex !== null ? Math.min(savedPageIndex + 1, totalPages) : 0;
                const progressPercent = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
                const bookComplete = isBookCompleted();
                const voiceAlreadyUnlocked = isVoiceUnlocked(rewardVoice.voiceId);
                const canUnlock = bookComplete && !voiceAlreadyUnlocked;
                
                console.log('🎁 Voice unlock status:', { 
                  bookComplete, 
                  voiceAlreadyUnlocked, 
                  canUnlock, 
                  voiceId: rewardVoice.voiceId,
                  pagesRead,
                  totalPages 
                });
                
                const handleUnlockTap = async () => {
                  console.log('🎁 Unlock tapped!');
                  if (!canUnlock) {
                    console.log('🎁 Cannot unlock - canUnlock is false');
                    return;
                  }
                  
                  try {
                    // Update local state immediately
                    unlockVoice(rewardVoice.voiceId);
                    console.log('🎁 Local state updated');
                    
                    // Also call API to persist
                    const user = JSON.parse(localStorage.getItem('godly_kids_user') || '{}');
                    const userId = user?.email || user?._id;
                    console.log('🎁 User for API:', userId);
                    
                    if (userId) {
                      const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://backendgk2-0.onrender.com';
                      const baseUrl = API_BASE.replace(/\/api\/?$/, '');
                      console.log('🎁 Calling API:', `${baseUrl}/api/voices/unlock`);
                      
                      const response = await fetch(`${baseUrl}/api/voices/unlock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, voiceId: rewardVoice.voiceId }),
                      });
                      const data = await response.json();
                      console.log('🎁 API response:', data);
                    }
                    
                    // Show success alert explaining it's added to their library
                    alert(`🎉 ${rewardVoice.name} Voice Unlocked!\n\nThis voice has been added to your voice library. You can now use it to read any book!`);
                  } catch (error) {
                    console.error('🎁 Failed to unlock voice:', error);
                    alert('Failed to unlock voice. Please try again.');
                  }
                };
                
                return (
                  <div 
                    className={`w-full max-w-sm mb-3 rounded-2xl p-3 border-2 ${
                      voiceAlreadyUnlocked 
                        ? 'bg-gradient-to-r from-green-700/90 to-emerald-800/90 border-green-500/70' 
                        : canUnlock
                          ? 'bg-gradient-to-r from-amber-800/95 to-orange-900/95 border-amber-400 cursor-pointer hover:from-amber-700/95 hover:to-orange-800/95 active:scale-[0.98] transition-all'
                          : 'bg-gradient-to-r from-stone-800/90 to-stone-900/90 border-amber-600/50'
                    }`}
                    onClick={canUnlock ? handleUnlockTap : undefined}
                  >
                    <div className="flex items-center gap-3">
                      {rewardVoice.characterImage ? (
                        <img 
                          src={rewardVoice.characterImage} 
                          alt={rewardVoice.name}
                          className={`w-14 h-14 rounded-full object-cover border-2 shadow-lg ${
                            voiceAlreadyUnlocked ? 'border-green-300' : 'border-amber-300'
                          }`}
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${
                          voiceAlreadyUnlocked ? 'bg-green-500 border-green-300' : 'bg-amber-600 border-amber-400'
                        }`}>
                          <span className="text-2xl">{voiceAlreadyUnlocked ? '✅' : '🎤'}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        {voiceAlreadyUnlocked ? (
                          <>
                            <p className="text-green-200 text-xs font-semibold flex items-center gap-1">
                              <span>✨</span> Voice Unlocked!
                            </p>
                            <p className="text-white font-bold text-sm drop-shadow-sm">{rewardVoice.name} Voice</p>
                            <p className="text-green-300/70 text-[10px] mt-0.5">Added to your voice library</p>
                          </>
                        ) : canUnlock ? (
                          <>
                            <p className="text-amber-300 text-xs font-semibold animate-pulse">🎁 Tap to Unlock!</p>
                            <p className="text-white font-bold text-sm drop-shadow-sm">{rewardVoice.name} Voice</p>
                            <p className="text-amber-200/80 text-[10px] mt-1">Add this voice to your library for all books!</p>
                          </>
                        ) : (
                          <>
                            <p className="text-amber-300 text-xs font-semibold">🎁 Complete to Unlock</p>
                            <p className="text-white font-bold text-sm drop-shadow-sm">{rewardVoice.name} Voice</p>
                            {/* Progress Bar */}
                            {totalPages > 0 && (
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-amber-200 mb-1 font-medium">
                                  <span>{pagesRead} / {totalPages} pages</span>
                                  <span>{progressPercent}%</span>
                                </div>
                                <div className="h-2.5 bg-black/50 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-2xl">{voiceAlreadyUnlocked ? '🎉' : canUnlock ? '👆' : '✨'}</span>
                    </div>
                  </div>
                );
              })()}
              
              {/* Read / Continue Buttons */}
              <div className="flex w-full gap-3 max-w-sm">
                {!bookDetailsLoaded ? (
                  // Loading state - disable buttons until we know if book is premium
                  <button
                    disabled
                    className="flex-1 bg-gray-300 text-gray-500 font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#aaa] border-2 border-gray-400 transition-all text-center leading-none cursor-not-allowed"
                  >
                    Loading...
                  </button>
                ) : isLocked ? (
                  // Locked state - show premium button that goes to paywall
                  <button
                    onClick={() => navigate('/paywall', { state: { from: `/book-details/${id}` } })}
                    className="flex-1 bg-gradient-to-b from-[#FFD700] to-[#FFA500] hover:from-[#FFE44D] hover:to-[#FFB733] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#B8860B] border-2 border-[#B8860B] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none flex items-center justify-center gap-2"
                  >
                    <Lock size={20} />
                    <span>{t('unlockToRead') || 'Unlock to Read'}</span>
                    <Crown size={18} className="text-[#8B4513]" />
                  </button>
                ) : (
                  // Normal unlocked state
                  <>
                    <button
                      onClick={() => navigate(`/read/${id}`)}
                      className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none"
                    >
                      {t('read')}
                    </button>
                    {savedPageIndex !== null && savedPageIndex >= 0 ? (
                      <button
                        onClick={handleContinue}
                        className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none flex flex-col items-center justify-center gap-0.5"
                      >
                        <span>{t('continue')}</span>
                        <span className="text-[10px] font-sans font-normal opacity-80">({t('pages') || 'Page'} {savedPageIndex + 1})</span>
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {/* Associated Games from Games Management */}
              {associatedGames.length > 0 && (
                <div className="w-full max-w-sm space-y-3">
                  {associatedGames.map((game) => {
                    return (
                      <div
                        key={game.gameId}
                        className="w-full bg-[#3E1F07] rounded-2xl p-3 pr-4 flex items-center gap-4 shadow-[0_6px_0_rgba(0,0,0,0.3)] border-2 border-[#5c2e0b] relative overflow-hidden"
                      >
                        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#70380d] to-transparent"></div>

                        <div className="w-20 h-14 bg-[#87CEEB] rounded-lg overflow-hidden relative shrink-0 border-2 border-white/10 shadow-inner z-10">
                          {game.coverImage ? (
                            <img src={game.coverImage} className="w-full h-full object-cover" alt={game.name} />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Globe className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 z-10 flex justify-between items-center">
                          <div className="flex-1 min-w-0 mr-2">
                            <h3 className="text-white font-display font-bold tracking-wide text-sm drop-shadow-md truncate">
                              {game.name}
                            </h3>
                          </div>
                          <button
                            onClick={() => {
                              // Track game open analytics
                              analyticsService.gameOpen(game.gameId, game.name, id);
                              
                              if (game.gameType === 'webview' && game.url) {
                                // Open webview game
                                setSelectedGame({ title: game.name, url: game.url });
                              } else if (game.gameType === 'modal') {
                                // Open modal games based on gameId
                                if (game.gameId === 'challenge') {
                                  setShowChallengeGame(true);
                                } else if (game.gameId === 'strength') {
                                  setShowStrengthGame(true);
                                } else if (game.gameId === 'prayer') {
                                  setShowPrayerGame(true);
                                }
                              }
                            }}
                            className="bg-[#6da34d] hover:bg-[#7db85b] text-white text-sm font-bold py-1.5 px-5 rounded-full shadow-[0_3px_0_#3d5c2b] active:translate-y-[3px] active:shadow-none transition-all border border-[#ffffff20] cursor-pointer shrink-0"
                          >
                            Play
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Book-Specific Games */}
              {bookGames.length > 0 && (
                <div className="w-full max-w-sm space-y-3">
                  {bookGames.map((game, index) => {
                    const isUnlocked = isBookCompleted();
                    return (
                      <div
                        key={index}
                        className={`w-full bg-[#3E1F07] rounded-2xl p-3 pr-4 flex items-center gap-4 shadow-[0_6px_0_rgba(0,0,0,0.3)] border-2 border-[#5c2e0b] relative overflow-hidden ${!isUnlocked ? 'opacity-75' : ''
                          }`}
                      >
                        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#70380d] to-transparent"></div>

                        <div className="w-20 h-14 bg-[#87CEEB] rounded-lg overflow-hidden relative shrink-0 border-2 border-white/10 shadow-inner z-10">
                          {game.coverImage ? (
                            <img src={game.coverImage} className="w-full h-full object-cover" alt={game.title} />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Globe className="w-8 h-8 text-white" />
                            </div>
                          )}
                          {!isUnlocked && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Lock className="w-6 h-6 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 z-10 flex justify-between items-center">
                          <div className="flex-1 min-w-0 mr-2">
                            <h3 className="text-white font-display font-bold tracking-wide text-sm drop-shadow-md truncate">
                              {game.title}
                            </h3>
                            {!isUnlocked && (
                              <p className="text-xs text-white/70 mt-0.5">{t('completeBookToUnlock') || 'Complete book to unlock'}</p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (isUnlocked) {
                                // Track game open analytics
                                analyticsService.gameOpen(game._id || `book_game_${index}`, game.title, id);
                                setSelectedGame({ title: game.title, url: game.url });
                              } else {
                                alert('Please complete reading this book to unlock this game!');
                              }
                            }}
                            disabled={!isUnlocked}
                            className={`${isUnlocked
                              ? 'bg-[#6da34d] hover:bg-[#7db85b] cursor-pointer'
                              : 'bg-gray-600 cursor-not-allowed opacity-50'
                              } text-white text-sm font-bold py-1.5 px-5 rounded-full shadow-[0_3px_0_#3d5c2b] active:translate-y-[3px] active:shadow-none transition-all border border-[#ffffff20] shrink-0`}
                          >
                            {isUnlocked ? t('play') : t('locked')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Stats Row (Read) */}
              <div className="w-full max-w-sm bg-[#2d1809]/80 backdrop-blur-sm rounded-xl py-2 px-4 flex justify-between items-center text-[#e2cba5] font-bold shadow-inner border border-[#ffffff10] relative z-10">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-default pointer-events-auto"
                >
                  <BookOpen size={20} />
                  <span className="text-lg">{t('myReads') || 'My Reads'}: {readCount}</span>
                </button>
                <div className="h-6 w-px bg-white/20"></div>
                <button
                  onClick={handleFavoriteToggle}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95 cursor-pointer pointer-events-auto relative z-20"
                  type="button"
                >
                  <Heart 
                    size={20} 
                    className={`${isFavorited ? 'text-[#FF5252] fill-[#FF5252]' : 'text-[#FF5252]'}`}
                    fill={isFavorited ? '#FF5252' : 'none'}
                  />
                  <span className="text-lg">{favoriteCount} {t('favorites') || 'Fav'}</span>
                </button>
              </div>

              {/* Save to Library Button */}
              <button
                onClick={handleSaveToLibrary}
                type="button"
                className={`w-full max-w-sm bg-gradient-to-b ${isInLibrary 
                  ? 'from-[#6da34d] to-[#5a8a3f] hover:from-[#7db85b] hover:to-[#6a9a4f]' 
                  : 'from-[#8B4513] to-[#5c2e0b] hover:from-[#A0522D] hover:to-[#70380d]'
                } text-[#f3e5ab] font-display font-bold text-lg py-2.5 rounded-full shadow-[0_4px_0_#3e1f07,0_8px_15px_rgba(0,0,0,0.4)] border-2 border-[#a05f2c] active:translate-y-[4px] active:shadow-[0_0_0_#3e1f07] transition-all text-center flex items-center justify-center gap-2 relative z-20 pointer-events-auto`}
              >
                {isInLibrary ? (
                  <>
                    <Bookmark size={18} fill="currentColor" />
                    <span>{t('savedToLibrary') || 'Saved to Library'}</span>
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    <span>{t('saveToLibrary') || 'Save to Library'}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* BOTTOM SECTION - CONTENT */}
      <div className="flex-1 w-full px-6 pt-8 pb-52 self-center bg-[#fdf6e3]">

        {/* Title & Author Area - Common */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-display font-extrabold text-[#3E1F07] mb-1 leading-tight">
            {book.title}
          </h1>
          <p className="text-[#8B4513] font-semibold text-sm opacity-90">
            By: {book.author || "Kingdom Builders Publishing"}
          </p>
        </div>

        {/* Description or Playlist */}
        <div className="max-w-lg mx-auto">
          {/* Pinned drawing ("fridge") - Portrait framed page style */}
          {pinnedDrawing && !isAudio && (
            <div className="mb-6 flex flex-col items-center">
              {/* Encouragement message */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                <p className="text-[#3E1F07] font-display font-bold text-xl">
                  {getFridgeMessage(pinnedDrawing.pageId)}
                </p>
              </div>
              
              {/* Framed drawing - portrait layout like a page on the fridge */}
              <div 
                onClick={() => setShowDrawingModal(true)}
                className="relative bg-white p-3 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.15)] border-4 border-[#8B4513] cursor-pointer hover:scale-[1.02] transition-transform active:scale-[0.98]"
                style={{
                  // Tape effect at top
                  backgroundImage: 'linear-gradient(to bottom, #f5f5dc 0%, #fff 8%)',
                }}
              >
                {/* Decorative tape */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-gradient-to-b from-[#f0e68c] to-[#daa520] opacity-80 rounded-sm shadow-sm" style={{ transform: 'translateX(-50%) rotate(-2deg)' }} />
                
                {/* Drawing container - portrait aspect ratio */}
                <div className="w-44 aspect-[3/4] rounded overflow-hidden bg-white relative">
                  {/* User's colored strokes (bottom layer) */}
                  <img
                    src={pinnedDrawing.dataUrl}
                    alt="Your coloring"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {/* Line art overlay (top layer) */}
                  {pinnedDrawing.backgroundUrl && (
                    <img
                      src={pinnedDrawing.backgroundUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ mixBlendMode: 'multiply' }}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>
                
                {/* Tap hint */}
                <p className="text-center text-[10px] text-[#8B4513] opacity-60 mt-2 font-bold">
                  Tap to view
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    if (!id) return;
                    // Check if book is locked before allowing coloring access
                    if (isLocked) {
                      navigate('/paywall', { state: { from: `/book-details/${id}` } });
                      return;
                    }
                    navigate(`/read/${id}?coloring=${encodeURIComponent(pinnedDrawing.pageRef)}`);
                  }}
                  className="bg-[#6da34d] hover:bg-[#7db85b] text-white text-sm font-bold py-2 px-5 rounded-full shadow-[0_3px_0_#3d5c2b] active:translate-y-[3px] active:shadow-none transition-all border border-[#ffffff20] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (!id) return;
                    pinnedColoringService.unpinWithCleanup(id);
                    setPinnedDrawing(null);
                  }}
                  className="text-xs font-bold text-[#8B4513] hover:text-[#5c2e0b] underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Full-screen drawing modal */}
          {showDrawingModal && pinnedDrawing && (
            <div 
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
              onClick={() => setShowDrawingModal(false)}
            >
              <div className="relative max-w-sm w-full bg-white rounded-2xl p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button
                  onClick={() => setShowDrawingModal(false)}
                  className="absolute -top-3 -right-3 w-10 h-10 bg-[#8B4513] hover:bg-[#5c2e0b] text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                {/* Message */}
                <p className="text-center text-[#3E1F07] font-display font-bold text-xl mb-3">
                  {getFridgeMessage(pinnedDrawing.pageId)}
                </p>
                
                {/* Full drawing - portrait */}
                <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white relative border-2 border-[#eecaa0]">
                  <img
                    src={pinnedDrawing.dataUrl}
                    alt="Your coloring"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {pinnedDrawing.backgroundUrl && (
                    <img
                      src={pinnedDrawing.backgroundUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  )}
                </div>
                
                {/* Edit button in modal */}
                <button
                  onClick={() => {
                    setShowDrawingModal(false);
                    if (!id) return;
                    // Check if book is locked before allowing coloring access
                    if (isLocked) {
                      navigate('/paywall', { state: { from: `/book-details/${id}` } });
                      return;
                    }
                    navigate(`/read/${id}?coloring=${encodeURIComponent(pinnedDrawing.pageRef)}`);
                  }}
                  className="mt-4 w-full bg-[#6da34d] hover:bg-[#7db85b] text-white font-bold py-3 rounded-xl shadow-[0_4px_0_#3d5c2b] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Continue Coloring
                </button>
              </div>
            </div>
          )}

          <p className="text-[#5c2e0b] font-sans text-base leading-relaxed opacity-90 mb-8 text-center">
            {book.description || "In a world where hearts glow with living colors, a young girl discovers her gift may change the fate of kingdoms. Guided by courage, friendship, and the mysterious Pulse, she learns that even in the darkest places, hearts still beats."}
            {isAudio && <span className="block mt-2 font-bold text-[#8B4513]">`Total playback duration: 00:53:10`</span>}
          </p>

          {isAudio && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {AUDIO_CHAPTERS.map((chapter, index) => (
                <div
                  key={chapter.id}
                  onClick={() => handleChapterClick(chapter.id)}
                  className="bg-white rounded-2xl p-2 flex items-center gap-3 shadow-[0_4px_10px_rgba(0,0,0,0.05)] border border-[#eecaa0] hover:border-[#d4b483] transition-colors group cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 relative">
                    <img src={chapter.image} alt={`Ch ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 py-1">
                    <h4 className="font-display font-bold text-[#3E1F07] text-base leading-tight truncate pr-2">
                      {chapter.title}
                    </h4>
                    <p className="text-xs text-[#8B4513] opacity-70 truncate mt-0.5">
                      {chapter.subtitle}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="shrink-0 flex flex-col items-center gap-1 pr-1">
                    <span className="text-[10px] font-bold text-[#8B4513] opacity-60 tracking-wide uppercase">Preview</span>
                    <button className="w-9 h-9 rounded-full bg-[#fcebb6] hover:bg-[#ffde8a] text-[#8B4513] flex items-center justify-center shadow-[0_2px_5px_rgba(139,69,19,0.2)] border border-[#eecaa0] active:scale-95 transition-all">
                      <PlayCircle size={22} fill="#8B4513" className="text-[#fcebb6]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment Section */}
          {id && book && (
            <CommentSection
              bookId={id}
              bookTitle={book.title}
              bookDescription={book.description}
            />
          )}
        </div>
      </div>

      {/* Game WebView Modal */}
      {selectedGame && (
        <GameWebView
          url={selectedGame.url}
          title={selectedGame.title}
          onClose={() => setSelectedGame(null)}
        />
      )}

      {/* Game Modals */}
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

    </div>
  );
};

export default BookDetailPage;