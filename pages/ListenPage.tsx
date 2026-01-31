import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { useTutorial } from '../context/TutorialContext';
import { Search, Music, ChevronDown, Lock, BookOpen, Heart, Sparkles, TreePine, Sword, Star, Book, Users, Crown, Compass, Smile } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';
import { getApiBaseUrl, ApiService } from '../services/apiService';
import StormySeaError from '../components/ui/StormySeaError';

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

const ListenPage: React.FC = () => {

  const navigate = useNavigate();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { isSubscribed } = useUser();
  const { isTutorialActive, isStepActive, nextStep } = useTutorial();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const ageDropdownRef = useRef<HTMLDivElement>(null);
  // categoryDropdownRef removed - using horizontal buttons
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

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

  // Fetch playlists on mount
  useEffect(() => {
    fetchPlaylists();
  }, []);

  // Fetch categories on mount (audio type only, excluding explore-only categories)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await ApiService.getCategories('audio');
        // Filter out categories that are marked for explore page only
        const nonExploreCategories = cats.filter(c => !c.showOnExplore);
        const categoryNames = ['All', ...nonExploreCategories.map(c => c.name).filter(Boolean)];
        setCategories(categoryNames);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Extract categories from playlists and books as fallback
        const playlistCategories = playlists.map(p => p.category).filter(Boolean);
        const bookCategories = books.filter(b => b.isAudio).map(b => b.category).filter(Boolean);
        const uniqueCategories = ['All', ...new Set([...playlistCategories, ...bookCategories])];
        setCategories(uniqueCategories);
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



  // CRITICAL TEST - This will show if component renders



  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="LISTEN" />

      <div className="px-4 pt-28 pb-52">

        {/* Search Bar with Age Filter */}
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="text-white/60" size={20} />
            </div>
            <input
              type="text"
              placeholder="Search adventures..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-black/30 transition-colors shadow-inner font-display"
            />
          </div>
          
          {/* Age Filter Dropdown */}
          <div className="relative" ref={ageDropdownRef}>
            <button
              onClick={() => setShowAgeDropdown(!showAgeDropdown)}
              className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl py-3 px-4 text-white hover:bg-black/30 transition-colors shadow-inner font-display flex items-center gap-1 min-w-[100px] justify-center"
            >
              <span className="text-sm">{selectedAge}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAgeDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Age Dropdown Menu */}
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

        {/* Collapsible Category Section */}
        <div className="my-4">
          {/* Category Header - Always visible */}
          <button
            onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${
              isCategoriesExpanded 
                ? 'bg-white/20 backdrop-blur-sm' 
                : `bg-gradient-to-r ${CATEGORY_CONFIG[selectedCategory]?.bgColor || CATEGORY_CONFIG['default'].bgColor}`
            }`}
          >
            <div className="flex items-center gap-3">
              {(() => {
                const config = CATEGORY_CONFIG[selectedCategory] || CATEGORY_CONFIG['default'];
                const IconComponent = config.icon;
                return (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-display text-lg font-bold">
                      {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                    </span>
                  </>
                );
              })()}
            </div>
            <ChevronDown className={`w-6 h-6 text-white transition-transform duration-300 ${isCategoriesExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Expandable Category Cards */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isCategoriesExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}>
            <div className="space-y-3">
              {categories.map((category) => {
                const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
                const IconComponent = config.icon;
                const isSelected = selectedCategory === category;
                
                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setIsCategoriesExpanded(false);
                    }}
                    className={`w-full relative overflow-hidden rounded-2xl transition-all duration-300 transform active:scale-[0.98] ${
                      isSelected ? 'ring-4 ring-white/50 scale-[1.02]' : 'hover:scale-[1.01]'
                    }`}
                  >
                    {/* Gradient Background */}
                    <div className={`bg-gradient-to-r ${config.bgColor} p-4 min-h-[80px] flex items-center`}>
                      {/* Left side - Icon and Text */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-white font-display text-xl font-bold drop-shadow-md">
                            {category === 'All' ? 'All Categories' : category}
                          </h3>
                          {isSelected && (
                            <span className="text-white/80 text-sm">Currently viewing</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right side - Decorative elements */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                        <IconComponent className="w-20 h-20 text-white" />
                      </div>
                      
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white flex items-center justify-center">
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
            <div className="text-xs text-white/60 mt-4 space-y-1">
              <p>No content available.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Playlists Section */}
            {filteredPlaylists.length > 0 && (
              <div className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                  {filteredPlaylists.map((playlist, index) => {
                    const isPlaylistLocked = playlist.isMembersOnly && !isSubscribed;
                    
                    return (
                      <div
                        key={playlist._id}
                        id={index === 0 ? 'audiobook-card-0' : undefined}
                        data-tutorial={index === 0 ? 'audiobook-card-0' : undefined}
                        onClick={() => {
                          // Allow navigation to detail page even for locked content
                          // The detail page will show preview functionality (1-minute demo)
                          // Advance tutorial when clicking highlighted audiobook
                          if (index === 0 && isTutorialActive && isStepActive('audiobook_highlight')) {
                            nextStep(); // Advance to tutorial_complete
                          }
                          navigate(`/audio/playlist/${playlist._id}`);
                        }}
                        className={`bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer group ${isPlaylistLocked ? 'opacity-80' : ''}`}
                      >
                        {/* Cover Image - Same structure as BookCard */}
                        <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                          {playlist.coverImage ? (
                            <img
                              src={playlist.coverImage}
                              alt={playlist.title}
                              className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${isPlaylistLocked ? 'filter brightness-75' : ''}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {playlist.type === 'Audiobook' ? (
                                <BookOpen className="w-24 h-24 text-white opacity-50" />
                              ) : (
                                <Music className="w-24 h-24 text-white opacity-50" />
                              )}
                            </div>
                          )}
                          
                          {/* Lock Overlay for Members Only Content */}
                          {isPlaylistLocked && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                              <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700]">
                                <Lock size={24} className="text-[#FFD700]" />
                              </div>
                            </div>
                          )}
                          
                          {/* Members Only Badge - Only show if user is NOT subscribed */}
                          {playlist.isMembersOnly && !isSubscribed && (
                            <PremiumBadge className="absolute top-2 right-2 z-20" />
                          )}
                          
                          {/* Type Badge - Song vs Audiobook */}
                          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white z-20 ${
                            playlist.type === 'Audiobook' 
                              ? 'bg-amber-600/90' 
                              : 'bg-purple-600/90'
                          }`}>
                            {playlist.type === 'Audiobook' ? '📖 Audiobook' : '🎵 Music'}
                          </div>
                          
                          {/* Gradient overlay at bottom */}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

                          {/* Age Badge - Bottom Left (matching BookCard style) */}
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 z-20">
                            {playlist.level || (playlist.minAge ? `${playlist.minAge}+` : 'All')}
                          </div>

                          {/* Type Icon - Different for Song vs Audiobook */}
                          <div className={`absolute bottom-2 right-2 p-1.5 rounded-full shadow-md ${
                            playlist.type === 'Audiobook' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-white/90 text-blue-900'
                          }`}>
                            {playlist.type === 'Audiobook' ? <BookOpen size={16} /> : <Music size={16} />}
                          </div>
                        </div>
                        
                        {/* Info - Same structure as BookCard */}
                        <div className="p-1.5">
                          <h3 className="text-white text-xs font-bold mb-0.5 truncate font-display">
                            {playlist.title}
                          </h3>
                          {playlist.author && (
                            <p className="text-white/70 text-[10px]">{playlist.author}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audio Books Section */}
            {filteredBooks.length > 0 && (
              <div>
                {filteredPlaylists.length > 0 && (
                  <h3 className="text-white/90 font-display text-lg mb-4 font-bold">Audio Books</h3>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                  {filteredBooks.map(book => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onClick={(id) => navigate(`/book/${id}`, { state: { from: '/listen' } })}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ListenPage;