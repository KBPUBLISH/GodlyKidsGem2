
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { Search, Music, Play } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';

console.log('📻 ListenPage: Module loaded');

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
}

const ListenPage: React.FC = () => {
  console.log('📻 ListenPage: Component rendering/remounting');
  console.log('📻 ListenPage: TEST - Component is DEFINITELY rendering!');
  console.log('📻 ListenPage: TEST - Window location:', window.location.href);
  console.log('📻 ListenPage: TEST - Hash:', window.location.hash);
  
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
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
    console.log('📻 ListenPage: useEffect triggered, fetching playlists');
    const fetchPlaylists = async () => {
      try {
        setPlaylistsLoading(true);
        const baseUrl = getApiBaseUrl();
        const endpoint = `${baseUrl}playlists?status=published`;
        console.log('📻 ListenPage: Fetching playlists from:', endpoint);
        console.log('📻 ListenPage: baseUrl:', baseUrl);
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('📻 ListenPage: Response status:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📻 ListenPage: Raw API response:', data);
          console.log('📻 ListenPage: Response type:', Array.isArray(data) ? 'Array' : typeof data);
          console.log('📻 ListenPage: Response length:', Array.isArray(data) ? data.length : 'Not an array');
          
          const validPlaylists = Array.isArray(data) ? data.filter((p: any) => {
            const isValid = p._id && p.title && p.status === 'published' && p.items && Array.isArray(p.items) && p.items.length > 0;
            if (!isValid) {
              console.warn('📻 ListenPage: Filtered out invalid playlist:', {
                _id: p._id,
                title: p.title,
                status: p.status,
                itemsCount: p.items?.length || 0
              });
            }
            return isValid;
          }) : [];
          
          console.log('📻 ListenPage: Valid playlists after filtering:', validPlaylists.length);
          console.log('📻 ListenPage: Setting playlists state:', validPlaylists);
          setPlaylists(validPlaylists);
        } else {
          const errorText = await response.text();
          console.error('📻 ListenPage: API error:', response.status, errorText);
        }
      } catch (error) {
        console.error('📻 ListenPage: Error fetching playlists:', error);
      } finally {
        setPlaylistsLoading(false);
        console.log('📻 ListenPage: Finished loading playlists');
      }
    };
    
    fetchPlaylists();
  }, []);

  // Filter for audio books
  const audioBooks = books.filter(b => b.isAudio);

  // Apply Search Filter
  const filteredBooks = audioBooks.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const filteredPlaylists = playlists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Debug logging
  console.log('📻 ListenPage: Render - playlists:', playlists.length, 'filtered:', filteredPlaylists.length, 'books:', filteredBooks.length);

  // Force a test API call on every render to debug
  useEffect(() => {
    console.log('📻 ListenPage: TEST - Component is mounted and useEffect is running!');
    console.log('📻 ListenPage: TEST - Making direct API call...');
    fetch('http://localhost:5001/api/playlists?status=published')
      .then(res => res.json())
      .then(data => {
        console.log('📻 ListenPage: TEST - Direct API call result:', data);
        console.log('📻 ListenPage: TEST - Number of playlists:', Array.isArray(data) ? data.length : 'Not an array');
        if (Array.isArray(data) && data.length > 0) {
          console.log('📻 ListenPage: TEST - First playlist:', data[0]);
          setPlaylists(data);
        }
      })
      .catch(err => console.error('📻 ListenPage: TEST - Direct API call error:', err));
  }, []);

  // CRITICAL TEST - This will show if component renders
  console.error('🚨🚨🚨 LISTEN PAGE IS RENDERING! 🚨🚨🚨');
  alert('ListenPage component is rendering! Check console for logs.');
  
  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="LISTEN" />

      <div className="px-4 pt-28 pb-52">
        
        {/* Search Bar */}
        <div className="relative mb-2">
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

        <SectionTitle title="Audio Adventures" />
        
        {(loading || playlistsLoading) ? (
           <div className="text-white font-display text-center mt-10">Loading sounds...</div>
        ) : (filteredBooks.length === 0 && filteredPlaylists.length === 0) ? (
           <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
             {searchQuery ? "No matching audio content found." : "No audio content found right now. Try the Explore tab!"}
             <div className="text-xs text-white/60 mt-4 space-y-1">
               <p>Debug: playlistsLoading: {playlistsLoading ? 'true' : 'false'}</p>
               <p>Debug: playlists in state: {playlists.length}</p>
               <p>Debug: filteredPlaylists: {filteredPlaylists.length}</p>
               <p>Debug: filteredBooks: {filteredBooks.length}</p>
               {playlists.length > 0 && (
                 <div className="mt-2 text-left">
                   <p className="font-bold">Playlists in state:</p>
                   {playlists.map(p => (
                     <p key={p._id} className="text-xs">
                       - {p.title} (items: {p.items?.length || 0}, status: {p.status})
                     </p>
                   ))}
                 </div>
               )}
             </div>
           </div>
        ) : (
          <>
            {/* Playlists Section */}
            {filteredPlaylists.length > 0 && (
              <div className="mb-8">
                <h3 className="text-white/90 font-display text-lg mb-4 font-bold">Playlists</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 justify-items-center">
                  {filteredPlaylists.map(playlist => (
                    <div
                      key={playlist._id}
                      onClick={() => navigate(`/audio/playlist/${playlist._id}`)}
                      className="w-full aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl overflow-hidden shadow-lg border-2 border-white/20 hover:scale-105 transition-transform cursor-pointer group relative"
                    >
                      {playlist.coverImage ? (
                        <img
                          src={playlist.coverImage}
                          alt={playlist.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-24 h-24 text-white opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl">
                          <Play className="w-8 h-8 text-indigo-600 ml-1" fill="#4f46e5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        <p className="text-white font-display font-bold text-sm truncate">{playlist.title}</p>
                        {playlist.author && (
                          <p className="text-white/80 text-xs truncate">{playlist.author}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Audio Books Section */}
            {filteredBooks.length > 0 && (
              <div>
                {filteredPlaylists.length > 0 && (
                  <h3 className="text-white/90 font-display text-lg mb-4 font-bold">Audio Books</h3>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 justify-items-center">
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