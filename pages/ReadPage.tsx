
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { ApiService } from '../services/apiService';
import { Search, ChevronDown, BookOpen, Heart, Sparkles, TreePine, Sword, Star, Book, Users, Crown, Compass, Smile, Castle } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

// Category button configuration with icons and colors for books page (purple/indigo theme)
const CATEGORY_CONFIG: Record<string, { icon: any; activeColor: string; activeBg: string }> = {
  'All': { icon: Sparkles, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-indigo-500 to-purple-600' },
  'Bible Stories': { icon: Book, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
  'Nature Tales': { icon: TreePine, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-emerald-500 to-teal-600' },
  'Character Building': { icon: Users, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-orange-500 to-amber-500' },
  'Adventures': { icon: Compass, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-rose-500 to-red-600' },
  'Favorites': { icon: Heart, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-pink-500 to-rose-500' },
  'Fantasy': { icon: Castle, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-violet-500 to-purple-600' },
  'Heroes': { icon: Sword, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500' },
  'Bedtime': { icon: Smile, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-indigo-400 to-blue-500' },
  'Learning': { icon: Star, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-cyan-500 to-blue-500' },
  'default': { icon: Crown, activeColor: 'text-white', activeBg: 'bg-gradient-to-r from-slate-500 to-slate-600' },
};

// Series card component
const SeriesCard: React.FC<{ series: any; onClick: () => void; isSubscribed?: boolean }> = ({ series, onClick, isSubscribed }) => (
  <div 
    onClick={onClick}
    className="cursor-pointer group"
  >
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-purple-400/30 hover:border-purple-400/60 hover:shadow-2xl hover:scale-105 transition-all">
      <div className="aspect-[3/4] bg-gradient-to-br from-purple-500 to-indigo-600 relative overflow-hidden">
        {series.coverImage ? (
          <img 
            src={series.coverImage} 
            alt={series.title} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">📚</span>
          </div>
        )}
        {/* Series badge */}
        <div className="absolute top-2 left-2 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          Series
        </div>
        {/* Books count badge */}
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
          {series.books?.length || 0} books
        </div>
        {/* Premium badge - Only show if user is NOT subscribed */}
        {series.isMembersOnly && !isSubscribed && (
          <PremiumBadge className="absolute top-2 right-2 z-20" />
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white text-sm font-bold mb-0.5 truncate font-display">
          {series.title}
        </h3>
        {series.author && (
          <p className="text-white/70 text-xs truncate">{series.author}</p>
        )}
      </div>
    </div>
  </div>
);

const ReadPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const { isSubscribed } = useUser();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  // Category dropdown removed - using horizontal buttons instead
  const [bookSeries, setBookSeries] = useState<any[]>([]);
  // categoryDropdownRef removed - using horizontal buttons
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

  // Fetch categories and book series on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await ApiService.getCategories('book');
        const categoryNames = ['All', ...cats.map(c => c.name).filter(Boolean)];
        setCategories(categoryNames);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Extract categories from books as fallback
        const uniqueCategories = ['All', ...new Set(books.map(b => b.category).filter(Boolean))];
        setCategories(uniqueCategories);
      }
    };
    
    const fetchBookSeries = async () => {
      try {
        const series = await ApiService.getBookSeries();
        setBookSeries(series);
        console.log('📚 Book series loaded:', series.length);
      } catch (error) {
        console.error('Error fetching book series:', error);
      }
    };
    
    fetchCategories();
    fetchBookSeries();
  }, [books]);

  // Create a set of book IDs that belong to a series
  const booksInSeries = useMemo(() => {
    const bookIds = new Set<string>();
    bookSeries.forEach(series => {
      series.books?.forEach((bookRef: any) => {
        const bookId = bookRef.book?._id || bookRef.book || bookRef._id;
        if (bookId) {
          bookIds.add(bookId.toString());
        }
      });
    });
    return bookIds;
  }, [bookSeries]);

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

  // Filter for reading books (not strictly audio only) and exclude books that are part of a series
  const readingBooks = books.filter(b => {
    if (b.isAudio) return false;
    // Exclude books that are part of a series
    const bookId = b.id || (b as any)._id;
    if (booksInSeries.has(bookId)) return false;
    return true;
  });

  // Filter by category (supports both single category and categories array)
  const categoryFilteredBooks = selectedCategory === 'All'
    ? readingBooks
    : readingBooks.filter(b => {
        // Check if book has categories array or single category
        const bookCategories = (b as any).categories && Array.isArray((b as any).categories) 
          ? (b as any).categories 
          : (b.category ? [b.category] : []);
        return bookCategories.includes(selectedCategory);
      });

  // Filter series by category
  const categoryFilteredSeries = selectedCategory === 'All'
    ? bookSeries
    : bookSeries.filter(s => {
        const seriesCategories = s.categories && Array.isArray(s.categories) 
          ? s.categories 
          : (s.category ? [s.category] : []);
        return seriesCategories.includes(selectedCategory);
      });

  // Filter by age
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

  // Filter series by age
  const ageFilteredSeries = selectedAge === 'All Ages'
    ? categoryFilteredSeries
    : categoryFilteredSeries.filter(s => {
        const seriesAge = s.level || s.minAge?.toString() || '';
        if (selectedAge === '3+') return seriesAge.includes('3');
        if (selectedAge === '4+') return seriesAge.includes('4');
        if (selectedAge === '5+') return seriesAge.includes('5');
        if (selectedAge === '6+') return seriesAge.includes('6');
        if (selectedAge === '7+') return seriesAge.includes('7');
        if (selectedAge === '8+') return seriesAge.includes('8');
        if (selectedAge === '9+') return seriesAge.includes('9');
        if (selectedAge === '10+') return seriesAge.includes('10');
        return true;
      });

  // Apply Search Filter
  const filteredBooks = ageFilteredBooks.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Apply search to series
  const filteredSeries = ageFilteredSeries.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.author && s.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Combine books and series for display
  const displayItems = useMemo(() => {
    const items: Array<{ type: 'book' | 'series'; data: any }> = [];
    
    // Add series first (they're collections, so show them prominently)
    filteredSeries.forEach(series => {
      items.push({ type: 'series', data: series });
    });
    
    // Add standalone books
    filteredBooks.forEach(book => {
      items.push({ type: 'book', data: book });
    });
    
    return items;
  }, [filteredBooks, filteredSeries]);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="READING" />

      <div className="px-4 pt-28 pb-52">
        
        {/* Search Bar with Age Filter */}
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="text-white/60" size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Search stories..." 
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

        {/* Category Buttons - Horizontal Scrollable */}
        <div className="my-4 -mx-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-4">
            {categories.map((category) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
              const IconComponent = config.icon;
              const isSelected = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-display text-sm font-semibold whitespace-nowrap transition-all duration-300 transform active:scale-95 shadow-lg ${
                    isSelected
                      ? `${config.activeBg} ${config.activeColor} scale-105 ring-2 ring-white/30`
                      : 'bg-white/90 text-gray-700 hover:bg-white hover:scale-105'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <span>{category}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Loading library...</div>
        ) : (
          <>
            {displayItems.length === 0 ? (
                <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
                    {searchQuery ? `No stories found matching "${searchQuery}"` : `No books found in ${selectedCategory}`}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {displayItems.map((item, index) => (
                      item.type === 'series' ? (
                        <SeriesCard
                          key={`series-${item.data._id}`}
                          series={item.data}
                          onClick={() => navigate(`/book-series/${item.data._id}`)}
                          isSubscribed={isSubscribed}
                        />
                      ) : (
                        <BookCard 
                          key={item.data.id || `book-${index}`} 
                          book={item.data} 
                          onClick={(id) => navigate(`/book/${id}`, { state: { from: '/read' } })} 
                        />
                      )
                    ))}
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReadPage;