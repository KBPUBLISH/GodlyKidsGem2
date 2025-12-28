
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { Search, ChevronDown, Music, BookOpen, Clock, Heart, ListMusic, Plus, Trash2 } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';
import { readingProgressService } from '../services/readingProgressService';
import { playHistoryService } from '../services/playHistoryService';
import { getApiBaseUrl } from '../services/apiService';
import { userPlaylistService, UserPlaylist } from '../services/userPlaylistService';
import { authService } from '../services/authService';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

interface Playlist {
  _id: string;
  title: string;
  author?: string;
  coverImage?: string;
  type?: 'Song' | 'Audiobook';
  items: any[];
}

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [userPlaylistsLoading, setUserPlaylistsLoading] = useState(true);
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
          <div 
            key={playlist._id} 
            className="flex-shrink-0 w-[42vw] md:w-[30vw] lg:w-[23vw] max-w-[200px] cursor-pointer relative group"
            onClick={() => navigate(`/my-playlist/${playlist._id}`)}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all">
              <div className="aspect-square bg-gradient-to-br from-purple-500 to-pink-600 relative overflow-hidden">
                {playlist.coverImage ? (
                  <img
                    src={playlist.coverImage}
                    alt={playlist.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListMusic className="w-16 h-16 text-white/60" />
                  </div>
                )}
                {/* AI Generated Badge */}
                {playlist.aiGenerated?.isAiGenerated && (
                  <div className="absolute top-2 left-2 bg-purple-500/80 backdrop-blur-sm px-2 py-1 rounded-full">
                    <span className="text-white text-xs font-medium">✨ AI</span>
                  </div>
                )}
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteUserPlaylist(playlist._id, e)}
                  className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <div className="p-3">
                <h3 className="text-white font-bold text-sm truncate">{playlist.name}</h3>
                <p className="text-white/40 text-xs mt-1">
                  {playlist.items?.length || 0} items
                </p>
              </div>
            </div>
          </div>
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
