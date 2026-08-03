import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, Play, Ship, Video } from 'lucide-react';
import Header from '../components/layout/Header';
import ExploreMapBackdrop from '../components/world/ExploreMapBackdrop';
import { useAppAmbientMusic } from '../context/AudioContext';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import {
  getSessionStreak,
  getSessionHistory,
  isSessionCompletedToday,
  hasSessionToday,
  getCurrentSession,
} from '../services/dailySessionService';
import { ApiService } from '../services/apiService';
import { isCompleted, isLocked } from '../services/lessonService';
import { FEATURE_CREATE_YOUR_STORY } from '../constants';
import { DespiaService } from '../services/despiaService';
import CoverImage from '../components/ui/CoverImage';
import { prefersReducedMotion } from '../utils/bibleMapApi';

const DailyVerseModal = lazy(() => import('../components/modals/DailyVerseModal'));

const MAP_OCEAN = '/assets/images/map-ocean-bg.png';
const MAP_ISLAND = '/assets/images/map-island-genesis.png';
const MAP_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const MAP_CLOUD_B = '/assets/images/map-sky-cloud-b.png';
const DIVE_BUTTON = '/assets/images/dive-into-bible-button.webp';
const LIBRARY_NEW_RELEASES_BG = '/assets/images/library-new-releases-bg.png';
const DAILY_STREAK_BG = '/assets/images/daily-streak-bg.png';
const DIVIDER_SHIP_ROPES = '/assets/images/divider-ship-ropes.png';
const WELCOME_VIDEO_KEY = 'godlykids_welcome_shown';

/**
 * Sail-the-Map cinematic — in-place on Explore (no /map load mid-anim).
 *
 * Timing (~3.1s):
 *   0ms         clear chrome; living map BG (ocean + clouds + Genesis) stays
 *   280–350ms   hold
 *   350–1100ms  lower Genesis on the ocean
 *   1100–2500ms zoom into Genesis
 *   2300–3000ms white fade
 *   3100ms      navigate /sail/genesis
 */
const SAIL_CLEAR_MS = 280;
const SAIL_HOLD_MS = 350;
const SAIL_LOWER_MS = 750;
const SAIL_LOWER_START_MS = SAIL_HOLD_MS;
const SAIL_ZOOM_START_MS = SAIL_LOWER_START_MS + SAIL_LOWER_MS;
const SAIL_FADE_MS = 700;
const SAIL_FADE_START_MS = 2300;
const SAIL_NAVIGATE_MS = 3100;
const SAIL_REDUCED_NAVIGATE_MS = 220;

const WOOD_PANEL: React.CSSProperties = {
  background: 'linear-gradient(165deg, #e8c892 0%, #d4a574 28%, #c4925a 55%, #b8834a 78%, #a8723c 100%)',
  boxShadow:
    'inset 0 2px 0 rgba(255,240,200,0.45), inset 0 -3px 6px rgba(80,40,10,0.28), 0 6px 16px rgba(0,0,0,0.28)',
  border: '2px solid rgba(92, 50, 18, 0.55)',
};

const WOOD_INNER: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,245,220,0.22) 0%, rgba(120,60,20,0.08) 100%)',
};

/** Gold-bracket ship rope image (`divider-ship-ropes.png`) — parent supplies full-bleed width. */
const ExploreShipRope: React.FC = () => (
  <img
    src={DIVIDER_SHIP_ROPES}
    alt=""
    aria-hidden
    className="block w-full h-auto object-cover object-center drop-shadow-md pointer-events-none select-none"
    draggable={false}
  />
);

const getWeekDays = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOfWeek + i);
    date.setHours(0, 0, 0, 0);
    weekDays.push(date);
  }
  return weekDays;
};

const isDateCompleted = (date: Date, history: any[]): boolean => {
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return history.some((session) => session.date === dateKey && session.completed);
};

/**
 * Legacy island overlay — Explore is now the card/Map layout in WorldPage.
 * Kept as a no-op export so App imports stay stable.
 */
export const PersistentWorldIsland: React.FC = () => null;

