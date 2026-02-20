import React, { useState, useCallback, useEffect } from 'react';
import { Book } from '../../types';
import { BookOpen, Headphones, Heart, Lock } from 'lucide-react';
import PremiumBadge from './PremiumBadge';
import { useUser } from '../../context/UserContext';
import { useLanguage } from '../../context/LanguageContext';

interface BookCardProps {
  book: Book;
  onClick: (id: string) => void;
}

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const { isSubscribed } = useUser();
  const { currentLanguage, translateText } = useLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(book.title);
  
  // Translate title when language changes
  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedTitle(book.title);
      return;
    }
    
    translateText(book.title).then(translated => {
      setTranslatedTitle(translated);
    });
  }, [book.title, currentLanguage, translateText]);
  
  // Check if this content is locked (members only and user not subscribed)
  const isMembersOnly = book.isMembersOnly === true;
  const isLocked = isMembersOnly && !isSubscribed;

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
    <button
      type="button"
      onClick={() => onClick(book.id)}
      className="w-full cursor-pointer select-none focus:outline-none group text-left"
    >
      <div className={`relative aspect-square rounded-xl overflow-hidden border-2 border-white/20 shadow-lg group-hover:border-white/40 group-hover:scale-105 transition-all ${isLocked ? 'opacity-80' : ''}`}>
        <img
          src={getImageSrc()}
          alt={book.title}
          className={`w-full h-full object-cover ${isLocked ? 'brightness-75' : ''}`}
          loading="lazy"
          onError={handleImageError}
        />
        {isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-black/70 rounded-full p-2 border-2 border-[#FFD700]">
              <Lock size={18} className="text-[#FFD700]" />
            </div>
          </div>
        )}
        {isMembersOnly && !isSubscribed && (
          <PremiumBadge className="absolute top-1.5 right-1.5 z-20" />
        )}
      </div>
      <p className="text-white text-[11px] font-display font-bold mt-1.5 truncate text-center">
        {translatedTitle}
      </p>
    </button>
  );
};

export default BookCard;