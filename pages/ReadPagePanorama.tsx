
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
import CoverImage from '../components/ui/CoverImage';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

interface CategoryData {
  _id: string;
  name: string;
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
  icon?: string;
}

// Category card configuration with colors for books page
const CATEGORY_CONFIG: Record<string, { icon: any; bgColor: string }> = {
  'All': { icon: Sparkles, bgColor: 'from-indigo-500 to-purple-600' },
  'Bible Stories': { icon: Book, bgColor: 'from-sky-400 to-blue-500' },
  'Nature Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Animal Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Character Building': { icon: Users, bgColor: 'from-amber-400 to-orange-500' },
  'Adventures': { icon: Compass, bgColor: 'from-rose-400 to-red-500' },
  'Bible Adventures': { icon: Compass, bgColor: 'from-amber-500 to-yellow-500' },
  'Favorites': { icon: Heart, bgColor: 'from-pink-400 to-rose-500' },
  'Fantasy': { icon: Castle, bgColor: 'from-violet-500 to-purple-600' },
  'Fantasy Worlds': { icon: Castle, bgColor: 'from-sky-400 to-blue-500' },
  'Heroes': { icon: Sword, bgColor: 'from-amber-500 to-yellow-500' },
  'Bedtime': { icon: Smile, bgColor: 'from-indigo-400 to-blue-500' },
  'Bedtime Stories': { icon: Smile, bgColor: 'from-indigo-500 to-purple-600' },
  'Funny Fables': { icon: Smile, bgColor: 'from-amber-400 to-orange-400' },
  'Learning': { icon: Star, bgColor: 'from-cyan-500 to-blue-500' },
  'default': { icon: Crown, bgColor: 'from-slate-400 to-slate-600' },
};

