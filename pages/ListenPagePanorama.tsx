import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTutorial } from '../context/TutorialContext';
import { Search, Music, Music2, ChevronDown, ChevronRight, Lock, BookOpen, Heart, Sparkles, TreePine, Star, Book, Users, Crown, Compass, Smile, Play, Headphones, Clock } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';
import CoverImage from '../components/ui/CoverImage';
import { getApiBaseUrl, ApiService } from '../services/apiService';
import StormySeaError from '../components/ui/StormySeaError';
import MusicVideoOverlay, { MusicVideo } from '../components/audio/MusicVideoOverlay';
import { getCoverThumb } from '../utils/coverImage';
import { DEFAULT_BOOK_COVER } from '../utils/placeholderImage';
import { playHistoryService } from '../services/playHistoryService';
import { useAudio, Playlist as AudioPlaylist } from '../context/AudioContext';

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

// Background of the wavy content panel — warm cream, sampled from the
// reference design. Shared by the wave SVG fill, the panel itself, and the
// fixed scroll underlay so everything reads as ONE uniform surface while
// scrolling; change it only here.
const PANEL_BG = '#F7F1E3';
const NAVY = '#173A5E';

// Shared "claymation" card chrome: white face, big corner radii, warm soft
// drop shadow plus a faint inner top highlight / bottom shading, so cards read
// as soft clay tiles resting on the cream panel. Carousels add p-1.5 so the
// artwork gets a chunky white frame like the reference.
const CLAY_CARD =
  'bg-white rounded-3xl shadow-[0_5px_14px_rgba(122,90,44,0.16),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-3px_8px_rgba(122,90,44,0.06)]';

// Hero artwork — Jesus with kids in a sailboat (1024x683 jpg, ~160KB)
const HERO_IMAGE = '/assets/images/listen-hero-boat.jpg';

// Category card configuration with colors and optional images for audio page
const CATEGORY_CONFIG: Record<string, { icon: any; bgColor: string; image?: string }> = {
  'All': { icon: Sparkles, bgColor: 'from-indigo-500 to-purple-600' },
  'Bible Stories': { icon: Book, bgColor: 'from-sky-400 to-blue-500' },
  'Nature Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Animal Tales': { icon: TreePine, bgColor: 'from-green-500 to-emerald-600' },
  'Character Building': { icon: Users, bgColor: 'from-amber-400 to-orange-500' },
  'Adventures': { icon: Compass, bgColor: 'from-rose-400 to-red-500' },
  'Bible Adventures': { icon: Compass, bgColor: 'from-amber-500 to-yellow-500' },
  'Favorites': { icon: Heart, bgColor: 'from-pink-400 to-rose-500' },
  'Music': { icon: Music, bgColor: 'from-violet-500 to-purple-600' },
  'Worship': { icon: Star, bgColor: 'from-yellow-400 to-amber-500' },
  'Lullabies': { icon: Smile, bgColor: 'from-indigo-400 to-blue-500' },
  'Sleepy Sounds': { icon: Smile, bgColor: 'from-indigo-400 to-violet-500' },
  'Bedtime Stories': { icon: Smile, bgColor: 'from-indigo-500 to-purple-600' },
  'Stories': { icon: BookOpen, bgColor: 'from-teal-400 to-cyan-500' },
  'Fantasy Worlds': { icon: Crown, bgColor: 'from-sky-400 to-blue-500' },
  'Funny Fables': { icon: Smile, bgColor: 'from-amber-400 to-orange-400' },
  'default': { icon: Crown, bgColor: 'from-slate-400 to-slate-600' },
};

// Soft pastel tile backgrounds + matching icon colors for category tiles
// without API artwork (cycled by index, like the reference layout).
const TILE_PASTELS = ['#E8F1FE', '#FDECEF', '#EDF9EE', '#FFF4E0', '#F3EDFB', '#E6F7F6'];
const TILE_ICON_COLORS = ['#2563eb', '#e0447a', '#2f9e44', '#e8890c', '#7c3aed', '#0d9488'];

interface Playlist {
  _id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  category?: string;
  type?: 'Song' | 'Audiobook';
  items: any[];
  status: 'draft' | 'published';
  minAge?: number;
  level?: string;
  isMembersOnly?: boolean;
}

interface CategoryData {
  _id: string;
  name: string;
  gradientFrom?: string;
  gradientTo?: string;
  image?: string;
  icon?: string;
}

// GET play-events/top-week — global weekly play chart entry
interface TopWeekEntry {
  playlistId: string;
  plays: number;
}

// GET playlists/most-played-episodes — all-time episode chart entry
interface TopEpisode {
  _id: string;
  title: string;
  coverImage?: string;
  playCount: number;
  itemIndex: number;
  playlist?: { _id: string; title?: string };
}

/** Ocean-wave top edge of the content panel — two stacked SVG paths for depth. */
const WaveDivider: React.FC = () => (
  <div className="relative z-10 -mt-10 pointer-events-none" aria-hidden>
    {/* Back wave — translucent cream peeking above the front wave */}
    <svg
      viewBox="0 0 1440 110"
      preserveAspectRatio="none"
      className="block w-full h-14 md:h-20"
    >
      <path
        d="M0,50 C200,10 420,92 660,58 C900,24 1140,88 1440,40 L1440,110 L0,110 Z"
        fill={PANEL_BG}
        opacity={0.5}
      />
      <path
        d="M0,74 C220,112 430,28 690,52 C950,76 1130,110 1440,60 L1440,110 L0,110 Z"
        fill={PANEL_BG}
      />
    </svg>
  </div>
);

/** Bold navy section heading with an optional "View All >" link on the right. */
const SectionHeading: React.FC<{
  children: React.ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}> = ({ children, onViewAll, viewAllLabel = 'View All' }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-display font-black text-xl" style={{ color: NAVY }}>{children}</h2>
    {onViewAll && (
      <button
        type="button"
        onClick={onViewAll}
        className="flex items-center gap-0.5 text-sm font-display font-bold text-[#2563eb] active:opacity-70"
      >
        {viewAllLabel}
        <ChevronRight size={16} />
      </button>
    )}
  </div>
);

/**
 * Story book card for Read mode — same clay chrome, portrait 3:4 cover and
 * sizing as the Explore Audio Library playlist cards, so the read catalog
 * lines up visually with the audio carousels. Keeps BookCard's title
 * translation but swaps the dark-page styling for the cream panel look.
 */
