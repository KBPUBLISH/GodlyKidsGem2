import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';
import { ApiService } from '../services/apiService';
import { useUser } from '../context/UserContext';

import AvatarCompositor from '../components/avatar/AvatarCompositor';

const WARRIOR_ISLAND = '/assets/images/warrior-island.webp';
const ISLAND_BUTTON = '/assets/images/island-button.webp';
const VOLCANO_ISLAND = '/assets/images/volcano-island.webp';

interface GameItem {
  _id?: string;
  gameId: string;
  name: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  url?: string;
  gameType?: 'modal' | 'webview';
  enabled?: boolean;
  isPurchasable?: boolean;
  goldCoinPrice?: number;
  ageRating?: string;
}

const GamesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    coins, spendCoins,
    equippedAvatar, equippedHat, equippedBody, equippedLeftArm, equippedRightArm, equippedLegs,
    equippedAnimation, equippedFrame,
    equippedLeftArmRotation, equippedRightArmRotation, equippedLegsRotation, equippedHatRotation,
    leftArmOffset, rightArmOffset, legsOffset, headOffset, bodyOffset, hatOffset,
    leftArmScale, rightArmScale, legsScale, legsSpread, headScale, bodyScale, hatScale,
  } = useUser();

  const hasCompleteAvatar = !!(equippedBody && (equippedLeftArm || equippedRightArm) && equippedLegs);
  const [isParrotFlying, setIsParrotFlying] = useState(false);
  const [isZoomingIn, setIsZoomingIn] = useState(false);
  const [isErupting, setIsErupting] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [islandBlur, setIslandBlur] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const triggerEruption = useCallback(() => {
    if (isErupting) return;
    setIsErupting(true);
    setTimeout(() => setIsErupting(false), 4000);
  }, [isErupting]);

  const handleIslandClick = useCallback(() => {
    if (isZoomingIn) return;
    setIsZoomingIn(true);
    setTimeout(() => {
      setShowContent(true);
      setTimeout(() => setIsZoomingIn(false), 300);
    }, 950);
  }, [isZoomingIn]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const data = await ApiService.getEnabledGames();
        setGames(data);
      } catch (error) {
        console.error('Failed to fetch games:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (showContent) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [showContent]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const currentScrollY = scrollRef.current.scrollTop;
    const blurProgress = Math.min(currentScrollY / 120, 1);
    setIslandBlur(blurProgress);
    lastScrollY.current = currentScrollY;
  };

  const handleGameClick = (game: GameItem) => {
    if (game.url) {
      navigate(`/game?url=${encodeURIComponent(game.url)}&name=${encodeURIComponent(game.name)}`);
    } else {
      alert(`${game.name} is ready to play! Game content coming soon.`);
    }
  };

  // ─── Content view (after island zoom-in) ───
  if (showContent) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />

        {/* Back button */}
        <div className="relative flex items-center px-4 pt-3 pb-2" style={{ zIndex: 10, paddingTop: 'calc(var(--safe-area-top, 12px) + 8px)' }}>
          <button
            onClick={() => setShowContent(false)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors font-display text-sm active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        {/* Island + scrollable content wrapper */}
        <div className="relative flex-1 overflow-hidden">
          {/* Fixed island behind content */}
          <div className="absolute top-0 left-0 right-0 flex justify-center pt-8 pointer-events-none" style={{ zIndex: 4 }}>
            <img
              src={WARRIOR_ISLAND}
              alt="Game Warrior Island"
              className="w-[55vw] max-w-[240px] h-auto object-contain"
            />
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(${islandBlur * 8}px)`,
                WebkitBackdropFilter: `blur(${islandBlur * 8}px)`,
                backgroundColor: `rgba(0,0,0,${islandBlur * 0.15})`,
                opacity: islandBlur,
                transition: 'opacity 0.1s ease-out',
              }}
            />
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative h-full overflow-y-auto no-scrollbar pb-12"
            style={{ zIndex: 5 }}
          >
            {/* Spacer so island is visible initially */}
            <div style={{ height: '240px' }} />

            {/* Section header */}
            <div className="relative py-2 mb-4 mx-[-2px]">
              <div
                className="absolute inset-0 rounded-r-xl shadow-lg transform -skew-x-6 origin-bottom-left border-t-2 border-b-4"
                style={{
                  backgroundColor: '#8B4513',
                  backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(0,0,0,0.1) 50px, rgba(0,0,0,0.1) 53px), linear-gradient(to bottom, #8B5A2B, #654321)`,
                  borderColor: '#A0522D',
                  borderBottomColor: '#5c2e0b',
                }}
              />
              <h3 className="relative z-10 text-white font-display text-lg tracking-wide px-6 drop-shadow-md flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" /> Games
              </h3>
              <div className="absolute top-1/2 left-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
              <div className="absolute top-1/2 right-2 w-2 h-2 bg-[#4a3728] rounded-full shadow-inner -translate-y-1/2 opacity-80" />
            </div>

            {/* Game icons grid */}
            <div className="px-4">
              {loading ? (
                <div className="text-white font-display text-center mt-10">Loading games...</div>
              ) : games.length === 0 ? (
                <div className="text-white/80 font-display text-center mt-10 p-6 bg-black/20 rounded-xl backdrop-blur-sm">
                  No games available right now. Check back soon!
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  {games.map((game) => {
                    const displayImage = game.logo || game.coverImage;
                    return (
                      <button
                        key={game._id || game.gameId}
                        onClick={() => handleGameClick(game)}
                        className="flex flex-col items-center gap-2 group cursor-pointer select-none focus:outline-none"
                      >
                        <div className="relative w-full aspect-square rounded-[22%] overflow-hidden shadow-lg border-2 border-white/20 group-hover:border-white/50 group-hover:scale-105 group-active:scale-95 transition-all">
                          {displayImage ? (
                            <img
                              src={displayImage}
                              alt={game.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Gamepad2 className="w-10 h-10 text-white/50" />
                            </div>
                          )}

                          {/* Age badge */}
                          {game.ageRating && game.ageRating !== 'All Ages' && (
                            <div className="absolute top-1 left-1 bg-blue-500/90 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10">
                              {game.ageRating}
                            </div>
                          )}

                          
                        </div>

                        <span className="text-white text-[11px] font-display font-bold text-center leading-tight drop-shadow-md line-clamp-2 w-full">
                          {game.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer spacer */}
            <div className="h-20" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Island landing view ───
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">

      {/* Drifting sky clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }} aria-hidden>
        <div className="games-cloud games-cloud-1" style={{ position: 'absolute', top: '3%' }}>
          <svg width="160" viewBox="0 0 240 70" fill="none" style={{ opacity: 0.45 }}>
            <ellipse cx="40" cy="42" rx="36" ry="20" fill="white" /><ellipse cx="95" cy="32" rx="50" ry="28" fill="white" /><ellipse cx="155" cy="36" rx="44" ry="24" fill="white" /><ellipse cx="205" cy="44" rx="30" ry="18" fill="white" /><rect x="38" y="38" width="168" height="22" rx="11" fill="white" />
          </svg>
        </div>
        <div className="games-cloud games-cloud-2" style={{ position: 'absolute', top: '7%' }}>
          <svg width="110" viewBox="0 0 150 120" fill="none" style={{ opacity: 0.35 }}>
            <ellipse cx="75" cy="36" rx="34" ry="30" fill="white" /><ellipse cx="48" cy="62" rx="38" ry="26" fill="white" /><ellipse cx="105" cy="58" rx="36" ry="24" fill="white" /><ellipse cx="75" cy="78" rx="52" ry="22" fill="white" />
          </svg>
        </div>
        <div className="games-cloud games-cloud-3" style={{ position: 'absolute', top: '1%' }}>
          <svg width="80" viewBox="0 0 130 40" fill="none" style={{ opacity: 0.3 }}>
            <ellipse cx="30" cy="22" rx="26" ry="14" fill="white" /><ellipse cx="70" cy="18" rx="34" ry="16" fill="white" /><ellipse cx="105" cy="22" rx="22" ry="12" fill="white" />
          </svg>
        </div>
        <div className="games-cloud games-cloud-4" style={{ position: 'absolute', top: '11%' }}>
          <svg width="130" viewBox="0 0 190 80" fill="none" style={{ opacity: 0.4 }}>
            <ellipse cx="50" cy="50" rx="42" ry="22" fill="white" /><ellipse cx="110" cy="35" rx="55" ry="30" fill="white" /><ellipse cx="160" cy="48" rx="28" ry="20" fill="white" /><rect x="42" y="44" width="118" height="20" rx="10" fill="white" />
          </svg>
        </div>
        <div className="games-cloud games-cloud-5" style={{ position: 'absolute', top: '5%' }}>
          <svg width="55" viewBox="0 0 80 50" fill="none" style={{ opacity: 0.3 }}>
            <ellipse cx="40" cy="26" rx="30" ry="20" fill="white" /><ellipse cx="24" cy="32" rx="18" ry="12" fill="white" /><ellipse cx="56" cy="34" rx="16" ry="11" fill="white" />
          </svg>
        </div>
      </div>

      {/* Ocean wave animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }} aria-hidden>
        <svg className="absolute games-ocean-1" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '18%', height: '14%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.04)" d="M0,280L60,274C120,268,240,256,360,250C480,244,600,244,720,250C840,256,960,268,1080,274C1200,280,1320,280,1440,274C1440,274,1560,268,1680,256C1800,244,1920,244,2040,250C2160,256,2280,268,2400,274C2520,280,2640,280,2760,274L2880,268L2880,320L0,320Z" />
        </svg>
        <svg className="absolute games-ocean-2" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '28%', height: '16%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.04)" d="M0,290L48,284C96,278,192,266,288,260C384,254,480,254,576,260C672,266,768,278,864,284C960,290,1056,290,1152,284C1248,278,1344,266,1440,260C1440,260,1536,254,1632,260C1728,266,1824,278,1920,284C2016,290,2112,290,2208,284C2304,278,2400,266,2496,260C2592,254,2688,254,2784,260L2880,266L2880,320L0,320Z" />
        </svg>
        <svg className="absolute games-ocean-3" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '40%', height: '18%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.06)" d="M0,288L80,278C160,268,320,248,480,242C640,236,800,244,960,254C1120,264,1280,276,1440,278C1440,278,1600,268,1760,254C1920,240,2080,242,2240,252C2400,262,2560,278,2720,282L2880,286L2880,320L0,320Z" />
        </svg>
        <svg className="absolute games-ocean-4" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '55%', height: '20%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.06)" d="M0,282L60,272C120,262,240,242,360,236C480,230,600,238,720,250C840,262,960,278,1080,282C1200,286,1320,278,1440,268C1440,268,1560,258,1680,248C1800,238,1920,238,2040,248C2160,258,2280,278,2400,284C2520,290,2640,282,2760,272L2880,262L2880,320L0,320Z" />
        </svg>
        <svg className="absolute games-ocean-5" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '68%', height: '22%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.08)" d="M0,276L48,266C96,256,192,236,288,228C384,220,480,224,576,238C672,252,768,276,864,282C960,288,1056,276,1152,264C1248,252,1344,240,1440,238C1440,238,1536,246,1632,258C1728,270,1824,286,1920,290C2016,294,2112,286,2208,272C2304,258,2400,238,2496,232C2592,226,2688,234,2784,248L2880,262L2880,320L0,320Z" />
        </svg>
        <svg className="absolute games-ocean-6" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '80%', height: '20%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.05)" d="M0,290L40,284C80,278,160,266,240,258C320,250,400,246,480,250C560,254,640,266,720,274C800,282,880,286,960,284C1040,282,1120,274,1200,266C1280,258,1360,250,1440,250C1440,250,1520,258,1600,266C1680,274,1760,282,1840,286C1920,290,2000,290,2080,284C2160,278,2240,266,2320,258C2400,250,2480,246,2560,250C2640,254,2720,266,2800,274L2880,282L2880,320L0,320Z" />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{ background: 'linear-gradient(to top, rgba(0,40,80,0.10), transparent)' }} />
      </div>

      {/* Flying avatar above island */}
      {hasCompleteAvatar && (
        <div
          className={`absolute ${isParrotFlying ? 'games-avatar-flying' : 'games-avatar-perched'}`}
          style={{ zIndex: 4, top: '30%', left: '50%', cursor: 'pointer' }}
          onClick={() => {
            if (!isParrotFlying) {
              setIsParrotFlying(true);
            }
          }}
          onAnimationEnd={() => {
            if (isParrotFlying) {
              setIsParrotFlying(false);
            }
          }}
        >
          <style>{`
            .games-avatar-perched { transform: translateX(-50%) translateY(0); }
            .games-avatar-perched [class*="animate-arm-sway-left"] { animation: gamesPerchFlapLeft 2s ease-in-out infinite !important; transform-origin: right center !important; }
            .games-avatar-perched [class*="animate-arm-sway-right"] { animation: gamesPerchFlapRight 2s ease-in-out infinite !important; transform-origin: left center !important; }
            @keyframes gamesPerchFlapLeft {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(12deg); }
            }
            @keyframes gamesPerchFlapRight {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(-12deg); }
            }

            .games-avatar-flying .animate-arm-sway-left,
            .games-avatar-flying .animate-arm-sway-right { animation: none !important; }
            .games-avatar-flying [class*="animate-arm-sway-left"] { animation: gamesFlapLeft 0.5s ease-in-out infinite !important; transform-origin: right center !important; }
            .games-avatar-flying [class*="animate-arm-sway-right"] { animation: gamesFlapRight 0.5s ease-in-out infinite !important; transform-origin: left center !important; }
            @keyframes gamesFlapLeft {
              0%, 100% { transform: rotate(-10deg); }
              50% { transform: rotate(50deg); }
            }
            @keyframes gamesFlapRight {
              0%, 100% { transform: rotate(10deg); }
              50% { transform: rotate(-50deg); }
            }
          `}</style>
          <div className="w-10 h-10">
            <AvatarCompositor
              headUrl={equippedAvatar}
              hat={equippedHat}
              body={equippedBody}
              leftArm={equippedLeftArm}
              rightArm={equippedRightArm}
              legs={equippedLegs}
              animationStyle={equippedAnimation}
              leftArmRotation={equippedLeftArmRotation}
              rightArmRotation={equippedRightArmRotation}
              legsRotation={equippedLegsRotation}
              hatRotation={equippedHatRotation}
              leftArmOffset={leftArmOffset}
              rightArmOffset={rightArmOffset}
              legsOffset={legsOffset}
              headOffset={headOffset}
              bodyOffset={bodyOffset}
              hatOffset={hatOffset}
              leftArmScale={leftArmScale}
              rightArmScale={rightArmScale}
              legsScale={legsScale}
              legsSpread={legsSpread}
              headScale={headScale}
              bodyScale={bodyScale}
              hatScale={hatScale}
              isAnimating
              frameClass={equippedFrame}
            />
          </div>
        </div>
      )}

      {/* Volcano island — right side */}
      <div className="absolute overflow-visible transition-opacity duration-300" style={{ zIndex: 5, right: '-2%', top: '16%', width: '34vw', maxWidth: 170, opacity: isZoomingIn ? 0 : 1 }}>
        <div className="absolute pointer-events-none" style={{ zIndex: 0, inset: '-10% -10%', bottom: '-6%' }}>
          <div className="volcano-wave-1" style={{
            position: 'absolute', left: '0', right: '0', bottom: '4%', height: '44%',
            borderRadius: '50%',
            border: '2.5px solid rgba(180,230,255,0.3)',
            boxShadow: '0 0 8px 3px rgba(140,210,255,0.15)',
          }} />
          <div className="volcano-wave-2" style={{
            position: 'absolute', left: '-5%', right: '-5%', bottom: '0%', height: '48%',
            borderRadius: '50%',
            border: '2px solid rgba(180,230,255,0.2)',
            boxShadow: '0 0 10px 4px rgba(140,210,255,0.1)',
          }} />
        </div>
        <button
          type="button"
          onClick={triggerEruption}
          className="relative w-full cursor-pointer select-none transition-transform active:scale-95 hover:scale-[1.02] focus:outline-none"
          style={{ zIndex: 1 }}
          aria-label="Tap the Volcano"
        >
          <img
            src={VOLCANO_ISLAND}
            alt="Volcano Island"
            className="w-full h-auto object-contain"
          />
        </button>

        {!isErupting && (
          <div className="absolute pointer-events-none" style={{ zIndex: 20, left: '20%', top: '-5%', width: '60%', height: '100%' }}>
            <div className="idle-smoke-1" style={{ position: 'absolute', left: '8%', top: '0%', width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(220,220,220,0.5) 40%, transparent 70%)', filter: 'blur(3px)' }} />
            <div className="idle-smoke-2" style={{ position: 'absolute', left: '35%', top: '3%', width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(210,210,210,0.45) 40%, transparent 70%)', filter: 'blur(2.5px)' }} />
            <div className="idle-smoke-3" style={{ position: 'absolute', left: '55%', top: '-2%', width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.4) 40%, transparent 70%)', filter: 'blur(3px)' }} />
            <div className="idle-smoke-1" style={{ position: 'absolute', left: '25%', top: '5%', width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(220,220,220,0.35) 40%, transparent 70%)', filter: 'blur(2px)', animationDelay: '-3s' }} />
          </div>
        )}

        {isErupting && (
          <div className="absolute pointer-events-none overflow-visible" style={{ zIndex: 10, inset: '-150% -50% -20% -50%' }}>
            <div className="volcano-smoke-1" style={{ position: 'absolute', left: '40%', bottom: '25%', width: '30%', height: '20%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,120,120,0.85) 0%, rgba(80,80,80,0.5) 50%, transparent 70%)' }} />
            <div className="volcano-smoke-2" style={{ position: 'absolute', left: '32%', bottom: '25%', width: '25%', height: '18%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,100,100,0.7) 0%, rgba(70,70,70,0.4) 50%, transparent 70%)' }} />
            <div className="volcano-smoke-3" style={{ position: 'absolute', left: '48%', bottom: '25%', width: '22%', height: '16%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,90,90,0.65) 0%, rgba(60,60,60,0.35) 50%, transparent 70%)' }} />
            <div className="volcano-smoke-4" style={{ position: 'absolute', left: '36%', bottom: '25%', width: '35%', height: '22%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,110,110,0.6) 0%, rgba(85,85,85,0.3) 50%, transparent 70%)' }} />
            <div className="volcano-smoke-5" style={{ position: 'absolute', left: '42%', bottom: '25%', width: '20%', height: '14%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,80,80,0.5) 0%, rgba(60,60,60,0.25) 50%, transparent 70%)' }} />

            <div className="volcano-lava-1" style={{ position: 'absolute', left: '44%', bottom: '28%', width: 6, height: 14, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffcc00, #ff4500)', boxShadow: '0 0 10px 4px rgba(255,69,0,0.7), 0 0 20px 8px rgba(255,100,0,0.3)', filter: 'blur(0.5px)' }} />
            <div className="volcano-lava-2" style={{ position: 'absolute', left: '52%', bottom: '28%', width: 5, height: 11, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffe066, #ff6600)', boxShadow: '0 0 8px 3px rgba(255,102,0,0.7), 0 0 16px 6px rgba(255,140,0,0.25)', filter: 'blur(0.5px)' }} />
            <div className="volcano-lava-3" style={{ position: 'absolute', left: '40%', bottom: '28%', width: 5, height: 13, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffbb33, #ff3300)', boxShadow: '0 0 9px 3px rgba(255,51,0,0.7), 0 0 18px 6px rgba(255,80,0,0.3)', filter: 'blur(0.5px)' }} />
            <div className="volcano-lava-4" style={{ position: 'absolute', left: '56%', bottom: '28%', width: 4, height: 9, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffdd44, #ff8800)', boxShadow: '0 0 7px 2px rgba(255,136,0,0.6)', filter: 'blur(0.5px)' }} />
            <div className="volcano-lava-5" style={{ position: 'absolute', left: '48%', bottom: '28%', width: 7, height: 16, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffee55, #ff2200)', boxShadow: '0 0 12px 5px rgba(255,34,0,0.7), 0 0 24px 8px rgba(255,68,0,0.3)', filter: 'blur(0.5px)' }} />
            <div className="volcano-lava-6" style={{ position: 'absolute', left: '37%', bottom: '28%', width: 4, height: 10, borderRadius: '40% 40% 50% 50%', background: 'linear-gradient(to bottom, #ffcc66, #ff5500)', boxShadow: '0 0 6px 2px rgba(255,85,0,0.6)', filter: 'blur(0.5px)' }} />

            <div className="volcano-glow" style={{ position: 'absolute', left: '30%', bottom: '22%', width: '50%', height: '18%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,100,0,0.6) 0%, rgba(255,60,0,0.3) 40%, transparent 70%)', filter: 'blur(6px)' }} />
            <div className="lava-body-glow" style={{ position: 'absolute', left: '25%', bottom: '4%', width: '55%', height: '24%', borderRadius: '40%', background: 'radial-gradient(ellipse at center top, rgba(255,80,0,0.25) 0%, rgba(255,40,0,0.1) 50%, transparent 80%)', filter: 'blur(8px)' }} />
          </div>
        )}
      </div>

      {/* Warrior Island — centered, nudged up */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ zIndex: 3, marginTop: '-8%' }}>
        <div
          className={`relative ${isZoomingIn ? 'games-island-zoom-in' : ''}`}
          style={{ width: 'min(260px, 68vw)', maxWidth: 280, transformOrigin: 'center 40%', willChange: 'transform, opacity' }}
        >
          {/* Pulse rings */}
          <div className="absolute pointer-events-none" style={{ zIndex: 1, inset: '-4% -4%', bottom: '0%' }}>
            <div className="games-pulse-1" style={{
              position: 'absolute', left: '5%', right: '5%', bottom: '10%', height: '38%',
              borderRadius: '50%',
              border: '3px solid rgba(180,230,255,0.25)',
              boxShadow: '0 0 12px 4px rgba(180,230,255,0.15), inset 0 0 10px 2px rgba(180,230,255,0.08)',
            }} />
            <div className="games-pulse-2" style={{
              position: 'absolute', left: '1%', right: '1%', bottom: '6%', height: '42%',
              borderRadius: '50%',
              border: '2px solid rgba(180,230,255,0.15)',
              boxShadow: '0 0 18px 6px rgba(180,230,255,0.1)',
            }} />
          </div>
          <button
            type="button"
            onClick={handleIslandClick}
            className="relative w-full cursor-pointer select-none focus:outline-none"
            style={{ zIndex: 2, background: 'transparent' }}
            aria-label="Warrior Island"
          >
            <img
              src={WARRIOR_ISLAND}
              alt="Warrior Island"
              className="w-full h-auto"
              draggable={false}
            />
          </button>
        </div>

        {/* Island label button */}
        <button
          type="button"
          onClick={handleIslandClick}
          className="relative cursor-pointer select-none focus:outline-none overflow-hidden rounded-2xl"
          style={{ width: 'min(194px, 53vw)', maxWidth: 223, marginTop: -20 }}
          aria-label="Game Warrior Island"
        >
          <img src={ISLAND_BUTTON} alt="" className="w-full h-auto rounded-xl" draggable={false} />
          <span
            className="absolute inset-0 flex flex-col items-center justify-center font-extrabold text-white leading-tight"
            style={{
              fontSize: 'clamp(16px, 4.8vw, 24px)',
              textShadow: '0 2px 5px rgba(0,0,0,0.6)',
              letterSpacing: '0.5px',
            }}
          >
            <span>Game Warrior</span>
            <span>Island</span>
          </span>
        </button>
      </div>

      <style>{`
        .volcano-wave-1 {
          animation: volcano-wave-shrink 3.5s ease-in-out infinite;
          transform-origin: center 70%;
        }
        .volcano-wave-2 {
          animation: volcano-wave-shrink 4.5s ease-in-out infinite;
          animation-delay: -1.5s;
          transform-origin: center 70%;
        }
        @keyframes volcano-wave-shrink {
          0%   { transform: scale(1.15); opacity: 0; }
          20%  { opacity: 0.7; }
          60%  { opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .idle-smoke-1 { animation: idle-wisp 4s ease-in-out infinite; }
        .idle-smoke-2 { animation: idle-wisp 5s ease-in-out infinite; animation-delay: -1.5s; }
        .idle-smoke-3 { animation: idle-wisp 6s ease-in-out infinite; animation-delay: -3s; }
        @keyframes idle-wisp {
          0%   { transform: translateY(0) scale(0.8); opacity: 0; }
          10%  { opacity: 0.8; transform: translateY(-6px) scale(1); }
          30%  { opacity: 0.6; transform: translateY(-22px) scale(1.3); }
          60%  { opacity: 0.3; transform: translateY(-45px) scale(1.7); }
          100% { opacity: 0; transform: translateY(-70px) scale(2.2); }
        }
        .volcano-smoke-1 { animation: smoke-rise 3s ease-out forwards; }
        .volcano-smoke-2 { animation: smoke-rise 3s ease-out 0.15s forwards; }
        .volcano-smoke-3 { animation: smoke-rise 3s ease-out 0.3s forwards; }
        .volcano-smoke-4 { animation: smoke-rise 2.8s ease-out 0.5s forwards; }
        .volcano-smoke-5 { animation: smoke-rise 3.2s ease-out 0.7s forwards; }
        @keyframes smoke-rise {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          15%  { opacity: 0.9; transform: translateY(-40px) scale(1.2); }
          40%  { opacity: 0.7; transform: translateY(-100px) scale(1.8); }
          70%  { opacity: 0.35; transform: translateY(-170px) scale(2.5); }
          100% { opacity: 0; transform: translateY(-250px) scale(3.2); }
        }
        .volcano-lava-1 { animation: lava-blob 2s ease-out forwards; --lava-x: -18px; --lava-peak: -110px; }
        .volcano-lava-2 { animation: lava-blob 1.7s ease-out 0.12s forwards; --lava-x: 12px; --lava-peak: -90px; }
        .volcano-lava-3 { animation: lava-blob 2.2s ease-out 0.22s forwards; --lava-x: -28px; --lava-peak: -130px; }
        .volcano-lava-4 { animation: lava-blob 1.5s ease-out 0.38s forwards; --lava-x: 22px; --lava-peak: -70px; }
        .volcano-lava-5 { animation: lava-blob 1.9s ease-out 0.06s forwards; --lava-x: -6px; --lava-peak: -120px; }
        .volcano-lava-6 { animation: lava-blob 1.8s ease-out 0.28s forwards; --lava-x: 16px; --lava-peak: -100px; }
        @keyframes lava-blob {
          0%   { transform: translate(0, 0) scaleY(1) scaleX(1) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; transform: translate(calc(var(--lava-x) * 0.15), calc(var(--lava-peak) * 0.4)) scaleY(1.6) scaleX(0.7) rotate(-5deg); }
          30%  { opacity: 1; transform: translate(calc(var(--lava-x) * 0.5), var(--lava-peak)) scaleY(1.3) scaleX(0.8) rotate(8deg); }
          55%  { opacity: 0.85; transform: translate(calc(var(--lava-x) * 0.8), calc(var(--lava-peak) * 0.4)) scaleY(0.9) scaleX(1.1) rotate(-3deg); }
          80%  { opacity: 0.4; transform: translate(var(--lava-x), calc(var(--lava-peak) * -0.1)) scaleY(1.4) scaleX(0.6) rotate(12deg); }
          100% { opacity: 0; transform: translate(calc(var(--lava-x) * 1.1), 30px) scaleY(1.8) scaleX(0.4) rotate(15deg); }
        }
        .volcano-glow { animation: glow-pulse 0.8s ease-in-out 3 forwards; }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.3); }
        }
        .lava-body-glow { animation: body-glow 3s ease-in-out forwards; opacity: 0; }
        @keyframes body-glow {
          0%   { opacity: 0; }
          20%  { opacity: 0.8; }
          60%  { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .games-cloud { left: -200px; }
        .games-cloud-1 { animation: games-cloud-flow 80s linear infinite; }
        .games-cloud-2 { animation: games-cloud-flow 65s linear infinite; animation-delay: -20s; }
        .games-cloud-3 { animation: games-cloud-flow 100s linear infinite; animation-delay: -55s; }
        .games-cloud-4 { animation: games-cloud-flow 70s linear infinite; animation-delay: -38s; }
        .games-cloud-5 { animation: games-cloud-flow 90s linear infinite; animation-delay: -65s; }
        @keyframes games-cloud-flow {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(100vw + 400px)); }
        }

        .games-ocean-1 { animation: games-ocean-scroll 28s linear infinite; }
        .games-ocean-2 { animation: games-ocean-scroll 22s linear infinite; animation-delay: -8s; }
        .games-ocean-3 { animation: games-ocean-scroll 18s linear infinite; animation-delay: -4s; }
        .games-ocean-4 { animation: games-ocean-scroll 15s linear infinite; animation-delay: -10s; }
        .games-ocean-5 { animation: games-ocean-scroll 12s linear infinite; animation-delay: -3s; }
        .games-ocean-6 { animation: games-ocean-scroll 9s linear infinite; animation-delay: -6s; }
        @keyframes games-ocean-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .games-pulse-1 { animation: games-pulse-shrink 3.5s ease-in-out infinite; transform-origin: center 70%; }
        .games-pulse-2 { animation: games-pulse-shrink 4.5s ease-in-out infinite; animation-delay: -1.2s; transform-origin: center 70%; }
        @keyframes games-pulse-shrink {
          0%   { transform: scale(1.15); opacity: 0; }
          20%  { opacity: 0.7; }
          60%  { opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0; }
        }

        .games-avatar-perched {
          transform: translateX(-50%) translateY(0);
          transition: transform 0.3s ease-out;
        }
        .games-avatar-flying {
          animation: games-avatar-flight 6s ease-in-out forwards;
        }
        @keyframes games-avatar-flight {
          0%   { transform: translate(-50%, 0); }
          10%  { transform: translate(-50%, -60px); }
          25%  { transform: translate(30px, -100px); }
          40%  { transform: translate(70px, -50px); }
          55%  { transform: translate(-10px, -90px); }
          70%  { transform: translate(-70px, -50px); }
          85%  { transform: translate(-30px, -25px); }
          100% { transform: translate(-50%, 0); }
        }

        .games-island-zoom-in {
          animation: games-island-zoom 1s ease-in forwards;
          will-change: transform, opacity;
        }
        @keyframes games-island-zoom {
          0%   { transform: scale(1); opacity: 1; }
          12%  { transform: scale(1.08); opacity: 1; }
          24%  { transform: scale(0.97); opacity: 1; }
          36%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(7); opacity: 0; }
        }
        .games-island-flash {
          animation: games-flash-white 1s ease-in forwards;
          will-change: background;
        }
        @keyframes games-flash-white {
          0%   { background: rgba(255,255,255,0); }
          60%  { background: rgba(255,255,255,0); }
          85%  { background: rgba(255,255,255,0.5); }
          100% { background: rgba(255,255,255,1); }
        }
      `}</style>

      {/* Zoom-in white flash overlay */}
      {isZoomingIn && (
        <div className="fixed inset-0 games-island-flash pointer-events-none" style={{ zIndex: 999 }} />
      )}
    </div>
  );
};

export default GamesPage;
