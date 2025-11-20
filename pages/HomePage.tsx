
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionTitle from '../components/ui/SectionTitle';
import BookCard from '../components/ui/BookCard';
import Header from '../components/layout/Header';
import FeaturedCarousel from '../components/ui/FeaturedCarousel';
import { useBooks } from '../context/BooksContext';
import DailyRewardModal from '../components/features/DailyRewardModal';
import { Gift } from 'lucide-react';

// Mock Data for Stories
const MOCK_STORIES = [
  // Note: 'Daily Gift' is handled dynamically now, but we keep others
  { id: 's1', name: 'Daily Verse', img: 'https://picsum.photos/seed/verse/200/200', isNew: true },
  { id: 's2', name: 'Challenge', img: 'https://picsum.photos/seed/challenge/200/200', isNew: true },
  { id: 's3', name: 'Winners', img: 'https://picsum.photos/seed/winners/200/200', isNew: true },
  { id: 's4', name: 'Events', img: 'https://picsum.photos/seed/events/200/200', isNew: false },
  { id: 's5', name: 'Crafts', img: 'https://picsum.photos/seed/crafts/200/200', isNew: false },
  { id: 's6', name: 'Music', img: 'https://picsum.photos/seed/music/200/200', isNew: false },
  { id: 's7', name: 'Parents', img: 'https://picsum.photos/seed/parents/200/200', isNew: false },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { books, loading } = useBooks();
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [showDailyReward, setShowDailyReward] = useState(false);
  
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
    // Pass state to know where to return
    navigate(`/book/${id}`, { state: { from: '/home' } });
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
      
      <DailyRewardModal 
        isOpen={showDailyReward} 
        onClose={() => setShowDailyReward(false)} 
      />

      <div className="px-4 pt-28 space-y-2 pb-52">
        
        {/* Featured Carousel */}
        {!loading && featuredBooks.length > 0 && (
           <FeaturedCarousel books={featuredBooks} onBookClick={handleBookClick} />
        )}

        {/* --- NEW: Stories Section --- */}
        <div className="w-full overflow-x-auto no-scrollbar pb-6 pt-2 -mt-2">
           <div className="flex space-x-4 px-1 min-w-min">
              
              {/* SPECIAL: Daily Gift Story */}
              <button 
                   className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
                   onClick={() => setShowDailyReward(true)}
              >
                   {/* Ring */}
                   <div className="p-[3px] rounded-full bg-gradient-to-tr from-[#FFD700] via-[#fff] to-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.6)] animate-pulse relative transition-transform group-active:scale-95">
                      {/* Avatar Container */}
                      <div className="w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-[#8B4513] overflow-hidden bg-[#8B4513] flex items-center justify-center relative">
                         <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 10%, transparent 80%)'}}></div>
                         <Gift size={32} className="text-[#FFD700] relative z-10 animate-[bounce_2s_infinite]" fill="#B8860B" />
                      </div>
                      {/* Notification Badge */}
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#FF5252] border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                        1
                      </div>
                   </div>
                   {/* Name */}
                   <span className="text-[#FFD700] text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                      Daily Gift
                   </span>
              </button>

              {MOCK_STORIES.map((story) => (
                <button 
                   key={story.id}
                   className="flex flex-col items-center gap-2 group min-w-[76px] md:min-w-[110px] outline-none"
                   onClick={() => {}} // Placeholder for story view
                >
                   {/* Ring */}
                   <div className={`p-[3px] rounded-full ${
                      story.isNew 
                        ? 'bg-gradient-to-tr from-[#FFD700] via-[#f59e0b] to-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)] animate-[spin_10s_linear_infinite_paused] group-hover:animate-[spin_4s_linear_infinite]' 
                        : 'bg-white/30 border border-white/10'
                   } transition-transform group-active:scale-95 relative`}>
                      
                      {/* Avatar Container */}
                      <div className="w-[70px] h-[70px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-white/20 overflow-hidden bg-black/20 relative">
                         <img src={story.img} alt={story.name} className="w-full h-full object-cover" />
                      </div>

                      {/* New Indicator Dot (Optional, if ring isn't enough) */}
                      {story.isNew && (
                         <div className="absolute bottom-1 right-1 w-4 h-4 bg-[#0ea5e9] border-2 border-white rounded-full shadow-sm"></div>
                      )}
                   </div>
                   
                   {/* Name */}
                   <span className="text-white text-[11px] md:text-sm font-bold font-display tracking-wide drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.6)] truncate w-20 md:w-28 text-center opacity-100 group-hover:scale-105 transition-transform">
                      {story.name}
                   </span>
                </button>
              ))}
           </div>
        </div>

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
