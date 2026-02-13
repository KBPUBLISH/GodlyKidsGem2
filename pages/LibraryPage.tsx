
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { Search, ChevronDown, Music, BookOpen, Clock, Heart, ListMusic, Plus, Trash2, Loader2 } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';
import { readingProgressService } from '../services/readingProgressService';
import { playHistoryService } from '../services/playHistoryService';
import { getApiBaseUrl } from '../services/apiService';
import { userPlaylistService, UserPlaylist } from '../services/userPlaylistService';
import { authService } from '../services/authService';
import { FEATURE_CREATE_YOUR_STORY } from '../constants';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

interface Playlist {
  _id: string;
  title: string;
  author?: string;
  coverImage?: string;
  type?: 'Song' | 'Audiobook';
  items: any[];
}

/** From GET /api/monthly-book/my-books (Create Your Story) */
interface MyMonthlyBook {
  customMonthlyBookId: string;
  bookId: string | null;
  title: string;
  coverImageUrl: string | null;
  childName?: string;
  createdAt: string;
  status: 'pending' | 'generating' | 'completed';
  pageCount?: number;
}

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [userPlaylistsLoading, setUserPlaylistsLoading] = useState(true);
  const [myMonthlyBooks, setMyMonthlyBooks] = useState<MyMonthlyBook[]>([]);
  const [myMonthlyBooksLoading, setMyMonthlyBooksLoading] = useState(false);
  const ageDropdownRef = useRef<HTMLDivElement>(null);
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

  // Fetch playlists
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        setPlaylistsLoading(true);
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}playlists?status=published`);
        if (response.ok) {
          const data = await response.json();
          const playlistsArray = Array.isArray(data) ? data : (data.data || []);
          setPlaylists(playlistsArray);
        }
      } catch (error) {
        console.error('Error fetching playlists:', error);
      } finally {
        setPlaylistsLoading(false);
      }
    };
    fetchPlaylists();
  }, []);

  // Fetch user's custom playlists
  useEffect(() => {
    const fetchUserPlaylists = async () => {
      const user = authService.getUser();
      const userId = user?.email || user?._id;
      if (!userId) {
        setUserPlaylistsLoading(false);
        return;
      }
      
      try {
        setUserPlaylistsLoading(true);
        const data = await userPlaylistService.getPlaylists(userId);
        setUserPlaylists(data);
      } catch (error) {
        console.error('Error fetching user playlists:', error);
      } finally {
        setUserPlaylistsLoading(false);
      }
    };
    fetchUserPlaylists();
  }, []);

  // Fetch user's Create Your Story books (completed + in-progress). Refetch when user lands on Library and when page becomes visible again.
  const fetchMyMonthlyBooksRef = useRef<() => Promise<void>>(null);
  useEffect(() => {
    if (!FEATURE_CREATE_YOUR_STORY || location.pathname !== '/library') return;
    const user = authService.getUser();
    const userId = (user as any)?._id || (user as any)?.id || user?.email || localStorage.getItem('godlykids_user_email') || localStorage.getItem('device_id');
    if (!userId) {
      setMyMonthlyBooksLoading(false);
      return;
    }
    const fetchMyMonthlyBooks = async () => {
      try {
        setMyMonthlyBooksLoading(true);
        const base = getApiBaseUrl()?.replace(/\/$/, '') || '';
        const res = await fetch(`${base}/api/monthly-book/my-books?userId=${encodeURIComponent(userId)}&includeInProgress=1`);
        const data = await res.json().catch(() => ({}));
        if (data.success && Array.isArray(data.books)) {
          setMyMonthlyBooks(data.books);
        }
      } catch (e) {
        console.error('Error fetching my monthly books:', e);
      } finally {
        setMyMonthlyBooksLoading(false);
      }
    };
    fetchMyMonthlyBooksRef.current = fetchMyMonthlyBooks;
    fetchMyMonthlyBooks();
  }, [location.pathname]);

  // Refetch my books when user returns to this tab/page so in-progress and newly completed books are visible.
  useEffect(() => {
    if (!FEATURE_CREATE_YOUR_STORY || location.pathname !== '/library') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && fetchMyMonthlyBooksRef.current) {
        fetchMyMonthlyBooksRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [location.pathname]);

  // When coming from Create Your Story or from the Creating page, scroll My Books into view so the user sees their book (in-progress or completed).
  const myBooksSectionRef = useRef<HTMLDivElement>(null);
  const didScrollToMyBooks = useRef(false);
  useEffect(() => {
    if (location.pathname !== '/library') {
      didScrollToMyBooks.current = false;
      return;
    }
    if (!FEATURE_CREATE_YOUR_STORY) return;
    const state = location.state as any;
    if (!state?.fromCreateYourStory && !state?.fromCreating) return;
    if (didScrollToMyBooks.current) return;
    didScrollToMyBooks.current = true;
    const t = setTimeout(() => {
      myBooksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => clearTimeout(t);
  }, [location.pathname, location.state]);

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

  // Get favorite books
  const favoriteBookIds = favoritesService.getFavorites();
  const favoriteBooks = books.filter(b => favoriteBookIds.includes(b.id) || favoriteBookIds.includes((b as any)._id));

  // Get favorite playlists
  const favoritePlaylistIds = favoritesService.getPlaylistFavorites();
  const favoritePlaylists = playlists.filter(p => favoritePlaylistIds.includes(p._id));

  // Get recently read books (history)
  const recentBookIds = readingProgressService.getRecentlyReadBookIds(10);
  const recentBooks = recentBookIds
    .map(id => books.find(b => b.id === id || (b as any)._id === id))
    .filter(Boolean) as typeof books;

  // Get recently played playlists (history)
  const recentPlaylistIds = playHistoryService.getRecentlyPlayedIds(10);
  const recentPlaylists = recentPlaylistIds
    .map(id => playlists.find(p => p._id === id))
    .filter(Boolean) as Playlist[];

  // Filter by search and age
  const filterBooks = (bookList: typeof books) => {
    let filtered = bookList;
    
    // Age filter
    if (selectedAge !== 'All Ages') {
      filtered = filtered.filter(b => {
        const bookAge = b.level || '';
        return bookAge.includes(selectedAge.replace('+', ''));
      });
    }
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return filtered;
  };

  const filterPlaylists = (playlistList: Playlist[]) => {
    if (!searchQuery) return playlistList;
    return playlistList.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const filteredFavoriteBooks = filterBooks(favoriteBooks);
  const filteredFavoritePlaylists = filterPlaylists(favoritePlaylists);
  const filteredRecentBooks = filterBooks(recentBooks);
  const filteredRecentPlaylists = filterPlaylists(recentPlaylists);

  // Filter user playlists by search
  const filteredUserPlaylists = searchQuery 
    ? userPlaylists.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : userPlaylists;

  const isLoading = loading || playlistsLoading || userPlaylistsLoading;

  // Delete a user playlist
  const handleDeleteUserPlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this playlist? This cannot be undone.')) return;
    
    const success = await userPlaylistService.deletePlaylist(playlistId);
    if (success) {
      setUserPlaylists(prev => prev.filter(p => p._id !== playlistId));
    }
  };

  // Render a horizontal scrollable row of book cards
  const renderBookRow = (bookList: typeof books) => (
    <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
      <div className="flex space-x-3 px-4">
        {bookList.map(book => (
          <div key={book.id} className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]">
            <BookCard 
              book={book} 
              onClick={(id) => navigate(`/book/${id}`, { state: { from: '/library' } })} 
            />
          </div>
        ))}
      </div>
    </div>
  );

  // Render user playlist cards (My Playlists)
  const renderUserPlaylistRow = () => (
    <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
      <div className="flex space-x-3 px-4">
        {/* Create New Playlist Card */}
        <div 
          className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] cursor-pointer"
          onClick={() => navigate('/create-playlist')}
        >
          <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-dashed border-purple-400/50 hover:border-purple-400 hover:shadow-2xl hover:scale-105 transition-all group">
            <div className="aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/30 flex items-center justify-center mb-2 group-hover:bg-purple-500/50 transition-colors">
                  <Plus className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-purple-200 font-bold text-sm">Create New</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Playlist Cards */}
        {filteredUserPlaylists.map(playlist => (
          <button 
            key={playlist._id} 
            className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] text-left relative group"
            onClick={() => navigate(`/my-playlist/${playlist._id}`)}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 active:scale-95 transition-transform">
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-600 relative overflow-hidden">
                {playlist.coverImage ? (
                  <img
                    src={playlist.coverImage}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListMusic className="w-16 h-16 text-white/60" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-white font-bold text-sm truncate">{playlist.name}</h3>
                <p className="text-white/40 text-xs mt-1">
                  {playlist.items?.length || 0} items
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Render a horizontal scrollable row of playlist cards
  const renderPlaylistRow = (playlistList: Playlist[]) => (
    <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
      <div className="flex space-x-3 px-4">
        {playlistList.map(playlist => (
          <div 
            key={playlist._id} 
            className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] cursor-pointer"
            onClick={() => navigate(`/audio/playlist/${playlist._id}`)}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all group">
              <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                {playlist.coverImage ? (
                  <img
                    src={playlist.coverImage}
                    alt={playlist.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-16 h-16 text-white/60" />
                  </div>
                )}
                {/* Type Badge */}
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                  <span className="text-white text-xs font-medium">
                    {playlist.type === 'Audiobook' ? '📖' : '🎵'} {playlist.type || 'Audio'}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-white font-bold text-sm truncate">{playlist.title}</h3>
                {playlist.author && (
                  <p className="text-white/60 text-xs truncate mt-1">{playlist.author}</p>
                )}
                <p className="text-white/40 text-xs mt-1">
                  {playlist.items?.length || 0} {playlist.type === 'Audiobook' ? 'chapters' : 'songs'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="MY LIBRARY" />

      <div className="px-4 pt-28 pb-52">
        {/* Create Your Story - front and center CTA (hidden until feature launch) */}
        {FEATURE_CREATE_YOUR_STORY && (
          <>
            <div
              onClick={() => navigate('/create-your-story')}
              className="mb-3 rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-gradient-to-br from-amber-600/40 to-amber-800/50 shadow-xl active:scale-[0.98] transition-transform"
            >
              <div className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-amber-500/30 flex items-center justify-center shrink-0">
                  <BookOpen className="w-8 h-8 text-amber-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-bold text-lg">Create your story</h2>
                  <p className="text-amber-100/90 text-sm mt-0.5">Enter the Bible with your own adventure. Once a month, a new story with you in it.</p>
                </div>
                <ChevronDown className="w-5 h-5 text-amber-200 rotate-[-90deg] shrink-0" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/kids-monthly')}
              className="mb-3 w-full py-2.5 rounded-xl border border-amber-400/40 bg-amber-500/20 text-amber-200 text-sm font-medium hover:bg-amber-500/30 active:scale-[0.98] transition-all"
            >
              Kids Monthly — stories you created
            </button>
            {myMonthlyBooks.some((b) => b.status === 'pending' || b.status === 'generating') && (
              <button
                type="button"
                onClick={() => {
                  const creating = myMonthlyBooks.find((b) => b.status === 'pending' || b.status === 'generating');
                  if (creating) navigate(`/library/creating/${creating.customMonthlyBookId}`);
                }}
                className="mb-6 w-full py-3 rounded-xl border-2 border-amber-400/50 bg-amber-500/25 text-amber-100 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-500/35 active:scale-[0.98] transition-all"
              >
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Your story is still creating — tap to see progress
              </button>
            )}
          </>
        )}

        {/* My Books (Create Your Story) - always show so user knows where to find created books */}
        {FEATURE_CREATE_YOUR_STORY && (
          <div className="mb-8" ref={myBooksSectionRef} data-my-books-section>
            <SectionTitle title="My Books" />
            {myMonthlyBooksLoading ? (
              <div className="py-6 text-center text-white/60 text-sm">Loading your books...</div>
            ) : myMonthlyBooks.length === 0 ? (
              <p className="py-4 text-white/60 text-sm">Books you create will appear here. Use &quot;Create your story&quot; above to make one.</p>
            ) : (
              <div className="w-screen overflow-x-auto no-scrollbar pb-4 -mx-4">
                <div className="flex space-x-3 px-4">
                  {myMonthlyBooks.map((item) => (
                    <div
                      key={item.customMonthlyBookId}
                      className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px]"
                    >
                      {item.status === 'completed' && item.bookId ? (
                        <div className="relative">
                          <BookCard
                            book={{
                              id: item.bookId,
                              title: item.title,
                              coverUrl: item.coverImageUrl || '',
                              author: item.childName,
                            } as any}
                            onClick={(id) => navigate(`/book/${id}`, { state: { from: '/library' } })}
                          />
                          {item.pageCount != null && item.pageCount > 0 && (
                            <p className="text-amber-200/90 text-xs text-center mt-1 px-1">
                              {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                            </p>
                          )}
                        </div>
                      ) : item.status === 'failed' ? (
                        <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 border-red-400/40">
                          <div className="aspect-square relative bg-gradient-to-br from-red-900/40 to-amber-900/30 flex flex-col items-center justify-center p-3">
                            <BookOpen className="w-12 h-12 text-red-300/80" />
                            <span className="text-red-200 text-sm font-bold text-center mt-2">Couldn’t create</span>
                            <span className="text-red-200/80 text-xs text-center mt-1">Try again with &quot;Create your story&quot;</span>
                          </div>
                          <div className="p-2">
                            <p className="text-white font-medium text-sm truncate">{item.title}</p>
                            <p className="text-red-300/80 text-xs">Creation failed · try again</p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/library/creating/${item.customMonthlyBookId}`)}
                          className="w-full text-left bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden border-2 border-amber-400/30 hover:border-amber-400/50 active:scale-[0.98] transition-all"
                        >
                          <div className="aspect-square relative bg-gradient-to-br from-amber-900/40 to-amber-800/30">
                            {item.coverImageUrl ? (
                              <img
                                src={item.coverImageUrl}
                                alt=""
                                className="w-full h-full object-cover opacity-80"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-12 h-12 text-amber-200/60" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
                              <Loader2 className="w-10 h-10 text-amber-300 animate-spin" aria-hidden />
                              <span className="text-amber-200 text-sm font-bold text-center px-2">Creating your story...</span>
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="text-white font-medium text-sm truncate">{item.title}</p>
                            <p className="text-amber-200/80 text-xs">Usually 5–10 min · tap to see progress</p>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Bar with Age Filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="text-white/60" size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Search my library..." 
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

        {isLoading ? (
          <div className="text-white font-display text-center mt-10">Checking backpack...</div>
        ) : (
          <>
            {/* My Playlists Section - ALWAYS show at the top so users can create playlists */}
            <section className="mb-6">
              <SectionTitle 
                title="My Playlists" 
                icon="🎶"
                color="#E040FB"
              />
              {renderUserPlaylistRow()}
            </section>

            {/* Favorite Books Section */}
            {filteredFavoriteBooks.length > 0 && (
              <section className="mb-6">
                <SectionTitle 
                  title="Favorite Books" 
                  icon="📚"
                  color="#E91E63"
                />
                {renderBookRow(filteredFavoriteBooks)}
              </section>
            )}

            {/* Favorite Audio Section */}
            {filteredFavoritePlaylists.length > 0 && (
              <section className="mb-6">
                <SectionTitle 
                  title="Favorite Audio" 
                  icon="🎧"
                  color="#9C27B0"
                />
                {renderPlaylistRow(filteredFavoritePlaylists)}
              </section>
            )}

            {/* Reading History Section */}
            {filteredRecentBooks.length > 0 && (
              <section className="mb-6">
                <SectionTitle 
                  title="Reading History" 
                  icon="📖"
                  color="#4CAF50"
                />
                {renderBookRow(filteredRecentBooks)}
              </section>
            )}

            {/* Listening History Section */}
            {filteredRecentPlaylists.length > 0 && (
              <section className="mb-6">
                <SectionTitle 
                  title="Listening History" 
                  icon="🎵"
                  color="#2196F3"
                />
                {renderPlaylistRow(filteredRecentPlaylists)}
              </section>
            )}

            {/* Empty backpack message - show only when there's nothing except My Playlists */}
            {filteredFavoriteBooks.length === 0 && 
             filteredFavoritePlaylists.length === 0 && 
             filteredRecentBooks.length === 0 && 
             filteredRecentPlaylists.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-4 bg-black/20 p-6 rounded-2xl backdrop-blur-sm">
                {searchQuery ? (
                  <p className="text-white font-display text-lg mb-2">No matching content found.</p>
                ) : (
                  <>
                    <p className="text-white font-display text-lg mb-2">Your backpack is empty!</p>
                    <p className="text-blue-100 text-sm text-center">Go explore and start reading or listening to fill up your library.</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
