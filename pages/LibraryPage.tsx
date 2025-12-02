
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { Search, ChevronDown } from 'lucide-react';
import { libraryService } from '../services/libraryService';
import { favoritesService } from '../services/favoritesService';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
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

  // Filter for user's books (from library or favorites)
  const libraryBookIds = libraryService.getLibrary();
  const favoriteBookIds = favoritesService.getFavorites();
  const allUserBookIds = [...new Set([...libraryBookIds, ...favoriteBookIds])];
  const myBooks = books.filter(b => allUserBookIds.includes(b.id));
  const displayBooks = myBooks.length > 0 ? myBooks : []; // Show empty if no saved books

  // Filter by age
  const ageFilteredBooks = selectedAge === 'All Ages'
    ? displayBooks
    : displayBooks.filter(b => {
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

  // Apply Search Filter
  const filteredBooks = ageFilteredBooks.filter(b => 
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
        
        {/* Search Bar with Age Filter */}
        <div className="flex gap-2 mb-2">
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