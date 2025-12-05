
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, BookOpen, Crown, PlayCircle, Headphones, Disc, Lock, Globe, Bookmark, Plus } from 'lucide-react';
import { useBooks } from '../context/BooksContext';
import { Book } from '../types';
import { readingProgressService } from '../services/readingProgressService';
import { useAudio } from '../context/AudioContext';
import { ApiService } from '../services/apiService';
import { readCountService } from '../services/readCountService';
import { bookCompletionService } from '../services/bookCompletionService';
import { favoritesService } from '../services/favoritesService';
import { libraryService } from '../services/libraryService';
import { analyticsService } from '../services/analyticsService';
import GameWebView from '../components/features/GameWebView';
import ChallengeGameModal from '../components/features/ChallengeGameModal';
import StrengthGameModal from '../components/features/StrengthGameModal';
import PrayerGameModal from '../components/features/PrayerGameModal';

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
  const { musicEnabled, toggleMusic } = useAudio();
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

  // Restore background music when returning from book reader
  useEffect(() => {
    // Check if music was enabled before entering book reader
    const wasMusicEnabled = localStorage.getItem('godly_kids_music_was_enabled') === 'true';

    // Always try to restore music when entering BookDetailPage
    // The book reader turns music off, so we should turn it back on here if it was originally on
    const restoreMusic = setTimeout(() => {
      if (wasMusicEnabled) {
        console.log('🎵 BookDetailPage: Restoring background music - music was enabled before book reader');

        // First, ensure music is enabled in state
        if (!musicEnabled) {
          toggleMusic();
        }

        // Then programmatically click the music button to ensure audio context is unlocked and music plays
        setTimeout(() => {
          const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
          if (musicButton) {
            console.log('🎵 BookDetailPage: Programmatically clicking music button to restore playback');
            musicButton.click();
          }
        }, 50);

        // Clear the flag
        localStorage.removeItem('godly_kids_music_was_enabled');
      } else if (musicEnabled) {
        // Double-check: if music is enabled but audio is paused, click button to resume
        const bgAudio = document.querySelector('audio[src*="Seaside_Adventure"]') as HTMLAudioElement;
        if (bgAudio && bgAudio.paused) {
          const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
          if (musicButton) {
            console.log('🎵 BookDetailPage: Music enabled but paused - clicking button to resume');
            musicButton.click();
          }
        }
      }
    }, 200); // Reduced delay for faster restoration

    return () => clearTimeout(restoreMusic);
  }, [location.pathname, musicEnabled, toggleMusic]); // Include location.pathname to react to navigation

  useEffect(() => {
    if (books.length > 0) {
      const found = books.find(b => b.id === id);
      setBook(found || null);

      // Track book view analytics when book is loaded
      if (found && id) {
        analyticsService.bookView(id, found.title);
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
    }
  }, [id, books]);

  // Fetch book details including bookGames and total pages
  useEffect(() => {
    const fetchBookDetails = async () => {
      if (!id) return;

      try {
        // Fetch full book data from API
        const fullBook = await ApiService.getBookById(id);
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
      // Navigate to book reader with the saved page
      navigate(`/read/${id}?page=${savedPageIndex + 1}`); // +1 because URL uses 1-based, but we store 0-based
    } else {
      // No saved progress, just start from beginning
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
          <button onClick={handleBack} className="w-12 h-12 bg-[#90be6d] rounded-full border-4 border-[#f3e5ab] overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.3)] relative flex items-center justify-center transform transition-transform active:scale-95 group">
            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-white border-b-[8px] border-b-transparent mr-1"></div>
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

          {isAudio ? (
            // --- AUDIO BOOK SPECIFIC ACTIONS ---
            <>
              {/* Add to Library Button */}
              <div className="w-full max-w-sm">
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
                      <span>Saved to Library</span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      <span>Save to Library</span>
                    </>
                  )}
                </button>
              </div>

              {/* Stats Row (Audio) */}
              <div className="w-full max-w-sm flex justify-between items-center px-4 text-[#e2cba5] font-bold drop-shadow-md">
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-default"
                >
                  <Headphones size={20} />
                  <span className="text-lg">My Listens: {readCount}</span>
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
                  <span className="text-lg">{favoriteCount} Favs</span>
                </button>
              </div>
            </>
          ) : (
            // --- STANDARD BOOK ACTIONS ---
            <>
              {/* Read / Continue Buttons */}
              <div className="flex w-full gap-3 max-w-sm">
                <button
                  onClick={() => navigate(`/read/${id}`)}
                  className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none"
                >
                  Read
                </button>
                {savedPageIndex !== null && savedPageIndex >= 0 ? (
                  <button
                    onClick={handleContinue}
                    className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none flex flex-col items-center justify-center gap-0.5"
                  >
                    <span>Continue</span>
                    <span className="text-[10px] font-sans font-normal opacity-80">(Page {savedPageIndex + 1})</span>
                  </button>
                ) : null}
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
                              <p className="text-xs text-white/70 mt-0.5">Complete book to unlock</p>
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
                            {isUnlocked ? 'Play' : 'Locked'}
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
                  <span className="text-lg">My Reads: {readCount}</span>
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
                  <span className="text-lg">{favoriteCount} Fav</span>
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
                    <span>Saved to Library</span>
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    <span>Save to Library</span>
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