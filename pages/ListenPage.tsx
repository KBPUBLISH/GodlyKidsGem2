import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { useAudio } from '../context/AudioContext';
import { useTutorial } from '../context/TutorialContext';
import { Search, Music, ChevronDown, Lock, BookOpen, Heart, Sparkles, TreePine, Sword, Star, Book, Users, Crown, Compass, Smile } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';
import { getApiBaseUrl, ApiService } from '../services/apiService';
import StormySeaError from '../components/ui/StormySeaError';
import { playHistoryService } from '../services/playHistoryService';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

// Category card configuration with colors and optional images for audio page
const CATEGORY_CONFIG: Record<string, { icon: any; bgColor: string; image?: string }> = {
  'All': { icon: Sparkles, bgColor: 'from-indigo-500 to-purple-600' },
  'Bible Stories': { icon: Book, bgColor: 'from-sky-400 to-blue-500' },
  'Nature Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Animal Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Character Building': { icon: Users, bgColor: 'from-amber-400 to-orange-500' },
  'Adventures': { icon: Compass, bgColor: 'from-rose-400 to-red-500' },
  'Bible Adventures': { icon: Compass, bgColor: 'from-amber-500 to-yellow-500' },
  'Favorites': { icon: Heart, bgColor: 'from-pink-400 to-rose-500' },
  'Music': { icon: Music, bgColor: 'from-violet-500 to-purple-600' },
  'Worship': { icon: Star, bgColor: 'from-yellow-400 to-amber-500' },
  'Lullabies': { icon: Smile, bgColor: 'from-indigo-400 to-blue-500' },
  'Sleepy Sounds': { icon: Smile, bgColor: 'from-indigo-400 to-violet-500' },
  'Bedtime Stories': { icon: Smile, bgColor: 'from-indigo-500 to-purple-600' },
  'Stories': { icon: BookOpen, bgColor: 'from-teal-400 to-cyan-500' },
  'Fantasy Worlds': { icon: Crown, bgColor: 'from-sky-400 to-blue-500' },
  'Funny Fables': { icon: Smile, bgColor: 'from-amber-400 to-orange-400' },
  'default': { icon: Crown, bgColor: 'from-slate-400 to-slate-600' },
};

interface Playlist {
  _id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  category?: string;
  type?: 'Song' | 'Audiobook';
  items: any[];
  status: 'draft' | 'published';
  minAge?: number;
  level?: string;
  isMembersOnly?: boolean;
}

interface CategoryData {
  _id: string;
  name: string;
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
  icon?: string;
}

const HEADPHONE_ISLAND = '/assets/images/headphone-island.webp';
const MUSIC_ISLAND = '/assets/images/music-island.webp';
const KARAOKE_RAFT = '/assets/images/karaoke-raft.webp';