type FeaturedCabinItem = {
  id: string;
  title: string;
  coverUrl: string;
  _itemType: 'book' | 'playlist' | 'episode' | 'amazonBook';
  _amazonUrl?: string;
  _playlistId?: string;
  _itemIndex?: number;
  badgeText?: string;
  isAudio?: boolean;
};

const normalizeFeaturedItem = (raw: any): FeaturedCabinItem => ({
  ...raw,
  id: String(raw._id || raw.id || ''),
  coverUrl: raw.coverUrl || raw.coverImage || raw.files?.coverImage || '',
  title: raw.title || 'New Story',
  _itemType: raw._itemType || (raw.isAudio ? 'playlist' : 'book'),
  _amazonUrl: raw._amazonUrl || raw.amazonUrl,
  _playlistId: raw._playlistId,
  _itemIndex: raw._itemIndex,
  badgeText: raw.badgeText,
});

const GOLD_CARD_STYLE: React.CSSProperties = {
  background: 'rgba(62, 31, 7, 0.45)',
  border: '2.5px solid #E8C76A',
  boxShadow:
    '0 0 0 1px rgba(92,46,18,0.35), 0 6px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,245,220,0.25)',
};

/**
 * Cabin featured carousel — portal featured list, gold card style, swipe + dots.
 * Slides are ~76% wide so the next card peeks; snap + touch pan for mobile.
 */
