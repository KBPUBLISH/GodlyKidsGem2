
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Book } from '../../types';
import { BookOpen, Music } from 'lucide-react';
import { ApiService } from '../../services/apiService';

// Simple localStorage cache for page images (survives app restarts - 24hr TTL)
const getPageFromCache = (bookId: string): string | null => {
  try {
    const cached = localStorage.getItem(`gk_page_${bookId}`);
    if (cached) {
      const { url, ts } = JSON.parse(cached);
      if (Date.now() - ts < 24 * 60 * 60 * 1000) return url;
    }
  } catch {}
  return null;
};

const setPageToCache = (bookId: string, url: string) => {
  try {
    localStorage.setItem(`gk_page_${bookId}`, JSON.stringify({ url, ts: Date.now() }));
  } catch {}
};

interface FeaturedItem extends Partial<Book> {
  id: string;
  _id?: string;
  title: string;
  coverUrl?: string;
  coverImage?: string;
  _itemType?: 'book' | 'playlist' | 'episode';
  _playlistId?: string;
  _itemIndex?: number;
}

interface FeaturedCarouselProps {
  books: FeaturedItem[];
  onBookClick: (id: string, isPlaylist?: boolean) => void;
}

// OPTIMIZED Page Preview - Simple crossfade between cover and ONE page
// Only fetches when active, uses localStorage cache, minimal state
const SimplePagePreview: React.FC<{
  bookId: string;
  coverUrl: string;
  isActive: boolean;
}> = ({ bookId, coverUrl, isActive }) => {
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [showPage, setShowPage] = useState(false);

  // Load from cache each time this becomes active; fetch only if missing.
  // Important: when inactive, release the page image to reduce iOS WebView memory pressure.
  useEffect(() => {
    let cancelled = false;

    if (!isActive) {
      setShowPage(false);
      setPageLoaded(false);
      setPageUrl(null);
      return;
    }

    const cached = getPageFromCache(bookId);
    if (cached) {
      setPageLoaded(false);
      setPageUrl(cached);
      return;
    }

    ApiService.getBookPages(bookId)
      .then(pages => {
        const firstPage = pages?.[0];
        // Check multiple possible sources for the first page preview:
        // 1. Video sequence (for books using multiple videos)
        // 2. files.background.url (new schema)
        // 3. backgroundUrl (legacy field)
        let url = null;
        
        if (firstPage?.useVideoSequence && firstPage?.videoSequence?.length > 0) {
          // Sort by order and get first video
          const sortedVideos = [...firstPage.videoSequence].sort((a: any, b: any) => a.order - b.order);
          url = sortedVideos[0]?.url;
        } else {
          url = firstPage?.files?.background?.url || firstPage?.backgroundUrl;
        }
        
        if (!cancelled && url) {
          setPageToCache(bookId, url);
          setPageLoaded(false);
          setPageUrl(url);
        }
      })
      .catch(() => {}); // Silent fail - just show cover

    return () => {
      cancelled = true;
    };
  }, [bookId, isActive]);

  // Crossfade only AFTER the page is loaded (avoid flicker / decode stalls)
  useEffect(() => {
    if (!isActive || !pageUrl || !pageLoaded) {
      setShowPage(false);
      return;
    }

    const timer = setTimeout(() => setShowPage(true), 800);
    return () => clearTimeout(timer);
  }, [isActive, pageUrl, pageLoaded]);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden">
      {/* Cover image (always visible as base) */}
      <img
        src={coverUrl}
        alt="Book cover"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        decoding="async"
      />
      
      {/* Page image or video (fades in on top) */}
      {isActive && pageUrl && (
        /\.(mp4|webm|mov|m4v)$/i.test(pageUrl) ? (
          <video
            src={pageUrl}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setPageLoaded(true)}
            onError={() => {
              try {
                localStorage.removeItem(`gk_page_${bookId}`);
              } catch {}
              setShowPage(false);
              setPageLoaded(false);
              setPageUrl(null);
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              showPage ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <img
            src={pageUrl}
            alt="Book page"
            loading="eager"
            decoding="async"
            onLoad={() => setPageLoaded(true)}
            onError={() => {
              // Recover: drop bad cache + fall back to cover
              try {
                localStorage.removeItem(`gk_page_${bookId}`);
              } catch {}
              setShowPage(false);
              setPageLoaded(false);
              setPageUrl(null);
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              showPage ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )
      )}
      
      {/* Page edge effect when showing page */}
      {isActive && showPage && pageUrl && (
        <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-r from-black/40 to-transparent" />
      )}
      
      {/* Border */}
      <div className="absolute inset-0 border-2 border-white/10 rounded-lg pointer-events-none" />
    </div>
  );
};

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ books, onBookClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getImageSrc = (item: FeaturedItem) => {
    return item.coverUrl || item.coverImage || (item as any).files?.coverImage || '';
  };

  const isPlaylist = (item: FeaturedItem) => item._itemType === 'playlist';
  const isEpisode = (item: FeaturedItem) => item._itemType === 'episode';

  const scrollToIndex = useCallback((index: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
    }
  }, []);

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

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (!books[activeIndex]) return;
    const timer = setTimeout(handleCycleComplete, 4000);
    return () => clearTimeout(timer);
  }, [activeIndex, books, handleCycleComplete]);

  if (books.length === 0) return null;

  return (
    <div className="relative w-full aspect-[4/3] max-h-[380px] md:max-h-[420px] rounded-2xl overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.4)] mb-6 mx-auto border-b-4 border-[#5c2e0b] bg-[#3e1f07]">

      {/* Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
      >
        {books.map((item, index) => {
          const itemId = item.id || item._id || '';
          const itemIsPlaylist = isPlaylist(item);
          const itemIsEpisode = isEpisode(item);
          const isActive = index === activeIndex;
          const coverUrl = getImageSrc(item);

          return (
            <div
              key={itemId}
              className="flex-shrink-0 w-full h-full snap-center relative flex flex-col items-center justify-center"
              onClick={() => {
                if (itemIsEpisode && item._playlistId !== undefined && item._itemIndex !== undefined) {
                  // For episodes, navigate to the specific track in the playlist
                  onBookClick(`${item._playlistId}/${item._itemIndex}`, true);
                } else {
                  onBookClick(itemId, itemIsPlaylist || itemIsEpisode);
                }
              }}
            >
              {/* Wood Background */}
              <div className="absolute inset-0" style={{
                background: `repeating-linear-gradient(90deg, 
                  #8B4513 0%, #8B4513 10%, 
                  #5e2c04 10%, #5e2c04 11%, 
                  #A0522D 11%, #A0522D 24%, 
                  #5e2c04 24%, #5e2c04 25%, 
                  #8B4513 25%, #8B4513 40%, 
                  #5e2c04 40%, #5e2c04 41%
                )`
              }} />

              {/* Vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.6)_100%)]" />


              {/* Cover */}
              <div className="relative z-10 transform transition-transform active:scale-95 duration-200 px-6 py-4 w-full h-full flex items-center justify-center">
                <div className="w-full max-w-[85%] sm:max-w-[75%] md:max-w-[70%] aspect-square rounded-lg shadow-2xl relative overflow-visible">
                  
                  {/* Use SimplePagePreview for books, static image for playlists and episodes */}
                  {(itemIsPlaylist || itemIsEpisode) ? (
                    <img
                      src={coverUrl || '/assets/images/placeholder-book.png'}
                      alt={item.title}
                      className="w-full h-full object-cover rounded-lg border-2 border-white/10"
                    />
                  ) : (
                    isActive ? (
                      <SimplePagePreview
                        bookId={itemId}
                        coverUrl={coverUrl || '/assets/images/placeholder-book.png'}
                        isActive={isActive}
                      />
                    ) : (
                      <img
                        src={coverUrl || '/assets/images/placeholder-book.png'}
                        alt={item.title}
                        className="w-full h-full object-cover rounded-lg border-2 border-white/10"
                        loading="lazy"
                        decoding="async"
                      />
                    )
                  )}

                  {/* Action Button */}
                  <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-black text-xs md:text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg hover:bg-white transition-colors z-30">
                    {(itemIsPlaylist || itemIsEpisode) ? (
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
      <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-2 z-20 pointer-events-none">
        {books.map((_, index) => (
          <div
            key={index}
            className={`w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-300 ${
              index === activeIndex ? 'bg-white scale-110 opacity-100' : 'bg-white opacity-50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default FeaturedCarousel;