const ListenPage: React.FC = () => {

  const navigate = useNavigate();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { isSubscribed } = useUser();
  const { playPlaylist, isPlaying, togglePlayPause, closePlayer, currentPlaylist: activePlaylist, currentTrackIndex } = useAudio();
  const { isTutorialActive, isStepActive, nextStep } = useTutorial();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [islandBlur, setIslandBlur] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [categoryData, setCategoryData] = useState<Record<string, CategoryData>>({});
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isZoomingIn, setIsZoomingIn] = useState(false);
  const [topAudio, setTopAudio] = useState<Playlist[]>([]);
  const [featuredAudio, setFeaturedAudio] = useState<Playlist[]>([]);
  const [featuredCarouselItems, setFeaturedCarouselItems] = useState<any[]>([]);
  const [continueListening, setContinueListening] = useState<Playlist[]>([]);

  const handleIslandClick = useCallback(() => {
    if (isZoomingIn) return;
    setIsZoomingIn(true);
    setTimeout(() => {
      setShowContent(true);
      setTimeout(() => setIsZoomingIn(false), 300);
    }, 950);
  }, [isZoomingIn]);

  useEffect(() => {
    if (showContent) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [showContent]);

  const isMusicIslandPlaying = !!activePlaylist && activePlaylist.title?.toLowerCase().includes('bible bit');

  const handleMusicIslandClick = () => {
    if (isMusicIslandPlaying) {
      togglePlayPause();
      return;
    }
    if (playlists.length === 0) return;
    const bibleBits = playlists.find(p => p.title?.toLowerCase().includes('bible bit'));
    const target = bibleBits || playlists.find(p => p.type === 'Song') || playlists[0];
    const randomIndex = target.items.length > 0 ? Math.floor(Math.random() * target.items.length) : 0;
    playPlaylist(target, randomIndex, isSubscribed);
  };

  const ageDropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScrollY = scrollRef.current.scrollTop;

    const blurProgress = Math.min(currentScrollY / 120, 1);
    setIslandBlur(blurProgress);

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

  // Fetch playlists function
  const fetchPlaylists = async () => {
    try {
      setPlaylistsLoading(true);
      setPlaylistsError(null);
      const baseUrl = getApiBaseUrl();
      const endpoint = `${baseUrl}playlists?status=published`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle both paginated response { data: [...] } and direct array response
        const playlistsArray = Array.isArray(responseData) ? responseData : (responseData.data || []);
        
        const validPlaylists = playlistsArray.filter((p: any) => {
          return p._id && p.title && p.status === 'published' && p.items && Array.isArray(p.items) && p.items.length > 0;
        });

        console.log('📻 Fetched playlists:', validPlaylists.length);
        setPlaylists(validPlaylists);
        setPlaylistsError(null);
      } else {
        console.error('Error fetching playlists:', response.status);
        setPlaylistsError('Failed to load audio content');
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setPlaylistsError(error instanceof Error ? error.message : 'Failed to load audio content');
    } finally {
      setPlaylistsLoading(false);
    }
  };

  // Fetch playlists + top audio on mount
  useEffect(() => {
    fetchPlaylists();

    const fetchTopAudio = async () => {
      try {
        const topRated = await ApiService.getTopRatedPlaylists();
        setFeaturedAudio(topRated.slice(0, 10));
      } catch {
        // fallback handled after playlists load
      }
    };
    fetchTopAudio();

    ApiService.getFeaturedAudioContent().then(items => {
      setFeaturedCarouselItems(items.map(item => ({
        ...item,
        id: item._id || item.id,
        coverUrl: item.coverUrl || item.coverImage || item.files?.coverImage || '',
      })));
    }).catch(() => {});
  }, []);

  // Build top 10 by combining featured + regular playlists
  useEffect(() => {
    const featuredIds = new Set(featuredAudio.map(p => p._id));
    const remaining = playlists.filter(p => !featuredIds.has(p._id));
    const combined = [...featuredAudio, ...remaining].slice(0, 10);
    if (combined.length > 0) setTopAudio(combined);
  }, [featuredAudio, playlists]);

  useEffect(() => {
    if (playlists.length > 0) {
      const recentIds = playHistoryService.getRecentlyPlayedIds(10);
      if (recentIds.length > 0) {
        const playlistMap = new Map(playlists.map(p => [p._id, p]));
        const recent = recentIds
          .map(id => playlistMap.get(id))
          .filter((p): p is Playlist => !!p);
        setContinueListening(recent.slice(0, 10));
      }
    }
  }, [playlists]);

  // Fetch categories on mount (audio type only, excluding explore-only categories)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await ApiService.getCategories('audio');
        // Filter out categories that are marked for explore page only
        const nonExploreCategories = cats.filter((c: any) => !c.showOnExplore);
        const categoryNames = ['All', ...nonExploreCategories.map((c: any) => c.name).filter(Boolean)];
        setCategories(categoryNames);
        
        // Store full category data for images and gradients
        const dataMap: Record<string, CategoryData> = {};
        nonExploreCategories.forEach((c: any) => {
          if (c.name) {
            dataMap[c.name] = {
              _id: c._id,
              name: c.name,
              gradientFrom: c.gradientFrom,
              gradientTo: c.gradientTo,
              image: c.image,
              icon: c.icon,
            };
            // Debug: Log categories with images
            if (c.image) {
              console.log(`📸 Category "${c.name}" has image:`, c.image);
            }
          }
        });
        console.log('📚 Category data loaded:', Object.keys(dataMap).length, 'categories');
        setCategoryData(dataMap);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Extract categories from playlists and books as fallback
        const playlistCategories = playlists.map(p => p.category).filter(Boolean);
        const bookCategories = books.filter(b => b.isAudio).map(b => b.category).filter(Boolean);
        const uniqueCategories = ['All', ...new Set([...playlistCategories, ...bookCategories])];
        setCategories(uniqueCategories as string[]);
      }
    };
    fetchCategories();
  }, [books, playlists]);

  // Close age dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ageDropdownRef.current && !ageDropdownRef.current.contains(event.target as Node)) {
        setShowAgeDropdown(false);
      }
    };
    
    if (showAgeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAgeDropdown]);

  // Filter for audio books
  const audioBooks = books.filter(b => b.isAudio);

  // Filter by category (supports both single category and categories array)
  const categoryFilteredBooks = selectedCategory === 'All'
    ? audioBooks
    : audioBooks.filter(b => {
        // Check if book has categories array or single category
        const bookCategories = (b as any).categories && Array.isArray((b as any).categories) 
          ? (b as any).categories 
          : (b.category ? [b.category] : []);
        return bookCategories.includes(selectedCategory);
      });

  const categoryFilteredPlaylists = selectedCategory === 'All'
    ? playlists
    : playlists.filter(p => {
        // Check if playlist has categories array or single category
        const playlistCategories = (p as any).categories && Array.isArray((p as any).categories) 
          ? (p as any).categories 
          : (p.category ? [p.category] : []);
        return playlistCategories.includes(selectedCategory);
      });

  // Filter by age - for audio books
  const ageFilteredBooks = selectedAge === 'All Ages'
    ? categoryFilteredBooks
    : categoryFilteredBooks.filter(b => {
        const bookAge = b.level || '';
        if (selectedAge === '3+') return bookAge.includes('3');
        if (selectedAge === '4+') return bookAge.includes('4');
        if (selectedAge === '5+') return bookAge.includes('5');
        if (selectedAge === '6+') return bookAge.includes('6');
        if (selectedAge === '7+') return bookAge.includes('7');
        if (selectedAge === '8+') return bookAge.includes('8');
        if (selectedAge === '9+') return bookAge.includes('9');
        if (selectedAge === '10+') return bookAge.includes('10');
        return true;
      });

  // Filter by age - for playlists
  // Show playlists where minAge <= selected age (appropriate for that age)
  const ageFilteredPlaylists = selectedAge === 'All Ages'
    ? categoryFilteredPlaylists
    : categoryFilteredPlaylists.filter(p => {
        const selectedAgeNum = parseInt(selectedAge.replace('+', ''));
        
        // Check minAge first (numeric)
        if (p.minAge !== undefined && p.minAge !== null) {
          return p.minAge <= selectedAgeNum;
        }
        
        // Fallback to level string parsing
        if (p.level) {
          const levelMatch = p.level.match(/(\d+)/);
          if (levelMatch) {
            return parseInt(levelMatch[1]) <= selectedAgeNum;
          }
        }
        
        // If no age info, show it (assume it's for all ages)
        return true;
      });

  // Apply Search Filter
  const filteredBooks = ageFilteredBooks.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPlaylists = ageFilteredPlaylists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  // Full-screen overlay that covers wheel/header/wood when content is active
  if (showContent) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden">
        <style>{`
          .karaoke-raft-drift { animation: karaoke-raft-drift 5s ease-in-out infinite; will-change: transform; }
          @keyframes karaoke-raft-drift {
            0%, 100% { transform: translate(0, 0) rotate(-0.5deg); }
            25%      { transform: translate(3px, -2px) rotate(0.5deg); }
            50%      { transform: translate(-2px, 3px) rotate(-0.3deg); }
            75%      { transform: translate(2px, 2px) rotate(0.4deg); }
          }
        `}</style>
        {/* Semi-transparent overlay so ocean panorama shows through */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Back button */}
        <div className="relative flex items-center px-4 pt-3 pb-2" style={{ zIndex: 10, paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button
            onClick={() => setShowContent(false)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors font-display text-sm active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        {/* Island + scrollable content wrapper */}
        <div className="relative flex-1 overflow-hidden">
          {/* Karaoke raft — hidden until feature is ready */}
          {/* Fixed island behind content */}
          <div className="absolute top-0 left-0 right-0 flex justify-center pt-12 pointer-events-none" style={{ zIndex: 4 }}>
            <img
              src={HEADPHONE_ISLAND}
              alt="Audio Adventure"
              className="w-[55vw] max-w-[240px] h-auto object-contain"
            />
            {/* Blur overlay that fades in as user scrolls */}
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(${islandBlur * 8}px)`,
                WebkitBackdropFilter: `blur(${islandBlur * 8}px)`,
                backgroundColor: `rgba(0,0,0,${islandBlur * 0.15})`,
                opacity: islandBlur,
                transition: 'opacity 0.1s ease-out',
              }}
            />
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative h-full overflow-y-auto overflow-x-hidden no-scrollbar pb-12"
            style={{ zIndex: 5, overscrollBehavior: 'contain' }}
          >
            {/* Spacer so island is visible initially */}
            <div style={{ height: '260px' }} />

          {/* Featured Audio Carousel */}
          {featuredCarouselItems.length > 0 && (
            <div className="mb-4">
              <div className="relative py-2 mb-3 mx-[-2px]">
                <div
                  className="absolute inset-0 rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-b-4"
                  style={{
                    backgroundColor: '#8B4513',
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), linear-gradient(to bottom, #8B5A2B, #654321)`,
                    borderColor: '#A0522D',
                    borderBottomColor: '#5c2e0b',
                  }}
                />
                <h3 className="relative z-10 text-white font-display text-lg tracking-wide px-6 drop-shadow-md flex items-center gap-2">
                  <span className="text-xl">⭐</span> Featured Audio
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="px-2">
              <FeaturedCarousel
                books={featuredCarouselItems}
                onBookClick={(id, isPlaylist, isAmazonBook, amazonUrl) => {
                  const item = featuredCarouselItems.find(i => (i._id || i.id) === id);
                  if (item?._itemType === 'episode' && item._playlistId != null) {
                    navigate(`/audio/playlist/${item._playlistId}/play/${item._trackIndex ?? 0}`);
                  } else if (isPlaylist || item?._itemType === 'playlist') {
                    navigate(`/audio/playlist/${id}`);
                  }
                }}
              />
              </div>
            </div>
          )}

          {/* Top 10 Audiobooks */}
          {topAudio.length > 0 && (
            <div className="mb-4">
              <div className="relative py-2 mb-3 mx-[-2px]">
                <div
                  className="absolute inset-0 rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-b-4"
                  style={{
                    backgroundColor: '#8B4513',
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), linear-gradient(to bottom, #8B5A2B, #654321)`,
                    borderColor: '#A0522D',
                    borderBottomColor: '#5c2e0b',
                  }}
                />
                <h3 className="relative z-10 text-white font-display text-lg tracking-wide px-6 drop-shadow-md flex items-center gap-2">
                  <span className="text-xl">🎧</span> Top 10 Audiobooks
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4">
                {topAudio.map((playlist, i) => (
                  <button
                    key={playlist._id || `top-audio-${i}`}
                    onClick={() => navigate(`/audio/playlist/${playlist._id}`)}
                    className="flex-shrink-0 w-[150px] group cursor-pointer select-none focus:outline-none"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-400/40 shadow-lg group-hover:border-purple-400/70 group-hover:scale-105 transition-all">
                      <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-md">
                        {i + 1}
                      </div>
                      {playlist.coverImage ? (
                        <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <Music className="w-10 h-10 text-white opacity-50" />
                        </div>
                      )}
                    </div>
                    <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{playlist.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Continue Listening */}
          {continueListening.length > 0 && (
            <div className="mb-4">
              <div className="relative py-2 mb-3 mx-[-2px]">
                <div
                  className="absolute inset-0 rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-b-4"
                  style={{
                    backgroundColor: '#8B4513',
                    backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), linear-gradient(to bottom, #8B5A2B, #654321)`,
                    borderColor: '#A0522D',
                    borderBottomColor: '#5c2e0b',
                  }}
                />
                <h3 className="relative z-10 text-white font-display text-lg tracking-wide px-6 drop-shadow-md flex items-center gap-2">
                  <Music className="w-5 h-5" /> Continue Listening
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4">
                {continueListening.map((playlist, i) => (
                  <button
                    key={playlist._id || `cl-${i}`}
                    onClick={() => navigate(`/audio/playlist/${playlist._id}`)}
                    className="flex-shrink-0 w-[120px] group cursor-pointer select-none focus:outline-none"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-400/40 shadow-lg group-hover:border-emerald-400/70 group-hover:scale-105 transition-all">
                      {playlist.coverImage ? (
                        <img src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                          <Music className="w-8 h-8 text-white opacity-50" />
                        </div>
                      )}
                    </div>
                    <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{playlist.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Bar with Age Filter */}
          <div className="flex gap-2 mb-2 px-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="text-white/60" size={20} />
              </div>
              <input
                type="text"
                placeholder="Search adventures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 transition-colors shadow-inner font-display"
              />
            </div>
            
            {/* Age Filter Dropdown */}
            <div className="relative" ref={ageDropdownRef}>
              <button
                onClick={() => setShowAgeDropdown(!showAgeDropdown)}
                className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl py-3 px-4 text-white hover:bg-white/15 transition-colors shadow-inner font-display flex items-center gap-1 min-w-[100px] justify-center"
              >
                <span className="text-sm">{selectedAge}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showAgeDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showAgeDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 min-w-[120px] max-h-[300px] overflow-y-auto">
                  <div className="py-2">
                    {ageOptions.map((age) => (
                      <button
                        key={age}
                        onClick={() => {
                          setSelectedAge(age);
                          setShowAgeDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors ${
                          selectedAge === age ? 'bg-white/20 font-bold' : ''
                        }`}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Category Section — hidden */}
          <div className="my-4 px-4" style={{ display: 'none' }}>
            {(() => {
              const catData = categoryData[selectedCategory];
              const config = CATEGORY_CONFIG[selectedCategory] || CATEGORY_CONFIG['default'];
              const IconComponent = config.icon;
              const gradientFrom = catData?.gradientFrom || '#6366f1';
              const gradientTo = catData?.gradientTo || '#8b5cf6';
              
              return (
                <button
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  className={`w-full relative overflow-hidden flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${
                    isCategoriesExpanded ? 'bg-white/20 backdrop-blur-sm' : ''
                  }`}
                  style={!isCategoriesExpanded ? { background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` } : undefined}
                >
                  {!isCategoriesExpanded && catData?.image && (
                    <>
                      <img src={catData.image} alt="" className="absolute right-0 top-0 h-full w-2/3 object-cover object-center z-0" />
                      <div className="absolute inset-0 z-[1]" style={{ background: `linear-gradient(to right, ${gradientFrom} 0%, ${gradientFrom} 20%, transparent 60%)` }} />
                    </>
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-display text-lg font-bold drop-shadow-md">
                      {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                    </span>
                  </div>
                  <ChevronDown className={`relative z-10 w-6 h-6 text-white transition-transform duration-300 ${isCategoriesExpanded ? 'rotate-180' : ''}`} />
                </button>
              );
            })()}

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isCategoriesExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
            }`}>
              <div className="space-y-3">
                {categories.map((category) => {
                  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
                  const IconComponent = config.icon;
                  const isSelected = selectedCategory === category;
                  const catData = categoryData[category];
                  const gradientFrom = catData?.gradientFrom || '#6366f1';
                  const gradientTo = catData?.gradientTo || '#8b5cf6';
                  
                  return (
                    <button
                      key={category}
                      onClick={() => { setSelectedCategory(category); setIsCategoriesExpanded(false); }}
                      className={`w-full relative overflow-hidden rounded-2xl transition-all duration-300 transform active:scale-[0.98] ${
                        isSelected ? 'ring-4 ring-white/50 scale-[1.02]' : 'hover:scale-[1.01]'
                      }`}
                    >
                      <div className="p-4 min-h-[80px] flex items-center relative" style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}>
                        {catData?.image && (
                          <>
                            <img src={catData.image} alt="" className="absolute right-0 top-0 h-full w-2/3 object-cover object-center z-0" />
                            <div className="absolute inset-0 z-[1]" style={{ background: `linear-gradient(to right, ${gradientFrom} 0%, ${gradientFrom} 20%, transparent 60%)` }} />
                          </>
                        )}
                        <div className="relative z-10 text-left flex-1">
                          <h3 className="text-white font-display text-xl font-bold drop-shadow-md">
                            {category === 'All' ? 'All Categories' : category}
                          </h3>
                          {isSelected && <span className="text-white/80 text-sm">Currently viewing</span>}
                        </div>
                        {!catData?.image && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                            <IconComponent className="w-16 h-16 text-white" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center z-20">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-4">
          {(loading || playlistsLoading) ? (
            <div className="text-white font-display text-center mt-10">Loading sounds...</div>
          ) : (booksError || playlistsError) ? (
            <StormySeaError 
              onRetry={async () => {
                setIsRetrying(true);
                await Promise.all([refreshBooks(), fetchPlaylists()]);
                setIsRetrying(false);
              }}
              message="The music got swept overboard!"
              isLoading={isRetrying}
            />
          ) : (filteredBooks.length === 0 && filteredPlaylists.length === 0) ? (
            <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
              {searchQuery ? "No matching audio content found." : "No audio content found right now. Try the Explore tab!"}
            </div>
          ) : (
            <>
              {filteredPlaylists.length > 0 && (
                <div className="mb-8">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-6xl mx-auto">
                    {filteredPlaylists.map((playlist, index) => {
                      const isPlaylistLocked = playlist.isMembersOnly && !isSubscribed;
                      return (
                        <button
                          key={playlist._id}
                          id={index === 0 ? 'audiobook-card-0' : undefined}
                          data-tutorial={index === 0 ? 'audiobook-card-0' : undefined}
                          type="button"
                          onClick={() => {
                            if (index === 0 && isTutorialActive && isStepActive('audiobook_highlight')) { nextStep(); }
                            navigate(`/audio/playlist/${playlist._id}`);
                          }}
                          className="w-full cursor-pointer select-none focus:outline-none group text-left"
                        >
                          <div className={`relative aspect-square rounded-xl overflow-hidden border-2 border-white/20 shadow-lg group-hover:border-white/40 group-hover:scale-105 transition-all ${isPlaylistLocked ? 'opacity-80' : ''}`}>
                            {playlist.coverImage ? (
                              <img src={playlist.coverImage} alt={playlist.title} className={`w-full h-full object-cover ${isPlaylistLocked ? 'brightness-75' : ''}`} loading="lazy" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {playlist.type === 'Audiobook' ? <BookOpen className="w-10 h-10 text-white opacity-50" /> : <Music className="w-10 h-10 text-white opacity-50" />}
                              </div>
                            )}
                            {isPlaylistLocked && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                <div className="bg-black/70 rounded-full p-2 border-2 border-[#FFD700]"><Lock size={18} className="text-[#FFD700]" /></div>
                              </div>
                            )}
                            {playlist.isMembersOnly && !isSubscribed && <PremiumBadge className="absolute top-1.5 right-1.5 z-20" />}
                          </div>
                          <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{playlist.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {filteredBooks.length > 0 && (
                <div>
                  {filteredPlaylists.length > 0 && <h3 className="text-white/90 font-display text-lg mb-4 font-bold">Audio Books</h3>}
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-6xl mx-auto">
                    {filteredBooks.map(book => (
                      <BookCard key={book.id} book={book} onClick={(id) => navigate(`/book/${id}`, { state: { from: '/listen' } })} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {/* Footer message + CTA */}
          <div className="px-4 pt-6 pb-8 flex flex-col items-center gap-4">
            <p className="text-white/60 font-display text-sm text-center">
              New playlists and episodes added weekly.
            </p>
            {!isSubscribed && (
              <button
                onClick={() => navigate('/paywall', { state: { from: '/listen' } })}
                className="relative overflow-hidden w-full max-w-[280px] py-3 px-6 rounded-2xl font-display font-bold text-white text-base tracking-wide shadow-lg active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  boxShadow: '0 4px 14px rgba(255,165,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Crown className="w-5 h-5" />
                  Get Unlimited Access
                </span>
              </button>
            )}
          </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (!showContent) {
    return (
      <div className="flex flex-col h-full overflow-hidden relative">

        {/* Drifting sky clouds */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
          <div className="sky-cloud sky-cloud-1" style={{ position: 'absolute', top: '3%' }}>
            <svg width="160" viewBox="0 0 240 70" fill="none" style={{ opacity: 0.18 }}>
              <ellipse cx="40" cy="42" rx="36" ry="20" fill="white" /><ellipse cx="95" cy="32" rx="50" ry="28" fill="white" /><ellipse cx="155" cy="36" rx="44" ry="24" fill="white" /><ellipse cx="205" cy="44" rx="30" ry="18" fill="white" /><rect x="38" y="38" width="168" height="22" rx="11" fill="white" />
            </svg>
          </div>
          <div className="sky-cloud sky-cloud-2" style={{ position: 'absolute', top: '7%' }}>
            <svg width="110" viewBox="0 0 150 120" fill="none" style={{ opacity: 0.14 }}>
              <ellipse cx="75" cy="36" rx="34" ry="30" fill="white" /><ellipse cx="48" cy="62" rx="38" ry="26" fill="white" /><ellipse cx="105" cy="58" rx="36" ry="24" fill="white" /><ellipse cx="75" cy="78" rx="52" ry="22" fill="white" />
            </svg>
          </div>
          <div className="sky-cloud sky-cloud-3" style={{ position: 'absolute', top: '1%' }}>
            <svg width="80" viewBox="0 0 130 40" fill="none" style={{ opacity: 0.10 }}>
              <ellipse cx="30" cy="22" rx="26" ry="14" fill="white" /><ellipse cx="70" cy="18" rx="34" ry="16" fill="white" /><ellipse cx="105" cy="22" rx="22" ry="12" fill="white" />
            </svg>
          </div>
          <div className="sky-cloud sky-cloud-4" style={{ position: 'absolute', top: '11%' }}>
            <svg width="130" viewBox="0 0 190 80" fill="none" style={{ opacity: 0.15 }}>
              <ellipse cx="50" cy="50" rx="42" ry="22" fill="white" /><ellipse cx="110" cy="35" rx="55" ry="30" fill="white" /><ellipse cx="160" cy="48" rx="28" ry="20" fill="white" /><rect x="42" y="44" width="118" height="20" rx="10" fill="white" />
            </svg>
          </div>
          <div className="sky-cloud sky-cloud-5" style={{ position: 'absolute', top: '5%' }}>
            <svg width="55" viewBox="0 0 80 50" fill="none" style={{ opacity: 0.12 }}>
              <ellipse cx="40" cy="26" rx="30" ry="20" fill="white" /><ellipse cx="24" cy="32" rx="18" ry="12" fill="white" /><ellipse cx="56" cy="34" rx="16" ry="11" fill="white" />
            </svg>
          </div>
        </div>

        {/* Ocean wave animations — same as Explore page */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }} aria-hidden>
          <svg className="absolute listen-ocean-1" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '18%', height: '14%', width: '200%' }}>
            <path fill="rgba(255,255,255,0.04)" d="M0,280L60,274C120,268,240,256,360,250C480,244,600,244,720,250C840,256,960,268,1080,274C1200,280,1320,280,1440,274C1440,274,1560,268,1680,256C1800,244,1920,244,2040,250C2160,256,2280,268,2400,274C2520,280,2640,280,2760,274L2880,268L2880,320L0,320Z" />
          </svg>
          <svg className="absolute listen-ocean-2" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '28%', height: '16%', width: '200%' }}>
            <path fill="rgba(0,180,220,0.04)" d="M0,290L48,284C96,278,192,266,288,260C384,254,480,254,576,260C672,266,768,278,864,284C960,290,1056,290,1152,284C1248,278,1344,266,1440,260C1440,260,1536,254,1632,260C1728,266,1824,278,1920,284C2016,290,2112,290,2208,284C2304,278,2400,266,2496,260C2592,254,2688,254,2784,260L2880,266L2880,320L0,320Z" />
          </svg>
          <svg className="absolute listen-ocean-3" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '40%', height: '18%', width: '200%' }}>
            <path fill="rgba(255,255,255,0.06)" d="M0,288L80,278C160,268,320,248,480,242C640,236,800,244,960,254C1120,264,1280,276,1440,278C1440,278,1600,268,1760,254C1920,240,2080,242,2240,252C2400,262,2560,278,2720,282L2880,286L2880,320L0,320Z" />
          </svg>
          <svg className="absolute listen-ocean-4" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '55%', height: '20%', width: '200%' }}>
            <path fill="rgba(0,180,220,0.06)" d="M0,282L60,272C120,262,240,242,360,236C480,230,600,238,720,250C840,262,960,278,1080,282C1200,286,1320,278,1440,268C1440,268,1560,258,1680,248C1800,238,1920,238,2040,248C2160,258,2280,278,2400,284C2520,290,2640,282,2760,272L2880,262L2880,320L0,320Z" />
          </svg>
          <svg className="absolute listen-ocean-5" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '68%', height: '22%', width: '200%' }}>
            <path fill="rgba(255,255,255,0.08)" d="M0,276L48,266C96,256,192,236,288,228C384,220,480,224,576,238C672,252,768,276,864,282C960,288,1056,276,1152,264C1248,252,1344,240,1440,238C1440,238,1536,246,1632,258C1728,270,1824,286,1920,290C2016,294,2112,286,2208,272C2304,258,2400,238,2496,232C2592,226,2688,234,2784,248L2880,262L2880,320L0,320Z" />
          </svg>
          <svg className="absolute listen-ocean-6" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '80%', height: '20%', width: '200%' }}>
            <path fill="rgba(255,255,255,0.05)" d="M0,290L40,284C80,278,160,266,240,258C320,250,400,246,480,250C560,254,640,266,720,274C800,282,880,286,960,284C1040,282,1120,274,1200,266C1280,258,1360,250,1440,250C1440,250,1520,258,1600,266C1680,274,1760,282,1840,286C1920,290,2000,290,2080,284C2160,278,2240,266,2320,258C2400,250,2480,246,2560,250C2640,254,2720,266,2800,274L2880,282L2880,320L0,320Z" />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{ background: 'linear-gradient(to top, rgba(0,40,80,0.10), transparent)' }} />
        </div>

        {/* Karaoke raft — hidden until feature is ready */}

        {/* Music Notes Island — back left */}
        <div className="absolute transition-opacity duration-300" style={{ zIndex: 3, left: '3%', top: '20%', width: '28vw', maxWidth: 140, opacity: isZoomingIn ? 0 : 1 }}>
          {/* Pulse rings — multi-color: green, orange, purple */}
          <div className="absolute pointer-events-none" style={{ zIndex: 1, left: 0, right: 0, top: 0, bottom: 0 }}>
            {/* Green */}
            <div className="music-pulse-green-1" style={{
              position: 'absolute', left: '5%', right: '5%', top: '58%', height: '30%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(144,238,144,0.65) 0%, rgba(144,238,144,0.40) 50%, rgba(144,238,144,0) 100%)',
              boxShadow: '0 0 16px 6px rgba(144,238,144,0.3)',
            }} />
            {/* Orange */}
            <div className="music-pulse-orange-1" style={{
              position: 'absolute', left: '3%', right: '3%', top: '56%', height: '32%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(255,165,0,0.60) 0%, rgba(255,165,0,0.35) 50%, rgba(255,165,0,0) 100%)',
              boxShadow: '0 0 16px 6px rgba(255,165,0,0.25)',
            }} />
            {/* Purple */}
            <div className="music-pulse-purple-1" style={{
              position: 'absolute', left: '1%', right: '1%', top: '55%', height: '34%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(180,100,255,0.55) 0%, rgba(180,100,255,0.30) 50%, rgba(180,100,255,0) 100%)',
              boxShadow: '0 0 20px 8px rgba(180,100,255,0.2)',
            }} />
          </div>
          <button
            type="button"
            onClick={handleMusicIslandClick}
            className="relative cursor-pointer select-none transition-transform active:scale-95 hover:scale-[1.03] focus:outline-none"
            style={{ zIndex: 2 }}
            aria-label="Play Music"
          >
            <img
              src={MUSIC_ISLAND}
              alt="Music Island"
              className="w-full h-auto object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
            />
            {/* Wood-themed now-playing widget — over the island */}
            {isMusicIslandPlaying && activePlaylist && (() => {
              const track = activePlaylist.items[currentTrackIndex];
              const coverImg = (track as any)?.coverImage || activePlaylist.coverImage;
              const trackTitle = (track as any)?.title || activePlaylist.title || 'Now Playing';
              return (
                <div className="absolute flex flex-col items-center" style={{ zIndex: 3, top: '-48%', left: '30%', width: '160%', maxWidth: 200 }}>
                  <div
                    className="relative w-full rounded-xl overflow-visible border-2 border-[#8B6914]"
                    style={{
                      background: 'linear-gradient(135deg, #5D4037 0%, #3E2723 50%, #4E342E 100%)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Close button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); closePlayer(); }}
                      className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[#3E2723] border border-[#8B6914]/60 flex items-center justify-center shadow-md hover:bg-[#5D4037] active:scale-90 transition-transform"
                      style={{ zIndex: 10 }}
                      aria-label="Close player"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="3" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                    {/* Wood grain texture overlay */}
                    <div className="relative p-2 flex items-center gap-2 rounded-xl overflow-hidden"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(0,0,0,0.06) 8px, rgba(0,0,0,0.06) 9px)',
                      }}
                    >
                      {/* Album cover */}
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-[#8B6914]/50" style={{ boxShadow: 'inset 0 0 4px rgba(0,0,0,0.4)' }}>
                        {coverImg ? (
                          <img src={coverImg} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#6D4C41] flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFD700"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                          </div>
                        )}
                      </div>
                      {/* Track name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[#FFD700] text-[10px] font-bold font-display truncate leading-tight">{trackTitle}</p>
                        <p className="text-[#D7CCC8] text-[8px] font-display truncate leading-tight">{activePlaylist.author || 'GodlyKids'}</p>
                      </div>
                      {/* Play/Pause button */}
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center border-2 border-[#FFD700]/60"
                        style={{
                          background: 'radial-gradient(circle, #8B6914 0%, #5D4037 100%)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.15)',
                        }}
                      >
                        {isPlaying ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD700">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD700">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ zIndex: 2, paddingTop: '8%' }}>
          <div
            className={`relative ${isZoomingIn ? 'listen-island-zoom-in' : ''}`}
            style={{ width: 'min(203px, 55vw)', maxWidth: 235, transformOrigin: 'center 40%', willChange: 'transform, opacity' }}
          >
            {/* Pulse rings — behind the island image */}
            <div className="absolute pointer-events-none" style={{ zIndex: 1, inset: '-12% -12%', bottom: '-8%' }}>
              <div className="listen-pulse-1" style={{
                position: 'absolute', left: '0', right: '0', bottom: '4%', height: '48%',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.25)',
                boxShadow: '0 0 12px 4px rgba(180,230,255,0.15), inset 0 0 10px 2px rgba(180,230,255,0.08)',
              }} />
              <div className="listen-pulse-2" style={{
                position: 'absolute', left: '-4%', right: '-4%', bottom: '0', height: '51%',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '0 0 18px 6px rgba(180,230,255,0.1)',
              }} />
            </div>
            {/* Floating music notes */}
            <div className="absolute pointer-events-none overflow-visible" style={{ zIndex: 3, left: '10%', right: '10%', top: '-15%', bottom: '0%' }}>
              {/* Left side notes */}
              <img src="/assets/images/music-note-orange.webp" alt="" className="absolute listen-note-float" style={{ width: 20, left: '0%', top: '15%', animationDelay: '0s' }} />
              <img src="/assets/images/music-note-purple.webp" alt="" className="absolute listen-note-float" style={{ width: 15, left: '8%', top: '40%', animationDelay: '2s' }} />
              <img src="/assets/images/music-note-yellow.webp" alt="" className="absolute listen-note-float" style={{ width: 17, left: '15%', top: '5%', animationDelay: '3.2s' }} />
              {/* Right side notes */}
              <img src="/assets/images/music-note-yellow.webp" alt="" className="absolute listen-note-float" style={{ width: 18, right: '0%', top: '12%', animationDelay: '1s' }} />
              <img src="/assets/images/music-note-orange.webp" alt="" className="absolute listen-note-float" style={{ width: 14, right: '10%', top: '38%', animationDelay: '2.8s' }} />
              <img src="/assets/images/music-note-purple.webp" alt="" className="absolute listen-note-float" style={{ width: 16, right: '5%', top: '0%', animationDelay: '0.6s' }} />
            </div>
            <button
              type="button"
              onClick={handleIslandClick}
              className="relative w-full cursor-pointer select-none focus:outline-none rounded-2xl"
              style={{ zIndex: 2 }}
              aria-label="Open Audio Content"
            >
              <img
                src={HEADPHONE_ISLAND}
                alt="Listen Island"
                className="w-full h-auto object-contain"
              />
            </button>
          </div>

          {/* Audio Adventure Island button */}
          <button
            type="button"
            onClick={handleIslandClick}
            className="cursor-pointer select-none focus:outline-none overflow-hidden rounded-2xl"
            style={{ width: 'min(194px, 53vw)', maxWidth: 223, marginTop: -20 }}
            aria-label="Audio Adventure Island"
          >
            <img
              src="/assets/images/audio-adventure-button.webp"
              alt="Audio Adventure Island"
              className="w-full h-auto object-contain rounded-2xl"
            />
          </button>
        </div>
        <style>{`
          /* Drifting clouds */
          .sky-cloud { left: -200px; }
          .sky-cloud-1 { animation: sky-cloud-flow 80s linear infinite; }
          .sky-cloud-2 { animation: sky-cloud-flow 65s linear infinite; animation-delay: -20s; }
          .sky-cloud-3 { animation: sky-cloud-flow 100s linear infinite; animation-delay: -55s; }
          .sky-cloud-4 { animation: sky-cloud-flow 70s linear infinite; animation-delay: -38s; }
          .sky-cloud-5 { animation: sky-cloud-flow 90s linear infinite; animation-delay: -65s; }
          @keyframes sky-cloud-flow {
            from { transform: translateX(0); }
            to   { transform: translateX(calc(100vw + 400px)); }
          }
          .listen-ocean-1 { animation: listen-wave-scroll 28s linear infinite; }
          .listen-ocean-2 { animation: listen-wave-scroll 22s linear infinite; animation-delay: -8s; }
          .listen-ocean-3 { animation: listen-wave-scroll 18s linear infinite; animation-delay: -4s; }
          .listen-ocean-4 { animation: listen-wave-scroll 15s linear infinite; animation-delay: -10s; }
          .listen-ocean-5 { animation: listen-wave-scroll 12s linear infinite; animation-delay: -3s; }
          .listen-ocean-6 { animation: listen-wave-scroll 9s linear infinite; animation-delay: -6s; }
          @keyframes listen-wave-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .listen-pulse-1 { animation: listen-wave-shrink 3.5s ease-in-out infinite; transform-origin: center 70%; }
          .listen-pulse-2 { animation: listen-wave-shrink 4.5s ease-in-out infinite; animation-delay: -1.2s; transform-origin: center 70%; }
          @keyframes listen-wave-shrink {
            0%   { transform: scale(1.15); opacity: 0; }
            20%  { opacity: 0.7; }
            60%  { opacity: 0.4; }
            100% { transform: scale(0.95); opacity: 0; }
          }
          .music-pulse-green-1  { animation: music-wave-shrink 3.5s ease-in-out infinite; transform-origin: center 70%; }
          .music-pulse-orange-1 { animation: music-wave-shrink 3.5s ease-in-out infinite; animation-delay: -1.2s; transform-origin: center 70%; }
          .music-pulse-purple-1 { animation: music-wave-shrink 3.5s ease-in-out infinite; animation-delay: -2.4s; transform-origin: center 70%; }
          @keyframes music-wave-shrink {
            0%   { transform: scale(1.15); opacity: 0; }
            20%  { opacity: 1; }
            60%  { opacity: 0.6; }
            100% { transform: scale(0.95); opacity: 0; }
          }

          .karaoke-raft-drift {
            animation: karaoke-raft-drift 5s ease-in-out infinite;
            will-change: transform;
          }
          @keyframes karaoke-raft-drift {
            0%, 100% { transform: translate(0, 0) rotate(-0.5deg); }
            25%      { transform: translate(3px, -2px) rotate(0.5deg); }
            50%      { transform: translate(-2px, 3px) rotate(-0.3deg); }
            75%      { transform: translate(2px, 2px) rotate(0.4deg); }
          }

          .listen-note-float {
            animation: listen-note-fly 4s ease-in-out infinite;
            will-change: transform, opacity;
          }
          @keyframes listen-note-fly {
            0%   { transform: translate(0, 0) rotate(0deg) scale(0.4); opacity: 0; }
            15%  { transform: translate(4px, -10px) rotate(-10deg) scale(0.9); opacity: 0.8; }
            40%  { transform: translate(-6px, -28px) rotate(12deg) scale(1); opacity: 1; }
            65%  { transform: translate(8px, -48px) rotate(-8deg) scale(0.9); opacity: 0.7; }
            85%  { transform: translate(-2px, -64px) rotate(6deg) scale(0.6); opacity: 0.3; }
            100% { transform: translate(0, -78px) rotate(0deg) scale(0.3); opacity: 0; }
          }

          /* Pulse-then-zoom for Audio Adventure Island */
          .listen-island-zoom-in {
            animation: listen-island-zoom 1s ease-in forwards;
            will-change: transform, opacity;
          }
          @keyframes listen-island-zoom {
            0%   { transform: scale(1); opacity: 1; }
            12%  { transform: scale(1.08); opacity: 1; }
            24%  { transform: scale(0.97); opacity: 1; }
            36%  { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(7); opacity: 0; }
          }
          .listen-island-flash {
            animation: listen-flash-white 1s ease-in forwards;
            will-change: background;
          }
          @keyframes listen-flash-white {
            0%   { background: rgba(255,255,255,0); }
            60%  { background: rgba(255,255,255,0); }
            85%  { background: rgba(255,255,255,0.5); }
            100% { background: rgba(255,255,255,1); }
          }
        `}</style>

        {/* Zoom-in white flash overlay */}
        {isZoomingIn && (
          <div className="fixed inset-0 listen-island-flash pointer-events-none" style={{ zIndex: 999 }} />
        )}
      </div>
    );
  }

  return null;
};

export default ListenPage;