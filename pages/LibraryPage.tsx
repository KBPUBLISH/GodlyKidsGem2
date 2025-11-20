import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScrollY = scrollRef.current.scrollTop;
    
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

  // Filter for user's books (mock logic: isRead or favorites)
  const myBooks = books.filter(b => b.isRead);
  const displayBooks = myBooks.length > 0 ? myBooks : books.slice(0, 2); // Fallback for demo

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="MY BOOKS" />

      <div className="px-4 pt-28 pb-52">
        <SectionTitle title="Favorites & History" />
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Checking backpack...</div>
        ) : displayBooks.length === 0 ? (
           <div className="flex flex-col items-center justify-center mt-10 bg-black/20 p-6 rounded-2xl backdrop-blur-sm">
             <p className="text-white font-display text-lg mb-2">Your backpack is empty!</p>
             <p className="text-blue-100 text-sm text-center">Go explore and start reading to fill up your library.</p>
           </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 justify-items-center">
            {displayBooks.map(book => (
              <BookCard key={book.id} book={book} onClick={(id) => navigate(`/book/${id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;