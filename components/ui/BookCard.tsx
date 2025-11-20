import React from 'react';
import { Book } from '../../types';
import { BookOpen, Headphones } from 'lucide-react';

interface BookCardProps {
  book: Book;
  onClick: (id: string) => void;
}

const BookCard: React.FC<BookCardProps> = ({ book, onClick }) => {
  return (
    <div 
      onClick={() => onClick(book.id)}
      className="relative flex-shrink-0 w-36 mx-2 cursor-pointer group transition-transform hover:scale-105"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
        <img 
          src={book.coverUrl} 
          alt={book.title} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

        {/* Level Badge */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20">
          {book.level}
        </div>

        {/* Type Icon */}
        <div className="absolute bottom-2 right-2 bg-white text-blue-900 p-1 rounded-full shadow-md">
          {book.isAudio ? <Headphones size={14} /> : <BookOpen size={14} />}
        </div>
      </div>
      
      <h3 className="mt-2 text-white text-sm font-bold leading-tight drop-shadow-md px-1 line-clamp-2">
        {book.title}
      </h3>
    </div>
  );
};

export default BookCard;