// Series card — div + pan-x so horizontal carousel scrolls inside vertical page (not eaten by <button> / image touches).
const SeriesCard: React.FC<{ series: any; onClick: () => void; isSubscribed?: boolean }> = ({ series, onClick, isSubscribed }) => {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer group select-none touch-pan-x focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl"
      onPointerDown={(e) => {
        startRef.current = { x: e.clientX, y: e.clientY };
        movedRef.current = false;
      }}
      onPointerMove={(e) => {
        if (!startRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        if (Math.hypot(dx, dy) > 10) movedRef.current = true;
      }}
      onPointerUp={() => { startRef.current = null; }}
      onPointerCancel={() => { startRef.current = null; }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onClick={() => {
        if (movedRef.current) {
          movedRef.current = false;
          return;
        }
        onClick();
      }}
    >
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-purple-400/30 hover:border-purple-400/60 hover:shadow-2xl hover:scale-105 transition-all">
        <div className="aspect-[3/4] bg-gradient-to-br from-purple-500 to-indigo-600 relative overflow-hidden">
          {series.coverImage ? (
            <CoverImage
              src={series.coverImage}
              alt={series.title}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center pointer-events-none">
              <span className="text-6xl">📚</span>
            </div>
          )}
          <div className="absolute top-2 left-2 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 pointer-events-none">
            <BookOpen className="w-3 h-3" />
            Series
          </div>
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md pointer-events-none">
            {series.books?.length || 0} books
          </div>
          {series.isMembersOnly && !isSubscribed && (
            <PremiumBadge className="absolute top-2 right-2 z-20" />
          )}
        </div>
        <div className="p-2">
          <h3 className="text-white text-xs font-bold mb-0.5 truncate font-display">
            {series.title}
          </h3>
          {series.author && (
            <p className="text-white/70 text-[10px] truncate">{series.author}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const BookSeriesCarouselRow: React.FC<{
  seriesList: any[];
  isSubscribed?: boolean;
  onSelectSeries: (seriesId: string) => void;
}> = ({ seriesList, isSubscribed, onSelectSeries }) => {
  if (!seriesList.length) return null;
  return (
    <div className="mb-6">
      <div className="px-1 mb-3">
        <SectionTitle title="Book Series" icon="📚" />
        <p className="text-white/50 text-xs font-display mt-1">Swipe sideways to browse</p>
      </div>
      <div
        className="series-carousel-track flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 px-1 touch-pan-x overscroll-x-contain no-scrollbar select-none relative z-[1]"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
        }}
      >
        {seriesList.map((series) => (
          <div key={series._id} className="snap-start shrink-0 w-[min(38vw,132px)] touch-pan-x">
            <SeriesCard
              series={series}
              onClick={() => onSelectSeries(String(series._id))}
              isSubscribed={isSubscribed}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const ReadPagePanorama: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const { isSubscribed } = useUser();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [categoryData, setCategoryData] = useState<Record<string, CategoryData>>({});
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
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
        const categoryNames = ['All', ...cats.map((c: any) => c.name).filter(Boolean)];
        setCategories(categoryNames);
        
        // Store full category data for images and gradients
        const dataMap: Record<string, CategoryData> = {};
        cats.forEach((c: any) => {
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
        // Extract categories from books as fallback
        const uniqueCategories = ['All', ...new Set(books.map(b => b.category).filter(Boolean))];
        setCategories(uniqueCategories as string[]);
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

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar relative"
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

        {/* Collapsible Category Section */}
        <div className="my-4">
          {/* Category Header - Always visible */}
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
                {/* Category image on right with gradient overlay */}
                {!isCategoriesExpanded && catData?.image && (
                  <>
                    <img 
                      src={catData.image} 
                      alt="" 
                      className="absolute right-0 top-0 h-full w-2/3 object-cover object-center z-0"
                    />
                    {/* Gradient overlay - solid on left, transparent on right */}
                    <div 
                      className="absolute inset-0 z-[1]"
                      style={{ background: `linear-gradient(to right, ${gradientFrom} 0%, ${gradientFrom} 20%, transparent 60%)` }}
                    />
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

          {/* Expandable Category Cards */}
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
                    onClick={() => {
                      setSelectedCategory(category);
                      setIsCategoriesExpanded(false);
                    }}
                    className={`w-full relative overflow-hidden rounded-2xl transition-all duration-300 transform active:scale-[0.98] ${
                      isSelected ? 'ring-4 ring-white/50 scale-[1.02]' : 'hover:scale-[1.01]'
                    }`}
                  >
                    {/* Base gradient background */}
                    <div 
                      className="p-4 min-h-[80px] flex items-center relative"
                      style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }}
                    >
                      {/* Category image on right with gradient overlay */}
                      {catData?.image && (
                        <>
                          <img 
                            src={catData.image} 
                            alt="" 
                            className="absolute right-0 top-0 h-full w-2/3 object-cover object-center z-0"
                          />
                          {/* Gradient overlay - solid on left, transparent on right */}
                          <div 
                            className="absolute inset-0 z-[1]"
                            style={{ background: `linear-gradient(to right, ${gradientFrom} 0%, ${gradientFrom} 20%, transparent 60%)` }}
                          />
                        </>
                      )}
                      
                      {/* Left side - Text */}
                      <div className="relative z-10 text-left flex-1">
                        <h3 className="text-white font-display text-xl font-bold drop-shadow-md">
                          {category === 'All' ? 'All Categories' : category}
                        </h3>
                        {isSelected && (
                          <span className="text-white/80 text-sm">Currently viewing</span>
                        )}
                      </div>
                      
                      {/* Fallback decorative icon if no image */}
                      {!catData?.image && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                          <IconComponent className="w-16 h-16 text-white" />
                        </div>
                      )}
                      
                      {/* Selected indicator */}
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
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Loading library...</div>
        ) : (
          <>
            {filteredSeries.length === 0 && filteredBooks.length === 0 ? (
                <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
                    {searchQuery ? `No stories found matching "${searchQuery}"` : `No books found in ${selectedCategory}`}
                </div>
            ) : (
                <>
                  <BookSeriesCarouselRow
                    seriesList={filteredSeries}
                    isSubscribed={isSubscribed}
                    onSelectSeries={(id) => navigate(`/book-series/${id}`)}
                  />
                  {filteredBooks.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                      {filteredBooks.map((book, index) => (
                        <BookCard
                          key={book.id || `book-${index}`}
                          book={book}
                          onClick={(id) => navigate(`/book/${id}`, { state: { from: '/read' } })}
                        />
                      ))}
                    </div>
                  ) : (
                    filteredSeries.length > 0 && (
                      <p className="text-white/70 font-display text-center text-sm py-4">
                        No standalone books in this category — open a series above.
                      </p>
                    )
                  )}
                </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ReadPagePanorama;