
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { Search } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Filter for user's books (from library or favorites)
  const libraryBookIds = libraryService.getLibrary();
  const favoriteBookIds = favoritesService.getFavorites();
  const allUserBookIds = [...new Set([...libraryBookIds, ...favoriteBookIds])];
  const myBooks = books.filter(b => allUserBookIds.includes(b.id));
  const displayBooks = myBooks.length > 0 ? myBooks : []; // Show empty if no saved books

  // Apply Search Filter
  const filteredBooks = displayBooks.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="MY BOOKS" />

      <div className="px-4 pt-28 pb-52">
        
        {/* Search Bar */}
        <div className="relative mb-2">
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

        <SectionTitle title="Favorites & History" />
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Checking backpack...</div>
        ) : (
          <>
            {filteredBooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center mt-10 bg-black/20 p-6 rounded-2xl backdrop-blur-sm">
                    {searchQuery ? (
                         <p className="text-white font-display text-lg mb-2">No matching books found.</p>
                    ) : (
                        <>
                            <p className="text-white font-display text-lg mb-2">Your backpack is empty!</p>
                            <p className="text-blue-100 text-sm text-center">Go explore and start reading to fill up your library.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 md:gap-x-8 gap-y-8 justify-items-center">
                    {filteredBooks.map(book => (
                    <BookCard 
                        key={book.id} 
                        book={book} 
                        onClick={(id) => navigate(`/book/${id}`, { state: { from: '/library' } })} 
                    />
                    ))}
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;