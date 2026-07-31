import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, Play, Ship, Video } from 'lucide-react';
import Header from '../components/layout/Header';
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

const DailyVerseModal = lazy(() => import('../components/modals/DailyVerseModal'));

const MAP_OCEAN = '/assets/images/map-ocean-bg.png';
const MAP_ISLAND = '/assets/images/map-island-genesis.png';
const MAP_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const MAP_CLOUD_B = '/assets/images/map-sky-cloud-b.png';
const DIVE_BUTTON = '/assets/images/dive-into-bible-button.webp';
const WELCOME_VIDEO_KEY = 'godlykids_welcome_shown';

const WOOD_PANEL: React.CSSProperties = {
  background: 'linear-gradient(165deg, #e8c892 0%, #d4a574 28%, #c4925a 55%, #b8834a 78%, #a8723c 100%)',
  boxShadow:
    'inset 0 2px 0 rgba(255,240,200,0.45), inset 0 -3px 6px rgba(80,40,10,0.28), 0 6px 16px rgba(0,0,0,0.28)',
  border: '2px solid rgba(92, 50, 18, 0.55)',
};

const WOOD_INNER: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,245,220,0.22) 0%, rgba(120,60,20,0.08) 100%)',
};

/** Twisted rope divider matching the nautical Explore mockup. */
const RopeDivider: React.FC = () => (
  <div className="relative w-full h-4 my-2.5 overflow-hidden" aria-hidden>
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 16" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ropeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5A2B" />
          <stop offset="45%" stopColor="#C4A06A" />
          <stop offset="100%" stopColor="#5C3317" />
        </linearGradient>
      </defs>
      <path
        d="M0,8 Q12,2 24,8 T48,8 T72,8 T96,8 T120,8 T144,8 T168,8 T192,8 T216,8 T240,8 T264,8 T288,8 T312,8 T336,8 T360,8 T384,8 T400,8"
        fill="none"
        stroke="url(#ropeGrad)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M0,8 Q12,13 24,8 T48,8 T72,8 T96,8 T120,8 T144,8 T168,8 T192,8 T216,8 T240,8 T264,8 T288,8 T312,8 T336,8 T360,8 T384,8 T400,8"
        fill="none"
        stroke="rgba(70,35,10,0.45)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  </div>
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

/**
 * Explore (`/world`) — wood/rope nautical layout with Map as the centerpiece.
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
  const [featuredItem, setFeaturedItem] = useState<any | null>(null);
  const [videoDevotionals, setVideoDevotionals] = useState<any[]>([]);
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleWelcomeVideoEnd = useCallback(() => {
    sessionStorage.setItem(WELCOME_VIDEO_KEY, 'true');
    setShowWelcomeVideo(false);
  }, []);

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
        const first = data[0] as any;
        setFeaturedItem({
          ...first,
          id: first._id || first.id,
          coverUrl: first.coverUrl || first.coverImage || first.files?.coverImage || '',
          title: first.title || 'New Story',
          _itemType: first._itemType || (first.isAudio ? 'playlist' : 'book'),
          _amazonUrl: first._amazonUrl || first.amazonUrl,
        });
      })
      .catch(() => {
        if (!cancelled && books[0]) {
          setFeaturedItem({
            id: books[0].id || (books[0] as any)._id,
            title: books[0].title,
            coverUrl: books[0].coverUrl || (books[0] as any).coverImage,
            _itemType: 'book',
          });
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

  const openFeatured = () => {
    if (!featuredItem) return;
    if (featuredItem._itemType === 'amazonBook' && featuredItem._amazonUrl) {
      ApiService.trackAmazonBookClick(featuredItem.id);
      DespiaService.openExternalUrl(featuredItem._amazonUrl);
      return;
    }
    if (featuredItem._itemType === 'playlist' || featuredItem.isAudio) {
      navigate(`/audio/playlist/${featuredItem.id}`);
      return;
    }
    navigate(`/book/${featuredItem.id}`);
  };

  const startLesson = () => {
    if (hasInProgress) navigate('/daily-session');
    else navigate('/daily-session', { state: { freshStart: true } });
  };

  const weekDays = getWeekDays();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Ocean backdrop — sits over panorama for a voyage look */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 20%, #5ec8f5 0%, #2aa8e0 40%, #1a8fd1 70%, #0f6fa8 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage: `url(${MAP_OCEAN})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
        aria-hidden
      />

      <Header isVisible={isHeaderVisible && !showWelcomeVideo} title="EXPLORE" />

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
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        <div className="px-3.5 pt-28 pb-48 space-y-1 max-w-lg mx-auto w-full">
          {/* ── Featured NEW RELEASE banner ── */}
          {featuredItem && (
            <button
              type="button"
              onClick={openFeatured}
              className="relative w-full rounded-2xl overflow-hidden active:scale-[0.99] transition-transform focus:outline-none"
              style={{ ...WOOD_PANEL, padding: 8 }}
              aria-label={`Explore ${featuredItem.title}`}
            >
              <div
                className="relative rounded-xl overflow-hidden flex items-stretch gap-3 min-h-[112px]"
                style={{
                  background:
                    'linear-gradient(90deg, #3d2314 0%, #5a3820 25%, #6b4428 50%, #5a3820 75%, #3d2314 100%)',
                }}
              >
                <div className="relative w-[38%] flex-shrink-0 py-2 pl-2">
                  <div className="relative aspect-[3/4] max-h-[120px] mx-auto rounded-lg overflow-hidden shadow-lg border border-[#c9a76b]/60">
                    {featuredItem.coverUrl ? (
                      <CoverImage
                        src={featuredItem.coverUrl}
                        alt={featuredItem.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#8B5A2B] flex items-center justify-center text-white font-bold text-sm px-2 text-center">
                        {featuredItem.title}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center pr-3 py-3 gap-2">
                  <span
                    className="absolute top-2 right-2 px-2.5 py-0.5 rounded-sm text-[10px] font-black tracking-wide text-white"
                    style={{
                      background: 'linear-gradient(180deg, #5cb85c, #2e7d32)',
                      boxShadow: '0 2px 0 #1b5e20',
                      transform: 'rotate(8deg)',
                    }}
                  >
                    NEW RELEASE!
                  </span>
                  <p
                    className="font-display font-black text-sm text-center leading-tight px-1"
                    style={{ color: '#ffe9b0', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {featuredItem.title}
                  </p>
                  <span
                    className="px-5 py-2 rounded-full font-display font-black text-sm text-[#3E1F07]"
                    style={{
                      background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                      boxShadow: '0 3px 0 #8B6914, inset 0 1px 0 rgba(255,255,255,0.45)',
                    }}
                  >
                    EXPLORE NOW
                  </span>
                </div>
              </div>
            </button>
          )}

          <RopeDivider />

          {/* ── Center row: Map preview + Daily Streak ── */}
          <div className="flex gap-2.5 items-stretch">
            {/* Map hero — primary centerpiece */}
            <button
              type="button"
              onClick={() => navigate('/sail')}
              className="relative flex-[1.65] min-w-0 rounded-2xl overflow-hidden active:scale-[0.99] transition-transform focus:outline-none text-left"
              style={{ ...WOOD_PANEL, padding: 7 }}
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

            {/* Daily Streak side card */}
            <div
              className="flex-1 min-w-[108px] max-w-[140px] rounded-2xl overflow-hidden flex flex-col"
              style={{ ...WOOD_PANEL, padding: 7 }}
            >
              <div
                className="flex-1 rounded-xl px-2 py-3 flex flex-col items-center"
                style={WOOD_INNER}
              >
                <p
                  className="font-display font-black text-[11px] tracking-wide text-center leading-tight mb-1"
                  style={{ color: '#5c2e12' }}
                >
                  DAILY STREAK
                </p>
                <div className="flex items-center gap-1 mb-2">
                  <Flame className="w-4 h-4 text-orange-500" fill="#f97316" />
                  <span className="font-display font-black text-lg text-[#2e7d32] leading-none">
                    {streak > 0 ? `${streak} DAYS!` : 'START!'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 w-full mb-auto">
                  {weekDays.map((date, index) => {
                    const isToday = date.getTime() === today.getTime();
                    const completed = isToday ? lessonDone : isDateCompleted(date, sessionHistory);
                    return (
                      <div key={index} className="flex items-center gap-1.5">
                        <span className="w-3 text-[9px] font-bold text-[#5c2e12]/55 text-center">
                          {dayLabels[index]}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            completed
                              ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow'
                              : isToday
                                ? 'border-2 border-[#2e7d32] bg-white/40'
                                : 'bg-[#e8e0d0]/80 text-[#8B4513]/40'
                          }`}
                        >
                          {completed ? (
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          ) : (
                            <span className="text-[8px] font-bold text-[#5c2e12]/70">{date.getDate()}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={startLesson}
                  className="mt-3 w-full py-2 rounded-xl font-display font-black text-[11px] text-white active:scale-[0.98] transition-transform"
                  style={{
                    background: 'linear-gradient(180deg, #3db8e8, #1B8BB8)',
                    boxShadow: '0 2px 0 #0e5f7a',
                  }}
                >
                  {lessonDone ? 'Review Lesson' : hasInProgress ? 'Continue' : 'Start Lesson'}
                </button>
              </div>
            </div>
          </div>

          <RopeDivider />

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

      <style>{`
        .explore-map-ship {
          animation: explore-ship-bob 2.4s ease-in-out infinite;
        }
        @keyframes explore-ship-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-4px) rotate(4deg); }
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
