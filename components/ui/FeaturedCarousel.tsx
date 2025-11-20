import React, { useState, useRef } from 'react';
import { Book } from '../../types';
import { BookOpen } from 'lucide-react';

interface FeaturedCarouselProps {
  books: Book[];
  onBookClick: (id: string) => void;
}

const FeaturedCarousel: React.FC<FeaturedCarouselProps> = ({ books, onBookClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  if (books.length === 0) return null;

  return (
    // Aspect ratio set to square 1:1
    <div className="relative w-full aspect-square max-h-[500px] rounded-2xl overflow-hidden shadow-[0_8px_16px_rgba(0,0,0,0.4)] mb-6 mx-auto border-b-4 border-[#5c2e0b] bg-[#3e1f07]">
      
      {/* Scroll Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
      >
        {books.map((book) => (
          <div 
            key={book.id} 
            className="flex-shrink-0 w-full h-full snap-center relative flex items-center justify-center"
            onClick={() => onBookClick(book.id)}
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

            {/* Content Container */}
            <div className="relative z-10 transform transition-transform active:scale-95 duration-200">
                {/* Book Cover - Aspect Square */}
                <div className="w-56 aspect-square rounded-lg shadow-2xl relative">
                     <img 
                        src={book.coverUrl} 
                        alt={book.title} 
                        className="w-full h-full object-cover rounded-lg border-2 border-white/10" 
                     />
                     
                     {/* NEW! Badge */}
                     <div className="absolute -top-3 -right-5 bg-white text-black font-display font-extrabold text-xs px-3 py-1.5 rounded-full shadow-lg transform rotate-12 border-2 border-gray-100 z-20">
                        NEW!
                     </div>

                     {/* Read Button Overlay */}
                     <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-md text-black text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg hover:bg-white transition-colors">
                        <BookOpen size={12} fill="currentColor" />
                        <span>Read</span>
                     </div>
                </div>
            </div>
          </div>
        ))}
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