import React, { useState, useCallback, useEffect } from 'react';
import { Book } from '../../types';
import { BookOpen, Headphones } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onClick: (id: string) => void;
}

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when book cover URL changes
  useEffect(() => {
    setImageError(false);
  }, [book.coverUrl]);

  // Determine the image source - use direct URL, no blob conversion needed
  const getImageSrc = useCallback(() => {
    if (imageError) return DEFAULT_COVER;
    if (!book.coverUrl || book.coverUrl.trim() === '') return DEFAULT_COVER;
    return book.coverUrl;
  }, [book.coverUrl, imageError]);

  const handleImageError = () => {
    if (!imageError) {
      console.error(`❌ Image failed to load for "${book.title}":`, book.coverUrl);
      setImageError(true);
    }
  };

  return (
    <div 
      onClick={() => onClick(book.id)}
      className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer group"
    >
      {/* Cover Image - Same structure as AudioPage */}
      <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
        <img 
          src={getImageSrc()} 
          alt={book.title} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          loading="lazy"
          onError={handleImageError}
        />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

        {/* Level Badge */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20">
          {book.level}
        </div>

        {/* Type Icon */}
        <div className="absolute bottom-2 right-2 bg-white/90 text-blue-900 p-1.5 rounded-full shadow-md">
          {book.isAudio ? <Headphones size={16} /> : <BookOpen size={16} />}
        </div>
      </div>
      
      {/* Info - Same structure as AudioPage */}
      <div className="p-2">
        <h3 className="text-white text-sm font-bold mb-0.5 truncate font-display">
          {book.title}
        </h3>
        {book.author && (
          <p className="text-white/70 text-xs">{book.author}</p>
        )}
      </div>
    </div>
  );
};

export default BookCard;