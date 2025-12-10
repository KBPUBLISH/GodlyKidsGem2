
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

// Simple crossfade preview component for books
const PageFlipPreview: React.FC<{
  bookId: string;
  coverUrl: string;
  title: string;
  onCycleComplete: () => void;
  isActive: boolean;
}> = ({ bookId, coverUrl, title, onCycleComplete, isActive }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const cycleCompleteRef = useRef(false);
  const hasFetchedRef = useRef(false);

  // All images: cover + pages
  const allImages = [coverUrl, ...pages];
  const totalImages = allImages.length;

  // Fetch pages
  useEffect(() => {
    if (!bookId || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    ApiService.getBookPages(bookId)
      .then((bookPages) => {
        if (bookPages?.length > 0) {
          const pageImages = bookPages
            .slice(0, 3)
            .map((p: any) => p.files?.background?.url || p.backgroundUrl)
            .filter(Boolean);
          if (pageImages.length > 0) {
            setPages(pageImages);
          }
        }
        setPagesLoaded(true);
      })
      .catch(() => setPagesLoaded(true));
  }, [bookId]);

  // Preload all images
  useEffect(() => {
    allImages.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [allImages]);

  // Reset on active
  useEffect(() => {
    if (isActive) {
      setCurrentIndex(0);
      cycleCompleteRef.current = false;
    }
  }, [isActive]);

  // Auto-advance through images
  useEffect(() => {
    if (!isActive) return;

    // Wait for pages to load
    if (!pagesLoaded) return;

    // If only 1 image, wait then advance carousel
    if (totalImages <= 1) {
      const timeout = setTimeout(() => {
        if (!cycleCompleteRef.current) {
          cycleCompleteRef.current = true;
          onCycleComplete();
        }
      }, 2500);
      return () => clearTimeout(timeout);
    }

    // Cycle through images
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= totalImages) {
          // Completed cycle, advance carousel
          if (!cycleCompleteRef.current) {
            cycleCompleteRef.current = true;
            setTimeout(() => onCycleComplete(), 300);
          }
          return 0;
        }
        return next;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isActive, pagesLoaded, totalImages, onCycleComplete]);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden">
      {/* Stack all images, only current one is visible */}
      {allImages.map((src, index) => (
        <img
          key={src}
          src={src}
          alt={`${title} ${index === 0 ? 'cover' : `page ${index}`}`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ 
            opacity: index === currentIndex ? 1 : 0,
            zIndex: index === currentIndex ? 1 : 0
          }}
        />
      ))}
      
      {/* Page indicator dots */}
      {totalImages > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {allImages.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white w-3' 
                  : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Subtle page edge effect */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />
      
      {/* Border */}
      <div className="absolute inset-0 rounded-lg border-2 border-white/10 pointer-events-none" />
    </div>
  );
};

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ books, onBookClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getImageSrc = (item: FeaturedItem) => {
    // Try multiple possible cover image fields
    return item.coverUrl || item.coverImage || (item as any).files?.coverImage || '';
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
          const coverUrl = getImageSrc(item);
          
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

            {/* Tap to Read/Listen text above cover */}
            <div className="relative z-20 mb-3">
              <p className="text-white/90 font-display font-bold text-base md:text-lg drop-shadow-lg">
                {itemIsPlaylist ? '🎧 Tap to listen' : '📖 Tap to read'}
              </p>
            </div>

            {/* Content Container */}
            <div className="relative z-10 transform transition-transform active:scale-95 duration-200 px-4">
              {/* Cover - Aspect Square */}
              <div className="w-[17rem] md:w-[21rem] aspect-square rounded-lg shadow-2xl relative overflow-visible">
                {/* Use PageFlipPreview for books with cover, static image for playlists */}
                {itemIsPlaylist || !coverUrl ? (
                  <img
                    src={coverUrl || '/assets/images/placeholder-book.png'}
                    alt={item.title}
                    className="w-full h-full object-cover rounded-lg border-2 border-white/10"
                  />
                ) : (
                  <PageFlipPreview
                    bookId={itemId}
                    coverUrl={coverUrl}
                    title={item.title}
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
