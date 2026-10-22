import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { activityTrackingService } from '../services/activityTrackingService';
import {
  startAdventurePreload,
  subscribeAdventurePreload,
  type AdventurePreloadProgress,
} from '../utils/assetCache';
import {
  ONBOARDING_FAMILY_BG_VIDEO,
  SPLASH_BOAT_POSTER,
  SPLASH_BOAT_VIDEO,
  SPLASH_CONTINUE_VIDEO,
  SPLASH_TAGLINE,
} from '../utils/onboardingJourney';

const STORAGE_KEY = 'godly_kids_data_v6';

const NAVY = '#12264A';
const GOLD = '#FFC43D';
const BUBBLE = "'Baloo 2', 'Fredoka', sans-serif";
const CONTINUE_TIMEOUT_MS = 7500;

const SPLASH_COVER: React.CSSProperties = {
  width: '100vw',
  height: '100dvh',
  minHeight: '100svh',
  objectFit: 'cover',
  objectPosition: 'center center',
};

const SPARKLES: Array<{
  top: string;
  left?: string;
  right?: string;
  rotate: string;
  h: number;
}> = [
  { top: '18%', left: '-1.35rem', rotate: '-38deg', h: 11 },
  { top: '46%', left: '-1.7rem', rotate: '8deg', h: 14 },
  { top: '72%', left: '-1.25rem', rotate: '42deg', h: 10 },
  { top: '14%', right: '-1.35rem', rotate: '38deg', h: 11 },
  { top: '46%', right: '-1.7rem', rotate: '-8deg', h: 14 },
  { top: '76%', right: '-1.25rem', rotate: '-42deg', h: 10 },
];

const formatDownloadSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const preloadPercent = (progress: AdventurePreloadProgress): number => {
  if (progress.finished) return 100;
  if (progress.totalBytes <= 0) return 8;
  return Math.max(8, Math.min(100, Math.round((progress.loadedBytes / progress.totalBytes) * 100)));
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const replaySplash = Boolean(
    (location.state as { replaySplash?: boolean } | null)?.replaySplash,
  );
  const [isChecking, setIsChecking] = useState(!replaySplash);
  const [mediaReady, setMediaReady] = useState(false);
  const [playingContinue, setPlayingContinue] = useState(false);
  const [preload, setPreload] = useState<AdventurePreloadProgress>({
    loadedBytes: 0,
    totalBytes: 0,
    finished: false,
  });
  const startedRef = useRef(false);
  const splashRef = useRef<HTMLVideoElement>(null);
  const continueRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (replaySplash) {
      setIsChecking(false);
      return;
    }
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const userData = JSON.parse(savedData);
        const hasCompletedOnboarding =
          (userData.parentName && userData.parentName !== 'Parent' && userData.parentName !== '') ||
          (userData.kids && userData.kids.length > 0) ||
          userData.isSubscribed;

        if (hasCompletedOnboarding) {
          const hasKids = userData.kids && userData.kids.length > 0;
          navigate(hasKids ? '/profile' : '/world', { replace: true });
          return;
        }
      }
    } catch (e) {
      console.error('Error checking user data:', e);
    }
    setIsChecking(false);
  }, [navigate, replaySplash]);

  useEffect(() => subscribeAdventurePreload(setPreload), []);

  useEffect(() => {
    if (isChecking) return;
    void startAdventurePreload();
  }, [isChecking]);

  useEffect(() => {
    const splashViewedKey = 'godlykids_splash_viewed_session';
    if (!sessionStorage.getItem(splashViewedKey) && !isChecking) {
      sessionStorage.setItem(splashViewedKey, 'true');
      activityTrackingService.trackOnboardingEvent('splash_page_viewed');
    }
  }, [isChecking]);

  useEffect(() => {
    const splash = splashRef.current;
    if (!splash) return;
    const play = () => {
      splash.play().catch(() => {
        /* muted + playsInline is the main autoplay fix */
      });
    };
    splash.addEventListener('canplay', play);
    play();
    return () => splash.removeEventListener('canplay', play);
  }, [isChecking]);

  const goOnboarding = useCallback(() => {
    navigate('/onboarding');
  }, [navigate]);

  const handleStartExplore = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    activityTrackingService.trackOnboardingEvent('splash_explore_clicked', {
      source: 'continue',
    });

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      goOnboarding();
      return;
    }

    splashRef.current?.pause();
    setPlayingContinue(true);

    const clip = continueRef.current;
    let finished = false;
    const failSafe = window.setTimeout(() => finish(), CONTINUE_TIMEOUT_MS);
    function finish() {
      if (finished) return;
      finished = true;
      window.clearTimeout(failSafe);
      goOnboarding();
    }

    if (!clip) {
      finish();
      return;
    }

    clip.onended = finish;
    clip.onerror = finish;
    clip.currentTime = 0;
    clip.muted = false;
    clip.play().catch(() => {
      clip.muted = true;
      clip.play().catch(() => finish());
    });
  };

  const handleSignIn = () => {
    activityTrackingService.trackOnboardingEvent('splash_signin_clicked');
    navigate('/signin');
  };

  if (isChecking) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-[#7EC8E8]"
        style={{ width: '100vw', height: '100dvh', minHeight: '100svh' }}
      >
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-white/40 border-t-white rounded-full animate-spin"></div>
          <p className="text-white mt-4 font-medium drop-shadow">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#7EC8E8]"
      style={{
        width: '100vw',
        height: '100dvh',
        minHeight: '100svh',
      }}
    >
      {!mediaReady && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#7EC8E8] to-[#4BA3D4] animate-pulse" />
      )}

      <img
        src={SPLASH_BOAT_POSTER}
        alt=""
        aria-hidden
        className="absolute inset-0 pointer-events-none select-none"
        style={SPLASH_COVER}
      />

      <video
        ref={splashRef}
        src={SPLASH_BOAT_VIDEO}
        poster={SPLASH_BOAT_POSTER}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={`absolute inset-0 pointer-events-none select-none transition-opacity duration-500 ${mediaReady ? 'opacity-100' : 'opacity-0'}`}
        style={SPLASH_COVER}
        aria-hidden
        onPlaying={() => setMediaReady(true)}
        onError={() => setMediaReady(true)}
      />

      <video
        ref={continueRef}
        src={SPLASH_CONTINUE_VIDEO}
        playsInline
        preload="auto"
        className={`absolute inset-0 z-30 pointer-events-none select-none transition-opacity duration-200 ${playingContinue ? 'opacity-100' : 'opacity-0'}`}
        style={SPLASH_COVER}
        aria-hidden
      />

      {/* Warm the family-page background so it is ready after the parrot clip. */}
      <video src={ONBOARDING_FAMILY_BG_VIDEO} preload="auto" muted playsInline className="hidden" aria-hidden />

      <div
        className={`absolute left-0 right-0 z-10 flex w-full min-w-0 flex-col items-center px-6 transition-opacity duration-200 ${playingContinue ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{
          top: 'max(calc(var(--safe-area-top, 0px) + 10px), 2.4vh)',
        }}
      >
        <h1 className="w-full max-w-[22rem] m-0">
          <img
            src={SPLASH_TAGLINE}
            alt="A Bible app for adventurous kids. Set sail into God's Word."
            className="w-full h-auto select-none pointer-events-none"
            draggable={false}
          />
        </h1>
      </div>

      <div
        className={`absolute left-1/2 z-20 flex w-full max-w-sm -translate-x-1/2 flex-col items-center px-5 transition-opacity duration-200 ${playingContinue ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{
          bottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + max(0.85rem, 3.5vh))',
        }}
      >
        <div className="relative flex w-full justify-center">
          {preload.finished ? (
            <>
              {SPARKLES.map((s, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    top: s.top,
                    left: s.left,
                    right: s.right,
                    width: 3,
                    height: s.h,
                    background: GOLD,
                    transform: `rotate(${s.rotate})`,
                  }}
                />
              ))}
              <button
                type="button"
                onClick={handleStartExplore}
                disabled={playingContinue}
                className="px-10 py-3.5 rounded-full font-extrabold text-[1.55rem] sm:text-[1.7rem] leading-none active:scale-[0.97] transition-transform disabled:opacity-70"
                style={{
                  fontFamily: BUBBLE,
                  background: GOLD,
                  color: NAVY,
                  boxShadow: '0 6px 0 #E0A21A, 0 10px 18px rgba(18, 38, 74, 0.18)',
                }}
              >
                Continue →
              </button>
            </>
          ) : (
            <div
              className="w-full rounded-3xl px-4 py-3"
              style={{ background: 'rgba(18, 38, 74, 0.82)' }}
              role="status"
              aria-live="polite"
            >
              <p
                className="text-center text-white font-extrabold text-base leading-tight"
                style={{ fontFamily: BUBBLE }}
              >
                Getting your adventure ready
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${preloadPercent(preload)}%`,
                    background: GOLD,
                  }}
                />
              </div>
              <p className="mt-1.5 text-center text-xs font-bold text-white/90">
                {formatDownloadSize(preload.loadedBytes)}
                {preload.totalBytes > 0 ? ` of ${formatDownloadSize(preload.totalBytes)}` : ''}
              </p>
              <button
                type="button"
                onClick={handleStartExplore}
                className="mt-1 w-full text-center text-xs font-bold text-white/80 underline"
              >
                Continue anyway
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleSignIn}
          className="mt-3 font-medium text-base hover:underline active:opacity-70 transition-all"
          style={{
            color: NAVY,
            textShadow: '0 0 8px #fff, 0 1px 0 #fff',
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
