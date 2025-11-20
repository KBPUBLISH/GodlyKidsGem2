import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import SectionTitle from '../components/ui/SectionTitle';
import { useBooks } from '../context/BooksContext';

const ListenPage: React.FC = () => {
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

  // Filter for audio books
  const audioBooks = books.filter(b => b.isAudio);

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} title="LISTEN" />

      <div className="px-4 pt-28 pb-52">
        <SectionTitle title="Audio Adventures" />
        
        {loading ? (
           <div className="text-white font-display text-center mt-10">Loading sounds...</div>
        ) : audioBooks.length === 0 ? (
           <div className="text-white/80 font-display text-center mt-10 p-4 bg-black/20 rounded-xl">
             No audio books found right now. Try the Explore tab!
           </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 justify-items-center">
            {audioBooks.map(book => (
              <BookCard key={book.id} book={book} onClick={(id) => navigate(`/book/${id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListenPage;