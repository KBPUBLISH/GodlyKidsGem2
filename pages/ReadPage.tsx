
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { ApiService } from '../services/apiService';
import { Search, ChevronDown, BookOpen, Heart, Sparkles, TreePine, Sword, Star, Book, Users, Crown, Compass, Smile, Castle } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';
import { readingProgressService } from '../services/readingProgressService';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

interface CategoryData {
  _id: string;
  name: string;
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
  icon?: string;
}

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

const SCHOLAR_ISLAND = '/assets/images/scholar-island.webp';
const WHIRLPOOL = '/assets/images/whirlpool.webp';
const BOOK_ISLAND = '/assets/images/book-island.webp';
const BIBLE_RAFT = '/assets/images/bible-raft.webp';
const SCHOLAR_BUTTON = '/assets/images/scholar-island-button.webp';
const ISLAND_BUTTON = '/assets/images/island-button.webp';

const SeriesCard: React.FC<{ series: any; onClick: () => void; isSubscribed?: boolean }> = ({ series, onClick, isSubscribed }) => (
  <button type="button" onClick={onClick} className="w-full cursor-pointer select-none focus:outline-none group text-left">
    <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-400/30 shadow-lg group-hover:border-purple-400/60 group-hover:scale-105 transition-all">
      {series.coverImage ? (
        <img src={series.coverImage} alt={series.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <span className="text-3xl">📚</span>
        </div>
      )}
      <div className="absolute top-1 left-1 bg-purple-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-10">
        <BookOpen className="w-2.5 h-2.5" />
        Series
      </div>
      {series.isMembersOnly && !isSubscribed && (
        <PremiumBadge className="absolute top-1.5 right-1.5 z-20" />
      )}
    </div>
    <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{series.title}</p>
  </button>
);

const ReadPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const { isSubscribed } = useUser();
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
  const [bookSeries, setBookSeries] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [featuredCarouselBooks, setFeaturedCarouselBooks] = useState<any[]>([]);
  const [continueReading, setContinueReading] = useState<any[]>([]);
  const [isWhirlpoolActive, setIsWhirlpoolActive] = useState(false);
  const [isBtnPopping, setIsBtnPopping] = useState(false);

  const handleWhirlpoolClick = useCallback(() => {
    if (isWhirlpoolActive || isBtnPopping) return;
    setIsBtnPopping(true);
    setTimeout(() => {
      setIsBtnPopping(false);
      setIsWhirlpoolActive(true);
      setTimeout(() => {
        navigate('/create-your-story');
        setTimeout(() => setIsWhirlpoolActive(false), 300);
      }, 2800);
    }, 400);
  }, [isWhirlpoolActive, isBtnPopping, navigate]);

  useEffect(() => {
    if (showContent) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [showContent]);

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

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await ApiService.getCategories('book');
        const categoryNames = ['All', ...cats.map((c: any) => c.name).filter(Boolean)];
        setCategories(categoryNames);

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
          }
        });
        setCategoryData(dataMap);
      } catch (error) {
        console.error('Error fetching categories:', error);
        const uniqueCategories = ['All', ...new Set(books.map(b => b.category).filter(Boolean))];
        setCategories(uniqueCategories as string[]);
      }
    };

    const fetchBookSeries = async () => {
      try {
        const series = await ApiService.getBookSeries();
        setBookSeries(series);
      } catch (error) {
        console.error('Error fetching book series:', error);
      }
    };

    fetchCategories();
    fetchBookSeries();

    const fetchTopBooks = async () => {
      try {
        const trending = await ApiService.getTrendingBooks(10);
        const readingOnly = trending.filter((b: any) => !b.isAudio);
        if (readingOnly.length >= 10) {
          setTopBooks(readingOnly.slice(0, 10));
        } else {
          const trendingIds = new Set(readingOnly.map((b: any) => b.id));
          const remaining = books.filter(b => !b.isAudio && !trendingIds.has(b.id));
          setTopBooks([...readingOnly, ...remaining].slice(0, 10));
        }
      } catch {
        setTopBooks(books.filter(b => !b.isAudio).slice(0, 10));
      }
    };
    fetchTopBooks();

    ApiService.getFeaturedBooks().then(items => {
      setFeaturedCarouselBooks(items.map((b: any) => ({
        ...b,
        id: b._id || b.id,
        coverUrl: b.coverUrl || b.coverImage || b.files?.coverImage || '',
      })));
    }).catch(() => {});

    const recentIds = readingProgressService.getRecentlyReadBookIds(10);
    if (recentIds.length > 0 && books.length > 0) {
      const bookMap = new Map(books.map(b => [b.id, b]));
      const recent = recentIds
        .map(id => bookMap.get(id))
        .filter((b): b is typeof books[0] => !!b && !b.isAudio);
      setContinueReading(recent.slice(0, 10));
    }
  }, [books]);

  const booksInSeries = useMemo(() => {
    const bookIds = new Set<string>();
    bookSeries.forEach(series => {
      series.books?.forEach((bookRef: any) => {
        const bookId = bookRef.book?._id || bookRef.book || bookRef._id;
        if (bookId) bookIds.add(bookId.toString());
      });
    });
    return bookIds;
  }, [bookSeries]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ageDropdownRef.current && !ageDropdownRef.current.contains(event.target as Node)) {
        setShowAgeDropdown(false);
      }
    };

    if (showAgeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAgeDropdown]);

  const readingBooks = books.filter(b => {
    if (b.isAudio) return false;
    const bookId = b.id || (b as any)._id;
    if (booksInSeries.has(bookId)) return false;
    return true;
  });

  const categoryFilteredBooks = selectedCategory === 'All'
    ? readingBooks
    : readingBooks.filter(b => {
        const bookCategories = (b as any).categories && Array.isArray((b as any).categories)
          ? (b as any).categories
          : (b.category ? [b.category] : []);
        return bookCategories.includes(selectedCategory);
      });

  const categoryFilteredSeries = selectedCategory === 'All'
    ? bookSeries
    : bookSeries.filter(s => {
        const seriesCategories = s.categories && Array.isArray(s.categories)
          ? s.categories
          : (s.category ? [s.category] : []);
        return seriesCategories.includes(selectedCategory);
      });

  const ageFilteredBooks = selectedAge === 'All Ages'
    ? categoryFilteredBooks
    : categoryFilteredBooks.filter(b => {
        const bookAge = b.level || '';
        const num = selectedAge.replace('+', '');
        return bookAge.includes(num);
      });

  const ageFilteredSeries = selectedAge === 'All Ages'
    ? categoryFilteredSeries
    : categoryFilteredSeries.filter(s => {
        const seriesAge = s.level || s.minAge?.toString() || '';
        const num = selectedAge.replace('+', '');
        return seriesAge.includes(num);
      });

  const filteredBooks = ageFilteredBooks.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSeries = ageFilteredSeries.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.author && s.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const displayItems = useMemo(() => {
    const items: Array<{ type: 'book' | 'series'; data: any }> = [];
    filteredSeries.forEach(series => items.push({ type: 'series', data: series }));
    filteredBooks.forEach(book => items.push({ type: 'book', data: book }));
    return items;
  }, [filteredBooks, filteredSeries]);

  /* ───── Content view (full-screen overlay that covers the wheel) ───── */
  if (showContent) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden">
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
          {/* Fixed island behind content */}
          <div className="absolute top-0 left-0 right-0 flex justify-center pt-12 pointer-events-none" style={{ zIndex: 4 }}>
            <img
              src={SCHOLAR_ISLAND}
              alt="Scholar Island"
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

          {/* Featured Books Carousel */}
          {featuredCarouselBooks.length > 0 && (
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
                  <span className="text-xl">⭐</span> Featured Books
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="px-2">
              <FeaturedCarousel
                books={featuredCarouselBooks}
                onBookClick={(id) => {
                  navigate(`/book/${id}`);
                }}
              />
              </div>
            </div>
          )}

          {/* Top 10 Books */}
          {topBooks.length > 0 && (
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
                  <span className="text-xl">🏆</span> Top 10 Books
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4">
                {topBooks.map((book, i) => (
                  <button
                    key={book.id || `top-${i}`}
                    onClick={() => navigate(`/book/${book.id}`, { state: { from: '/read' } })}
                    className="flex-shrink-0 w-[150px] group cursor-pointer select-none focus:outline-none"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-amber-400/40 shadow-lg group-hover:border-amber-400/70 group-hover:scale-105 transition-all">
                      <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center z-10 shadow-md">
                        {i + 1}
                      </div>
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-3xl">📚</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{book.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Continue Reading */}
          {continueReading.length > 0 && (
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
                  <BookOpen className="w-5 h-5" /> Continue Reading
                </h3>
                <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
                <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4">
                {continueReading.map((book, i) => (
                  <button
                    key={book.id || `cr-${i}`}
                    onClick={() => navigate(`/book/${book.id}`, { state: { from: '/read' } })}
                    className="flex-shrink-0 w-[120px] group cursor-pointer select-none focus:outline-none"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-400/40 shadow-lg group-hover:border-emerald-400/70 group-hover:scale-105 transition-all">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                          <span className="text-3xl"><BookOpen className="w-8 h-8 text-white opacity-50" /></span>
                        </div>
                      )}
                    </div>
                    <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">{book.title}</p>
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
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/15 transition-colors shadow-inner font-display"
              />
            </div>

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
                        onClick={() => { setSelectedAge(age); setShowAgeDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors ${selectedAge === age ? 'bg-white/20 font-bold' : ''}`}
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
                  className={`w-full relative overflow-hidden flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 ${isCategoriesExpanded ? 'bg-white/20 backdrop-blur-sm' : ''}`}
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

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isCategoriesExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
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
                      className={`w-full relative overflow-hidden rounded-2xl transition-all duration-300 transform active:scale-[0.98] ${isSelected ? 'ring-4 ring-white/50 scale-[1.02]' : 'hover:scale-[1.01]'}`}
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

          {loading ? (
            <div className="text-white font-display text-center mt-10 px-4">Loading library...</div>
          ) : displayItems.length === 0 ? (
            <div className="text-white/80 font-display text-center mt-10 p-6 mx-4 bg-black/20 rounded-xl backdrop-blur-sm">
              {searchQuery ? `No stories found matching "${searchQuery}"` : `No books found in ${selectedCategory}`}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-6xl mx-auto px-4">
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

          {/* Footer message + CTA */}
          <div className="px-4 pt-6 pb-8 flex flex-col items-center gap-4">
            <p className="text-white/60 font-display text-sm text-center">
              New stories and adventures added weekly.
            </p>
            <button
              onClick={() => navigate('/paywall', { state: { from: '/read' } })}
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
          </div>
        </div>
        </div>
      </div>
    );
  }

  /* ───── Island view (default) ───── */
  return (
    <div className="flex flex-col h-full overflow-hidden relative">

      {/* Drifting sky clouds — each a unique shape, all flow right */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        {/* Cloud 1 — wide flat stratus */}
        <div className="sky-cloud sky-cloud-1" style={{ position: 'absolute', top: '3%' }}>
          <svg width="160" viewBox="0 0 240 70" fill="none" style={{ opacity: 0.18 }}>
            <ellipse cx="40" cy="42" rx="36" ry="20" fill="white" />
            <ellipse cx="95" cy="32" rx="50" ry="28" fill="white" />
            <ellipse cx="155" cy="36" rx="44" ry="24" fill="white" />
            <ellipse cx="205" cy="44" rx="30" ry="18" fill="white" />
            <rect x="38" y="38" width="168" height="22" rx="11" fill="white" />
          </svg>
        </div>
        {/* Cloud 2 — tall puffy cumulus */}
        <div className="sky-cloud sky-cloud-2" style={{ position: 'absolute', top: '7%' }}>
          <svg width="110" viewBox="0 0 150 120" fill="none" style={{ opacity: 0.14 }}>
            <ellipse cx="75" cy="36" rx="34" ry="30" fill="white" />
            <ellipse cx="48" cy="62" rx="38" ry="26" fill="white" />
            <ellipse cx="105" cy="58" rx="36" ry="24" fill="white" />
            <ellipse cx="75" cy="78" rx="52" ry="22" fill="white" />
          </svg>
        </div>
        {/* Cloud 3 — small wispy streak */}
        <div className="sky-cloud sky-cloud-3" style={{ position: 'absolute', top: '1%' }}>
          <svg width="80" viewBox="0 0 130 40" fill="none" style={{ opacity: 0.10 }}>
            <ellipse cx="30" cy="22" rx="26" ry="14" fill="white" />
            <ellipse cx="70" cy="18" rx="34" ry="16" fill="white" />
            <ellipse cx="105" cy="22" rx="22" ry="12" fill="white" />
          </svg>
        </div>
        {/* Cloud 4 — medium lopsided */}
        <div className="sky-cloud sky-cloud-4" style={{ position: 'absolute', top: '11%' }}>
          <svg width="130" viewBox="0 0 190 80" fill="none" style={{ opacity: 0.15 }}>
            <ellipse cx="50" cy="50" rx="42" ry="22" fill="white" />
            <ellipse cx="110" cy="35" rx="55" ry="30" fill="white" />
            <ellipse cx="160" cy="48" rx="28" ry="20" fill="white" />
            <rect x="42" y="44" width="118" height="20" rx="10" fill="white" />
          </svg>
        </div>
        {/* Cloud 5 — tiny puff */}
        <div className="sky-cloud sky-cloud-5" style={{ position: 'absolute', top: '5%' }}>
          <svg width="55" viewBox="0 0 80 50" fill="none" style={{ opacity: 0.12 }}>
            <ellipse cx="40" cy="26" rx="30" ry="20" fill="white" />
            <ellipse cx="24" cy="32" rx="18" ry="12" fill="white" />
            <ellipse cx="56" cy="34" rx="16" ry="11" fill="white" />
          </svg>
        </div>
      </div>

      {/* Ocean wave animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }} aria-hidden>
        <svg className="absolute read-ocean-1" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '18%', height: '14%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.04)" d="M0,280L60,274C120,268,240,256,360,250C480,244,600,244,720,250C840,256,960,268,1080,274C1200,280,1320,280,1440,274C1440,274,1560,268,1680,256C1800,244,1920,244,2040,250C2160,256,2280,268,2400,274C2520,280,2640,280,2760,274L2880,268L2880,320L0,320Z" />
        </svg>
        <svg className="absolute read-ocean-2" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '28%', height: '16%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.04)" d="M0,290L48,284C96,278,192,266,288,260C384,254,480,254,576,260C672,266,768,278,864,284C960,290,1056,290,1152,284C1248,278,1344,266,1440,260C1440,260,1536,254,1632,260C1728,266,1824,278,1920,284C2016,290,2112,290,2208,284C2304,278,2400,266,2496,260C2592,254,2688,254,2784,260L2880,266L2880,320L0,320Z" />
        </svg>
        <svg className="absolute read-ocean-3" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '40%', height: '18%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.06)" d="M0,288L80,278C160,268,320,248,480,242C640,236,800,244,960,254C1120,264,1280,276,1440,278C1440,278,1600,268,1760,254C1920,240,2080,242,2240,252C2400,262,2560,278,2720,282L2880,286L2880,320L0,320Z" />
        </svg>
        <svg className="absolute read-ocean-4" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '55%', height: '20%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.06)" d="M0,282L60,272C120,262,240,242,360,236C480,230,600,238,720,250C840,262,960,278,1080,282C1200,286,1320,278,1440,268C1440,268,1560,258,1680,248C1800,238,1920,238,2040,248C2160,258,2280,278,2400,284C2520,290,2640,282,2760,272L2880,262L2880,320L0,320Z" />
        </svg>
        <svg className="absolute read-ocean-5" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '68%', height: '22%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.08)" d="M0,276L48,266C96,256,192,236,288,228C384,220,480,224,576,238C672,252,768,276,864,282C960,288,1056,276,1152,264C1248,252,1344,240,1440,238C1440,238,1536,246,1632,258C1728,270,1824,286,1920,290C2016,294,2112,286,2208,272C2304,258,2400,238,2496,232C2592,226,2688,234,2784,248L2880,262L2880,320L0,320Z" />
        </svg>
        <svg className="absolute read-ocean-6" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '80%', height: '20%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.05)" d="M0,290L40,284C80,278,160,266,240,258C320,250,400,246,480,250C560,254,640,266,720,274C800,282,880,286,960,284C1040,282,1120,274,1200,266C1280,258,1360,250,1440,250C1440,250,1520,258,1600,266C1680,274,1760,282,1840,286C1920,290,2000,290,2080,284C2160,278,2240,266,2320,258C2400,250,2480,246,2560,250C2640,254,2720,266,2800,274L2880,282L2880,320L0,320Z" />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{ background: 'linear-gradient(to top, rgba(0,40,80,0.10), transparent)' }} />
      </div>

      {/* Whirlpool + Book Island — top right */}
      <div
        className="absolute"
        style={{ zIndex: 2, right: '-2%', top: '22%', width: '40vw', maxWidth: 200 }}
      >
        <button
          type="button"
          onClick={handleWhirlpoolClick}
          className={`relative w-full cursor-pointer select-none focus:outline-none ${isWhirlpoolActive ? '' : 'transition-transform hover:scale-[1.05]'}`}
          style={{ zIndex: 1 }}
          aria-label="Create Your Story"
        >
          {/* Whirlpool base layer — pulses when active */}
          <img
            src={WHIRLPOOL}
            alt="Story Whirlpool"
            className={`w-full h-auto object-contain drop-shadow-[0_4px_14px_rgba(0,100,200,0.4)] ${isWhirlpoolActive ? 'wp-pulse' : ''}`}
          />
          {/* Water splashes & bubbles around the book island */}
          <div className="absolute inset-0 pointer-events-none" style={{ marginTop: '-6%' }}>
            {/* Splash rings */}
            <div className="wp-splash-ring-1" style={{
              position: 'absolute', left: '12%', right: '12%', top: '28%', bottom: '28%',
              borderRadius: '50%',
              border: '4px solid rgba(180,230,255,0.4)',
              boxShadow: '0 0 8px 3px rgba(140,210,255,0.2)',
            }} />
            <div className="wp-splash-ring-2" style={{
              position: 'absolute', left: '6%', right: '6%', top: '22%', bottom: '22%',
              borderRadius: '50%',
              border: '3.5px solid rgba(180,230,255,0.3)',
              boxShadow: '0 0 10px 4px rgba(140,210,255,0.15)',
            }} />
            {/* Bubbles */}
            <div className="wp-bubble" style={{ position: 'absolute', left: '22%', top: '30%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(200,240,255,0.6)', animationDelay: '0s' }} />
            <div className="wp-bubble" style={{ position: 'absolute', left: '68%', top: '25%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(200,240,255,0.5)', animationDelay: '0.8s' }} />
            <div className="wp-bubble" style={{ position: 'absolute', left: '75%', top: '42%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(200,240,255,0.55)', animationDelay: '1.6s' }} />
            <div className="wp-bubble" style={{ position: 'absolute', left: '30%', top: '50%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(200,240,255,0.5)', animationDelay: '0.4s' }} />
            <div className="wp-bubble" style={{ position: 'absolute', left: '55%', top: '20%', width: 3, height: 3, borderRadius: '50%', background: 'rgba(200,240,255,0.45)', animationDelay: '1.2s' }} />
            <div className="wp-bubble" style={{ position: 'absolute', left: '18%', top: '45%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(200,240,255,0.5)', animationDelay: '2s' }} />
            {/* Splash droplets */}
            <div className="wp-droplet" style={{ position: 'absolute', left: '20%', top: '26%', width: 3, height: 8, borderRadius: '40%', background: 'rgba(180,230,255,0.5)', animationDelay: '0.3s' }} />
            <div className="wp-droplet" style={{ position: 'absolute', left: '72%', top: '32%', width: 3, height: 7, borderRadius: '40%', background: 'rgba(180,230,255,0.45)', animationDelay: '1.1s' }} />
            <div className="wp-droplet" style={{ position: 'absolute', left: '60%', top: '48%', width: 2, height: 6, borderRadius: '40%', background: 'rgba(180,230,255,0.4)', animationDelay: '1.8s' }} />
            <div className="wp-droplet" style={{ position: 'absolute', left: '35%', top: '22%', width: 2, height: 7, borderRadius: '40%', background: 'rgba(180,230,255,0.45)', animationDelay: '0.6s' }} />
          </div>
          {/* Bible Raft + label together — idle jiggle, sinks when active */}
          <div
            className={`absolute inset-0 w-[64%] m-auto flex flex-col items-center ${isWhirlpoolActive ? 'wp-island-sink' : 'wp-raft-jiggle'}`}
            style={{ marginTop: '-42%', zIndex: 2 }}
          >
            {/* Label button on top of raft */}
            <div className={`relative w-full pointer-events-none ${isBtnPopping ? 'wp-btn-pop' : ''}`} style={{ marginBottom: '-2px', opacity: isWhirlpoolActive ? 0 : undefined }}>
              <img src={ISLAND_BUTTON} alt="" className="w-full h-auto rounded-xl" />
              <span
                className="absolute inset-0 flex items-center justify-center font-extrabold text-white"
                style={{
                  fontSize: 'clamp(9px, 2.8vw, 15px)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  letterSpacing: '0.5px',
                }}
              >
                Enter the Bible
              </span>
            </div>
            {/* Raft image */}
            <img
              src={BIBLE_RAFT}
              alt="Enter the Bible"
              className="w-full h-auto object-contain"
            />
          </div>
        </button>
      </div>

      {/* Book Island — left side, navigates to Library */}
      <div
        className="absolute"
        style={{ zIndex: 2, left: '2%', top: '14%', width: '39vw', maxWidth: 195 }}
      >
        <div className="relative w-[65%] mx-auto mb-1 pointer-events-none">
          <img src={ISLAND_BUTTON} alt="" className="w-full h-auto rounded-xl" />
          <span
            className="absolute inset-0 flex items-center justify-center font-extrabold text-white"
            style={{
              fontSize: 'clamp(9px, 2.8vw, 15px)',
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              letterSpacing: '0.5px',
            }}
          >
            My Library
          </span>
        </div>
        <div className="relative">
          {/* Wave rings around My Library island */}
          <div className="absolute pointer-events-none" style={{ zIndex: 0, inset: '-6%', bottom: '-2%' }}>
            <div className="lib-wave-1" style={{
              position: 'absolute', left: '4%', right: '4%', bottom: '12%', height: '42%',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.25)',
              boxShadow: '0 0 12px 4px rgba(180,230,255,0.15), inset 0 0 10px 2px rgba(180,230,255,0.08)',
            }} />
            <div className="lib-wave-2" style={{
              position: 'absolute', left: '0%', right: '0%', bottom: '8%', height: '46%',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              boxShadow: '0 0 18px 6px rgba(180,230,255,0.1)',
            }} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="relative w-full cursor-pointer select-none transition-transform hover:scale-[1.05] active:scale-95 focus:outline-none"
            style={{ zIndex: 1 }}
            aria-label="My Library"
          >
            <img
              src={BOOK_ISLAND}
              alt="My Library"
              className="w-full h-auto object-contain"
            />
          </button>
        </div>
      </div>

      {/* Fade to dark after island sinks */}
      {isWhirlpoolActive && (
        <div className="fixed inset-0 wp-fade-dark pointer-events-none" style={{ zIndex: 100 }} />
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-4 pointer-events-none" style={{ zIndex: 3, paddingTop: '20%' }}>
        <div className="relative pointer-events-auto" style={{ width: 'min(240px, 65vw)', maxWidth: 270 }}>
          {/* Pulse rings — behind the island image */}
          <div className="absolute pointer-events-none" style={{ zIndex: 1, inset: '-4% -4%', bottom: '0%' }}>
            <div className="read-pulse-1" style={{
              position: 'absolute', left: '5%', right: '5%', bottom: '30%', height: '38%',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.25)',
              boxShadow: '0 0 12px 4px rgba(180,230,255,0.15), inset 0 0 10px 2px rgba(180,230,255,0.08)',
            }} />
            <div className="read-pulse-2" style={{
              position: 'absolute', left: '1%', right: '1%', bottom: '26%', height: '42%',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              boxShadow: '0 0 18px 6px rgba(180,230,255,0.1)',
            }} />
          </div>
          <button
            type="button"
            onClick={() => setShowContent(true)}
            className="relative w-full cursor-pointer select-none transition-transform active:scale-95 active:translate-y-2 hover:scale-[1.02] focus:outline-none rounded-2xl"
            style={{ zIndex: 2, marginTop: '-10%' }}
            aria-label="Open Book Library"
          >
            <img
              src={SCHOLAR_ISLAND}
              alt="Scholar Island"
              className="w-full h-auto object-contain"
            />
          </button>
          {/* Scholar Island label button */}
          <button
            type="button"
            onClick={() => setShowContent(true)}
            className="relative block mx-auto overflow-hidden rounded-2xl cursor-pointer select-none focus:outline-none transition-transform active:scale-95 active:translate-y-1"
            style={{ zIndex: 5, width: '80%', marginTop: -8 }}
            aria-label="Open Book Library"
          >
            <img
              src={SCHOLAR_BUTTON}
              alt="Scholar Island"
              className="w-full h-auto object-contain rounded-2xl"
              draggable={false}
            />
          </button>
        </div>
      </div>

      <style>{`
        /* Drifting clouds — one direction, staggered */
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

        .read-ocean-1 { animation: read-wave-scroll 28s linear infinite; }
        .read-ocean-2 { animation: read-wave-scroll 22s linear infinite; animation-delay: -8s; }
        .read-ocean-3 { animation: read-wave-scroll 18s linear infinite; animation-delay: -4s; }
        .read-ocean-4 { animation: read-wave-scroll 15s linear infinite; animation-delay: -10s; }
        .read-ocean-5 { animation: read-wave-scroll 12s linear infinite; animation-delay: -3s; }
        .read-ocean-6 { animation: read-wave-scroll 9s linear infinite; animation-delay: -6s; }
        @keyframes read-wave-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .read-pulse-1 { animation: read-wave-shrink 3.5s ease-in-out infinite; transform-origin: center 70%; }
        .read-pulse-2 { animation: read-wave-shrink 4.5s ease-in-out infinite; animation-delay: -1.2s; transform-origin: center 70%; }

        .lib-wave-1 { animation: read-wave-shrink 3.5s ease-in-out infinite; transform-origin: center 70%; }
        .lib-wave-2 { animation: read-wave-shrink 4.5s ease-in-out infinite; animation-delay: -1.2s; transform-origin: center 70%; }

        @keyframes read-wave-shrink {
          0%   { transform: scale(1.15); opacity: 0; }
          20%  { opacity: 0.7; }
          60%  { opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0; }
        }

        /* Splash rings — shrinking wave around book island */
        .wp-splash-ring-1 {
          animation: wp-wave-shrink 3.5s ease-in-out infinite;
          transform-origin: center center;
        }
        .wp-splash-ring-2 {
          animation: wp-wave-shrink 4.5s ease-in-out infinite;
          animation-delay: -1.2s;
          transform-origin: center center;
        }
        @keyframes wp-wave-shrink {
          0%   { transform: scale(1.15); opacity: 0; }
          20%  { opacity: 0.7; }
          60%  { opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0; }
        }

        /* Bubbles floating up */
        .wp-bubble {
          animation: wp-bubble-float 2.5s ease-in-out infinite;
        }
        @keyframes wp-bubble-float {
          0%   { transform: translateY(0) scale(1); opacity: 0.6; }
          50%  { transform: translateY(-12px) scale(1.3); opacity: 0.9; }
          100% { transform: translateY(-24px) scale(0.5); opacity: 0; }
        }

        /* Splash droplets shooting up */
        .wp-droplet {
          animation: wp-droplet-splash 2s ease-out infinite;
        }
        @keyframes wp-droplet-splash {
          0%   { transform: translateY(0) scaleY(1); opacity: 0.6; }
          30%  { transform: translateY(-18px) scaleY(1.4); opacity: 0.8; }
          60%  { transform: translateY(-8px) scaleY(0.8); opacity: 0.4; }
          100% { transform: translateY(0) scaleY(1); opacity: 0; }
        }

        /* Island circles the whirlpool in jagged spirals, then sinks to center */
        .wp-island-sink {
          animation: wp-island-sink-anim 2.4s ease-in forwards;
          will-change: transform, opacity;
        }
        @keyframes wp-island-sink-anim {
          0%   { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
          8%   { transform: translate(14%, 16%) scale(0.92) rotate(15deg); opacity: 1; }
          16%  { transform: translate(4%, 28%) scale(0.85) rotate(-10deg); opacity: 0.95; }
          24%  { transform: translate(-12%, 26%) scale(0.78) rotate(20deg); opacity: 0.9; }
          32%  { transform: translate(-14%, 22%) scale(0.7) rotate(-15deg); opacity: 0.85; }
          40%  { transform: translate(-4%, 28%) scale(0.62) rotate(12deg); opacity: 0.8; }
          48%  { transform: translate(10%, 32%) scale(0.54) rotate(-18deg); opacity: 0.75; }
          56%  { transform: translate(5%, 36%) scale(0.44) rotate(14deg); opacity: 0.65; }
          64%  { transform: translate(-4%, 38%) scale(0.34) rotate(-10deg); opacity: 0.55; }
          72%  { transform: translate(3%, 40%) scale(0.24) rotate(8deg); opacity: 0.4; }
          80%  { transform: translate(-1%, 42%) scale(0.15) rotate(-5deg); opacity: 0.3; }
          90%  { transform: translate(0, 43%) scale(0.06) rotate(3deg); opacity: 0.15; }
          100% { transform: translate(0, 44%) scale(0) rotate(0deg); opacity: 0; }
        }

        /* Whirlpool pulses when triggered */
        .wp-pulse {
          animation: wp-pulse-anim 2.4s ease-in-out;
          will-change: transform;
        }
        @keyframes wp-pulse-anim {
          0%   { transform: scale(1); }
          10%  { transform: scale(1.06); }
          20%  { transform: scale(0.97); }
          30%  { transform: scale(1.05); }
          40%  { transform: scale(0.98); }
          50%  { transform: scale(1.04); }
          60%  { transform: scale(0.98); }
          70%  { transform: scale(1.03); }
          80%  { transform: scale(0.99); }
          90%  { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        /* Fade to dark after island disappears */
        .wp-fade-dark {
          animation: wp-fade-dark-anim 2.8s ease-in forwards;
          will-change: background;
        }
        @keyframes wp-fade-dark-anim {
          0%   { background: rgba(0,0,0,0); }
          70%  { background: rgba(0,0,0,0); }
          88%  { background: rgba(0,15,30,0.6); }
          100% { background: rgba(0,10,20,1); }
        }

        .wp-btn-pop {
          animation: wp-btn-pop-anim 0.4s ease-out forwards;
          will-change: transform, opacity;
        }
        @keyframes wp-btn-pop-anim {
          0%   { transform: scale(1); opacity: 1; }
          25%  { transform: scale(1.3); opacity: 1; }
          50%  { transform: scale(1.15); opacity: 0.8; }
          75%  { transform: scale(1.25); opacity: 0.4; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        .wp-raft-jiggle {
          animation: wp-raft-bumpy 4s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes wp-raft-bumpy {
          0%   { transform: translate(0, 0) rotate(0deg); }
          4%   { transform: translate(0.5px, -1px) rotate(1.2deg); }
          8%   { transform: translate(-1px, 0.5px) rotate(-1.5deg); }
          12%  { transform: translate(0.8px, -0.5px) rotate(0.8deg); }
          16%  { transform: translate(-0.3px, 1px) rotate(-0.6deg); }
          20%  { transform: translate(0, 0) rotate(0deg); }
          50%  { transform: translate(0, 0) rotate(0deg); }
          54%  { transform: translate(-0.6px, -0.8px) rotate(-1deg); }
          58%  { transform: translate(1px, 0.3px) rotate(1.4deg); }
          62%  { transform: translate(-0.4px, -0.6px) rotate(-0.9deg); }
          66%  { transform: translate(0.5px, 0.8px) rotate(0.5deg); }
          70%  { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default ReadPage;
