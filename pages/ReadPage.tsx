import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';

const ReadPage: React.FC = () => {
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

  // Filter for reading books (not strictly audio only)
  const readingBooks = books.filter(b => !b.isAudio);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="READING" />

      <div className="px-4 pt-28 pb-52">
        <SectionTitle title="All Books" />
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Loading library...</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 justify-items-center">
            {readingBooks.map(book => (
              <BookCard key={book.id} book={book} onClick={(id) => navigate(`/book/${id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadPage;