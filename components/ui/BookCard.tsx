import React, { useState, useEffect } from 'react';
import { Book } from '../../types';
import { BookOpen, Headphones } from 'lucide-react';
import { fetchAuthenticatedImage, revokeImageUrl } from '../../services/imageService';

interface BookCardProps {
  book: Book;
  onClick: (id: string) => void;
}

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>(DEFAULT_COVER);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  // Load image with authentication if needed
  useEffect(() => {
    const loadImage = async () => {
      if (!book.coverUrl || book.coverUrl.trim() === '') {
        console.warn(`⚠️ Book "${book.title}" has no cover URL`);
        setImageSrc(DEFAULT_COVER);
        return;
      }

      console.log(`🖼️ Loading cover for "${book.title}":`, book.coverUrl);
      setIsLoadingImage(true);
      setImageError(false);

      try {
        // Try to fetch as authenticated image if it's from our API
        const authenticatedUrl = await fetchAuthenticatedImage(book.coverUrl);
        
        if (authenticatedUrl) {
          setImageSrc(authenticatedUrl);
          console.log(`✅ Successfully loaded cover for "${book.title}"`);
        } else {
          // Fallback to direct URL (might be external or public)
          setImageSrc(book.coverUrl);
        }
      } catch (error) {
        console.error(`❌ Failed to load cover for "${book.title}":`, error);
        setImageSrc(DEFAULT_COVER);
        setImageError(true);
      } finally {
        setIsLoadingImage(false);
      }
    };

    loadImage();

    // Cleanup: revoke object URL when component unmounts
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        revokeImageUrl(imageSrc);
      }
    };
  }, [book.coverUrl, book.title]);

  const handleImageError = () => {
    if (!imageError) {
      console.error(`❌ Image failed to load for "${book.title}":`, imageSrc);
      setImageError(true);
      setImageSrc(DEFAULT_COVER);
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
          src={imageSrc} 
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