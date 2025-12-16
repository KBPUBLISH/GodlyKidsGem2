
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';
import { ApiService } from '../services/apiService';
import { Search, ChevronDown } from 'lucide-react';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

const ReadPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
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

  // Fetch categories on mount (book type only)
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
    fetchCategories();
  }, [books]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (ageDropdownRef.current && !ageDropdownRef.current.contains(event.target as Node)) {
        setShowAgeDropdown(false);
      }
    };
    
    if (showCategoryDropdown || showAgeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showCategoryDropdown, showAgeDropdown]);

  // Filter for reading books (not strictly audio only)
  const readingBooks = books.filter(b => !b.isAudio);

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

        {/* Category Header with Dropdown */}
        <div className="relative py-2 my-4 mx-[-10px]">
          {/* Wood Texture Background */}
          <div 
            className="absolute inset-0 bg-[#8B4513] rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-[#A0522D] border-b-4 border-[#5c2e0b]"
            style={{
                backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), 
                              linear-gradient(to bottom, #8B5A2B, #654321)`
            }}
          ></div>
          
          {/* Content */}
          <div className="relative z-10 flex items-center justify-between px-6">
            <h2 className="text-white font-display text-lg tracking-wide drop-shadow-md text-shadow">
              {selectedCategory === 'All' ? 'All Books' : selectedCategory}
            </h2>
            
            {/* Category Dropdown Button */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="flex items-center gap-1 text-white hover:text-[#FFD700] transition-colors"
              >
                <span className="text-sm font-semibold">Category</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {showCategoryDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-black/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl z-50 min-w-[180px] max-h-[300px] overflow-y-auto">
                  <div className="py-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category);
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors ${
                          selectedCategory === category ? 'bg-white/20 font-bold' : ''
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Nail details */}
          <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner transform -translate-y-1/2 opacity-80"></div>
          <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner transform -translate-y-1/2 opacity-80"></div>
        </div>
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Loading library...</div>
        ) : (
          <>
            {filteredBooks.length === 0 ? (
                <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
                    {searchQuery ? `No stories found matching "${searchQuery}"` : `No books found in ${selectedCategory}`}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                    {filteredBooks.map(book => (
                    <BookCard 
                        key={book.id} 
                        book={book} 
                        onClick={(id) => navigate(`/book/${id}`, { state: { from: '/read' } })} 
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

export default ReadPage;