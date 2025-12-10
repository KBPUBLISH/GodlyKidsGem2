
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Book } from '../../types';
import { BookOpen, Music } from 'lucide-react';
import { ApiService } from '../../services/apiService';

interface FeaturedItem extends Partial<Book> {
  id: string;
  _id?: string;
  title: string;
  coverUrl?: string;
  coverImage?: string;
  _itemType?: 'book' | 'playlist';
}

interface FeaturedCarouselProps {
  books: FeaturedItem[];
  onBookClick: (id: string, isPlaylist?: boolean) => void;
}

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

// Page flip preview component for books
const PageFlipPreview: React.FC<{
  bookId: string;
  coverUrl: string;
  onError: () => void;
  onCycleComplete: () => void;
  isActive: boolean;
}> = ({ bookId, coverUrl, onError, onCycleComplete, isActive }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const cycleCompleteRef = useRef(false);
  const hasFetchedRef = useRef(false);

  console.log('📖 PageFlipPreview rendered - bookId:', bookId, 'isActive:', isActive);

  // All images: cover + first 2 pages (3 total for ~3 second cycle)
  const allImages = pagesLoaded && pages.length > 0 
    ? [coverUrl, ...pages.slice(0, 2)] 
    : [coverUrl];
  
  console.log('📖 allImages constructed:', allImages.length, 'pages:', pages.length);

  // Fetch first 2 pages of the book (just background images, no text)
  useEffect(() => {
    console.log('📖 Fetch useEffect triggered - bookId:', bookId, 'hasFetched:', hasFetchedRef.current);
    
    if (!bookId) {
      console.log('📖 No bookId, skipping fetch');
      setPagesLoaded(true);
      return;
    }
    
    if (hasFetchedRef.current) {
      console.log('📖 Already fetched, skipping');
      return;
    }
    
    const fetchPages = async () => {
      hasFetchedRef.current = true;
      try {
        console.log('📖 FETCHING pages for featured book:', bookId);
        const bookPages = await ApiService.getBookPages(bookId);
        console.log('📖 Got pages:', bookPages?.length, bookPages?.[0]);
        
        if (bookPages && bookPages.length > 0) {
          // Get first 2 pages' background images only
          // The image is at files.background.url (nested object)
          const pageImages = bookPages
            .slice(0, 2)
            .map((p: any) => {
              // Path is: files.background.url (same as BookReaderPage uses)
              const img = p.files?.background?.url || p.backgroundUrl || p.backgroundImage;
              console.log('📖 Page background url:', img);
              return img;
            })
            .filter(Boolean);
          
          console.log('📖 Final page images:', pageImages.length, pageImages);
          setPages(pageImages);
        } else {
          console.log('📖 No pages array returned');
        }
        setPagesLoaded(true);
      } catch (error) {
        console.log('📖 Error fetching pages:', bookId, error);
        setPagesLoaded(true);
      }
    };
    
    fetchPages();
  }, [bookId]);

  // Reset when becoming active
  useEffect(() => {
    if (isActive) {
      setCurrentImageIndex(0);
      cycleCompleteRef.current = false;
    }
  }, [isActive]);

  // Auto-flip animation - 1 second per image
  useEffect(() => {
    console.log('📖 Flip effect - isActive:', isActive, 'pagesLoaded:', pagesLoaded, 'allImages:', allImages.length);
    
    if (!isActive || !pagesLoaded) return;
    
    const totalImages = allImages.length;
    console.log('📖 Total images for flip:', totalImages);
    
    if (totalImages <= 1) {
      // No pages to flip, just wait and advance
      console.log('📖 Only 1 image, waiting 3s then advancing');
      const timeout = setTimeout(() => {
        onCycleComplete();
      }, 3000);
      return () => clearTimeout(timeout);
    }
    
    console.log('📖 Starting flip interval for', totalImages, 'images');
    const interval = setInterval(() => {
      console.log('📖 Flipping! Current index:', currentImageIndex);
      setIsFlipping(true);
      
      // After flip animation, change image
      setTimeout(() => {
        setCurrentImageIndex((prev) => {
          const next = prev + 1;
          console.log('📖 Advancing from', prev, 'to', next);
          if (next >= totalImages) {
            // Cycle complete - trigger carousel advance
            if (!cycleCompleteRef.current) {
              cycleCompleteRef.current = true;
              console.log('📖 Cycle complete, advancing carousel');
              setTimeout(() => onCycleComplete(), 500);
            }
            return 0; // Reset to cover
          }
          return next;
        });
        setIsFlipping(false);
      }, 200); // Flip animation duration
    }, 1000); // 1 second per image
    
    return () => clearInterval(interval);
  }, [isActive, pagesLoaded, allImages.length, onCycleComplete]);

  return (
    <div className="w-full h-full relative" style={{ perspective: '1000px' }}>
      <div 
        className="w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipping ? 'rotateY(-20deg) scale(0.96)' : 'rotateY(0deg) scale(1)',
          transition: 'transform 0.2s ease-in-out',
        }}
      >
        <img
          src={allImages[currentImageIndex] || coverUrl}
          alt="Book preview"
          className="w-full h-full object-cover rounded-lg border-2 border-white/10"
          onError={onError}
        />
        
        {/* Page edge effect when showing pages (not cover) */}
        {currentImageIndex > 0 && (
          <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-gradient-to-r from-black/30 to-transparent rounded-l pointer-events-none" />
        )}
      </div>
    </div>
  );
};

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ books, onBookClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleImageError = (itemId: string) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

  const getImageSrc = (item: FeaturedItem) => {
    const id = item.id || item._id || '';
    const coverUrl = item.coverUrl || item.coverImage || '';
    if (imageErrors[id] || !coverUrl) {
      return DEFAULT_COVER;
    }
    return coverUrl;
  };

  const isPlaylist = (item: FeaturedItem) => {
    return item._itemType === 'playlist';
  };

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
    }
  }, []);

  // Handle page flip cycle complete - advance to next book
  const handleCycleComplete = useCallback(() => {
    const nextIndex = (activeIndex + 1) % books.length;
    setActiveIndex(nextIndex);
    scrollToIndex(nextIndex);
  }, [activeIndex, books.length, scrollToIndex]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const width = scrollRef.current.offsetWidth;
      const index = Math.round(scrollLeft / width);
      if (index !== activeIndex && index >= 0 && index < books.length) {
        setActiveIndex(index);
      }
    }
  };

  // Auto-advance for playlists (no page flip, just 3 seconds)
  useEffect(() => {
    const currentItem = books[activeIndex];
    if (!currentItem) return;
    
    const itemIsPlaylist = currentItem._itemType === 'playlist';
    if (itemIsPlaylist) {
      const timeout = setTimeout(() => {
        handleCycleComplete();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [activeIndex, books, handleCycleComplete]);

  if (books.length === 0) return null;

  return (
    // Aspect ratio set to square 1:1
    <div className="relative w-full aspect-square max-h-[500px] md:max-h-[550px] rounded-2xl overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.4)] mb-6 mx-auto border-b-4 border-[#5c2e0b] bg-[#3e1f07]">

      {/* Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
      >
        {books.map((item, index) => {
          const itemId = item.id || item._id || '';
          const itemIsPlaylist = isPlaylist(item);
          const isActive = index === activeIndex;
          
          return (
          <div
            key={itemId}
            className="flex-shrink-0 w-full h-full snap-center relative flex flex-col items-center justify-center"
            onClick={() => onBookClick(itemId, itemIsPlaylist)}
          >
            {/* Vertical Wood Plank Background */}
            <div className="absolute inset-0" style={{
              background: `repeating-linear-gradient(
                    90deg, 
                    #8B4513 0%, #8B4513 10%, 
                    #5e2c04 10%, #5e2c04 11%, 
                    #A0522D 11%, #A0522D 24%, 
                    #5e2c04 24%, #5e2c04 25%, 
                    #8B4513 25%, #8B4513 40%, 
                    #5e2c04 40%, #5e2c04 41%
                )`
            }}></div>

            {/* Vignette / Shadow Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.6)_100%)]"></div>

            {/* NEW! Badge - Above the book on wood background */}
            <div className="relative z-20 mb-3">
              <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#3E1F07] font-display font-extrabold text-sm md:text-base px-5 py-1.5 rounded-full shadow-lg border-2 border-white/30 animate-pulse">
                ✨ NEW! ✨
              </div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 transform transition-transform active:scale-95 duration-200 px-4">
              {/* Cover - Aspect Square */}
              <div className="w-[17rem] md:w-[21rem] aspect-square rounded-lg shadow-2xl relative overflow-visible">
                {/* Use PageFlipPreview for books, static image for playlists */}
                {itemIsPlaylist ? (
                  <img
                    src={getImageSrc(item)}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-lg border-2 border-white/10"
                    onError={() => handleImageError(itemId)}
                  />
                ) : (
                  <PageFlipPreview
                    bookId={itemId}
                    coverUrl={getImageSrc(item)}
                    onError={() => handleImageError(itemId)}
                    onCycleComplete={handleCycleComplete}
                    isActive={isActive}
                  />
                )}

                {/* Action Button Overlay */}
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-black text-xs md:text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg hover:bg-white transition-colors z-30">
                  {itemIsPlaylist ? (
                    <>
                      <Music size={14} fill="currentColor" className="md:w-4 md:h-4" />
                      <span>Listen</span>
                    </>
                  ) : (
                    <>
                      <BookOpen size={14} fill="currentColor" className="md:w-4 md:h-4" />
                      <span>Read</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
        {books.map((_, index) => (
          <div
            key={index}
            className={`w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-300 ${index === activeIndex ? 'bg-white scale-110 opacity-100' : 'bg-white opacity-50'}`}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedCarousel;
