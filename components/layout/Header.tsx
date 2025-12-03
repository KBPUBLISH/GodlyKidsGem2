
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Crown, Music, Hammer, Wrench } from 'lucide-react';
const ShopModal = lazy(() => import('../features/ShopModal'));
import AvatarDetailModal from '../features/AvatarDetailModal';
import { useUser } from '../../context/UserContext';
import ErrorBoundary from '../common/ErrorBoundary';
import { useAudio } from '../../context/AudioContext';
import { AVATAR_ASSETS } from '../avatar/AvatarAssets';

interface HeaderProps {
  isVisible: boolean;
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ isVisible, title = "GODLY KIDS" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { coins, equippedAvatar, equippedFrame, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs, isSubscribed, headOffset } = useUser();
  const { musicEnabled, toggleMusic, playClick } = useAudio();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Check if we're on book reader page - music should appear muted
  const isBookReader = location.pathname.startsWith('/read/');
  const displayMusicEnabled = isBookReader ? false : musicEnabled;

  // Restore background music when returning from book reader
  useEffect(() => {
    // Only restore if we're not on the book reader page
    const isBookReader = location.pathname.startsWith('/read/');
    if (isBookReader) return;

    // Check if music was enabled before entering book reader
    const wasMusicEnabled = localStorage.getItem('godly_kids_music_was_enabled') === 'true';

    // Restore music if it was enabled before entering book reader
    const restoreMusic = setTimeout(() => {
      if (wasMusicEnabled) {
        console.log('🎵 Header: Restoring background music - music was enabled before book reader');

        // First, ensure music is enabled in state
        if (!musicEnabled) {
          toggleMusic();
        }

        // Then programmatically click the music button to ensure audio context is unlocked and music plays
        setTimeout(() => {
          const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
          if (musicButton) {
            console.log('🎵 Header: Programmatically clicking music button to restore playback');
            musicButton.click();
          }
        }, 50);

        // Clear the flag
        localStorage.removeItem('godly_kids_music_was_enabled');
      } else if (musicEnabled) {
        // Double-check: if music is enabled but audio is paused, click button to resume
        const bgAudio = document.querySelector('audio[src*="Seaside_Adventure"]') as HTMLAudioElement;
        if (bgAudio && bgAudio.paused) {
          const musicButton = document.querySelector('button[title*="Music"]') as HTMLButtonElement;
          if (musicButton) {
            console.log('🎵 Header: Music enabled but paused - clicking button to resume');
            musicButton.click();
          }
        }
      }
    }, 200); // Reduced delay for faster restoration

    return () => clearTimeout(restoreMusic);
  }, [location.pathname, musicEnabled, toggleMusic]); // React to pathname changes

  // Check for openShop in navigation state
  useEffect(() => {
    if (location.state && (location.state as any).openShop) {
      setIsShopOpen(true);
      // Clear the state to prevent reopening on refresh/back
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 drop-shadow-2xl transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        {/* Main Plank Area */}
        <div className="relative bg-[#CD853F] px-4 pt-5 pb-3 shadow-sm border-t border-[#eecaa0]">
          {/* Wood Grain Texture Overlay */}
          <div className="absolute inset-0 opacity-25 pointer-events-none mix-blend-color-burn"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q 50 15 100 20 T 200 20' stroke='%238B4513' fill='none' opacity='0.5' stroke-width='2'/%3E%3Cpath d='M0 10 Q 80 5 160 10 T 320 10' stroke='%235C2E0B' fill='none' opacity='0.3'/%3E%3C/svg%3E")`,
              backgroundSize: '200px 40px'
            }}>
          </div>

          {/* Content */}
          <div className="flex justify-between items-center relative z-10 mb-1">
            {/* User Avatar - Head Only */}
            <div
              onClick={() => setIsDetailOpen(true)}
              className="relative group cursor-pointer active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 bg-[#f3e5ab] rounded-full border-[3px] ${equippedFrame} overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative z-0 flex items-center justify-center`}>
                {/* Head Only with Offset */}
                <div
                  className="w-full h-full flex items-center justify-center relative"
                  style={{
                    transform: `translate(${headOffset.x}%, ${headOffset.y}%)`
                  }}
                >
                  {(() => {
                    const isInternalHead = equippedAvatar && equippedAvatar.startsWith('head-');
                    const headAsset = isInternalHead ? AVATAR_ASSETS[equippedAvatar] : null;

                    return (
                      <>
                        {headAsset ? (
                          <div className="w-[90%] h-[90%] flex items-center justify-center">
                            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                              {headAsset}
                            </svg>
                          </div>
                        ) : (
                          <img src={equippedAvatar || ''} alt="Head" className="w-full h-full object-cover" />
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Subscription Status Crown */}
              <div className={`absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border z-20 ${isSubscribed ? 'border-[#FFD700]' : 'border-gray-200'}`}>
                <Crown
                  size={14}
                  className={isSubscribed ? "text-[#B8860B]" : "text-gray-400"}
                  fill={isSubscribed ? "#FFD700" : "#E5E7EB"}
                />
              </div>
            </div>

            {/* Center - Empty for now */}
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              {/* Music Toggle Button */}
              <button
                onClick={() => {
                  if (isBookReader) {
                    // Don't allow toggling music while in book reader
                    return;
                  }
                  playClick();
                  toggleMusic();
                }}
                className={`bg-black/30 hover:bg-black/40 rounded-full p-2 border transition-colors active:scale-95 ${displayMusicEnabled ? 'border-[#FFD700]/40' : 'border-white/20'
                  } ${isBookReader ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={isBookReader ? "Music paused - Book has its own background music" : (musicEnabled ? "Music On - Click to turn off" : "Music Off - Click to turn on")}
                disabled={isBookReader}
              >
                <Music
                  size={18}
                  className={displayMusicEnabled ? "text-[#FFD700]" : "text-white/50"}
                  fill={displayMusicEnabled ? "#FFD700" : "none"}
                />
              </button>

              {/* Shop Sign Button */}
              <button
                onClick={() => setIsShopOpen(true)}
                className="bg-[#8B4513] hover:bg-[#A0522D] px-3 py-1.5 rounded-lg border-2 border-[#5c2e0b] shadow-[0_4px_0_#3e1f07] active:translate-y-[2px] active:shadow-none transition-all relative group flex items-center justify-center"
              >
                {/* Wood Texture Overlay */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] pointer-events-none rounded-md"></div>

                {/* Nails */}
                <div className="absolute top-1 left-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute top-1 right-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute bottom-1 left-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>
                <div className="absolute bottom-1 right-1 w-1 h-1 bg-[#2d1809] rounded-full opacity-60"></div>

                <span className="text-[#FFD700] font-display font-black text-sm tracking-wide drop-shadow-md uppercase group-hover:text-white transition-colors relative z-10">
                  Shop
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Jagged Bottom Edge SVG */}
        <div className="relative w-full h-6 -mt-[1px]">
          <svg viewBox="0 0 600 25" preserveAspectRatio="none" className="w-full h-full text-[#CD853F] fill-current drop-shadow-lg">
            <path d="M0,0 L600,0 L600,8 C550,16 500,6 450,10 C350,16 250,4 150,12 C100,16 50,6 0,10 Z" />
            <path d="M0,10 C50,6 100,16 150,12 C250,4 350,16 450,10 C500,6 550,16 600,8" fill="none" stroke="#5C2E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          </svg>
        </div>
      </header>

      {isShopOpen && (
        <Suspense fallback={null}>
          <ShopModal isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
        </Suspense>
      )}
      <AvatarDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} onEdit={() => setIsShopOpen(true)} />
    </>
  );
};

export default Header;
