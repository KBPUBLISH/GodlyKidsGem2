import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';

const HomePage: React.FC = () => {
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

  const handleBookClick = (id: string) => {
    navigate(`/book/${id}`);
  };

  const featuredBooks = books.slice(0, 5); // Top 5 featured
  const activityBooks = books.filter(b => b.category === 'Activity Books');
  const freeBooks = books.filter(b => b.category === 'Books Gone Free');
  const youngReaders = books.filter(b => b.category === 'Young Readers');

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      <Header isVisible={isHeaderVisible} />

      <div className="px-4 pt-28 space-y-2 pb-52">
        
        {/* Featured Carousel */}
        {!loading && featuredBooks.length > 0 && (
           <FeaturedCarousel books={featuredBooks} onBookClick={handleBookClick} />
        )}

        <section>
           <SectionTitle title="Activity Books" />
           <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
             {loading ? <div className="text-white p-4 font-display">Loading treasures...</div> : 
               (activityBooks.length > 0 ? activityBooks : books.slice(0,3)).map(book => (
                 <BookCard key={book.id} book={book} onClick={handleBookClick} />
               ))
             }
           </div>
        </section>

        <section>
           <SectionTitle title="Books Gone Free" />
           <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
             {loading ? null : 
               (freeBooks.length > 0 ? freeBooks : books.slice(3,5)).map(book => (
                 <BookCard key={book.id} book={book} onClick={handleBookClick} />
               ))
             }
           </div>
        </section>

        <section>
           <SectionTitle title="Young Readers" />
           <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
             {loading ? null : 
                (youngReaders.length > 0 ? youngReaders : books.slice(2,6)).map(book => (
                 <BookCard key={book.id} book={book} onClick={handleBookClick} />
               ))
             }
           </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;