const FeaturedCabinCarousel: React.FC<{
  items: FeaturedCabinItem[];
  onOpen: (item: FeaturedCabinItem) => void;
}> = ({ items, onOpen }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTrackScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !items.length) return;
    const first = el.children[0] as HTMLElement | undefined;
    const slideW = first?.offsetWidth || el.clientWidth;
    if (slideW <= 0) return;
    const index = Math.round(el.scrollLeft / slideW);
    if (index !== activeIndex && index >= 0 && index < items.length) {
      setActiveIndex(index);
    }
  }, [activeIndex, items.length]);

  if (!items.length) return null;

  const multi = items.length > 1;

  return (
    <div className="relative z-10 w-full py-3 min-h-[min(18dvh,160px)]">
      <div
        ref={trackRef}
        onScroll={multi ? handleTrackScroll : undefined}
        className={`flex w-full ${
          multi
            ? 'overflow-x-auto snap-x snap-mandatory no-scrollbar'
            : 'justify-center'
        }`}
        style={
          multi
            ? {
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x pan-y',
                overscrollBehaviorX: 'contain',
                paddingLeft: '12%',
                paddingRight: '12%',
                scrollPaddingInline: '12%',
              }
            : undefined
        }
      >
        {items.map((item) => {
          const badge =
            item._itemType === 'amazonBook' && item.badgeText
              ? item.badgeText
              : 'NEW RELEASE!';
          return (
            <div
              key={item.id}
              className={`flex items-center justify-center ${
                multi
                  ? 'flex-shrink-0 snap-center w-[76%] pr-3 last:pr-0'
                  : 'w-full px-[15%]'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="relative flex w-full max-w-[260px] flex-row items-center gap-2.5 rounded-xl px-2.5 py-2 active:scale-[0.99] transition-transform focus:outline-none"
                style={GOLD_CARD_STYLE}
                aria-label={`Explore ${item.title}`}
              >
                <span
                  className="absolute -top-2.5 right-2 z-20 px-2 py-0.5 rounded-sm text-[9px] font-black tracking-wide text-white"
                  style={{
                    background: 'linear-gradient(180deg, #5cb85c, #2e7d32)',
                    boxShadow: '0 2px 0 #1b5e20',
                  }}
                >
                  {badge}
                </span>
                <div className="relative shrink-0 aspect-[3/4] h-[96px] rounded-md overflow-hidden shadow-xl border border-[#c9a76b]/80">
                  {item.coverUrl ? (
                    <CoverImage
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#8B5A2B] flex items-center justify-center text-white font-bold text-xs px-1.5 text-center">
                      {item.title}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start justify-center gap-2 min-w-0 flex-1 pr-0.5">
                  <p
                    className="font-display font-black text-[13px] text-left leading-tight line-clamp-2"
                    style={{ color: '#3E1F07', textShadow: '0 1px 0 rgba(255,245,220,0.65)' }}
                  >
                    {item.title}
                  </p>
                  <span
                    className="px-3.5 py-1.5 rounded-full font-display font-black text-[11px] text-white"
                    style={{
                      background: 'linear-gradient(180deg, #FF9A3C 0%, #F07020 55%, #D45A12 100%)',
                      boxShadow: '0 2px 0 #8B3A0A, inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    EXPLORE NOW
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {multi && (
        <div
          className="flex justify-center gap-1.5 pt-2.5 pointer-events-none"
          aria-hidden
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-full transition-all duration-300"
              style={{
                width: index === activeIndex ? 7 : 5,
                height: index === activeIndex ? 7 : 5,
                background:
                  index === activeIndex
                    ? 'rgba(232, 199, 106, 0.95)'
                    : 'rgba(255, 245, 220, 0.4)',
                boxShadow:
                  index === activeIndex ? '0 0 0 1px rgba(92,46,18,0.35)' : undefined,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Explore (`/world`) — plank header → cabin featured band → mid rope →
 * ocean (map + streak) → wood tab bar (footer frame already includes its rope).
 */
const WorldPage: React.FC = () => {
  useAppAmbientMusic(true);
  const navigate = useNavigate();
  const { books } = useBooks();
  const { isSubscribed } = useUser();

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [streak, setStreak] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [lessonDone, setLessonDone] = useState(false);
  const [hasInProgress, setHasInProgress] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<FeaturedCabinItem[]>([]);
  const [videoDevotionals, setVideoDevotionals] = useState<any[]>([]);
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  /** Explore sail cinematic — in-place on living map BG (no mid-anim route). */
  const [sailCinematic, setSailCinematic] = useState(false);
  const [sailGenesisLowered, setSailGenesisLowered] = useState(false);
  const [sailZoom, setSailZoom] = useState(false);
  const [sailFade, setSailFade] = useState(false);
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const sailTimersRef = useRef<number[]>([]);
  /** Sync lock — prevents double-start. */
  const sailCinematicLockRef = useRef(false);

  const handleWelcomeVideoEnd = useCallback(() => {
    sessionStorage.setItem(WELCOME_VIDEO_KEY, 'true');
    setShowWelcomeVideo(false);
  }, []);

  const clearSailTimers = useCallback(() => {
    sailTimersRef.current.forEach((id) => window.clearTimeout(id));
    sailTimersRef.current = [];
  }, []);

  const goToSailScene = useCallback(() => {
    navigate('/sail/genesis', {
      state: { title: 'Genesis: Creation' },
    });
  }, [navigate]);

  const startSailCinematic = useCallback(
    (e?: React.MouseEvent | React.PointerEvent) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (sailCinematicLockRef.current) return;
      sailCinematicLockRef.current = true;

      clearSailTimers();
      document.body.setAttribute('data-modal-open', 'true');
      setSailCinematic(true);
      setSailGenesisLowered(false);
      setSailZoom(false);
      setSailFade(false);

      if (prefersReducedMotion()) {
        setSailGenesisLowered(true);
        setSailFade(true);
        const id = window.setTimeout(goToSailScene, SAIL_REDUCED_NAVIGATE_MS);
        sailTimersRef.current = [id];
        return;
      }

      const lowerId = window.setTimeout(() => setSailGenesisLowered(true), SAIL_LOWER_START_MS);
      const zoomId = window.setTimeout(() => setSailZoom(true), SAIL_ZOOM_START_MS);
      const fadeId = window.setTimeout(() => setSailFade(true), SAIL_FADE_START_MS);
      const navId = window.setTimeout(goToSailScene, SAIL_NAVIGATE_MS);
      sailTimersRef.current = [lowerId, zoomId, fadeId, navId];
    },
    [clearSailTimers, goToSailScene],
  );

  useEffect(
    () => () => {
      clearSailTimers();
      sailCinematicLockRef.current = false;
      document.body.removeAttribute('data-modal-open');
    },
    [clearSailTimers],
  );

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return;
    if (sessionStorage.getItem(WELCOME_VIDEO_KEY)) return;
    setShowWelcomeVideo(true);
  }, []);

  useEffect(() => {
    if (!showWelcomeVideo) return;
    const video = welcomeVideoRef.current;
    if (!video) return;
    video.play().catch(() => handleWelcomeVideoEnd());
  }, [showWelcomeVideo, handleWelcomeVideoEnd]);

  useEffect(() => {
    setLessonDone(isSessionCompletedToday());
    setStreak(getSessionStreak());
    setSessionHistory(getSessionHistory());
    if (!isSessionCompletedToday() && hasSessionToday()) {
      const session = getCurrentSession();
      setHasInProgress(!!session);
    } else {
      setHasInProgress(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    ApiService.getFeaturedContent()
      .then((data) => {
        if (cancelled || !data?.length) return;
        setFeaturedItems(data.map(normalizeFeaturedItem).filter((item) => item.id));
      })
      .catch(() => {
        if (!cancelled && books[0]) {
          setFeaturedItems([
            normalizeFeaturedItem({
              id: books[0].id || (books[0] as any)._id,
              title: books[0].title,
              coverUrl: books[0].coverUrl || (books[0] as any).coverImage,
              _itemType: 'book',
            }),
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [books]);

  useEffect(() => {
    let cancelled = false;
    ApiService.getLessons()
      .then((lessons) => {
        if (cancelled || !Array.isArray(lessons)) return;
        const devotionals = lessons
          .filter(
            (l: any) =>
              l.type === 'Daily Verse' ||
              l.type?.toLowerCase() === 'daily verse' ||
              l.title?.toLowerCase().includes('daily verse') ||
              l.seriesName?.toLowerCase().includes('daily verse'),
          )
          .sort((a: any, b: any) => {
            const aDone = isCompleted(a._id);
            const bDone = isCompleted(b._id);
            if (aDone && !bDone) return 1;
            if (!aDone && bDone) return -1;
            return 0;
          })
          .slice(0, 8);
        setVideoDevotionals(devotionals);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    if (y > lastScrollY.current + 8) setIsHeaderVisible(false);
    else if (y < lastScrollY.current - 4) setIsHeaderVisible(true);
    lastScrollY.current = y;
  }, []);

  const openFeatured = useCallback(
    (item: FeaturedCabinItem) => {
      if (item._itemType === 'amazonBook' && item._amazonUrl) {
        ApiService.trackAmazonBookClick(item.id);
        DespiaService.openExternalUrl(item._amazonUrl);
        return;
      }
      if (item._itemType === 'episode' && item._playlistId != null) {
        navigate(
          `/audio/playlist/${item._playlistId}/play/${item._itemIndex ?? 0}`,
        );
        return;
      }
      if (item._itemType === 'playlist' || item.isAudio) {
        navigate(`/audio/playlist/${item.id}`);
        return;
      }
      navigate(`/book/${item.id}`);
    },
    [navigate],
  );

  const startLesson = () => {
    if (hasInProgress) navigate('/daily-session');
    else navigate('/daily-session', { state: { freshStart: true } });
  };

  const weekDays = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const showChrome = !sailCinematic;

  return (
    <div
      className={`relative w-full h-full overflow-hidden${sailCinematic ? ' sail-cinematic-active' : ''}`}
    >
      {/* Living Map backdrop — ocean + clouds + all MapPage islands */}
      <ExploreMapBackdrop
        cinematic={sailCinematic}
        genesisLowered={sailGenesisLowered}
        zoom={sailZoom}
      />

      <Header
        isVisible={showChrome && isHeaderVisible && !showWelcomeVideo}
        title="EXPLORE"
        variant="plank"
      />

      {showWelcomeVideo && (
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
          <button type="button" onClick={handleWelcomeVideoEnd} className="mt-2 text-white/70 text-sm underline">
            Skip
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative z-10 flex flex-col h-full overflow-y-auto no-scrollbar"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          overflow: sailCinematic ? 'hidden' : undefined,
          pointerEvents: sailCinematic ? 'none' : undefined,
        }}
      >
        <div className="pb-48 w-full">
          {/* ── 1–2. Cabin featured band (carousel of portal featured items) ── */}
          {featuredItems.length > 0 && (
            <section
              className="relative w-full explore-chrome"
              aria-label="Featured new releases"
              style={{
                // Featured band — compact upper strip; bookshelves/portholes visible
                minHeight: 'min(30dvh, 260px)',
                // Match plank header: full wood PNG aspect (1021×284) − PLANK_TOP_LIFT (−1.5rem) + breath
                paddingTop: 'calc(100vw * 284 / 1021 + 0.35rem - 1.5rem)',
                paddingBottom: '1.25rem',
                opacity: showChrome ? 1 : 0,
                transition: `opacity ${SAIL_CLEAR_MS}ms ease`,
                pointerEvents: showChrome ? undefined : 'none',
              }}
            >
              <img
                src={LIBRARY_NEW_RELEASES_BG}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                style={{ objectPosition: 'center 42%' }}
                draggable={false}
              />

              <FeaturedCabinCarousel items={featuredItems} onOpen={openFeatured} />
            </section>
          )}

          {/* Header clearance when featured cabin is absent */}
          {featuredItems.length === 0 && (
            <div className="pt-[calc(100vw*284/1021+0.35rem-1.5rem)]" aria-hidden />
          )}

          {/* ── 3. Mid rope — edge-to-edge on cabin / ocean seam (overlays both) ── */}
          {featuredItems.length > 0 && (
            <div
              className="relative z-20 w-screen max-w-none pointer-events-none explore-chrome"
              style={{
                marginLeft: 'calc(50% - 50vw)',
                marginTop: '-0.85rem',
                marginBottom: '-0.85rem',
                opacity: showChrome ? 1 : 0,
                transition: `opacity ${SAIL_CLEAR_MS}ms ease`,
              }}
              aria-hidden
            >
              <ExploreShipRope />
            </div>
          )}

          {/* ── 4. Ocean section — map + daily streak ── */}
          <section className="relative w-full" aria-label="Explore map and daily streak">
            <div className="relative z-10 px-3.5 pt-5 pb-4 max-w-lg mx-auto w-full flex gap-2.5 items-stretch">
              {/* Map hero — primary centerpiece (Sail the Map CTA) */}
              <button
                type="button"
                onClick={startSailCinematic}
                disabled={sailCinematic}
                className="relative flex-[1.65] min-w-0 rounded-2xl overflow-hidden active:scale-[0.99] transition-transform focus:outline-none text-left"
                style={{
                  ...WOOD_PANEL,
                  padding: 7,
                  /* Clear path to ocean — hide Sail card with all other chrome. */
                  opacity: showChrome ? 1 : 0,
                  transition: `opacity ${SAIL_CLEAR_MS}ms ease`,
                  visibility: showChrome ? 'visible' : 'hidden',
                  pointerEvents: showChrome ? undefined : 'none',
                }}
                aria-label="Open God's Word Adventure Map"
              >
                <div className="relative rounded-xl overflow-hidden" style={{ minHeight: 220, ...WOOD_INNER }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, #3aa0ef 0%, #2aa8e0 35%, #1a8fd1 70%, #1578b5 100%)',
                    }}
                  />
                  <img
                    src={MAP_CLOUD_A}
                    alt=""
                    aria-hidden
                    className="absolute top-0 left-[-8%] w-[70%] opacity-90 pointer-events-none select-none"
                    draggable={false}
                  />
                  <img
                    src={MAP_CLOUD_B}
                    alt=""
                    aria-hidden
                    className="absolute top-1 right-[-6%] w-[48%] opacity-85 pointer-events-none select-none"
                    draggable={false}
                  />
                  <img
                    src={MAP_OCEAN}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none select-none"
                    style={{ objectPosition: 'center 30%' }}
                    draggable={false}
                  />
                  <img
                    src={MAP_ISLAND}
                    alt=""
                    className="absolute left-1/2 -translate-x-1/2 w-[78%] max-w-[200px] drop-shadow-lg pointer-events-none select-none"
                    style={{ top: '18%' }}
                    draggable={false}
                  />
                  <span className="absolute explore-map-ship" style={{ right: '14%', bottom: '28%' }}>
                    <Ship size={22} className="text-[#7a4a20] drop-shadow" fill="#C4884A" strokeWidth={1.5} />
                  </span>

                  <div className="absolute inset-x-0 top-0 pt-2.5 px-2 text-center z-10">
                    <h2
                      className="font-display font-black text-[clamp(0.95rem,3.8vw,1.2rem)] leading-none"
                      style={{
                        color: '#ffe9b0',
                        textShadow: '0 2px 0 #5c2e12, 0 3px 6px rgba(0,0,0,0.4)',
                      }}
                    >
                      God&apos;s Word Adventure
                    </h2>
                    <p
                      className="mt-0.5 font-display font-bold text-[10px] tracking-wide"
                      style={{ color: 'rgba(255,245,220,0.92)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      Sail. Learn. Grow.
                    </p>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-2.5 z-10 flex flex-col items-center gap-1.5">
                    <span
                      className="px-4 py-2 rounded-full font-display font-black text-sm text-[#3E1F07] flex items-center gap-1.5"
                      style={{
                        background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                        boxShadow: '0 3px 0 #8B6914, inset 0 1px 0 rgba(255,255,255,0.45)',
                      }}
                    >
                      <Ship size={16} strokeWidth={2.5} />
                      Sail the Map
                    </span>
                  </div>
                </div>
              </button>

              {/* Daily Streak plaque — right over ocean */}
              <div
                className="relative flex-1 min-w-[112px] max-w-[142px] self-center explore-chrome"
                style={{
                  opacity: showChrome ? 1 : 0,
                  transition: `opacity ${SAIL_CLEAR_MS}ms ease`,
                  pointerEvents: showChrome ? undefined : 'none',
                }}
              >
                <img
                  src={DAILY_STREAK_BG}
                  alt=""
                  aria-hidden
                  className="block w-full h-auto pointer-events-none select-none"
                  draggable={false}
                />
                <div className="absolute inset-0 flex flex-col">
                  <div className="h-[15%] flex items-center justify-center px-[12%] pt-[1%]">
                    <p
                      className="font-display font-black text-[10px] tracking-wide text-center leading-none"
                      style={{
                        color: '#3E1F07',
                        textShadow: '0 1px 0 rgba(255,245,220,0.55)',
                      }}
                    >
                      DAILY STREAK
                    </p>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-[14%] pt-[5%] pb-[9%] min-h-0">
                    <div className="flex items-center gap-0.5 mb-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" fill="#f97316" />
                      <span
                        className="font-display font-black text-[15px] leading-none"
                        style={{
                          color: '#7CFC98',
                          textShadow: '0 1px 0 #1b5e20, 0 2px 3px rgba(0,0,0,0.35)',
                        }}
                      >
                        {streak > 0 ? `${streak} DAYS!` : 'START!'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 w-full mb-auto overflow-hidden">
                      {weekDays.map((date, index) => {
                        const isToday = date.getTime() === today.getTime();
                        const completed = isToday ? lessonDone : isDateCompleted(date, sessionHistory);
                        return (
                          <div key={index} className="flex items-center gap-1">
                            <span className="w-3 text-[8px] font-bold text-[#ffe9b0]/75 text-center">
                              {dayLabels[index]}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                                completed
                                  ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow'
                                  : isToday
                                    ? 'border-2 border-[#ffe9b0] bg-white/25'
                                    : 'bg-[#5c2e12]/35 text-[#ffe9b0]/50'
                              }`}
                            >
                              {completed ? (
                                <Check className="w-2 h-2" strokeWidth={3} />
                              ) : (
                                <span className="text-[7px] font-bold text-[#ffe9b0]/85">{date.getDate()}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={startLesson}
                      className="mt-1.5 w-full py-1.5 rounded-lg font-display font-black text-[10px] text-white active:scale-[0.98] transition-transform"
                      style={{
                        background: 'linear-gradient(180deg, #3db8e8, #1B8BB8)',
                        boxShadow: '0 2px 0 #0e5f7a',
                      }}
                    >
                      {lessonDone ? 'Review' : hasInProgress ? 'Continue' : 'Start'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div
            className="px-3.5 max-w-lg mx-auto w-full space-y-1 explore-chrome"
            style={{
              opacity: showChrome ? 1 : 0,
              transition: `opacity ${SAIL_CLEAR_MS}ms ease`,
              pointerEvents: showChrome ? undefined : 'none',
            }}
          >
            {/* ── Supporting cards: Dive + Video Devotional ── */}
            <div className="flex gap-2.5">
              {FEATURE_CREATE_YOUR_STORY && (
                <button
                  type="button"
                  onClick={() => navigate('/create-your-story')}
                  className="flex-1 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform focus:outline-none p-0 border-0 bg-transparent"
                  style={WOOD_PANEL}
                  aria-label="Dive into the Bible - Start Story Adventure"
                >
                  <div className="p-1.5">
                    <img
                      src={DIVE_BUTTON}
                      alt="Dive into The Bible"
                      className="w-full h-auto block rounded-xl"
                    />
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const first = videoDevotionals.find((l) => !isLocked(l)) || videoDevotionals[0];
                  if (first) navigate(`/lesson/${first._id}`);
                  else setShowVerseModal(true);
                }}
                className={`rounded-2xl overflow-hidden active:scale-[0.98] transition-transform focus:outline-none ${
                  FEATURE_CREATE_YOUR_STORY ? 'flex-1' : 'w-full'
                }`}
                style={{ ...WOOD_PANEL, padding: 7 }}
                aria-label="Video Devotional Activities"
              >
                <div
                  className="rounded-xl px-2.5 py-3 flex flex-col items-center justify-center gap-2 min-h-[108px]"
                  style={WOOD_INNER}
                >
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-[#c9a76b] shadow-md bg-[#5a3820] flex items-center justify-center">
                    {videoDevotionals[0]?.video?.thumbnail || videoDevotionals[0]?.thumbnailUrl ? (
                      <img
                        src={videoDevotionals[0].video?.thumbnail || videoDevotionals[0].thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Video className="w-7 h-7 text-[#ffe9b0]" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </span>
                  </div>
                  <p
                    className="font-display font-black text-[11px] text-center leading-tight"
                    style={{ color: '#5c2e12' }}
                  >
                    Video Devotional Activities
                  </p>
                  {videoDevotionals.length > 0 && (
                    <p className="text-[10px] font-bold text-[#5c2e12]/65">
                      {videoDevotionals.length} video{videoDevotionals.length === 1 ? '' : 's'}
                      {!isSubscribed && videoDevotionals.some((l) => isLocked(l)) ? ' · Premium' : ''}
                    </p>
                  )}
                </div>
              </button>
            </div>

            {/* Horizontal video strip when we have multiple devotionals */}
            {videoDevotionals.length > 1 && (
              <div className="pt-2 -mx-1">
                <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory">
                  <div className="flex gap-2.5 px-1 pb-1">
                    {videoDevotionals.map((lesson: any) => {
                      const done = isCompleted(lesson._id);
                      const locked = isLocked(lesson);
                      const thumb = lesson.video?.thumbnail || lesson.thumbnailUrl;
                      return (
                        <button
                          key={lesson._id}
                          type="button"
                          onClick={() => {
                            if (locked) return;
                            navigate(`/lesson/${lesson._id}`);
                          }}
                          className="relative flex-shrink-0 w-28 snap-center rounded-xl overflow-hidden border-2 border-[#c9a76b]/70 shadow-md active:scale-95 transition-transform"
                          style={{ background: '#5a3820' }}
                        >
                          <div className="aspect-[3/4] relative">
                            {thumb ? (
                              <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-8 h-8 text-white/40" />
                              </div>
                            )}
                            {done && (
                              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </span>
                            )}
                          </div>
                          <p className="px-1.5 py-1 text-[10px] font-bold text-[#ffe9b0] truncate bg-[#3d2314]">
                            {lesson.title}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* White fade → SailScene (after in-place Genesis zoom) */}
      {sailCinematic &&
        createPortal(
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 99980,
              background: '#fff',
              opacity: sailFade ? 1 : 0,
              transition: `opacity ${SAIL_FADE_MS}ms ease-in`,
            }}
            aria-hidden
          />,
          document.body,
        )}

      <style>{`
        .explore-map-ship {
          animation: explore-ship-bob 2.4s ease-in-out infinite;
        }
        .sail-cinematic-active .explore-map-ship {
          animation: none;
        }
        @keyframes explore-ship-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-4px) rotate(4deg); }
        }
        body[data-modal-open="true"] .bottom-nav-bar {
          display: none !important;
          pointer-events: none !important;
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
    </div>
  );
};

export default WorldPage;