const StoryBookCard: React.FC<{
  book: any;
  onClick: (id: string) => void;
  isSubscribed: boolean;
  className?: string;
}> = ({ book, onClick, isSubscribed, className = '' }) => {
  const { currentLanguage, translateText } = useLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(book.title);

  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedTitle(book.title);
      return;
    }
    translateText(book.title).then(setTranslatedTitle);
  }, [book.title, currentLanguage, translateText]);

  const isLocked = book.isMembersOnly === true && !isSubscribed;

  return (
    <button
      type="button"
      onClick={() => onClick(book.id)}
      className={`relative p-1.5 text-left cursor-pointer active:scale-[0.97] hover:scale-105 transition-all group ${CLAY_CARD} ${isLocked ? 'opacity-80' : ''} ${className}`}
    >
      <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 relative">
        <CoverImage
          src={book.coverUrl}
          alt={book.title}
          fallback={DEFAULT_BOOK_COVER}
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${isLocked ? 'brightness-75' : ''}`}
        />

        {isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700]">
              <Lock size={24} className="text-[#FFD700]" />
            </div>
          </div>
        )}
        {book.isMembersOnly && !isSubscribed && (
          <PremiumBadge className="absolute top-2 right-2 z-20" />
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

        {/* Age Badge - Bottom Left */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 z-20">
          {book.level || 'All'}
        </div>

        {/* Read affordance - Bottom Right (mirrors the headphone circle) */}
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md z-20">
          <BookOpen size={15} className="text-[#2563eb]" />
        </div>
      </div>

      {/* Info */}
      <div className="px-1 pt-1.5 pb-1">
        <h3 className="text-xs font-bold mb-0.5 truncate font-display" style={{ color: NAVY }}>
          {translatedTitle}
        </h3>
        {book.author && (
          <p className="text-[10px] truncate" style={{ color: 'rgba(23,58,94,0.55)' }}>{book.author}</p>
        )}
      </div>
    </button>
  );
};

const formatVideoDuration = (seconds?: number): string | null => {
  if (!seconds || isNaN(seconds)) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Music Videos as a white-card carousel matching the Recommended row.
 * Same behavior as the shared MusicVideosShelf (members-only paywall gate,
 * view-count increment, fullscreen overlay) restyled for the white panel;
 * the dark neon shelf stays in use on the non-panorama ListenPage.
 */
const MusicVideosSection: React.FC = () => {
  const navigate = useNavigate();
  const { isSubscribed } = useUser();
  const [videos, setVideos] = useState<MusicVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<MusicVideo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const baseUrl = getApiBaseUrl();
        // Cache-bust so a video published in the Portal shows up on next load
        const res = await fetch(`${baseUrl}music-videos?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load music videos');
        const json = await res.json();
        const list: MusicVideo[] = Array.isArray(json) ? json : (json.data || []);
        if (!cancelled) {
          const playable = list.filter(v => v.videoUrl);
          // Featured videos lead the carousel
          setVideos([...playable.filter(v => v.isFeatured), ...playable.filter(v => !v.isFeatured)]);
        }
      } catch {
        if (!cancelled) setVideos([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openVideo = (video: MusicVideo) => {
    // Music videos are a members-only perk
    if (!isSubscribed) {
      navigate('/paywall', { state: { from: '/listen' } });
      return;
    }
    // Fire-and-forget view count
    try {
      const baseUrl = getApiBaseUrl();
      fetch(`${baseUrl}music-videos/${video._id}/increment-view`, { method: 'POST' }).catch(() => {});
    } catch { /* ignore */ }
    setActiveVideo(video);
  };

  if (videos.length === 0) return null;

  return (
    <div className="mb-6">
      <SectionHeading onViewAll={() => navigate('/music-videos')}>Music Videos</SectionHeading>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {videos.map((video) => {
          const dur = formatVideoDuration(video.duration);
          return (
            <button
              key={video._id}
              type="button"
              onClick={() => openVideo(video)}
              className={`relative shrink-0 w-40 p-1.5 text-left active:scale-[0.97] transition-transform ${CLAY_CARD}`}
            >
              <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                {video.thumbnailUrl ? (
                  <img
                    src={getCoverThumb(video.thumbnailUrl)}
                    alt={video.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-white/60" />
                  </div>
                )}
                {(video.isPopular || video.isNew) && (
                  <span className={`absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide text-white shadow-md ${
                    video.isPopular ? 'bg-fuchsia-600/90' : 'bg-emerald-500/90'
                  }`}>
                    {video.isPopular ? 'Popular' : 'New'}
                  </span>
                )}
                {!isSubscribed && (
                  <span className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                    <Crown size={12} className="text-[#FFD700]" fill="#FFD700" />
                  </span>
                )}
                {dur && (
                  <span className="absolute bottom-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                    {dur}
                  </span>
                )}
              </div>
              <div className="px-1 pt-2 pb-1 pr-9">
                <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: NAVY }}>
                  {video.title}
                </p>
                <p className="text-[10px] font-bold truncate min-h-[14px]" style={{ color: 'rgba(23,58,94,0.55)' }}>
                  {video.author || ''}
                </p>
              </div>
              <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)]">
                <Play size={14} className="text-white ml-0.5" fill="white" />
              </span>
            </button>
          );
        })}
      </div>
      {activeVideo && (
        <MusicVideoOverlay video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
};

const ListenPagePanorama: React.FC = () => {

  const navigate = useNavigate();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { isSubscribed, kids, currentProfileId } = useUser();
  const { isTutorialActive, isStepActive, nextStep } = useTutorial();
  const { playPlaylist } = useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [categoryData, setCategoryData] = useState<Record<string, CategoryData>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  // Global play charts — empty until the endpoints respond (sections hide when empty)
  const [topWeek, setTopWeek] = useState<TopWeekEntry[]>([]);
  const [topEpisodes, setTopEpisodes] = useState<TopEpisode[]>([]);
  // One library, two modes: Listen (audio catalog) or Read (story books).
  // Read-mode data loads lazily on the first switch.
  const [libraryMode, setLibraryMode] = useState<'listen' | 'read'>('listen');
  const [bookSeries, setBookSeries] = useState<any[]>([]);
  const [trendingBooks, setTrendingBooks] = useState<any[]>([]);
  const readDataLoadedRef = useRef(false);
  const ageDropdownRef = useRef<HTMLDivElement>(null);
  // "View All" on Recommended scrolls to the full playlist grid below
  const voyageRef = useRef<HTMLDivElement>(null);

  // --- Cream backstop while scrolled into the panel ---
  // The scroller lives inside overflow-hidden layout wrappers, which clip any
  // ink-overflow tricks (box shadows) painted past the content end. Instead, a
  // position:fixed cream underlay (fixed elements escape overflow clipping) is
  // toggled on once the wave has scrolled past the top of the viewport, so any
  // region the content fails to cover — gaps, short content, bottom
  // rubber-banding — paints cream instead of the panorama behind the page.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPastWave, setIsPastWave] = useState(false);

  // --- Parallax hero ---
  // The hero image translates down at ~45% of the scroll rate, so it appears
  // to scroll slower while the wave + cream panel slide up over it. Written
  // directly to the DOM node (transform only, rAF-throttled) so scrolling
  // never triggers React renders or layout thrash. Disabled entirely when the
  // user prefers reduced motion.
  const heroImgRef = useRef<HTMLImageElement>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return () => {
      if (parallaxRafRef.current !== null) cancelAnimationFrame(parallaxRafRef.current);
    };
  }, []);

  const handleScroll = () => {
    if (parallaxRafRef.current !== null) return; // coalesce to one update per frame
    parallaxRafRef.current = requestAnimationFrame(() => {
      parallaxRafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      // offsetTop is relative to the scroller (its offsetParent, position:relative)
      const panelTop = panelRef.current?.offsetTop ?? 400;
      setIsPastWave(el.scrollTop >= panelTop - 2);
      if (heroImgRef.current && !reducedMotionRef.current) {
        // Clamped at 0 so top rubber-banding never pulls the image up off the wave
        const y = Math.max(0, el.scrollTop) * 0.45;
        heroImgRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
      }
    });
  };

  // Fetch playlists function
  const fetchPlaylists = async () => {
    try {
      setPlaylistsLoading(true);
      setPlaylistsError(null);
      const baseUrl = getApiBaseUrl();
      const endpoint = `${baseUrl}playlists?status=published`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        // Handle both paginated response { data: [...] } and direct array response
        const playlistsArray = Array.isArray(responseData) ? responseData : (responseData.data || []);

        const validPlaylists = playlistsArray.filter((p: any) => {
          return p._id && p.title && p.status === 'published' && p.items && Array.isArray(p.items) && p.items.length > 0;
        });

        console.log('📻 Fetched playlists:', validPlaylists.length);
        setPlaylists(validPlaylists);
        setPlaylistsError(null);
      } else {
        console.error('Error fetching playlists:', response.status);
        setPlaylistsError('Failed to load audio content');
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setPlaylistsError(error instanceof Error ? error.message : 'Failed to load audio content');
    } finally {
      setPlaylistsLoading(false);
    }
  };

  // Fetch playlists on mount
  useEffect(() => {
    fetchPlaylists();
  }, []);

  // Fetch global play charts on mount, from the trending-episodes endpoint
  // that is already live in production (same one the Explore/home page uses).
  // Any failure (network, bad shape, empty) just leaves the arrays empty and
  // the sections hidden. Never shows an error to kids.
  useEffect(() => {
    let cancelled = false;
    const baseUrl = getApiBaseUrl();
    (async () => {
      try {
        // 7-day window = "Top 10 of the week". Over-fetch since several top
        // episodes can belong to the same playlist; dedupe keeps chart order.
        const res = await fetch(`${baseUrl}playlists/trending-episodes?limit=30&timeWindow=7d`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const seen = new Set<string>();
        const entries: TopWeekEntry[] = [];
        for (const ep of data) {
          const pid = ep?.playlist?._id;
          if (!pid || seen.has(pid)) continue;
          seen.add(pid);
          entries.push({ playlistId: pid, plays: ep.recentPlays ?? 0 });
        }
        setTopWeek(entries);
      } catch { /* section stays hidden */ }
    })();
    (async () => {
      try {
        // Widest window play events support (30-day TTL) — the closest live
        // semantic to an all-time "most played" chart.
        const res = await fetch(`${baseUrl}playlists/trending-episodes?limit=10&timeWindow=30d`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const episodes: TopEpisode[] = data
          .filter((ep: any) => ep?._id && ep?.playlist?._id)
          .map((ep: any) => ({
            _id: ep._id,
            title: ep.title,
            coverImage: ep.coverImage,
            playCount: ep.recentPlays ?? 0,
            itemIndex: ep.itemIndex ?? 0,
            playlist: { _id: ep.playlist._id, title: ep.playlist.title },
          }));
        setTopEpisodes(episodes);
      } catch { /* section stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Lazy-load Read-mode data (book series + trending books) on first switch.
  // Failures just hide the respective rows — never an error state.
  useEffect(() => {
    if (libraryMode !== 'read' || readDataLoadedRef.current) return;
    readDataLoadedRef.current = true;
    (async () => {
      try { setBookSeries(await ApiService.getBookSeries()); } catch { /* row hides */ }
    })();
    (async () => {
      try { setTrendingBooks(await ApiService.getTrendingBooks(10)); } catch { /* row hides */ }
    })();
  }, [libraryMode]);

  // Fetch categories on mount (audio type only, excluding explore-only categories)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await ApiService.getCategories('audio');
        // Filter out categories that are marked for explore page only
        const nonExploreCategories = cats.filter((c: any) => !c.showOnExplore);
        const categoryNames = ['All', ...nonExploreCategories.map((c: any) => c.name).filter(Boolean)];
        setCategories(categoryNames);

        // Store full category data for images and gradients
        const dataMap: Record<string, CategoryData> = {};
        nonExploreCategories.forEach((c: any) => {
          if (c.name) {
            dataMap[c.name] = {
              _id: c._id,
              name: c.name,
              gradientFrom: c.gradientFrom,
              gradientTo: c.gradientTo,
              image: c.image,
              icon: c.icon,
            };
          }
        });
        console.log('📚 Category data loaded:', Object.keys(dataMap).length, 'categories');
        setCategoryData(dataMap);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Extract categories from playlists and books as fallback
        const playlistCategories = playlists.map(p => p.category).filter(Boolean);
        const bookCategories = books.filter(b => b.isAudio).map(b => b.category).filter(Boolean);
        const uniqueCategories = ['All', ...new Set([...playlistCategories, ...bookCategories])];
        setCategories(uniqueCategories as string[]);
      }
    };
    fetchCategories();
  }, [books, playlists]);

  // Close age dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ageDropdownRef.current && !ageDropdownRef.current.contains(event.target as Node)) {
        setShowAgeDropdown(false);
      }
    };

    if (showAgeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showAgeDropdown]);

  // Greeting name: active kid profile, falling back to "Explorer"
  const kidName = useMemo(() => {
    if (currentProfileId) {
      const kid = kids.find((k: any) => k.id === currentProfileId);
      if (kid?.name) return kid.name;
    }
    return 'Explorer';
  }, [kids, currentProfileId]);

  // Recently played playlists (per-profile localStorage history), most recent first
  const recentPlaylists = useMemo(() => {
    if (playlists.length === 0) return [];
    const ids = playHistoryService.getRecentlyPlayedIds(6);
    return ids
      .map(id => playlists.find(p => p._id === id))
      .filter((p): p is Playlist => Boolean(p));
  }, [playlists]);

  // Progress through a playlist. Uses the real saved playback position when
  // available (AudioContext persists it while playing); falls back to the old
  // episode-index approximation for entries without one.
  const getPlaylistProgress = (p: Playlist): number => {
    const entry = playHistoryService.getHistory(p._id);
    if (!entry) return 0;
    if (!entry.itemId || !Array.isArray(p.items) || p.items.length === 0) return 0.1;
    const idx = p.items.findIndex((it: any) => it?._id === entry.itemId || it?.id === entry.itemId);
    if (idx < 0) return 0.1;

    if (typeof entry.positionSeconds === 'number' && entry.positionSeconds > 0) {
      // Exact: seconds listened across the whole playlist, when durations are known
      const totalSec = p.items.reduce((sum: number, it: any) => sum + getItemDurationSec(it), 0);
      if (totalSec > 0) {
        const beforeSec = p.items.slice(0, idx).reduce((sum: number, it: any) => sum + getItemDurationSec(it), 0);
        return Math.min(1, Math.max(0.02, (beforeSec + entry.positionSeconds) / totalSec));
      }
      // No item durations — blend the within-episode fraction into the index
      if (typeof entry.durationSeconds === 'number' && entry.durationSeconds > 0) {
        const frac = Math.min(1, entry.positionSeconds / entry.durationSeconds);
        return Math.min(1, Math.max(0.02, (idx + frac) / p.items.length));
      }
    }

    return Math.min(1, Math.max(0.08, (idx + 0.5) / p.items.length));
  };

  const continuePlaylist = recentPlaylists[0] || null;
  const continueRowPlaylists = recentPlaylists.slice(0, 6);

  // "Recommended for you" — playlists the profile hasn't played recently.
  // Falls back to the full list for brand-new profiles with no history.
  const recommendedPlaylists = useMemo(() => {
    if (playlists.length === 0) return [];
    const recentIds = new Set(playHistoryService.getRecentlyPlayedIds(20));
    const unplayed = playlists.filter(p => !recentIds.has(p._id));
    return (unplayed.length > 0 ? unplayed : playlists).slice(0, 8);
  }, [playlists]);

  // "Top 10 of the week" — resolve chart playlist ids against loaded playlists;
  // unresolved ids (unpublished/removed) are skipped.
  const topWeekPlaylists = useMemo(() => {
    if (topWeek.length === 0 || playlists.length === 0) return [];
    return topWeek
      .map(entry => playlists.find(p => p._id === entry.playlistId))
      .filter((p): p is Playlist => Boolean(p))
      .slice(0, 10);
  }, [topWeek, playlists]);

  // "Most played Episodes" — keep only episodes whose parent playlist is loaded
  const mostPlayedEpisodes = useMemo(() => {
    if (topEpisodes.length === 0 || playlists.length === 0) return [];
    return topEpisodes
      .map(ep => {
        const parent = playlists.find(p => p._id === ep.playlist?._id);
        return parent ? { ...ep, parent } : null;
      })
      .filter((e): e is TopEpisode & { parent: Playlist } => Boolean(e))
      .slice(0, 10);
  }, [topEpisodes, playlists]);

  // Per-item durations are optional in the playlist data — treat missing as 0
  // and only render time chips when at least something is known.
  const getItemDurationSec = (it: any): number => {
    const d = it?.duration ?? it?.durationSeconds;
    return typeof d === 'number' && isFinite(d) && d > 0 ? d : 0;
  };

  const getPlaylistMinutes = (p: Playlist): number | null => {
    const total = (p.items || []).reduce((sum: number, it: any) => sum + getItemDurationSec(it), 0);
    return total > 0 ? Math.max(1, Math.round(total / 60)) : null;
  };

  const getMinutesLeft = (p: Playlist): number | null => {
    const entry = playHistoryService.getHistory(p._id);
    if (!entry?.itemId || !Array.isArray(p.items) || p.items.length === 0) return null;
    const idx = p.items.findIndex((it: any) => it?._id === entry.itemId || it?.id === entry.itemId);
    if (idx < 0) return null;

    // With a real saved position: remainder of the current episode plus
    // everything after it
    if (typeof entry.positionSeconds === 'number' && entry.positionSeconds > 0) {
      const curDur = getItemDurationSec(p.items[idx]) || entry.durationSeconds || 0;
      if (curDur > 0) {
        const remaining =
          Math.max(0, curDur - entry.positionSeconds) +
          p.items.slice(idx + 1).reduce((sum: number, it: any) => sum + getItemDurationSec(it), 0);
        return remaining > 0 ? Math.max(1, Math.round(remaining / 60)) : null;
      }
    }

    // Fallback: remaining ≈ half the last-played item plus everything after it
    const remaining = p.items
      .slice(idx)
      .reduce((sum: number, it: any, i: number) => sum + getItemDurationSec(it) * (i === 0 ? 0.5 : 1), 0);
    return remaining > 0 ? Math.max(1, Math.round(remaining / 60)) : null;
  };

  const getChapterLabel = (p: Playlist): string => {
    const unit = p.type === 'Audiobook' ? 'Chapter' : 'Song';
    const entry = playHistoryService.getHistory(p._id);
    if (entry?.itemId && Array.isArray(p.items)) {
      const idx = p.items.findIndex((it: any) => it?._id === entry.itemId || it?.id === entry.itemId);
      if (idx >= 0) return `${unit} ${idx + 1}`;
    }
    return `${p.items.length} ${unit.toLowerCase()}${p.items.length === 1 ? '' : 's'}`;
  };

  const getAgeLabel = (p: Playlist): string | null =>
    p.level || (p.minAge ? `${p.minAge}+` : null);

  // Filter for audio books
  const audioBooks = books.filter(b => b.isAudio);

  // Filter by category (supports both single category and categories array)
  const categoryFilteredBooks = selectedCategory === 'All'
    ? audioBooks
    : audioBooks.filter(b => {
        // Check if book has categories array or single category
        const bookCategories = (b as any).categories && Array.isArray((b as any).categories)
          ? (b as any).categories
          : (b.category ? [b.category] : []);
        return bookCategories.includes(selectedCategory);
      });

  const categoryFilteredPlaylists = selectedCategory === 'All'
    ? playlists
    : playlists.filter(p => {
        // Check if playlist has categories array or single category
        const playlistCategories = (p as any).categories && Array.isArray((p as any).categories)
          ? (p as any).categories
          : (p.category ? [p.category] : []);
        return playlistCategories.includes(selectedCategory);
      });

  // Filter by age - for audio books
  const ageFilteredBooks = selectedAge === 'All Ages'
    ? categoryFilteredBooks
    : categoryFilteredBooks.filter(b => {
        const bookAge = b.level || '';
        if (selectedAge === '3+') return bookAge.includes('3');
        if (selectedAge === '4+') return bookAge.includes('4');
        if (selectedAge === '5+') return bookAge.includes('5');
        if (selectedAge === '6+') return bookAge.includes('6');
        if (selectedAge === '7+') return bookAge.includes('7');
        if (selectedAge === '8+') return bookAge.includes('8');
        if (selectedAge === '9+') return bookAge.includes('9');
        if (selectedAge === '10+') return bookAge.includes('10');
        return true;
      });

  // Filter by age - for playlists
  // Show playlists where minAge <= selected age (appropriate for that age)
  const ageFilteredPlaylists = selectedAge === 'All Ages'
    ? categoryFilteredPlaylists
    : categoryFilteredPlaylists.filter(p => {
        const selectedAgeNum = parseInt(selectedAge.replace('+', ''));

        // Check minAge first (numeric)
        if (p.minAge !== undefined && p.minAge !== null) {
          return p.minAge <= selectedAgeNum;
        }

        // Fallback to level string parsing
        if (p.level) {
          const levelMatch = p.level.match(/(\d+)/);
          if (levelMatch) {
            return parseInt(levelMatch[1]) <= selectedAgeNum;
          }
        }

        // If no age info, show it (assume it's for all ages)
        return true;
      });

  // Apply Search Filter
  const filteredBooks = ageFilteredBooks.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.author && b.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPlaylists = ageFilteredPlaylists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.author && p.author.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- Read mode data ---
  // Books that belong to a series surface through the series card instead
  const booksInSeries = useMemo(() => {
    const ids = new Set<string>();
    bookSeries.forEach((s: any) => {
      s.books?.forEach((ref: any) => {
        const id = ref.book?._id || ref.book || ref._id;
        if (id) ids.add(id.toString());
      });
    });
    return ids;
  }, [bookSeries]);

  const matchesSelectedAge = (level?: string): boolean =>
    selectedAge === 'All Ages' || (level || '').includes(selectedAge.replace('+', ''));

  // Standalone story books, respecting the shared search + age controls
  const filteredReadBooks = books.filter(b => {
    if (b.isAudio) return false;
    const bookId = (b.id || (b as any)._id)?.toString?.() ?? '';
    if (booksInSeries.has(bookId)) return false;
    if (!matchesSelectedAge(b.level)) return false;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || Boolean(b.author && b.author.toLowerCase().includes(q));
  });

  const filteredReadSeries = bookSeries.filter((s: any) => {
    if (!matchesSelectedAge(s.level || s.minAge?.toString())) return false;
    const q = searchQuery.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || Boolean(s.author && s.author.toLowerCase().includes(q));
  });

  const trendingReadBooks = trendingBooks.filter((b: any) => !b.isAudio).slice(0, 10);

  const openPlaylist = (playlist: Playlist, index?: number) => {
    // Allow navigation to detail page even for locked content — the detail
    // page shows preview functionality (1-minute demo).
    // Advance tutorial when clicking the highlighted audiobook.
    if (index === 0 && isTutorialActive && isStepActive('audiobook_highlight')) {
      nextStep(); // Advance to tutorial_complete
    }
    navigate(`/audio/playlist/${playlist._id}`);
  };

  // Resume the last-played episode right here on the Listen page — the global
  // MiniPlayer bar appears above the bottom nav once playback starts. Playlist
  // data is already fully loaded in memory (items included), so playback is
  // instant with no fetch or loading state. playPlaylist itself handles the
  // 2-minute preview mode for members-only content when not subscribed.
  const resumePlaylist = (p: Playlist) => {
    // Sort a copy by item order, matching how the player pages queue tracks
    const items = [...(p.items || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const entry = playHistoryService.getHistory(p._id);
    let startIndex = 0;
    let resumeAt: number | undefined;
    if (entry?.itemId) {
      const idx = items.findIndex((it: any) => it?._id === entry.itemId || it?.id === entry.itemId);
      if (idx >= 0) {
        startIndex = idx;
        // Seek back to the exact saved position within that episode (null when
        // nothing meaningful is saved — barely started or already finished)
        resumeAt = playHistoryService.getResumePosition(p._id)?.positionSeconds;
      }
    }
    playPlaylist({ ...p, items } as AudioPlaylist, startIndex, isSubscribed, resumeAt);
  };

  // Discovery rows only make sense on the unfiltered view — hide them while
  // the kid is searching or has a category selected.
  const isBrowsingAll = selectedCategory === 'All' && !searchQuery;
  const showContinueRow = continueRowPlaylists.length > 0 && isBrowsingAll;
  const showRecommended = recommendedPlaylists.length > 0 && isBrowsingAll;
  const showTopWeek = topWeekPlaylists.length > 0 && isBrowsingAll;
  const showMostPlayed = mostPlayedEpisodes.length > 0 && isBrowsingAll;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex flex-col h-full overflow-y-auto no-scrollbar relative"
    >
      {/* Fixed cream underlay — paints above the panorama but below all page
          content (negative z within the layout's stacking context). Active only
          once the hero + wave are fully scrolled past, so it's invisible to
          toggle, and it guarantees a solid cream surface from the wave down. */}
      {isPastWave && (
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{ backgroundColor: PANEL_BG, zIndex: -1 }}
        />
      )}

      {/* ============ HERO — boat artwork with the greeting overlaid ============ */}
      {/* No page header here — just clear the notch/status bar, then the greeting */}
      <div className="relative px-4 pt-[calc(var(--safe-area-top,0px)+1.25rem)] pb-14">
        {/* Boat scene fills the hero. The clipped wrapper lets the image
            translate for the parallax without ever painting past the hero
            bounds, keeping the wave seam clean. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            ref={heroImgRef}
            src={HERO_IMAGE}
            alt=""
            draggable={false}
            className="w-full h-full object-cover object-[70%_center] select-none will-change-transform"
          />
        </div>
        {/* Top scrim so the greeting stays readable — fades out before the
            faces in the lower half of the artwork */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(9,38,68,0.5) 0%, rgba(9,38,68,0.28) 38%, rgba(9,38,68,0.04) 62%, transparent 78%)',
          }}
        />

        {/* Hero content paints above the artwork — greeting only, anchored to
            the top of the hero so the faces in the boat scene stay clear */}
        <div className="relative min-h-[9.5rem] flex flex-col justify-start">
          <div className="max-w-xl">
            <h1 className="font-display font-black text-4xl md:text-5xl text-white leading-tight drop-shadow-[0_2px_8px_rgba(10,40,80,0.65)]">
              Ahoy, {kidName}!
            </h1>
            <p className="font-display font-semibold text-white/90 text-base md:text-lg mt-1 drop-shadow-[0_1px_4px_rgba(10,40,80,0.6)]">
              Listen to God&rsquo;s Word and let your journey begin!
            </p>
          </div>
        </div>
      </div>

      {/* ============ WAVY TRANSITION + CREAM CONTENT PANEL ============ */}
      <WaveDivider />
      {/* min-h-screen: the cream panel always extends at least a full viewport
          past the wave, so normal scrolling can never run out of cream surface
          even in loading/short-content states. All sections live inside it.
          NOTE: no flex-1 here — inside the fixed-height flex column it locked
          the panel box at exactly 100vh, so long content overflowed PAST the
          padding box and the bottom padding never cleared the wood tab bar.
          shrink-0 is required for the same reason: the scroller is a
          fixed-height flex column, so the default flex-shrink:1 clamps this
          flex item back down to its min-height (100vh) and long content
          overflows past the padding box again.
          Bottom clearance = plank (--map-footer-h) × 1.24 (active notch rises
          ~24% above the plank) + lift + safe area + breathing room. */}
      <div
        ref={panelRef}
        className="-mt-px px-4 min-h-screen shrink-0"
        style={{
          backgroundColor: PANEL_BG,
          paddingBottom:
            'calc(var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px) + var(--map-footer-h, 78px) * 1.24 + 2rem)',
        }}
      >

        {/* Listen / Read segmented toggle — a compact pill floating in the
            wave/water transition (pulled up over the wave with negative
            margin; the pill is opaque and sits above the wave's z-10, so
            nothing shows through). Active segment: solid navy, white text;
            inactive: white pill with a thin outline and navy text. */}
        <div className="relative z-20 -mt-9 mb-4 flex justify-center">
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-white shadow-[0_5px_14px_rgba(23,58,94,0.28)]">
            <button
              type="button"
              onClick={() => setLibraryMode('listen')}
              aria-pressed={libraryMode === 'listen'}
              className={`flex items-center justify-center gap-1.5 px-5 py-2 rounded-full font-display font-black text-sm transition-colors ${
                libraryMode === 'listen'
                  ? 'bg-[#173A5E] text-white'
                  : 'bg-white text-[#173A5E] border border-[#173A5E]/30 active:bg-[#f4f7fa]'
              }`}
            >
              <Headphones size={16} />
              Listen
            </button>
            <button
              type="button"
              onClick={() => setLibraryMode('read')}
              aria-pressed={libraryMode === 'read'}
              className={`flex items-center justify-center gap-1.5 px-5 py-2 rounded-full font-display font-black text-sm transition-colors ${
                libraryMode === 'read'
                  ? 'bg-[#173A5E] text-white'
                  : 'bg-white text-[#173A5E] border border-[#173A5E]/30 active:bg-[#f4f7fa]'
              }`}
            >
              <BookOpen size={16} />
              Read
            </button>
          </div>
        </div>

        {/* Search Bar with Age Filter — shared by both modes (light style) */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={20} style={{ color: 'rgba(23,58,94,0.45)' }} />
            </div>
            <input
              type="text"
              placeholder={libraryMode === 'read' ? 'Search stories...' : 'Search adventures...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-[#eee3cd] rounded-xl py-3 pl-10 pr-4 font-display text-[#173A5E] placeholder:text-[#173A5E]/45 shadow-[0_3px_8px_rgba(122,90,44,0.08)] focus:outline-none focus:border-[#2563eb]/50 transition-colors"
            />
          </div>

          {/* Age Filter Dropdown */}
          <div className="relative" ref={ageDropdownRef}>
            <button
              onClick={() => setShowAgeDropdown(!showAgeDropdown)}
              className="bg-white border-2 border-[#eee3cd] rounded-xl py-3 px-4 shadow-[0_3px_8px_rgba(122,90,44,0.08)] hover:bg-[#fbf6ea] transition-colors font-display flex items-center gap-1 min-w-[100px] justify-center"
              style={{ color: NAVY }}
            >
              <span className="text-sm font-bold">{selectedAge}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showAgeDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Age Dropdown Menu */}
            {showAgeDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-white rounded-xl border border-[#eee3cd] shadow-2xl z-50 min-w-[120px] max-h-[300px] overflow-y-auto">
                <div className="py-2">
                  {ageOptions.map((age) => (
                    <button
                      key={age}
                      onClick={() => {
                        setSelectedAge(age);
                        setShowAgeDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#fbf6ea] ${
                        selectedAge === age ? 'bg-[#e8f1fe] font-bold' : ''
                      }`}
                      style={{ color: NAVY }}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============ LISTEN MODE — audio catalog ============ */}
        {libraryMode === 'listen' && (<>

        {/* Continue Listening — wood plaque. Tapping it resumes playback of the
            last-played episode immediately (MiniPlayer pops up); the small
            cover thumb is the secondary affordance to open the playlist page. */}
        {continuePlaylist && (
          <button
            type="button"
            onClick={() => resumePlaylist(continuePlaylist)}
            className="w-full max-w-md flex items-center gap-3 rounded-2xl px-4 py-3 mb-6 border-2 border-[#8a5a2b] active:scale-[0.98] transition-transform text-left"
            style={{
              background: 'linear-gradient(180deg, #D9A05B 0%, #C4884A 45%, #A56B3A 100%)',
              boxShadow: '0 4px 0 #7a4a20, 0 6px 14px rgba(30,15,0,0.35), inset 0 1px 0 rgba(255,235,190,0.5)',
            }}
          >
            <div
              className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 32% 28%, #FFF6DE 0%, #F5E6C8 55%, #D9C49A 100%)',
                boxShadow: '0 2px 3px rgba(60,30,10,0.4), inset 0 -1px 2px rgba(90,50,10,0.25)',
              }}
            >
              <Play size={20} className="text-[#5c2e0b] ml-0.5" fill="#5c2e0b" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-black text-[#5c2e0b]/80 font-display">
                Continue Listening
              </p>
              <p className="font-display font-bold text-[#3b2007] truncate leading-snug">
                {continuePlaylist.title}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#7a4a20]/45 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FFF3D6]"
                  style={{ width: `${Math.round(getPlaylistProgress(continuePlaylist) * 100)}%` }}
                />
              </div>
            </div>
            {continuePlaylist.coverImage && (
              <span
                role="button"
                aria-label={`Open ${continuePlaylist.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openPlaylist(continuePlaylist);
                }}
                className="block w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden border-2 border-[#8a5a2b] shadow-md cursor-pointer"
              >
                <CoverImage
                  src={continuePlaylist.coverImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </span>
            )}
          </button>
        )}

        {/* Explore Categories — small rounded-square tiles, label underneath.
            "View All" toggles between one scrollable row and a wrapped grid. */}
        <div className="pt-1 mb-6">
          <SectionHeading
            onViewAll={() => setShowAllCategories(v => !v)}
            viewAllLabel={showAllCategories ? 'Show Less' : 'View All'}
          >
            Explore Categories
          </SectionHeading>
          <div className={showAllCategories
            ? 'flex flex-wrap gap-3'
            : 'flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1'
          }>
            {categories.map((category, i) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['default'];
              const IconComponent = config.icon;
              const isSelected = selectedCategory === category;
              const catData = categoryData[category];
              const pastel = TILE_PASTELS[i % TILE_PASTELS.length];
              const iconColor = TILE_ICON_COLORS[i % TILE_ICON_COLORS.length];
              const label = category === 'All' ? 'All' : category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`relative shrink-0 w-28 aspect-[3/4] rounded-3xl overflow-hidden active:scale-95 transition-transform shadow-[0_5px_14px_rgba(122,90,44,0.18)] ${
                    isSelected ? 'ring-[3px] ring-[#2563eb]' : 'ring-[3px] ring-white'
                  }`}
                  style={{ backgroundColor: pastel }}
                >
                  {/* Artwork fills the card below the title band */}
                  {catData?.image ? (
                    <img
                      src={catData.image}
                      alt=""
                      loading="lazy"
                      className="absolute inset-x-0 bottom-0 h-[72%] w-full object-cover"
                    />
                  ) : (
                    <IconComponent
                      size={44}
                      className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
                      style={{ color: iconColor }}
                    />
                  )}
                  {/* Title band on the pastel card top */}
                  <span
                    className="absolute top-2 inset-x-1.5 text-center font-display font-bold text-[13px] leading-tight"
                    style={{ color: NAVY }}
                  >
                    {label}
                  </span>
                  {/* Headphone affordance at the card bottom */}
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-[0_2px_6px_rgba(23,58,94,0.3)]">
                    <Headphones size={17} className="text-[#2563eb]" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recommended for you — horizontal content cards (unplayed playlists) */}
        {showRecommended && (
          <div className="mb-6">
            <SectionHeading
              onViewAll={() => voyageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Recommended for you
            </SectionHeading>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {recommendedPlaylists.map((playlist) => {
                const minutes = getPlaylistMinutes(playlist);
                const age = getAgeLabel(playlist);
                const isLocked = playlist.isMembersOnly && !isSubscribed;

                return (
                  <button
                    key={playlist._id}
                    type="button"
                    onClick={() => openPlaylist(playlist)}
                    className={`relative shrink-0 w-40 p-1.5 text-left active:scale-[0.97] transition-transform ${CLAY_CARD}`}
                  >
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                      {playlist.coverImage ? (
                        <CoverImage src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {playlist.type === 'Audiobook' ? (
                            <BookOpen className="w-10 h-10 text-white/60" />
                          ) : (
                            <Music className="w-10 h-10 text-white/60" />
                          )}
                        </div>
                      )}
                      {isLocked && <PremiumBadge className="absolute top-1.5 right-1.5 z-10" />}
                    </div>
                    <div className="px-1 pt-2 pb-1">
                      <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: NAVY }}>
                        {playlist.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 pr-9 min-h-[14px]">
                        {minutes !== null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: 'rgba(23,58,94,0.55)' }}>
                            <Clock size={10} />
                            {minutes} min
                          </span>
                        )}
                        {age && (
                          <span className="text-[10px] font-bold" style={{ color: 'rgba(23,58,94,0.55)' }}>
                            Ages {age}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)]">
                      <Play size={14} className="text-white ml-0.5" fill="white" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Continue Listening — compact tiles in a horizontal row (play history) */}
        {showContinueRow && (
          <div className="mb-6">
            <SectionHeading>Continue Listening</SectionHeading>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {continueRowPlaylists.map((playlist) => {
                const progress = getPlaylistProgress(playlist);
                const minutesLeft = getMinutesLeft(playlist);

                return (
                  <button
                    key={playlist._id}
                    type="button"
                    onClick={() => openPlaylist(playlist)}
                    className={`shrink-0 w-64 p-2.5 flex items-center gap-2.5 text-left active:scale-[0.97] transition-transform ${CLAY_CARD}`}
                  >
                    <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      {playlist.coverImage ? (
                        <CoverImage src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                      ) : playlist.type === 'Audiobook' ? (
                        <BookOpen className="w-6 h-6 text-white/60" />
                      ) : (
                        <Music className="w-6 h-6 text-white/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-xs truncate" style={{ color: NAVY }}>
                        {playlist.title}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'rgba(23,58,94,0.55)' }}>
                        {getChapterLabel(playlist)}
                      </p>
                      <div className="mt-1 h-1 rounded-full bg-[#dce7f0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2563eb]"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      {minutesLeft !== null && (
                        <p className="mt-0.5 text-[9px] font-bold" style={{ color: 'rgba(23,58,94,0.45)' }}>
                          {minutesLeft} min left
                        </p>
                      )}
                    </div>
                    {/* Play button resumes the episode in place; tapping the
                        rest of the tile opens the playlist page */}
                    <span
                      role="button"
                      aria-label={`Resume ${playlist.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        resumePlaylist(playlist);
                      }}
                      className="w-8 h-8 flex-shrink-0 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)] cursor-pointer active:scale-90 transition-transform"
                    >
                      <Play size={13} className="text-white ml-0.5" fill="white" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Music Videos — white-card carousel (after Recommended + Continue Listening) */}
        <MusicVideosSection />

        {/* Top 10 of the week — global weekly play chart with rank badges */}
        {showTopWeek && (
          <div className="mb-6">
            <SectionHeading>Top 10 of the week</SectionHeading>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {topWeekPlaylists.map((playlist, rank) => {
                const isLocked = playlist.isMembersOnly && !isSubscribed;
                return (
                  <button
                    key={playlist._id}
                    type="button"
                    onClick={() => openPlaylist(playlist)}
                    className={`relative shrink-0 w-40 p-1.5 text-left active:scale-[0.97] transition-transform ${CLAY_CARD}`}
                  >
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 relative">
                      {playlist.coverImage ? (
                        <CoverImage src={playlist.coverImage} alt={playlist.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {playlist.type === 'Audiobook' ? (
                            <BookOpen className="w-10 h-10 text-white/60" />
                          ) : (
                            <Music className="w-10 h-10 text-white/60" />
                          )}
                        </div>
                      )}
                      {isLocked && <PremiumBadge className="absolute top-1.5 right-1.5 z-10" />}
                      {/* Chart rank — big bold numeral, like music chart UIs */}
                      <span className="absolute bottom-1 left-2 z-10 font-display font-black text-5xl text-white leading-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.65)]">
                        {rank + 1}
                      </span>
                    </div>
                    <div className="px-1 pt-2 pb-1 pr-9">
                      <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: NAVY }}>
                        {playlist.title}
                      </p>
                    </div>
                    <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)]">
                      <Play size={14} className="text-white ml-0.5" fill="white" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Most played Episodes — all-time chart as compact rows */}
        {showMostPlayed && (
          <div className="mb-6">
            <SectionHeading>Most played Episodes</SectionHeading>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {mostPlayedEpisodes.map((ep, rank) => (
                <button
                  key={`${ep.parent._id}-${ep._id}`}
                  type="button"
                  onClick={() => openPlaylist(ep.parent)}
                  className={`shrink-0 w-64 p-2.5 flex items-center gap-2.5 text-left active:scale-[0.97] transition-transform ${CLAY_CARD}`}
                >
                  <span className="w-6 flex-shrink-0 text-center font-display font-black text-lg" style={{ color: 'rgba(23,58,94,0.4)' }}>
                    {rank + 1}
                  </span>
                  <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    {(ep.coverImage || ep.parent.coverImage) ? (
                      <CoverImage
                        src={ep.coverImage || ep.parent.coverImage!}
                        alt={ep.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-white/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-xs truncate" style={{ color: NAVY }}>
                      {ep.title}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(23,58,94,0.55)' }}>
                      {ep.parent.title}
                    </p>
                  </div>
                  <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)]">
                    <Play size={13} className="text-white ml-0.5" fill="white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {(loading || playlistsLoading) ? (
          <div className="font-display text-center mt-10 font-bold" style={{ color: 'rgba(23,58,94,0.7)' }}>
            Loading sounds...
          </div>
        ) : (booksError || playlistsError) ? (
          <StormySeaError
            onRetry={async () => {
              setIsRetrying(true);
              await Promise.all([refreshBooks(), fetchPlaylists()]);
              setIsRetrying(false);
            }}
            message="The music got swept overboard!"
            isLoading={isRetrying}
          />
        ) : (filteredBooks.length === 0 && filteredPlaylists.length === 0) ? (
          <div className={`font-display text-center mt-10 p-6 ${CLAY_CARD}`} style={{ color: 'rgba(23,58,94,0.75)' }}>
            {searchQuery ? 'No matching audio content found.' : 'No audio content found right now. Try the Explore tab!'}
          </div>
        ) : (
          <>
            {/* Explore Audio Library — the full playlist catalog. A horizontal
                carousel like the other content rows while browsing; switches
                to a wrapped grid during search/category filtering so results
                can be scanned vertically instead of hiding in a long row. */}
            {filteredPlaylists.length > 0 && (
              <div className="mb-8 scroll-mt-4" ref={voyageRef}>
                <SectionHeading>Explore Audio Library</SectionHeading>
                <div className={isBrowsingAll
                  ? 'flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1'
                  : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto'
                }>
                  {filteredPlaylists.map((playlist, index) => {
                    const isPlaylistLocked = playlist.isMembersOnly && !isSubscribed;
                    const isInProgress = playHistoryService.wasPlayedRecently(playlist._id);

                    return (
                      <div
                        key={playlist._id}
                        id={index === 0 ? 'audiobook-card-0' : undefined}
                        data-tutorial={index === 0 ? 'audiobook-card-0' : undefined}
                        onClick={() => openPlaylist(playlist, index)}
                        className={`${isBrowsingAll ? 'shrink-0 w-40' : 'w-full max-w-[9.5rem] mx-auto'} p-1.5 hover:scale-105 transition-all cursor-pointer group ${CLAY_CARD} ${isPlaylistLocked ? 'opacity-80' : ''}`}
                      >
                        {/* Cover Image — portrait ratio to match the carousels */}
                        <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 relative overflow-hidden">
                          {playlist.coverImage ? (
                            <CoverImage
                              src={playlist.coverImage}
                              alt={playlist.title}
                              className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 ${isPlaylistLocked ? 'filter brightness-75' : ''}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {playlist.type === 'Audiobook' ? (
                                <BookOpen className="w-24 h-24 text-white opacity-50" />
                              ) : (
                                <Music className="w-24 h-24 text-white opacity-50" />
                              )}
                            </div>
                          )}

                          {/* Lock Overlay for Members Only Content */}
                          {isPlaylistLocked && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                              <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700]">
                                <Lock size={24} className="text-[#FFD700]" />
                              </div>
                            </div>
                          )}

                          {/* Members Only Badge - Only show if user is NOT subscribed */}
                          {playlist.isMembersOnly && !isSubscribed && (
                            <PremiumBadge className="absolute top-2 right-2 z-20" />
                          )}

                          {/* Top-left badges: In Progress + type */}
                          <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-1">
                            {isInProgress && (
                              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-[#2563eb]/95 shadow-md">
                                In Progress
                              </div>
                            )}
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${
                              playlist.type === 'Audiobook'
                                ? 'bg-amber-600/90'
                                : 'bg-purple-600/90'
                            }`}>
                              {playlist.type === 'Audiobook' ? '📖 Audiobook' : '🎵 Music'}
                            </div>
                          </div>

                          {/* Gradient overlay at bottom */}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

                          {/* Age Badge - Bottom Left */}
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 z-20">
                            {playlist.level || (playlist.minAge ? `${playlist.minAge}+` : 'All')}
                          </div>

                          {/* Headphone play affordance - Bottom Right */}
                          <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md z-20">
                            <Headphones size={15} className="text-[#2563eb]" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="px-1 pt-1.5 pb-1">
                          <h3 className="text-xs font-bold mb-0.5 truncate font-display" style={{ color: NAVY }}>
                            {playlist.title}
                          </h3>
                          {playlist.author && (
                            <p className="text-[10px] truncate" style={{ color: 'rgba(23,58,94,0.55)' }}>{playlist.author}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audio Books Section */}
            {filteredBooks.length > 0 && (
              <div>
                <SectionHeading>Audio Books</SectionHeading>
                {/* Same cover-size cap as the audio library cards — applied on
                    the wrapper so the shared BookCard component stays untouched */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
                  {filteredBooks.map(book => (
                    /* BookCard titles are white (designed for dark pages) — recolor navy for the cream panel */
                    <div key={book.id} className="w-full max-w-[9.5rem] mx-auto [&_p]:!text-[#173A5E]">
                      <BookCard
                        book={book}
                        onClick={(id) => navigate(`/book/${id}`, { state: { from: '/listen' } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        </>)}

        {/* ============ READ MODE — story books catalog ============ */}
        {libraryMode === 'read' && (
          loading ? (
            <div className="font-display text-center mt-10 font-bold" style={{ color: 'rgba(23,58,94,0.7)' }}>
              Loading library...
            </div>
          ) : (
            <>
              {/* Book Series — clay carousel; opens the series page */}
              {filteredReadSeries.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Book Series</SectionHeading>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                    {filteredReadSeries.map((series: any) => (
                      <div
                        key={series._id}
                        role="button"
                        onClick={() => navigate(`/book-series/${series._id}`)}
                        className={`relative shrink-0 w-40 p-1.5 cursor-pointer active:scale-[0.97] transition-transform ${CLAY_CARD}`}
                      >
                        <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 relative">
                          {series.coverImage ? (
                            <CoverImage src={series.coverImage} alt={series.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-5xl">📚</div>
                          )}
                          <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            Series
                          </span>
                          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md">
                            {series.books?.length || 0} books
                          </span>
                          {series.isMembersOnly && !isSubscribed && (
                            <PremiumBadge className="absolute top-2 right-2 z-20" />
                          )}
                        </div>
                        <div className="px-1 pt-2 pb-1">
                          <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: NAVY }}>
                            {series.title}
                          </p>
                          {series.author && (
                            <p className="text-[10px] truncate" style={{ color: 'rgba(23,58,94,0.55)' }}>{series.author}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Stories — discovery row, hidden while searching.
                  Same clay cards / portrait ratio as the audio carousels. */}
              {!searchQuery && trendingReadBooks.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Trending Stories</SectionHeading>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                    {trendingReadBooks.map((book: any, i: number) => (
                      <StoryBookCard
                        key={book.id || `trending-${i}`}
                        book={book}
                        isSubscribed={isSubscribed}
                        onClick={(id) => navigate(`/book/${id}`, { state: { from: '/listen' } })}
                        className="shrink-0 w-40"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Story Books — the standalone (non-series) reading catalog.
                  A horizontal carousel like Explore Audio Library while
                  browsing; switches to a wrapped grid during search so
                  results can be scanned vertically. */}
              {filteredReadBooks.length > 0 ? (
                <div>
                  <SectionHeading>Story Books</SectionHeading>
                  <div className={!searchQuery
                    ? 'flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1'
                    : 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto'
                  }>
                    {filteredReadBooks.map((book: any) => (
                      <StoryBookCard
                        key={book.id}
                        book={book}
                        isSubscribed={isSubscribed}
                        onClick={(id) => navigate(`/book/${id}`, { state: { from: '/listen' } })}
                        className={!searchQuery ? 'shrink-0 w-40' : 'w-full max-w-[9.5rem] mx-auto'}
                      />
                    ))}
                  </div>
                </div>
              ) : filteredReadSeries.length === 0 ? (
                <div className={`font-display text-center mt-10 p-6 ${CLAY_CARD}`} style={{ color: 'rgba(23,58,94,0.75)' }}>
                  {searchQuery ? 'No matching stories found.' : 'No story books found right now. Try the Listen tab!'}
                </div>
              ) : null}
            </>
          )
        )}
      </div>
    </div>
  );
};

export default ListenPagePanorama;
