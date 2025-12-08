import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Star, Sparkles } from 'lucide-react';

interface WelcomeOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const ONBOARDING_PAGES = [
  {
    icon: '📖',
    title: 'Stories & Adventures',
    subtitle: 'Explore Bible stories with beautiful illustrations and read-along audio!',
  },
  {
    icon: '🎮',
    title: 'Fun Games & Challenges',
    subtitle: 'Play memory games, daily challenges, and earn gold coins!',
  },
  {
    icon: '⭐',
    title: 'Learn & Grow',
    subtitle: 'Watch video lessons, complete activities, and grow in faith every day!',
  }
];

const WelcomeOnboardingModal: React.FC<WelcomeOnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentPage < ONBOARDING_PAGES.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      // Complete onboarding
      onComplete();
    }
  };

  const page = ONBOARDING_PAGES[currentPage];
  const isLastPage = currentPage === ONBOARDING_PAGES.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop - Panorama style background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 25%, #0f3460 50%, #1a1a2e 75%, #16213e 100%)',
        }}
      >
        {/* Subtle stars/sparkles */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            >
              <Sparkles 
                size={8 + Math.random() * 10} 
                className="text-[#FFD700]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-sm animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        
        {/* Welcome badge at top */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-[#CD853F] px-5 py-2 rounded-full shadow-lg border-4 border-[#8B4513]">
            <span className="text-sm font-display font-bold text-[#fff8e1] flex items-center gap-2 tracking-wide">
              <span className="text-lg">👋</span> Welcome!
            </span>
          </div>
        </div>

        {/* Card Content - Wood themed */}
        <div 
          className="relative rounded-3xl shadow-2xl overflow-hidden border-4 border-[#8B4513]"
          style={{
            background: 'linear-gradient(180deg, #CD853F 0%, #A0522D 100%)',
          }}
        >
          {/* Wood grain texture overlay */}
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                90deg,
                transparent,
                transparent 2px,
                rgba(62, 31, 7, 0.3) 2px,
                rgba(62, 31, 7, 0.3) 4px
              )`
            }}
          />
          
          {/* Header Section with Icon */}
          <div className="pt-14 pb-8 px-6 text-center relative">
            {/* Decorative corner nails */}
            <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-[#3E1F07] shadow-inner" />
            <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-[#3E1F07] shadow-inner" />
            
            {/* Icon in wood circle */}
            <div className="relative mb-6">
              <div 
                className="w-28 h-28 mx-auto rounded-full flex items-center justify-center shadow-xl border-4 border-[#FFD700]"
                style={{
                  background: 'linear-gradient(145deg, #8B4513, #5D3A1A)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1)'
                }}
              >
                <span className="text-6xl drop-shadow-lg">{page.icon}</span>
              </div>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-display font-extrabold text-[#fff8e1] drop-shadow-lg tracking-wide">
              {page.title}
            </h2>
          </div>

          {/* Body Section - Scroll/parchment style */}
          <div 
            className="mx-3 mb-3 px-6 pt-6 pb-8 rounded-2xl relative"
            style={{
              background: 'linear-gradient(180deg, #fff8e1 0%, #f5e6c8 100%)',
              boxShadow: 'inset 0 2px 8px rgba(139, 69, 19, 0.2)'
            }}
          >
            {/* Parchment texture lines */}
            <div 
              className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 24px,
                  rgba(139, 90, 43, 0.1) 24px,
                  rgba(139, 90, 43, 0.1) 25px
                )`
              }}
            />
            
            {/* Subtitle */}
            <p className="text-[#5c2e0b] text-center text-lg leading-relaxed mb-8 relative font-medium">
              {page.subtitle}
            </p>

            {/* Page Indicators - Gold coins style */}
            <div className="flex justify-center gap-3 mb-6">
              {ONBOARDING_PAGES.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentPage 
                      ? 'w-8 h-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] shadow-md'
                      : i < currentPage
                        ? 'w-3 h-3 bg-[#CD853F]'
                        : 'w-3 h-3 bg-[#d4c4a8]'
                  }`}
                  style={i === currentPage ? {
                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.5)'
                  } : {}}
                />
              ))}
            </div>

            {/* Action Button - Gold wood button */}
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-xl font-display font-bold text-lg text-[#5c2e0b] shadow-lg transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 border-b-4 border-[#B8860B]"
              style={{
                background: 'linear-gradient(180deg, #FFD700 0%, #FFA500 100%)',
                boxShadow: '0 4px 16px rgba(255, 165, 0, 0.4)'
              }}
            >
              {isLastPage ? (
                <>
                  <span>Let's Go!</span>
                  <Star className="w-5 h-5 fill-current" />
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-5 h-5" strokeWidth={3} />
                </>
              )}
            </button>

            {/* Skip option (only on non-last pages) */}
            {!isLastPage && (
              <button
                onClick={onComplete}
                className="w-full mt-4 py-2 text-[#8B4513] font-display font-medium text-sm hover:text-[#5c2e0b] transition-colors"
              >
                Skip intro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WelcomeOnboardingModal;
