import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookCard from '../components/ui/BookCard';
import { useBooks } from '../context/BooksContext';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useTutorial } from '../context/TutorialContext';
import { Search, Music, Music2, ChevronDown, ChevronRight, Lock, BookOpen, Heart, Sparkles, TreePine, Star, Book, Users, Crown, Compass, Smile, Play, Headphones, Clock } from 'lucide-react';
import PremiumBadge from '../components/ui/PremiumBadge';
import CoverImage from '../components/ui/CoverImage';
import HardcoverCover from '../components/ui/HardcoverCover';
import { playBookOpenFromEvent } from '../components/ui/BookOpenTransition';
import { playCdSpinFromEvent } from '../components/ui/CdSpinTransition';
import BookshelfRow from '../components/ui/BookshelfRow';
import { getApiBaseUrl, ApiService } from '../services/apiService';
import StormySeaError from '../components/ui/StormySeaError';
import MusicVideoOverlay, { MusicVideo } from '../components/audio/MusicVideoOverlay';
import { getCoverThumb } from '../utils/coverImage';
import { DEFAULT_BOOK_COVER } from '../utils/placeholderImage';
import { playHistoryService } from '../services/playHistoryService';
import { useAudio, Playlist as AudioPlaylist } from '../context/AudioContext';
import { getLibraryMode, setLibraryMode as persistLibraryMode, type LibraryMode } from '../utils/libraryMode';
import {
  clearLibraryFromBasement,
  isLibraryFromBasement,
  markLibraryFromBasement,
} from '../utils/libraryFromBasement';
import {
  armTourWrapFromLibrary,
  hasSeenAdamTour,
  isAdamFinaleDone,
  isTourWrapPending,
} from '../utils/adamTour';
import ProfilePortholeButton from '../components/layout/ProfilePortholeButton';
import WoodBackButton from '../components/WoodBackButton';
import { DespiaService } from '../services/despiaService';
import CreatorsDiscoverPanel from '../components/creators/CreatorsDiscoverPanel';

type FeaturedHeroItem = {
  id: string;
  title: string;
  coverUrl: string;
  itemType: 'book' | 'playlist' | 'episode' | 'amazonBook';
  playlistId?: string;
  itemIndex?: number;
  amazonUrl?: string;
  isAudio?: boolean;
};

const ageOptions = ['All Ages', '3+', '4+', '5+', '6+', '7+', '8+', '9+', '10+'];

// Left-to-right order of the library tabs, used to pick the slide direction.
const LIBRARY_MODE_ORDER: LibraryMode[] = ['listen', 'read', 'creators'];

// Library wall — warm cream panel that fills the viewport behind the catalog.
const CREATORS_BG = '#F7F0E6';
// Listen / Read / Creators all share the same warm cream panel.
const PANEL_BG = CREATORS_BG;
const NAVY = '#173A5E';
const ON_WOOD = NAVY;
const ON_WOOD_MUTED = 'rgba(23, 58, 94, 0.66)';

// Shared "claymation" card chrome: white face, big corner radii, warm soft
// drop shadow plus a faint inner top highlight / bottom shading, so cards read
// as soft clay tiles resting on the cream panel. Carousels add p-1.5 so the
// artwork gets a chunky white frame like the reference.
const CLAY_CARD =
  'bg-white rounded-3xl shadow-[0_5px_14px_rgba(122,90,44,0.16),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-3px_8px_rgba(122,90,44,0.06)]';

// Hero artwork — Jesus with kids in a sailboat (1024x683 jpg, ~160KB)
const HERO_IMAGE = '/assets/images/listen-hero-boat.jpg';
const CREATORS_HERO_IMAGE = '/assets/images/creators-hero.jpg';
const HERO_HEIGHT = 'min(32vh, 244px)';

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
  'Bedtime': { icon: Smile, bgColor: 'from-indigo-400 to-blue-500' },
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
  iconImage?: string;
}

