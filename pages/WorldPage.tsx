import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/layout/Header';
import ChallengeGameModal from '../components/features/ChallengeGameModal';
import { activityTrackingService } from '../services/activityTrackingService';

const DailyVerseModal = lazy(() => import('../components/modals/DailyVerseModal'));

const DAILY_ADVENTURE_ISLAND = '/assets/images/daily-adventure-island.webp';
const ISLAND_BUTTON = '/assets/images/island-button.webp';

const ISLAND_WIDTH = 240;   /* ~10% larger than before */
const ISLAND_MAX_WIDTH = 273;

const FIREFLIES = [
  { x: 20, y: 70, drift: -20, dur: 3.8, delay: 0, size: 8 },
  { x: 75, y: 65, drift: 15, dur: 4.2, delay: 0.6, size: 10 },
  { x: 35, y: 80, drift: -12, dur: 3.5, delay: 1.2, size: 7 },
  { x: 60, y: 75, drift: 18, dur: 4.6, delay: 0.3, size: 9 },
  { x: 10, y: 55, drift: 10, dur: 3.2, delay: 2.0, size: 6 },
  { x: 85, y: 60, drift: -16, dur: 4.0, delay: 1.5, size: 8 },
  { x: 50, y: 85, drift: -8, dur: 3.6, delay: 0.9, size: 11 },
  { x: 30, y: 50, drift: 14, dur: 4.4, delay: 2.5, size: 7 },
  { x: 68, y: 78, drift: -22, dur: 3.9, delay: 1.8, size: 9 },
  { x: 45, y: 60, drift: 10, dur: 4.1, delay: 0.4, size: 6 },
  { x: 15, y: 72, drift: 20, dur: 3.4, delay: 3.0, size: 8 },
  { x: 80, y: 50, drift: -14, dur: 4.8, delay: 2.2, size: 7 },
  { x: 55, y: 68, drift: 12, dur: 3.7, delay: 1.0, size: 10 },
  { x: 40, y: 45, drift: -18, dur: 4.3, delay: 3.5, size: 6 },
];

/**
 * Persistent island layer rendered in Layout — never unmounts.
 * Visibility toggled by route so the island stays locked in place.
 */
const WELCOME_VIDEO_KEY = 'godlykids_welcome_shown';

