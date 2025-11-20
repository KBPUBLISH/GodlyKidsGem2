
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, BookOpen, Crown, PlayCircle, Headphones, Disc } from 'lucide-react';
import { useBooks } from '../context/BooksContext';
import { Book } from '../types';

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

// Mock Chapters Data for Audio Books
const AUDIO_CHAPTERS = [
  { 
    id: 1, 
    title: "Chapter 1 — In the Beginning", 
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch1/150/150"
  },
  { 
    id: 2, 
    title: "Chapter 2 — Tom and the Clock Shop", 
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch2/150/150"
  },
  { 
    id: 3, 
    title: "Chapter 3 — The Prince's Slippers", 
    subtitle: "Kingdom Builders Publishing",
    image: "https://picsum.photos/seed/ch3/150/150"
  }
];

const BookDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { books, loading } = useBooks();
  const [book, setBook] = useState<Book | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (books.length > 0) {
        const found = books.find(b => b.id === id);
        setBook(found || null);
    }
  }, [id, books]);

  if (loading && !book) return <div className="h-full flex items-center justify-center text-white font-display">Loading...</div>;
  
  if (!book) return <div className="h-full flex items-center justify-center text-white font-display">Book not found</div>;

  const isAudio = book.isAudio;

  const handleChapterClick = (chapterId: number) => {
    navigate(`/player/${id}/${chapterId}`);
  };

  const handleBack = () => {
    // Navigate back to the previous main tab (passed via state) or default to Home
    const backPath = (location.state as any)?.from || '/home';
    navigate(backPath);
  };

  return (
    // Opaque background to hide panorama
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar bg-[#fdf6e3]">
      
      {/* TOP SECTION - WOOD BACKGROUND */}
      {/* Full width, removed margins and top rounded corners */}
      <div className="relative pb-8 shadow-2xl z-10 overflow-hidden shrink-0 w-full">
        {/* Vertical Wood Plank Pattern CSS */}
        <div className="absolute inset-0 bg-[#8B4513]" style={{
            backgroundImage: `repeating-linear-gradient(
                90deg, 
                #a05f2c 0%, #a05f2c 14%, 
                #3e1f07 14%, #3e1f07 15%, 
                #c28246 15%, #c28246 29%, 
                #3e1f07 29%, #3e1f07 30%, 
                #945829 30%, #945829 49%, 
                #3e1f07 49%, #3e1f07 50%, 
                #b06d36 50%, #b06d36 74%, 
                #3e1f07 74%, #3e1f07 75%,
                #a05f2c 75%, #a05f2c 100%
            )`
        }}></div>
        
        {/* Subtle Grain Overlay */}
         <div className="absolute inset-0 opacity-10 pointer-events-none" 
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}></div>

        {/* Header Icons */}
        <div className="relative z-20 flex justify-between items-center px-4 pt-6 pb-2">
            {/* Back Button */}
             <button onClick={handleBack} className="w-12 h-12 bg-[#90be6d] rounded-full border-4 border-[#f3e5ab] overflow-hidden shadow-[0_4px_0_rgba(0,0,0,0.3)] relative flex items-center justify-center transform transition-transform active:scale-95 group">
                 <div className="w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-white border-b-[8px] border-b-transparent mr-1"></div>
            </button>

            {/* Crown Icon */}
            <div className="bg-[#fdf6e3] px-4 py-1 rounded-full border-b-4 border-[#d4c5a0] shadow-lg flex items-center justify-center">
                <Crown className="text-[#8B4513]" size={24} fill="#8B4513" />
            </div>
        </div>

        {/* Main Content Area - Swaps based on type */}
        <div className="relative z-20 px-6 pt-2 flex flex-col items-center space-y-5">
            
            {/* Book Cover - Aspect Square 1:1 - Increased max-width by another 7% */}
            <div className="w-full aspect-square max-w-[20.6rem] md:max-w-[28rem] lg:max-w-[32rem] rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-[3px] border-[#5c2e0b] relative bg-gray-800">
                <img 
                    src={imageError || !book.coverUrl ? DEFAULT_COVER : book.coverUrl} 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
                {/* Decorative Sparkles */}
                <div className="absolute top-3 right-4 text-white/90 text-2xl animate-pulse filter drop-shadow-md">✦</div>
                <div className="absolute bottom-3 left-4 text-white/80 text-xl animate-pulse delay-700 filter drop-shadow-md">✨</div>
            </div>

            {isAudio ? (
              // --- AUDIO BOOK SPECIFIC ACTIONS ---
              <>
                {/* Add to Library Button */}
                <div className="w-full max-w-sm">
                    <button className="w-full bg-gradient-to-b from-[#8B4513] to-[#5c2e0b] hover:from-[#A0522D] hover:to-[#70380d] text-[#f3e5ab] font-display font-bold text-xl py-3 rounded-full shadow-[0_4px_0_#3e1f07,0_8px_15px_rgba(0,0,0,0.4)] border-2 border-[#a05f2c] active:translate-y-[4px] active:shadow-[0_0_0_#3e1f07] transition-all text-center flex items-center justify-center gap-2">
                        <span>Add to library</span>
                    </button>
                </div>

                {/* Stats Row (Audio) */}
                <div className="w-full max-w-sm flex justify-between items-center px-4 text-[#e2cba5] font-bold drop-shadow-md">
                    <div className="flex items-center gap-2">
                        <Headphones size={20} />
                        <span className="text-lg">104 Listen</span>
                    </div>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex items-center gap-2">
                        <Heart size={20} className="text-[#FF5252]" fill="#FF5252" />
                        <span className="text-lg">15 Favs</span>
                    </div>
                </div>
              </>
            ) : (
              // --- STANDARD BOOK ACTIONS ---
              <>
                {/* Read / Continue Buttons */}
                <div className="flex w-full gap-3 max-w-sm">
                    <button className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none">
                        Read
                    </button>
                    <button className="flex-1 bg-[#FCEBB6] hover:bg-[#fff5cc] text-[#5c2e0b] font-display font-bold text-xl py-3 rounded-2xl shadow-[0_4px_0_#D4B483] border-2 border-[#D4B483] active:translate-y-[4px] active:shadow-none transition-all text-center leading-none flex flex-col items-center justify-center gap-0.5">
                        <span>Continue</span>
                        <span className="text-[10px] font-sans font-normal opacity-80">(Pag 22)</span>
                    </button>
                </div>

                {/* Game Card */}
                <div className="w-full max-w-sm bg-[#3E1F07] rounded-2xl p-3 flex items-center gap-4 shadow-[0_6px_0_rgba(0,0,0,0.3)] border-2 border-[#5c2e0b] relative overflow-hidden">
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#70380d] to-transparent"></div>
                    
                    <div className="w-20 h-14 bg-[#87CEEB] rounded-lg overflow-hidden relative shrink-0 border-2 border-white/10 shadow-inner z-10">
                        <img src="https://picsum.photos/seed/minewings/200/150" className="w-full h-full object-cover" alt="Game" />
                    </div>
                    <div className="flex-1 z-10 flex justify-between items-center">
                        <h3 className="text-white font-display font-bold tracking-wide text-lg drop-shadow-md">MineWings</h3>
                        <button className="bg-[#6da34d] hover:bg-[#7db85b] text-white text-sm font-bold py-1.5 px-6 rounded-full shadow-[0_3px_0_#3d5c2b] active:translate-y-[3px] active:shadow-none transition-all border border-[#ffffff20]">
                            Play
                        </button>
                    </div>
                </div>

                {/* Stats Row (Read) */}
                <div className="w-full max-w-sm bg-[#2d1809]/80 backdrop-blur-sm rounded-xl py-2 px-4 flex justify-between items-center text-[#e2cba5] font-bold shadow-inner border border-[#ffffff10]">
                    <div className="flex items-center gap-2">
                        <BookOpen size={20} />
                        <span className="text-lg">950 Read</span>
                    </div>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex items-center gap-2">
                        <Heart size={20} className="text-[#FF5252]" fill="#FF5252" />
                        <span className="text-lg">15 Fav</span>
                    </div>
                </div>
              </>
            )}
        </div>
      </div>

      {/* BOTTOM SECTION - CONTENT */}
      <div className="flex-1 w-full px-6 pt-8 pb-52 self-center bg-[#fdf6e3]">
          
          {/* Title & Author Area - Common */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-extrabold text-[#3E1F07] mb-1 leading-tight">
                {book.title}
            </h1>
            <p className="text-[#8B4513] font-semibold text-sm opacity-90">
                By: {book.author || "Kingdom Builders Publishing"}
            </p>
          </div>

          {/* Description or Playlist */}
          <div className="max-w-lg mx-auto">
             <p className="text-[#5c2e0b] font-sans text-base leading-relaxed opacity-90 mb-8 text-center">
                  {book.description || "In a world where hearts glow with living colors, a young girl discovers her gift may change the fate of kingdoms. Guided by courage, friendship, and the mysterious Pulse, she learns that even in the darkest places, hearts still beats."}
                  {isAudio && <span className="block mt-2 font-bold text-[#8B4513]">`Total playback duration: 00:53:10`</span>}
              </p>

              {isAudio && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {AUDIO_CHAPTERS.map((chapter, index) => (
                    <div 
                        key={chapter.id} 
                        onClick={() => handleChapterClick(chapter.id)}
                        className="bg-white rounded-2xl p-2 flex items-center gap-3 shadow-[0_4px_10px_rgba(0,0,0,0.05)] border border-[#eecaa0] hover:border-[#d4b483] transition-colors group cursor-pointer"
                    >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 relative">
                            <img src={chapter.image} alt={`Ch ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0 py-1">
                            <h4 className="font-display font-bold text-[#3E1F07] text-base leading-tight truncate pr-2">
                              {chapter.title}
                            </h4>
                            <p className="text-xs text-[#8B4513] opacity-70 truncate mt-0.5">
                              {chapter.subtitle}
                            </p>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex flex-col items-center gap-1 pr-1">
                            <span className="text-[10px] font-bold text-[#8B4513] opacity-60 tracking-wide uppercase">Preview</span>
                            <button className="w-9 h-9 rounded-full bg-[#fcebb6] hover:bg-[#ffde8a] text-[#8B4513] flex items-center justify-center shadow-[0_2px_5px_rgba(139,69,19,0.2)] border border-[#eecaa0] active:scale-95 transition-all">
                                <PlayCircle size={22} fill="#8B4513" className="text-[#fcebb6]" />
                            </button>
                        </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
      </div>

    </div>
  );
};

export default BookDetailPage;