function itemBelongsToCategory(
  item: { category?: string; categories?: string[] },
  name: string,
): boolean {
  const list = Array.isArray(item.categories) && item.categories.length
    ? item.categories
    : (item.category ? [item.category] : []);
  return list.includes(name);
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

/** Bold navy section heading with an optional "View All >" link on the right. */
const SectionHeading: React.FC<{
  children: React.ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}> = ({ children, onViewAll, viewAllLabel = 'View All' }) => (
  <div className="flex items-center justify-between mb-3">
    <h2
      className="font-display font-black text-xl"
      style={{ color: ON_WOOD }}
    >
      {children}
    </h2>
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

/** Horizontal / wrap category tiles used by both Listen and Read library modes. */
const CategoryTiles: React.FC<{
  categories: string[];
  categoryData: Record<string, CategoryData>;
  selectedCategory: string;
  onSelect: (name: string) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  mode: 'listen' | 'read';
}> = ({ categories, categoryData, selectedCategory, onSelect, showAll, onToggleShowAll, mode }) => {
  if (categories.length <= 1) return null;
  const AffordanceIcon = mode === 'read' ? BookOpen : Headphones;

  return (
    <div className="pt-1 mb-6">
      <SectionHeading
        onViewAll={() => onToggleShowAll()}
        viewAllLabel={showAll ? 'Show Less' : 'View All'}
      >
        Explore Categories
      </SectionHeading>
      <div className={showAll
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
          const cmsIcon = catData?.iconImage || catData?.image;
          const hasCmsIcon = Boolean(cmsIcon);

          return (
            <button
              key={`${mode}-${category}`}
              type="button"
              onClick={() => onSelect(category)}
              className={`relative shrink-0 w-28 aspect-[3/4] rounded-3xl overflow-hidden active:scale-95 transition-transform shadow-[0_5px_14px_rgba(122,90,44,0.18)] ${
                isSelected ? 'ring-[3px] ring-[#2563eb]' : 'ring-[3px] ring-white'
              }`}
              style={{ backgroundColor: hasCmsIcon ? '#ffffff' : pastel }}
            >
              {hasCmsIcon ? (
                <img
                  src={cmsIcon}
                  alt=""
                  className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 w-[5.75rem] h-[5.75rem] object-contain"
                />
              ) : (
                <IconComponent
                  size={44}
                  className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
                  style={{ color: iconColor }}
                />
              )}
              <span
                className="absolute top-2 inset-x-1.5 text-center font-display font-bold text-[13px] leading-tight"
                style={{ color: NAVY }}
              >
                {label}
              </span>
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-[0_2px_6px_rgba(23,58,94,0.3)]">
                <AffordanceIcon size={17} className="text-[#2563eb]" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Story book card for Read mode — same clay chrome, portrait 3:4 cover and
 * sizing as the Explore Audio Library playlist cards, so the read catalog
 * lines up visually with the audio carousels. Keeps BookCard's title
 * translation but swaps the dark-page styling for the cream panel look.
 */
const StoryBookCard: React.FC<{
  book: any;
  onClick: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
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
      onClick={(event) => onClick(book.id, event)}
      className={`relative text-left cursor-pointer active:scale-[0.98] transition-transform group ${isLocked ? 'opacity-80' : ''} ${className}`}
    >
      <HardcoverCover>
        <CoverImage
          src={book.coverUrl}
          alt={book.title}
          fallback={DEFAULT_BOOK_COVER}
          variant="full"
          className={`w-full h-full object-cover ${isLocked ? 'brightness-75' : ''}`}
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
      </HardcoverCover>

      {/* Info */}
      <div className="px-1 pt-1.5 pb-1">
        <h3 className="text-xs font-bold mb-0.5 truncate font-display" style={{ color: ON_WOOD }}>
          {translatedTitle}
        </h3>
        {book.author && (
          <p className="text-[10px] truncate" style={{ color: ON_WOOD_MUTED }}>{book.author}</p>
        )}
      </div>
    </button>
  );
};

const LibraryPlaylistCard: React.FC<{
  playlist: Playlist;
  isSubscribed: boolean;
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  className?: string;
  tutorialFirst?: boolean;
}> = ({ playlist, isSubscribed, onOpen, className = '', tutorialFirst = false }) => {
  const isPlaylistLocked = playlist.isMembersOnly && !isSubscribed;
  const isInProgress = playHistoryService.wasPlayedRecently(playlist._id);

  return (
    <div
      id={tutorialFirst ? 'audiobook-card-0' : undefined}
      data-tutorial={tutorialFirst ? 'audiobook-card-0' : undefined}
      onClick={onOpen}
      className={`active:scale-[0.98] transition-transform cursor-pointer group ${isPlaylistLocked ? 'opacity-80' : ''} ${className}`}
    >
      <HardcoverCover>
        {playlist.coverImage ? (
          <CoverImage
            src={playlist.coverImage}
            alt={playlist.title}
            variant="full"
            className={`w-full h-full object-cover ${isPlaylistLocked ? 'brightness-75' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
            {playlist.type === 'Audiobook' ? (
              <BookOpen className="w-24 h-24 text-white opacity-50" />
            ) : (
              <Music className="w-24 h-24 text-white opacity-50" />
            )}
          </div>
        )}

        {isPlaylistLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-black/70 rounded-full p-3 border-2 border-[#FFD700]">
              <Lock size={24} className="text-[#FFD700]" />
            </div>
          </div>
        )}
        {playlist.isMembersOnly && !isSubscribed && (
          <PremiumBadge className="absolute top-2 right-2 z-20" />
        )}

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

        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>

        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 z-20">
          {playlist.level || (playlist.minAge ? `${playlist.minAge}+` : 'All')}
        </div>

        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow-md z-20">
          <Headphones size={15} className="text-[#2563eb]" />
        </div>
      </HardcoverCover>

      <div className="px-1 pt-1.5 pb-1">
        <h3 className="text-xs font-bold mb-0.5 truncate font-display" style={{ color: ON_WOOD }}>
          {playlist.title}
        </h3>
        {playlist.author && (
          <p className="text-[10px] truncate" style={{ color: ON_WOOD_MUTED }}>{playlist.author}</p>
        )}
      </div>
    </div>
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
  const location = useLocation();
  const { books, loading, error: booksError, refreshBooks } = useBooks();
  const { isSubscribed, kids, currentProfileId } = useUser();
  const { isTutorialActive, isStepActive, nextStep } = useTutorial();
  const { playPlaylist } = useAudio();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAge, setSelectedAge] = useState<string>('All Ages');
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [listenCategories, setListenCategories] = useState<string[]>(['All']);
  const [readCategories, setReadCategories] = useState<string[]>(['All']);
  const [listenCategoryData, setListenCategoryData] = useState<Record<string, CategoryData>>({});
  const [readCategoryData, setReadCategoryData] = useState<Record<string, CategoryData>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  // Global play charts — empty until the endpoints respond (sections hide when empty)
  const [topWeek, setTopWeek] = useState<TopWeekEntry[]>([]);
  const [topEpisodes, setTopEpisodes] = useState<TopEpisode[]>([]);
  // One library, two modes: Listen (audio catalog) or Read (story books).
  // Read-mode data loads lazily on the first switch. Restore last mode so
  // Back from a book stays on Read instead of resetting to Listen.
  const [libraryMode, setLibraryMode] = useState<LibraryMode>(() => {
    const fromState = (location.state as { libraryMode?: LibraryMode } | null)?.libraryMode;
    if (fromState === 'read' || fromState === 'listen') return fromState;
    const saved = getLibraryMode();
    return saved === 'creators' ? 'listen' : saved;
  });
  // Direction the tab pane slides in from: tapping a tab to the right of the
  // current one brings the new pane in from the right, and vice versa.
  const [modeSlideFrom, setModeSlideFrom] = useState('0px');
  const fromBasement =
    (location.state as { from?: string } | null)?.from === '/sail/basement' ||
    isLibraryFromBasement();
  const [featuredHeroItems, setFeaturedHeroItems] = useState<FeaturedHeroItem[]>([]);
  const [heroSlide, setHeroSlide] = useState(0);
  const heroTrackRef = useRef<HTMLDivElement>(null);
  const heroPauseRef = useRef(false);
  const [bookSeries, setBookSeries] = useState<any[]>([]);
  const [trendingBooks, setTrendingBooks] = useState<any[]>([]);
  const readDataLoadedRef = useRef(false);
  const ageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistLibraryMode(libraryMode);
  }, [libraryMode]);

  useEffect(() => {
    if ((location.state as { from?: string } | null)?.from === '/sail/basement') {
      markLibraryFromBasement();
    }
  }, [location.state]);

  const openBook = (
    id: string,
    event?: React.MouseEvent<HTMLElement>,
    coverUrl?: string,
  ) => {
    const go = () => navigate(`/book/${id}`, { state: { from: '/listen', libraryMode } });
    if (event) {
      playBookOpenFromEvent(event, coverUrl, go);
      return;
    }
    go();
  };
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

  useEffect(() => {
    let cancelled = false;
    ApiService.getFeaturedContent()
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const items: FeaturedHeroItem[] = data
          .map((raw: any) => {
            const id = String(raw._id || raw.id || '');
            if (!id) return null;
            return {
              id,
              title: raw.title || 'Featured',
              coverUrl: getCoverThumb(
                raw.coverUrl || raw.coverImage || raw.files?.coverImage || '',
              ),
              itemType: raw._itemType || (raw.isAudio ? 'playlist' : 'book'),
              playlistId: raw._playlistId,
              itemIndex: raw._itemIndex ?? raw._trackIndex,
              amazonUrl: raw._amazonUrl || raw.amazonUrl,
              isAudio: Boolean(raw.isAudio),
            } as FeaturedHeroItem;
          })
          .filter((item): item is FeaturedHeroItem => !!item)
          .slice(0, 8);
        setFeaturedHeroItems(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

  // Fetch Listen (audio) and Read (book) categories independently so a Bedtime
  // icon on an Audio category shows on Listen even if a Book category shares the name.
  useEffect(() => {
    const toMap = (cats: Array<{ name?: string; _id?: string; gradientFrom?: string; gradientTo?: string; image?: string; icon?: string; iconImage?: string }>) => {
      const dataMap: Record<string, CategoryData> = {};
      cats.forEach((c) => {
        if (c.name) {
          dataMap[c.name] = {
            _id: c._id || '',
            name: c.name,
            gradientFrom: c.gradientFrom,
            gradientTo: c.gradientTo,
            image: c.image,
            icon: c.icon,
            iconImage: c.iconImage,
          };
        }
      });
      return dataMap;
    };

    const fetchCategories = async () => {
      try {
        const [audioCats, bookCats] = await Promise.all([
          ApiService.getCategories('audio'),
          ApiService.getCategories('book'),
        ]);
        const audioNames = audioCats.map((c) => c.name).filter(Boolean);
        const bookNames = bookCats.map((c) => c.name).filter(Boolean);
        setListenCategories(['All', ...audioNames]);
        setReadCategories(['All', ...bookNames]);
        setListenCategoryData(toMap(audioCats));
        setReadCategoryData(toMap(bookCats));
      } catch (error) {
        console.error('Error fetching categories:', error);
        const playlistCategories = playlists.map(p => p.category).filter(Boolean);
        const audioBookCategories = books.filter(b => b.isAudio).map(b => b.category).filter(Boolean);
        const storyCategories = books.filter(b => !b.isAudio).map(b => b.category).filter(Boolean);
        setListenCategories(['All', ...new Set([...playlistCategories, ...audioBookCategories])] as string[]);
        setReadCategories(['All', ...new Set(storyCategories)] as string[]);
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

  const matchesSelectedCategory = (item: { category?: string; categories?: string[] }): boolean => {
    if (selectedCategory === 'All') return true;
    const list = Array.isArray(item.categories) && item.categories.length
      ? item.categories
      : (item.category ? [item.category] : []);
    return list.includes(selectedCategory);
  };

  // Standalone story books, respecting the shared search + age + category controls
  const filteredReadBooks = books.filter(b => {
    if (b.isAudio) return false;
    const bookId = (b.id || (b as any)._id)?.toString?.() ?? '';
    if (booksInSeries.has(bookId)) return false;
    if (!matchesSelectedAge(b.level)) return false;
    if (!matchesSelectedCategory(b as any)) return false;
    const q = searchQuery.toLowerCase();
    return b.title.toLowerCase().includes(q) || Boolean(b.author && b.author.toLowerCase().includes(q));
  });

  const filteredReadSeries = bookSeries.filter((s: any) => {
    if (!matchesSelectedAge(s.level || s.minAge?.toString())) return false;
    if (!matchesSelectedCategory(s)) return false;
    const q = searchQuery.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || Boolean(s.author && s.author.toLowerCase().includes(q));
  });

  const trendingReadBooks = trendingBooks.filter((b: any) => !b.isAudio).slice(0, 10);

  const playlistFitsAge = (p: Playlist): boolean => {
    if (selectedAge === 'All Ages') return true;
    const selectedAgeNum = parseInt(selectedAge.replace('+', ''), 10);
    if (p.minAge !== undefined && p.minAge !== null) return p.minAge <= selectedAgeNum;
    if (p.level) {
      const levelMatch = p.level.match(/(\d+)/);
      if (levelMatch) return parseInt(levelMatch[1], 10) <= selectedAgeNum;
    }
    return true;
  };

  const titleFitsSearch = (title?: string, author?: string): boolean => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (title || '').toLowerCase().includes(q) || Boolean(author && author.toLowerCase().includes(q));
  };

  const listenCategoryShelves = useMemo(
    () =>
      listenCategories
        .filter((name) => name !== 'All')
        .map((name) => ({
          name,
          playlists: playlists.filter(
            (p) => itemBelongsToCategory(p, name) && playlistFitsAge(p) && titleFitsSearch(p.title, p.author),
          ),
        }))
        .filter((row) => row.playlists.length > 0),
    [listenCategories, playlists, selectedAge, searchQuery],
  );

  const readCategoryShelves = useMemo(
    () =>
      readCategories
        .filter((name) => name !== 'All')
        .map((name) => ({
          name,
          books: books.filter((b) => {
            if (b.isAudio) return false;
            const bookId = (b.id || (b as any)._id)?.toString?.() ?? '';
            if (booksInSeries.has(bookId)) return false;
            return (
              itemBelongsToCategory(b as any, name) &&
              matchesSelectedAge(b.level) &&
              titleFitsSearch(b.title, b.author)
            );
          }),
        }))
        .filter((row) => row.books.length > 0),
    [readCategories, books, booksInSeries, selectedAge, searchQuery],
  );

  const explorePlaylists = useMemo(() => {
    const browsingAll = selectedCategory === 'All' && !searchQuery;
    if (!browsingAll || listenCategoryShelves.length === 0) return filteredPlaylists;
    const onAShelf = new Set(listenCategoryShelves.flatMap((row) => row.playlists.map((p) => p._id)));
    return filteredPlaylists.filter((p) => !onAShelf.has(p._id));
  }, [selectedCategory, searchQuery, listenCategoryShelves, filteredPlaylists]);

  const leftoverReadBooks = useMemo(() => {
    if (searchQuery || readCategoryShelves.length === 0) return filteredReadBooks;
    const onAShelf = new Set(readCategoryShelves.flatMap((row) => row.books.map((b) => b.id)));
    return filteredReadBooks.filter((b) => !onAShelf.has(b.id));
  }, [searchQuery, readCategoryShelves, filteredReadBooks]);

  const openPlaylist = (
    playlist: Playlist,
    index?: number,
    event?: React.MouseEvent<HTMLElement>,
  ) => {
    // Allow navigation to detail page even for locked content — the detail
    // page shows preview functionality (1-minute demo).
    // Advance tutorial when clicking the highlighted audiobook.
    if (index === 0 && isTutorialActive && isStepActive('audiobook_highlight')) {
      nextStep(); // Advance to tutorial_complete
    }
    const go = () => navigate(`/audio/playlist/${playlist._id}`);
    if (event) {
      playCdSpinFromEvent(event, playlist.coverImage, go);
      return;
    }
    go();
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

  const goBackToBasement = () => {
    if (!isAdamFinaleDone() && hasSeenAdamTour()) armTourWrapFromLibrary();
    clearLibraryFromBasement();
    navigate('/sail/basement', {
      state: isTourWrapPending() ? { adamTourWrap: true } : undefined,
    });
  };

  const openFeaturedHero = useCallback(
    (item: FeaturedHeroItem) => {
      if (item.itemType === 'amazonBook' && item.amazonUrl) {
        ApiService.trackAmazonBookClick(item.id);
        DespiaService.openExternalUrl(item.amazonUrl);
        return;
      }
      if (item.itemType === 'episode' && item.playlistId != null) {
        navigate(`/audio/playlist/${item.playlistId}/play/${item.itemIndex ?? 0}`);
        return;
      }
      if (item.itemType === 'playlist' || item.isAudio) {
        navigate(`/audio/playlist/${item.id}`);
        return;
      }
      navigate(`/book/${item.id}`, { state: { from: '/listen', libraryMode } });
    },
    [libraryMode, navigate],
  );

  const heroSlideCount = 1 + featuredHeroItems.length;

  const onHeroTrackScroll = useCallback(() => {
    const el = heroTrackRef.current;
    if (!el || heroSlideCount < 1) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const index = Math.round(el.scrollLeft / w);
    if (index !== heroSlide && index >= 0 && index < heroSlideCount) {
      setHeroSlide(index);
    }
  }, [heroSlide, heroSlideCount]);

  useEffect(() => {
    if (heroSlideCount < 2) return;
    const id = window.setInterval(() => {
      if (heroPauseRef.current) return;
      const el = heroTrackRef.current;
      if (!el) return;
      const next = (heroSlide + 1) % heroSlideCount;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 5500);
    return () => window.clearInterval(id);
  }, [heroSlide, heroSlideCount]);

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
          style={{ backgroundColor: PANEL_BG, zIndex: 0 }}
        />
      )}

      {/* ============ FEATURED HERO CAROUSEL ============ */}
      <div className="relative">
        <div
          className="absolute z-30"
          style={{
            top: 'max(10px, calc(var(--safe-area-top, 0px) + 8px))',
            left: fromBasement ? '12px' : undefined,
            right: fromBasement ? undefined : '12px',
          }}
        >
          {fromBasement ? (
            <WoodBackButton
              onClick={goBackToBasement}
              className="w-12 h-12"
              aria-label="Back to ship basement"
            />
          ) : (
            <ProfilePortholeButton />
          )}
        </div>

        {libraryMode === 'creators' ? (
          <section
            className="relative w-full overflow-hidden"
            style={{ height: HERO_HEIGHT }}
          >
            <img
              src={CREATORS_HERO_IMAGE}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover object-[62%_center] select-none"
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, rgba(8,22,44,0.62) 0%, rgba(8,22,44,0.28) 48%, rgba(8,22,44,0.08) 72%, transparent 100%)',
              }}
            />
            <div
              className={`relative h-full flex flex-col justify-center px-4 ${
                fromBasement ? 'pl-16' : 'pr-[7.5rem]'
              }`}
              style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 0.35rem)' }}
            >
              <h1 className="font-display font-black text-[1.65rem] md:text-3xl text-white leading-[1.12] drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                Stories by
                <br />
                Creators.
                <br />
                Powered by You.
              </h1>
              <p className="font-display font-semibold text-white/90 text-[11px] md:text-sm mt-1.5 max-w-[15.5rem] leading-snug drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
                Support amazing creators and help bring more faith-filled adventures.
              </p>
            </div>
          </section>
        ) : (
        <div
          ref={heroTrackRef}
          onScroll={heroSlideCount > 1 ? onHeroTrackScroll : undefined}
          onPointerDown={() => {
            heroPauseRef.current = true;
          }}
          onPointerUp={() => {
            heroPauseRef.current = false;
          }}
          className={`flex w-full ${
            heroSlideCount > 1 ? 'overflow-x-auto snap-x snap-mandatory no-scrollbar' : ''
          }`}
          style={
            heroSlideCount > 1
              ? {
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x pan-y',
                  overscrollBehaviorX: 'contain',
                }
              : undefined
          }
        >
          <section
            className="relative w-full min-w-full max-w-full snap-center shrink-0 overflow-hidden"
            style={{ height: HERO_HEIGHT }}
          >
            <img
              src={HERO_IMAGE}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center] select-none"
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(9,38,68,0.5) 0%, rgba(9,38,68,0.28) 38%, rgba(9,38,68,0.04) 62%, transparent 78%)',
              }}
            />
            <div
              className={`relative h-full flex flex-col justify-start px-4 ${
                fromBasement ? 'pl-16' : 'pr-16'
              }`}
              style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 1.25rem)' }}
            >
              <h1 className="font-display font-black text-3xl md:text-4xl text-white leading-tight drop-shadow-[0_2px_8px_rgba(10,40,80,0.65)]">
                Ahoy, {kidName}!
              </h1>
              <p className="font-display font-semibold text-white/90 text-sm md:text-base mt-1 drop-shadow-[0_1px_4px_rgba(10,40,80,0.6)]">
                Listen to God&rsquo;s Word and let your journey begin!
              </p>
            </div>
          </section>

          {featuredHeroItems.map((item) => (
            <button
              key={`${item.itemType}-${item.id}`}
              type="button"
              onClick={() => openFeaturedHero(item)}
              className="relative w-full min-w-full max-w-full snap-center shrink-0 overflow-hidden text-left"
              style={{ height: HERO_HEIGHT }}
              aria-label={`Open ${item.title}`}
            >
              {item.coverUrl ? (
                <CoverImage
                  src={item.coverUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[#173A5E]" />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(8,22,44,0.82) 0%, rgba(8,22,44,0.25) 46%, rgba(8,22,44,0.35) 100%)',
                }}
              />
              <div
                className="relative h-full min-w-0 max-w-full w-full flex flex-col justify-end px-5 pr-8 pb-14"
                style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 1.25rem)' }}
              >
                <span className="self-start mb-1.5 px-2.5 py-0.5 rounded-full bg-[#E8B923] text-[#3E1F07] font-display font-black text-[10px] uppercase tracking-wide">
                  Featured
                </span>
                <h2 className="min-w-0 max-w-[18.5rem] sm:max-w-[21rem] font-display font-black text-[1.25rem] sm:text-[1.35rem] text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] break-words [overflow-wrap:anywhere] line-clamp-3">
                  {item.title}
                </h2>
                <p className="mt-1 font-display font-bold text-white/90 text-sm">
                  {item.itemType === 'playlist' || item.itemType === 'episode' || item.isAudio
                    ? 'Tap to listen'
                    : 'Tap to read'}
                </p>
              </div>
            </button>
          ))}
        </div>
        )}

        {libraryMode !== 'creators' && heroSlideCount > 1 && (
          <div className="absolute bottom-8 inset-x-0 z-20 flex justify-center gap-1.5 pointer-events-none">
            {Array.from({ length: heroSlideCount }).map((_, index) => (
              <span
                key={index}
                className="rounded-full transition-all duration-300"
                style={{
                  width: index === heroSlide ? 8 : 6,
                  height: index === heroSlide ? 8 : 6,
                  background:
                    index === heroSlide ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ============ WOOD LIBRARY PANEL ============ */}
      {/* min-h-screen: the wood panel always extends at least a full viewport
          past the hero, so normal scrolling can never run out of the wall
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
        className="relative z-10 px-4 min-h-screen shrink-0 -mt-12 rounded-t-[2rem] shadow-[0_-8px_24px_rgba(30,15,0,0.18)]"
        style={{
          backgroundColor: PANEL_BG,
          paddingBottom: fromBasement
            ? 'calc(var(--safe-area-bottom, 0px) + 2rem)'
            : 'calc(var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px) + var(--map-footer-h, 78px) * 1.24 + 2rem)',
        }}
      >
        <div className="relative z-10">

        {/* Listen / Read / Creators segmented toggle */}
        <div className="relative z-20 pt-4 mb-4 flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white shadow-[0_5px_14px_rgba(23,58,94,0.28)]">
            {([
              { id: 'listen' as const, label: 'Listen', Icon: Headphones },
              { id: 'read' as const, label: 'Read', Icon: BookOpen },
            ]).map(({ id, label, Icon }, index) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === libraryMode) return;
                  const current = LIBRARY_MODE_ORDER.indexOf(libraryMode);
                  setModeSlideFrom(index > current ? '28px' : '-28px');
                  setLibraryMode(id);
                  setSelectedCategory('All');
                  setShowAllCategories(false);
                }}
                aria-pressed={libraryMode === id}
                className={`flex items-center justify-center gap-1 px-3 sm:px-4 py-2 rounded-full font-display font-black text-xs sm:text-sm transition-colors ${
                  libraryMode === id
                    ? 'bg-[#173A5E] text-white'
                    : 'bg-white text-[#173A5E] border border-[#173A5E]/30 active:bg-[#f4f7fa]'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab pane — remounted per mode (key) so the slide-in replays on every
            Listen / Read / Creators switch. */}
        <div
          key={libraryMode}
          className="gk-library-pane"
          style={{ '--gk-pane-from': modeSlideFrom } as React.CSSProperties}
        >

        {/* Search + age filter — Listen and Read only */}
        {libraryMode !== 'creators' && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={20} style={{ color: 'rgba(23,58,94,0.45)' }} />
            </div>
            <input
              type="text"
              placeholder={
                libraryMode === 'read'
                  ? 'Search stories...'
                  : 'Search adventures...'
              }
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
        )}

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

        {/* Category tiles hidden — portal categories render as shelf rows below. */}

        {/* Recommended for you — horizontal content cards (unplayed playlists) */}
        {showRecommended && (
          <div className="mb-6">
            <SectionHeading
              onViewAll={() => voyageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Recommended for you
            </SectionHeading>
            <BookshelfRow>
              {recommendedPlaylists.map((playlist) => {
                const minutes = getPlaylistMinutes(playlist);
                const age = getAgeLabel(playlist);
                const isLocked = playlist.isMembersOnly && !isSubscribed;

                return (
                  <button
                    key={playlist._id}
                    type="button"
                    onClick={(event) => openPlaylist(playlist, undefined, event)}
                    className="relative shrink-0 w-40 text-left active:scale-[0.97] transition-transform"
                  >
                    <HardcoverCover>
                      {playlist.coverImage ? (
                        <CoverImage src={playlist.coverImage} alt={playlist.title} variant="full" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                          {playlist.type === 'Audiobook' ? (
                            <BookOpen className="w-10 h-10 text-white/60" />
                          ) : (
                            <Music className="w-10 h-10 text-white/60" />
                          )}
                        </div>
                      )}
                      {isLocked && <PremiumBadge className="absolute top-1.5 right-1.5 z-10" />}
                    </HardcoverCover>
                    <div className="px-1 pt-2 pb-1">
                      <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: ON_WOOD }}>
                        {playlist.title}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 pr-9 min-h-[14px]">
                        {minutes !== null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: ON_WOOD_MUTED }}>
                            <Clock size={10} />
                            {minutes} min
                          </span>
                        )}
                        {age && (
                          <span className="text-[10px] font-bold" style={{ color: ON_WOOD_MUTED }}>
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
            </BookshelfRow>
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
            <BookshelfRow>
              {topWeekPlaylists.map((playlist, rank) => {
                const isLocked = playlist.isMembersOnly && !isSubscribed;
                return (
                  <button
                    key={playlist._id}
                    type="button"
                    onClick={(event) => openPlaylist(playlist, undefined, event)}
                    className="relative shrink-0 w-40 text-left active:scale-[0.97] transition-transform"
                  >
                    <HardcoverCover>
                      {playlist.coverImage ? (
                        <CoverImage src={playlist.coverImage} alt={playlist.title} variant="full" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
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
                    </HardcoverCover>
                    <div className="px-1 pt-2 pb-1 pr-9">
                      <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: ON_WOOD }}>
                        {playlist.title}
                      </p>
                    </div>
                    <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center shadow-[0_3px_8px_rgba(37,99,235,0.4)]">
                      <Play size={14} className="text-white ml-0.5" fill="white" />
                    </span>
                  </button>
                );
              })}
            </BookshelfRow>
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
          <div className="font-display text-center mt-10 font-bold" style={{ color: ON_WOOD }}>
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
            {isBrowsingAll && listenCategoryShelves.map((row) => (
              <div key={`listen-shelf-${row.name}`} className="mb-8">
                <SectionHeading>{row.name}</SectionHeading>
                <BookshelfRow>
                  {row.playlists.map((playlist) => (
                    <LibraryPlaylistCard
                      key={playlist._id}
                      playlist={playlist}
                      isSubscribed={isSubscribed}
                      onOpen={(event) => openPlaylist(playlist, undefined, event)}
                      className="w-40"
                    />
                  ))}
                </BookshelfRow>
              </div>
            ))}

            {/* Full catalog while searching, or leftover titles that have no
                portal category once those categories are listed as shelves. */}
            {explorePlaylists.length > 0 && (
              <div className="mb-8 scroll-mt-4" ref={voyageRef}>
                <SectionHeading>
                  {isBrowsingAll && listenCategoryShelves.length > 0
                    ? 'More Audio'
                    : 'Explore Audio Library'}
                </SectionHeading>
                <BookshelfRow grid={!isBrowsingAll}>
                  {explorePlaylists.map((playlist, index) => (
                    <LibraryPlaylistCard
                      key={playlist._id}
                      playlist={playlist}
                      isSubscribed={isSubscribed}
                      onOpen={(event) => openPlaylist(playlist, index, event)}
                      tutorialFirst={index === 0}
                      className={isBrowsingAll ? 'w-40' : 'w-full max-w-[9.5rem] mx-auto'}
                    />
                  ))}
                </BookshelfRow>
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
                        onClick={(id, event) => {
                          const go = () =>
                            navigate(`/book/${id}`, { state: { from: '/listen', libraryMode } });
                          playCdSpinFromEvent(event, book.coverUrl, go);
                        }}
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
            <div className="font-display text-center mt-10 font-bold" style={{ color: ON_WOOD }}>
              Loading library...
            </div>
          ) : (
            <>
              {/* Category tiles hidden — portal categories render as shelf rows below. */}

              {/* Book Series — clay carousel; opens the series page */}
              {filteredReadSeries.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Book Series</SectionHeading>
                  <BookshelfRow>
                    {filteredReadSeries.map((series: any) => (
                      <div
                        key={series._id}
                        role="button"
                        onClick={(event) =>
                          playBookOpenFromEvent(event, series.coverImage, () =>
                            navigate(`/book-series/${series._id}`),
                          )
                        }
                        className="relative shrink-0 w-40 cursor-pointer active:scale-[0.97] transition-transform"
                      >
                        <HardcoverCover>
                          {series.coverImage ? (
                            <CoverImage src={series.coverImage} alt={series.title} variant="full" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-5xl">📚</div>
                          )}
                          <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 z-20">
                            <BookOpen className="w-3 h-3" />
                            Series
                          </span>
                          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md z-20">
                            {series.books?.length || 0} books
                          </span>
                          {series.isMembersOnly && !isSubscribed && (
                            <PremiumBadge className="absolute top-2 right-2 z-20" />
                          )}
                        </HardcoverCover>
                        <div className="px-1 pt-2 pb-1">
                          <p className="font-display font-bold text-sm leading-snug truncate" style={{ color: ON_WOOD }}>
                            {series.title}
                          </p>
                          {series.author && (
                            <p className="text-[10px] truncate" style={{ color: ON_WOOD_MUTED }}>{series.author}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </BookshelfRow>
                </div>
              )}

              {/* Trending Stories — discovery row, hidden while searching.
                  Same clay cards / portrait ratio as the audio carousels. */}
              {!searchQuery && trendingReadBooks.length > 0 && (
                <div className="mb-6">
                  <SectionHeading>Trending Stories</SectionHeading>
                  <BookshelfRow>
                    {trendingReadBooks.map((book: any, i: number) => (
                      <StoryBookCard
                        key={book.id || `trending-${i}`}
                        book={book}
                        isSubscribed={isSubscribed}
                        onClick={(id, event) => openBook(id, event, book.coverUrl)}
                        className="w-40"
                      />
                    ))}
                  </BookshelfRow>
                </div>
              )}

              {!searchQuery && readCategoryShelves.map((row) => (
                <div key={`read-shelf-${row.name}`} className="mb-8">
                  <SectionHeading>{row.name}</SectionHeading>
                  <BookshelfRow>
                    {row.books.map((book: any) => (
                      <StoryBookCard
                        key={book.id}
                        book={book}
                        isSubscribed={isSubscribed}
                        onClick={(id, event) => openBook(id, event, book.coverUrl)}
                        className="w-40"
                      />
                    ))}
                  </BookshelfRow>
                </div>
              ))}

              {/* Story Books — leftover titles with no portal category, or
                  the full catalog while searching. */}
              {leftoverReadBooks.length > 0 ? (
                <div>
                  <SectionHeading>
                    {!searchQuery && readCategoryShelves.length > 0 ? 'More Stories' : 'Story Books'}
                  </SectionHeading>
                  <BookshelfRow grid={Boolean(searchQuery)}>
                    {leftoverReadBooks.map((book: any) => (
                      <StoryBookCard
                        key={book.id}
                        book={book}
                        isSubscribed={isSubscribed}
                        onClick={(id, event) => openBook(id, event, book.coverUrl)}
                        className={!searchQuery ? 'w-40' : 'w-full max-w-[9.5rem] mx-auto'}
                      />
                    ))}
                  </BookshelfRow>
                </div>
              ) : filteredReadSeries.length === 0 && readCategoryShelves.length === 0 ? (
                <div className={`font-display text-center mt-10 p-6 ${CLAY_CARD}`} style={{ color: 'rgba(23,58,94,0.75)' }}>
                  {searchQuery ? 'No matching stories found.' : 'No story books found right now. Try the Listen tab!'}
                </div>
              ) : null}
            </>
          )
        )}

        {libraryMode === 'creators' && <CreatorsDiscoverPanel />}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ListenPagePanorama;