export const PersistentWorldIsland: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isVisible = location.pathname === '/world' || location.pathname === '/home';
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [showChallengeGame, setShowChallengeGame] = useState(false);
  const [isZoomingIn, setIsZoomingIn] = useState(false);

  // Welcome video - plays once per app session when first visiting Explore; hide header until done
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);

  const handleWelcomeVideoEnd = useCallback(() => {
    sessionStorage.setItem(WELCOME_VIDEO_KEY, 'true');
    setShowWelcomeVideo(false);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return;
    if (sessionStorage.getItem(WELCOME_VIDEO_KEY)) return;
    setShowWelcomeVideo(true);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !showWelcomeVideo) return;
    const video = welcomeVideoRef.current;
    if (!video) return;
    video.play().catch(() => handleWelcomeVideoEnd());
  }, [isVisible, showWelcomeVideo, handleWelcomeVideoEnd]);

  useEffect(() => {
    if (showVerseModal || showChallengeGame) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [showVerseModal, showChallengeGame]);

  const handleIslandClick = useCallback(() => {
    if (isZoomingIn) return;
    setIsZoomingIn(true);
    setTimeout(() => {
      navigate('/daily-session');
      setTimeout(() => setIsZoomingIn(false), 300);
    }, 950);
  }, [isZoomingIn, navigate]);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        zIndex: 5,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 0.15s ease-out',
      }}
    >
      <Header isVisible={isVisible && !showWelcomeVideo} title="EXPLORE" />

      {/* Welcome video - full-screen, plays once per session; header hidden until done */}
      {showWelcomeVideo && isVisible && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-start pt-[6%] z-[100]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          <div className="relative aspect-[9/16] w-32 sm:w-[154px] md:w-[179px] max-w-[192px] rounded-xl overflow-hidden">
            <video
              ref={welcomeVideoRef}
              src="/assets/videos/welcome.mp4"
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
              onEnded={handleWelcomeVideoEnd}
              onError={handleWelcomeVideoEnd}
            />
          </div>
          <p className="mt-4 text-white font-display font-bold text-lg text-center px-4">
            Hi Explorer! Let&apos;s Dive in. 🌊
          </p>
          <button
            type="button"
            onClick={handleWelcomeVideoEnd}
            className="mt-2 text-white/70 text-sm underline"
          >
            Skip
          </button>
        </div>
      )}

      {/* Drifting sky clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        <div className="world-cloud world-cloud-1" style={{ position: 'absolute', top: '3%', left: '-12%' }}>
          <svg width="140" viewBox="0 0 200 90" fill="none" style={{ opacity: 0.18 }}>
            <ellipse cx="70" cy="55" rx="50" ry="28" fill="white" />
            <ellipse cx="110" cy="45" rx="60" ry="36" fill="white" />
            <ellipse cx="155" cy="58" rx="40" ry="24" fill="white" />
            <rect x="50" y="48" width="105" height="30" rx="14" fill="white" />
          </svg>
        </div>
        <div className="world-cloud world-cloud-2" style={{ position: 'absolute', top: '8%', right: '-8%' }}>
          <svg width="110" viewBox="0 0 200 90" fill="none" style={{ opacity: 0.13 }}>
            <ellipse cx="60" cy="52" rx="45" ry="26" fill="white" />
            <ellipse cx="105" cy="42" rx="55" ry="34" fill="white" />
            <ellipse cx="150" cy="55" rx="38" ry="22" fill="white" />
            <rect x="45" y="46" width="110" height="28" rx="12" fill="white" />
          </svg>
        </div>
        <div className="world-cloud world-cloud-3" style={{ position: 'absolute', top: '1%', left: '25%' }}>
          <svg width="90" viewBox="0 0 200 90" fill="none" style={{ opacity: 0.1 }}>
            <ellipse cx="65" cy="50" rx="42" ry="24" fill="white" />
            <ellipse cx="110" cy="40" rx="52" ry="30" fill="white" />
            <ellipse cx="150" cy="52" rx="36" ry="20" fill="white" />
            <rect x="48" y="44" width="100" height="26" rx="12" fill="white" />
          </svg>
        </div>
        <div className="world-cloud world-cloud-4" style={{ position: 'absolute', top: '12%', left: '55%' }}>
          <svg width="120" viewBox="0 0 200 90" fill="none" style={{ opacity: 0.14 }}>
            <ellipse cx="75" cy="54" rx="48" ry="27" fill="white" />
            <ellipse cx="115" cy="44" rx="58" ry="35" fill="white" />
            <ellipse cx="160" cy="56" rx="35" ry="22" fill="white" />
            <rect x="52" y="47" width="108" height="28" rx="13" fill="white" />
          </svg>
        </div>
      </div>

      {/* Drifting sky clouds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        <div className="sky-cloud sky-cloud-1" style={{ position: 'absolute', top: '3%' }}>
          <svg width="160" viewBox="0 0 240 70" fill="none" style={{ opacity: 0.18 }}>
            <ellipse cx="40" cy="42" rx="36" ry="20" fill="white" /><ellipse cx="95" cy="32" rx="50" ry="28" fill="white" /><ellipse cx="155" cy="36" rx="44" ry="24" fill="white" /><ellipse cx="205" cy="44" rx="30" ry="18" fill="white" /><rect x="38" y="38" width="168" height="22" rx="11" fill="white" />
          </svg>
        </div>
        <div className="sky-cloud sky-cloud-2" style={{ position: 'absolute', top: '7%' }}>
          <svg width="110" viewBox="0 0 150 120" fill="none" style={{ opacity: 0.14 }}>
            <ellipse cx="75" cy="36" rx="34" ry="30" fill="white" /><ellipse cx="48" cy="62" rx="38" ry="26" fill="white" /><ellipse cx="105" cy="58" rx="36" ry="24" fill="white" /><ellipse cx="75" cy="78" rx="52" ry="22" fill="white" />
          </svg>
        </div>
        <div className="sky-cloud sky-cloud-3" style={{ position: 'absolute', top: '1%' }}>
          <svg width="80" viewBox="0 0 130 40" fill="none" style={{ opacity: 0.10 }}>
            <ellipse cx="30" cy="22" rx="26" ry="14" fill="white" /><ellipse cx="70" cy="18" rx="34" ry="16" fill="white" /><ellipse cx="105" cy="22" rx="22" ry="12" fill="white" />
          </svg>
        </div>
        <div className="sky-cloud sky-cloud-4" style={{ position: 'absolute', top: '11%' }}>
          <svg width="130" viewBox="0 0 190 80" fill="none" style={{ opacity: 0.15 }}>
            <ellipse cx="50" cy="50" rx="42" ry="22" fill="white" /><ellipse cx="110" cy="35" rx="55" ry="30" fill="white" /><ellipse cx="160" cy="48" rx="28" ry="20" fill="white" /><rect x="42" y="44" width="118" height="20" rx="10" fill="white" />
          </svg>
        </div>
        <div className="sky-cloud sky-cloud-5" style={{ position: 'absolute', top: '5%' }}>
          <svg width="55" viewBox="0 0 80 50" fill="none" style={{ opacity: 0.12 }}>
            <ellipse cx="40" cy="26" rx="30" ry="20" fill="white" /><ellipse cx="24" cy="32" rx="18" ry="12" fill="white" /><ellipse cx="56" cy="34" rx="16" ry="11" fill="white" />
          </svg>
        </div>
      </div>

      {/* Full-screen continuous ocean waves — all flow in one direction */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }} aria-hidden>
        {/* Wave 1 — top area, very subtle distant swell */}
        <svg className="absolute ocean-flow-1" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '18%', height: '14%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.04)" d="M0,280L60,274C120,268,240,256,360,250C480,244,600,244,720,250C840,256,960,268,1080,274C1200,280,1320,280,1440,274C1440,274,1560,268,1680,256C1800,244,1920,244,2040,250C2160,256,2280,268,2400,274C2520,280,2640,280,2760,274L2880,268L2880,320L0,320Z" />
        </svg>
        {/* Wave 2 — upper-mid, light teal tint */}
        <svg className="absolute ocean-flow-2" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '28%', height: '16%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.04)" d="M0,290L48,284C96,278,192,266,288,260C384,254,480,254,576,260C672,266,768,278,864,284C960,290,1056,290,1152,284C1248,278,1344,266,1440,260C1440,260,1536,254,1632,260C1728,266,1824,278,1920,284C2016,290,2112,290,2208,284C2304,278,2400,266,2496,260C2592,254,2688,254,2784,260L2880,266L2880,320L0,320Z" />
        </svg>
        {/* Wave 3 — mid area, white shimmer */}
        <svg className="absolute ocean-flow-3" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '40%', height: '18%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.06)" d="M0,288L80,278C160,268,320,248,480,242C640,236,800,244,960,254C1120,264,1280,276,1440,278C1440,278,1600,268,1760,254C1920,240,2080,242,2240,252C2400,262,2560,278,2720,282L2880,286L2880,320L0,320Z" />
        </svg>
        {/* Wave 4 — lower-mid, stronger teal */}
        <svg className="absolute ocean-flow-4" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '55%', height: '20%', width: '200%' }}>
          <path fill="rgba(0,180,220,0.06)" d="M0,282L60,272C120,262,240,242,360,236C480,230,600,238,720,250C840,262,960,278,1080,282C1200,286,1320,278,1440,268C1440,268,1560,258,1680,248C1800,238,1920,238,2040,248C2160,258,2280,278,2400,284C2520,290,2640,282,2760,272L2880,262L2880,320L0,320Z" />
        </svg>
        {/* Wave 5 — lower, white crest highlights */}
        <svg className="absolute ocean-flow-5" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '68%', height: '22%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.08)" d="M0,276L48,266C96,256,192,236,288,228C384,220,480,224,576,238C672,252,768,276,864,282C960,288,1056,276,1152,264C1248,252,1344,240,1440,238C1440,238,1536,246,1632,258C1728,270,1824,286,1920,290C2016,294,2112,286,2208,272C2304,258,2400,238,2496,232C2592,226,2688,234,2784,248L2880,262L2880,320L0,320Z" />
        </svg>
        {/* Wave 6 — near bottom, subtle fast ripple */}
        <svg className="absolute ocean-flow-6" viewBox="0 0 2880 320" preserveAspectRatio="none" style={{ top: '80%', height: '20%', width: '200%' }}>
          <path fill="rgba(255,255,255,0.05)" d="M0,290L40,284C80,278,160,266,240,258C320,250,400,246,480,250C560,254,640,266,720,274C800,282,880,286,960,284C1040,282,1120,274,1200,266C1280,258,1360,250,1440,250C1440,250,1520,258,1600,266C1680,274,1760,282,1840,286C1920,290,2000,290,2080,284C2160,278,2240,266,2320,258C2400,250,2480,246,2560,250C2640,254,2720,266,2800,274L2880,282L2880,320L0,320Z" />
        </svg>
        {/* Ambient depth gradient at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[25%]" style={{ background: 'linear-gradient(to top, rgba(0,40,80,0.10), transparent)' }} />
      </div>

      {/* Daily Chest raft — clickable, drifting, with angled wake */}
      <div className="absolute raft-drift transition-opacity duration-300" style={{ zIndex: 12, left: '3%', top: '26%', width: '26vw', maxWidth: 150, opacity: isZoomingIn ? 0 : 1 }}>
        {/* Label button above the raft */}
        <button
          type="button"
          onClick={() => {
            activityTrackingService.trackGamePlayed('memory_challenge', 'Memory Bible Challenge');
            setShowChallengeGame(true);
          }}
          className="absolute left-1/2 -translate-x-1/2 cursor-pointer select-none focus:outline-none"
          style={{ top: '-24px', width: '75%', zIndex: 2 }}
          aria-label="Open Memory Bible Challenge"
        >
          <div className="relative w-full">
            <img src={ISLAND_BUTTON} alt="" className="w-full h-auto rounded-xl" />
            <span
              className="absolute inset-0 flex items-center justify-center font-extrabold text-white whitespace-nowrap"
              style={{
                fontSize: 'clamp(8px, 2.6vw, 13px)',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                letterSpacing: '0.5px',
              }}
            >
              Daily Chest
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            activityTrackingService.trackGamePlayed('memory_challenge', 'Memory Bible Challenge');
            setShowChallengeGame(true);
          }}
          className="relative w-full cursor-pointer select-none transition-transform active:scale-95 hover:scale-[1.03] focus:outline-none"
          style={{ zIndex: 2 }}
          aria-label="Open Memory Bible Challenge"
        >
          <img
            src="/assets/images/wooden-raft.webp"
            alt="Daily Chest"
            className="w-full h-auto relative"
          />
        </button>

        {/* Waves underneath the raft — overlaps bottom half, behind the raft image */}
        <div className="absolute pointer-events-none" style={{ zIndex: 1, bottom: '5%', left: '-30%', width: '160%', height: '60%' }}>
          {/* Wave lines fanning out from under the raft */}
          <svg className="raft-wave" style={{ position: 'absolute', top: '10%', left: '5%', width: '90%', height: '30%' }} viewBox="0 0 140 20" preserveAspectRatio="none">
            <path d="M0,16 Q12,6 24,14 Q36,4 48,14 Q60,4 72,14 Q84,4 96,14 Q108,4 120,14 Q132,6 140,12" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <svg className="raft-wave" style={{ position: 'absolute', top: '30%', left: '0%', width: '100%', height: '30%', animationDelay: '0.6s' }} viewBox="0 0 140 20" preserveAspectRatio="none">
            <path d="M0,14 Q10,4 22,12 Q34,2 46,12 Q58,2 70,12 Q82,2 94,12 Q106,2 118,12 Q130,4 140,10" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className="raft-wave" style={{ position: 'absolute', top: '48%', left: '3%', width: '94%', height: '28%', animationDelay: '1.2s' }} viewBox="0 0 140 20" preserveAspectRatio="none">
            <path d="M0,12 Q14,4 28,12 Q42,4 56,12 Q70,4 84,12 Q98,4 112,12 Q126,4 140,10" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <svg className="raft-wave" style={{ position: 'absolute', top: '64%', left: '6%', width: '88%', height: '26%', animationDelay: '1.8s' }} viewBox="0 0 140 20" preserveAspectRatio="none">
            <path d="M0,10 Q16,2 32,10 Q48,2 64,10 Q80,2 96,10 Q112,2 128,10 L140,8" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <svg className="raft-wave" style={{ position: 'absolute', top: '78%', left: '10%', width: '80%', height: '22%', animationDelay: '2.4s' }} viewBox="0 0 140 20" preserveAspectRatio="none">
            <path d="M0,10 Q18,3 36,10 Q54,3 72,10 Q90,3 108,10 Q126,3 140,8" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {/* Splash droplets scattered around */}
          <div className="raft-splash" style={{ position: 'absolute', left: '8%', top: '20%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.55)' }} />
          <div className="raft-splash" style={{ position: 'absolute', left: '25%', top: '45%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animationDelay: '0.4s' }} />
          <div className="raft-splash" style={{ position: 'absolute', left: '50%', top: '15%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.45)', animationDelay: '0.8s' }} />
          <div className="raft-splash" style={{ position: 'absolute', right: '12%', top: '35%', width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', animationDelay: '1.1s' }} />
          <div className="raft-splash" style={{ position: 'absolute', right: '30%', top: '60%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', animationDelay: '1.5s' }} />
          <div className="raft-splash" style={{ position: 'absolute', left: '15%', top: '70%', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', animationDelay: '1.9s' }} />
          <div className="raft-splash" style={{ position: 'absolute', right: '20%', top: '75%', width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', animationDelay: '2.2s' }} />
        </div>
      </div>

      {/* Build-a-Parrot island — right side */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('open_avatar_shop'))}
        className="absolute overflow-visible transition-opacity duration-300 cursor-pointer select-none focus:outline-none active:scale-95 parrot-island-drift"
        style={{ zIndex: 12, right: '2%', top: '22%', width: '28vw', maxWidth: 155, opacity: isZoomingIn ? 0 : 1 }}
        aria-label="Build a Parrot - Open Avatar Shop"
      >
        <img
          src="/assets/images/build-a-parrot-sign.webp"
          alt="Build a Parrot"
          className="absolute left-1/2 -translate-x-1/2 w-[85%] h-auto object-contain drop-shadow-md"
          style={{ top: '-28%', zIndex: 2 }}
          draggable={false}
        />
        <img
          src="/assets/images/parrot-island.webp"
          alt="Parrot Island"
          className="relative w-full h-auto object-contain drop-shadow-lg"
          style={{ zIndex: 1 }}
          draggable={false}
        />
      </button>

      {/* Island centered on screen */}
      <div className="relative flex-1 min-h-0 overflow-auto flex items-center justify-center" style={{ zIndex: 10, paddingTop: '18%' }}>
        <div
          className={`relative flex-shrink-0 ${isZoomingIn ? 'island-zoom-in' : ''}`}
          style={{ width: `min(${ISLAND_WIDTH}px, 85vw)`, maxWidth: ISLAND_MAX_WIDTH, transformOrigin: 'center 40%', willChange: 'transform, opacity' }}
        >
          {FIREFLIES.map((f, i) => (
            <div
              key={i}
              className="world-firefly"
              style={{
                position: 'absolute',
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: f.size,
                height: f.size,
                zIndex: 1,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,215,0,0.95) 0%, rgba(255,200,50,0.5) 60%, transparent 100%)',
                boxShadow: '0 0 10px 3px rgba(255,215,0,0.7), 0 0 20px 6px rgba(255,215,0,0.3)',
                animationDuration: `${f.dur}s`,
                animationDelay: `${f.delay}s`,
                ['--drift' as string]: `${f.drift}px`,
              }}
            />
          ))}

          <button
            type="button"
            onClick={handleIslandClick}
            className="relative w-full cursor-pointer select-none focus:outline-none rounded-2xl"
            style={{ zIndex: 5 }}
            aria-label="Go to Daily Adventure"
          >
            <img
              src={DAILY_ADVENTURE_ISLAND}
              alt="Daily Adventure"
              className="w-full h-auto object-contain"
            />
          </button>

          {/* Water pulse ring — follows the island curvature, breathes in and out */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
            <div className="shore-pulse-1" style={{
              position: 'absolute', left: '-8%', right: '-8%', bottom: '2%', height: '55%',
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.25)',
              boxShadow: '0 0 12px 4px rgba(180,230,255,0.15), inset 0 0 10px 2px rgba(180,230,255,0.08)',
            }} />
            <div className="shore-pulse-2" style={{
              position: 'absolute', left: '-14%', right: '-14%', bottom: '-2%', height: '58%',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.15)',
              boxShadow: '0 0 18px 6px rgba(180,230,255,0.1), inset 0 0 14px 3px rgba(180,230,255,0.05)',
            }} />
            <div className="shore-pulse-3" style={{
              position: 'absolute', left: '-20%', right: '-20%', bottom: '-6%', height: '61%',
              borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 24px 8px rgba(180,230,255,0.06)',
            }} />
          </div>
        </div>
      </div>

      {/* Zoom-in white flash overlay */}
      {isZoomingIn && (
        <div className="fixed inset-0 island-flash pointer-events-none" style={{ zIndex: 999 }} />
      )}

      <style>{`
        .parrot-island-drift {
          animation: parrot-drift 8s ease-in-out infinite;
        }
        @keyframes parrot-drift {
          0%   { transform: translate(0, 0) rotate(0deg); }
          25%  { transform: translate(-4px, -3px) rotate(0.5deg); }
          50%  { transform: translate(2px, 3px) rotate(-0.3deg); }
          75%  { transform: translate(5px, -2px) rotate(0.4deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        /* Drifting clouds */
        .sky-cloud { left: -200px; }
        .sky-cloud-1 { animation: sky-cloud-flow 80s linear infinite; }
        .sky-cloud-2 { animation: sky-cloud-flow 65s linear infinite; animation-delay: -20s; }
        .sky-cloud-3 { animation: sky-cloud-flow 100s linear infinite; animation-delay: -55s; }
        .sky-cloud-4 { animation: sky-cloud-flow 70s linear infinite; animation-delay: -38s; }
        .sky-cloud-5 { animation: sky-cloud-flow 90s linear infinite; animation-delay: -65s; }
        @keyframes sky-cloud-flow {
          from { transform: translateX(0); }
          to   { transform: translateX(calc(100vw + 400px)); }
        }
        /* Continuous one-direction wave flow — each layer at different speed */
        .ocean-flow-1 { animation: ocean-scroll 28s linear infinite; }
        .ocean-flow-2 { animation: ocean-scroll 22s linear infinite; animation-delay: -8s; }
        .ocean-flow-3 { animation: ocean-scroll 18s linear infinite; animation-delay: -4s; }
        .ocean-flow-4 { animation: ocean-scroll 15s linear infinite; animation-delay: -10s; }
        .ocean-flow-5 { animation: ocean-scroll 12s linear infinite; animation-delay: -3s; }
        .ocean-flow-6 { animation: ocean-scroll 9s linear infinite; animation-delay: -6s; }
        @keyframes ocean-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .raft-drift {
          animation: raft-drifting 10s ease-in-out infinite;
        }
        @keyframes raft-drifting {
          0%   { transform: translate(0, 0) rotate(0deg); }
          20%  { transform: translate(6px, -5px) rotate(1.2deg); }
          40%  { transform: translate(12px, 2px) rotate(-0.8deg); }
          60%  { transform: translate(5px, -3px) rotate(1deg); }
          80%  { transform: translate(-2px, 1px) rotate(-0.5deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .raft-wave {
          animation: raft-wave-flow 3s ease-in-out infinite;
        }
        @keyframes raft-wave-flow {
          0%, 100% { transform: translateX(0); opacity: 0.15; }
          50% { transform: translateX(6px); opacity: 0.7; }
        }
        .raft-splash {
          animation: raft-drop 2.2s ease-out infinite;
        }
        @keyframes raft-drop {
          0% { transform: scale(0.2); opacity: 0; }
          20% { transform: scale(1.1); opacity: 0.6; }
          50% { transform: scale(0.85); opacity: 0.3; }
          100% { transform: scale(0.2); opacity: 0; }
        }
        .shore-pulse-1 {
          animation: shore-breathe 3.5s ease-in-out infinite;
          transform-origin: center 70%;
        }
        .shore-pulse-2 {
          animation: shore-breathe 4.5s ease-in-out infinite;
          animation-delay: -1.2s;
          transform-origin: center 70%;
        }
        .shore-pulse-3 {
          animation: shore-breathe 5.5s ease-in-out infinite;
          animation-delay: -2.8s;
          transform-origin: center 70%;
        }
        @keyframes shore-breathe {
          0%   { transform: scale(1.15); opacity: 0; }
          20%  { opacity: 0.7; }
          60%  { opacity: 0.4; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        /* Island zoom-in portal effect */
        .island-zoom-in {
          animation: island-zoom 1s ease-in forwards;
          will-change: transform, opacity;
        }
        @keyframes island-zoom {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(7); opacity: 0; }
        }
        .island-flash {
          animation: flash-white 1s ease-in forwards;
          will-change: background;
        }
        @keyframes flash-white {
          0%   { background: rgba(255,255,255,0); }
          60%  { background: rgba(255,255,255,0); }
          85%  { background: rgba(255,255,255,0.5); }
          100% { background: rgba(255,255,255,1); }
        }
        .world-firefly { animation: firefly-rise ease-out infinite; pointer-events: none; opacity: 0; }
        @keyframes firefly-rise {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          10% { opacity: 0.9; transform: translate(calc(var(--drift) * 0.1), -15px) scale(1); }
          30% { opacity: 1; transform: translate(calc(var(--drift) * 0.4), -60px) scale(1.1); }
          60% { opacity: 0.7; transform: translate(calc(var(--drift) * 0.8), -140px) scale(0.9); }
          85% { opacity: 0.25; transform: translate(var(--drift), -210px) scale(0.5); }
          100% { opacity: 0; transform: translate(var(--drift), -260px) scale(0.2); }
        }
      `}</style>

      {showVerseModal && (
        <div className="fixed inset-0" style={{ zIndex: 9999 }}>
          <Suspense fallback={null}>
            <DailyVerseModal
              isOpen={showVerseModal}
              onClose={() => setShowVerseModal(false)}
              onComplete={() => setShowVerseModal(false)}
            />
          </Suspense>
        </div>
      )}

      <ChallengeGameModal
        isOpen={showChallengeGame}
        onClose={() => setShowChallengeGame(false)}
      />
    </div>
  );
};

/**
 * Route-level WorldPage — now a thin shell. The island visuals live in
 * PersistentWorldIsland (rendered in Layout). This component is kept for
 * the WorldPageWithWelcomeCheck wrapper to render modals on top.
 */
const WorldPage: React.FC = () => {
  return <div className="relative w-full h-full" />;
};

export default WorldPage;
