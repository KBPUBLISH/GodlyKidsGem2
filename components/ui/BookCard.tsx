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
    <div 
      onClick={() => {
        // Always allow clicking to see book details - button will be locked there
        onClick(book.id);
      }}
      className={`bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border-2 border-white/20 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer group ${isLocked ? 'opacity-80' : ''}`}
    >
      {/* Cover Image - Same structure as AudioPage */}
      <div className="aspect-square bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
        <img 
          src={getImageSrc()} 
          alt={book.title} 
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${isLocked ? 'filter brightness-75' : ''}`}
          loading="lazy"
          onError={handleImageError}
        />
        
        {/* Lock Overlay for Members Only Content */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700]">
              <Lock size={24} className="text-[#FFD700]" />
            </div>
          </div>
        )}
        
        {/* Members Only Badge - Only show if user is NOT subscribed */}
        {isMembersOnly && !isSubscribed && (
          <PremiumBadge className="absolute top-2 right-2 z-20" />
        )}
        
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

        {/* Level Badge */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20">
          {book.level}
        </div>

        {/* Stats Badge - Likes only */}
        {(book as any).likeCount > 0 && (
          <div className="absolute top-2 left-2">
            <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
              <Heart size={10} className="text-red-400" />
              {(book as any).likeCount}
            </div>
          </div>
        )}

        {/* Type Icon */}
        <div className="absolute bottom-2 right-2 bg-white/90 text-blue-900 p-1.5 rounded-full shadow-md">
          {book.isAudio ? <Headphones size={16} /> : <BookOpen size={16} />}
        </div>
      </div>
      
      {/* Info - Same structure as AudioPage */}
      <div className="p-2">
        <h3 className="text-white text-sm font-bold mb-0.5 truncate font-display">
          {translatedTitle}
        </h3>
        {book.author && (
          <p className="text-white/70 text-xs">{book.author}</p>
        )}
      </div>
    </div>
  );
};

export default BookCard;