import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Crown, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useBooks } from '../context/BooksContext';

// Default placeholder image
const DEFAULT_COVER = 'https://via.placeholder.com/400x400/8B4513/FFFFFF?text=Book+Cover';

// Mock Data for demonstration purposes, matching the visual request
const MOCK_CHAPTER_DETAILS = {
  '1': {
    title: "Chapter 1 — In the Beginning",
    subtitle: "Written and produced by Kingdom Builders Publishing",
    description: "The tale opens with the creation of Kardia, where rivers, skies, and stars are woven by the Pulse itself. In a quiet cottage, a girl named Mindy begins to wonder what her half-red, half-blue heart might mean.",
    duration: "09:30",
    plays: 81
  },
  '2': {
    title: "Chapter 2 — Tom and the Clock Shop",
    subtitle: "Written and produced by Kingdom Builders Publishing",
    description: "Mindy meets Tom, a clockmaker who knows more about the rhythm of the world than he lets on. Tick-tock, the secrets unfold.",
    duration: "12:15",
    plays: 45
  },
  '3': {
    title: "Chapter 3 — The Prince's Slippers",
    subtitle: "Written and produced by Kingdom Builders Publishing",
    description: "A humorous interlude involving a lost pair of royal slippers, a muddy puddle, and a very confused goose named Barnaby.",
    duration: "08:45",
    plays: 112
  }
};

const AudioPlayerPage: React.FC = () => {
  const { bookId, chapterId } = useParams();
  const navigate = useNavigate();
  const { books } = useBooks();
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [progress, setProgress] = useState(35); // Mock progress percentage

  const book = books.find(b => b.id === bookId);
  const chapter = MOCK_CHAPTER_DETAILS[chapterId as keyof typeof MOCK_CHAPTER_DETAILS] || MOCK_CHAPTER_DETAILS['1'];
  
  if (!book) return null;

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-30 flex justify-between items-center pt-8">
        {/* Custom Back Button (Orange/Wood Box style) */}
        <button 
          onClick={() => navigate(`/book/${bookId}`)}
          className="w-12 h-12 bg-[#e67e22] rounded-2xl border-b-4 border-[#d35400] shadow-lg flex items-center justify-center active:translate-y-1 active:border-b-0 active:shadow-none transition-all"
        >
          <ChevronLeft size={32} className="text-[#5c2e0b]" strokeWidth={3} />
        </button>

        {/* Crown Icon */}
        <div className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center shadow-lg">
             <Crown className="text-white/90" size={24} />
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-32 relative z-10 overflow-y-auto no-scrollbar">
          
          {/* Album Art - Increased size by another ~7% */}
          <div className="w-[18.3rem] h-[18.3rem] mb-6 relative shrink-0">
             {/* Decorative Frame/Glow */}
             <div className="absolute inset-0 bg-white/10 rounded-xl transform rotate-3 scale-105 blur-sm"></div>
             <div className="relative w-full h-full rounded-lg overflow-hidden border-4 border-[#8B4513] shadow-2xl">
                <img 
                  src={imageError || !book.coverUrl ? DEFAULT_COVER : book.coverUrl} 
                  alt={book.title} 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
                
                {/* Decorative corners (simulated with CSS) */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#FFD700] rounded-tl-md opacity-80"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#FFD700] rounded-tr-md opacity-80"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#FFD700] rounded-bl-md opacity-80"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#FFD700] rounded-br-md opacity-80"></div>
             </div>
          </div>

          {/* Text Info Panel */}
          <div className="w-full max-w-sm bg-black/40 backdrop-blur-md rounded-3xl p-6 text-center border border-white/10 shadow-xl relative">
              <h2 className="text-2xl font-display font-bold text-white mb-2 leading-tight">
                {chapter.title}
              </h2>
              <p className="text-[#FFD700] font-sans text-sm font-bold mb-4 uppercase tracking-wider opacity-90">
                {chapter.subtitle}
              </p>
              
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/30 to-transparent mb-4"></div>

              <p className="text-white/90 font-sans text-base leading-relaxed line-clamp-4">
                {chapter.description}
              </p>

              <div className="mt-4 text-white/60 text-xs font-bold tracking-wide">
                 `Total playback duration: {book.isAudio ? "00:53:10" : chapter.duration}`
              </div>
          </div>
      </div>

      {/* Bottom Player Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-44 bg-[#8B4513] z-30 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col px-8 pt-8 overflow-hidden">
          
          {/* Wood Texture Background */}
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply"
             style={{
                backgroundImage: `repeating-linear-gradient(
                    90deg, 
                    #5e2c04 0%, #5e2c04 2%, 
                    #8B4513 2%, #8B4513 5%, 
                    #A0522D 5%, #A0522D 10%
                )`
             }}
          ></div>
          
          {/* Plays Count Overlay */}
          <div className="absolute top-8 right-8 text-white/80 font-bold font-sans text-sm z-40">
             Plays: {chapter.plays}
          </div>

          {/* Progress Slider */}
          <div className="relative w-full h-2 bg-[#3E1F07] rounded-full mb-3 mt-6 z-40 group cursor-pointer">
              <div 
                className="absolute top-0 left-0 h-full bg-white rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 h-5 w-5 bg-black border-2 border-white rounded-full shadow-md"
                style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
              ></div>
          </div>
          
          {/* Time Labels */}
          <div className="flex justify-between text-xs font-bold text-white/70 mb-2 relative z-40">
              <span>0:00 / 1:30 Preview</span>
              {/* <span>{chapter.duration}</span> */}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-center gap-10 relative z-40">
               {/* Prev */}
               <button className="text-[#5c2e0b] hover:text-[#3e1f07] transition-colors transform active:scale-90">
                 <div className="w-0 h-0 border-t-[12px] border-t-transparent border-r-[20px] border-r-[#d4a373] border-b-[12px] border-b-transparent"></div>
               </button>

               {/* Play/Pause Button */}
               <button 
                 onClick={() => setIsPlaying(!isPlaying)}
                 className="w-16 h-16 bg-gradient-to-b from-[#deb887] to-[#b08d55] rounded-full border-[3px] border-[#5c2e0b] shadow-[0_4px_0_#3e1f07] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all"
               >
                 {isPlaying ? (
                   <Pause size={32} fill="#3e1f07" className="text-[#3e1f07]" />
                 ) : (
                   <Play size={32} fill="#3e1f07" className="text-[#3e1f07] ml-1" />
                 )}
               </button>

               {/* Next */}
               <button className="text-[#5c2e0b] hover:text-[#3e1f07] transition-colors transform active:scale-90">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-[#d4a373] border-b-[12px] border-b-transparent"></div>
               </button>
          </div>
      </div>

    </div>
  );
};

export default AudioPlayerPage;