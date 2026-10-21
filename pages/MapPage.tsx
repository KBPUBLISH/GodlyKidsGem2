import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Star, Check, Ship, Compass } from 'lucide-react';
import CloudFlythrough from '../components/onboarding/CloudFlythrough';
import OnboardingGuideCard from '../components/onboarding/OnboardingGuideCard';
import PerryMapGuide from '../components/onboarding/PerryMapGuide';
import StormySeaError from '../components/ui/StormySeaError';
import {
  ONBOARDING_GENESIS_VIDEO,
  isOnboardingJourneyActive,
} from '../utils/onboardingJourney';
import { prefersReducedMotion } from '../utils/bibleMapApi';
import { useUser } from '../context/UserContext';
import { assertFreeTierIslandExists, hasPremiumAccess } from '../utils/freeTierAccess';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { profileService } from '../services/profileService';
import { isPlayableMainMapStory, isStoryPackComplete } from '../utils/mainMapStoryUnlock';
import {
  CMS_ISLANDS_TIMEOUT_MS,
  fetchOceanMapIslands,
  fetchPublishedMapStories,
  getOceanIslandArtSrc,
  storyIslandKeys,
  type OceanMapIsland,
  type OceanMapStoryRow,
} from '../utils/oceanMapIslands';
import { cacheAssetUrls } from '../utils/assetCache';

/** Native size of map-footer-frame.png (846×295) — used for --map-footer-h scroll clearance. */
const MAP_FOOTER_ASPECT = 295 / 846;
/**
 * Resolved banner heights (CSS vars). Header is a thin sky inset under the
 * safe area (wood plank removed). Footer is capped on ALL viewports
 * (phone uncapped 100vw×aspect was ~30%+ of screen).
 */
const MAP_HEADER_H = 'var(--map-header-h)';
const MAP_FOOTER_H = 'var(--map-footer-h)';
/**
 * Footer caps — match BottomNavigation compact wood tab bar.
 * Phone ~70–78px / tablet ~80–88px.
 */
const MAP_FOOTER_MAX_VH = 10;
const MAP_FOOTER_MAX_PX = 78;
const MAP_FOOTER_MAX_VH_TABLET = 8.5;
const MAP_FOOTER_MAX_PX_TABLET = 88;
/** Tall painted ocean strip (scrolls with voyage content). Native 2816×11392. */
const MAP_OCEAN_SCROLL = '/assets/images/map-ocean-scroll.png';
/** Native aspect of map-ocean-scroll.png — one tile of the repeating water. */
const OCEAN_SCROLL_ASPECT = 11392 / 2816;
/** Sky cloud A — wide 3D bank (970×453; alpha already keyed). */
const MAP_SKY_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
/** Sky cloud B — compact 3D cluster (769×306; alpha already keyed). */
const MAP_SKY_CLOUD_B = '/assets/images/map-sky-cloud-b.png';
/**
 * Layered sky clouds for the seamless marquee strip.
 * The strip is duplicated side-by-side; the track animates translateX(-50% → 0)
 * linear infinite so clouds drift left → right and twins enter from the left.
 */
type MapSkyCloudSpec = {
  id: string;
  src: string;
  widthPct: number;
  /** Horizontal anchor — prefer left OR right. */
  leftPct?: number;
  rightPct?: number;
  /** Vertical anchors inside the sky band. */
  topPct?: number;
  bottomPct?: number;
  opacity: number;
};

/**
 * Horizon cloud bank — modest sky strip under the safe area, resting on the
 * ocean horizon. Assets have ~20% top alpha padding so topPct near 0 still
 * leaves a thin sky gap before the white puffs.
 */
const MAP_SKY_CLOUDS: MapSkyCloudSpec[] = [
  {
    id: 'a-left',
    src: MAP_SKY_CLOUD_A,
    widthPct: 44,
    leftPct: -12,
    topPct: 0,
    opacity: 0.95,
  },
  {
    id: 'b-right',
    src: MAP_SKY_CLOUD_B,
    widthPct: 36,
    rightPct: -8,
    topPct: 4,
    opacity: 0.92,
  },
  {
    id: 'a-mid',
    src: MAP_SKY_CLOUD_A,
    widthPct: 30,
    leftPct: 32,
    topPct: 0,
    opacity: 0.82,
  },
  {
    id: 'b-high',
    src: MAP_SKY_CLOUD_B,
    widthPct: 22,
    leftPct: 52,
    topPct: 2,
    opacity: 0.74,
  },
  {
    id: 'a-low',
    src: MAP_SKY_CLOUD_A,
    widthPct: 32,
    leftPct: 10,
    topPct: 14,
    opacity: 0.58,
  },
];

/** Full loop duration for the duplicated cloud track (linear infinite). */
const MAP_SKY_CLOUD_LOOP_SEC = 90;

/**
 * Extra drop for water + islands after the wood header was removed
 * (`--map-header-h` is 0). Keeps the first-island tap cue below the
 * fixed cloud bank without growing the clouds themselves.
 */
const OCEAN_CONTENT_NUDGE_PX = 48;
/**
 * Ocean frame top — sits under the safe area (thin header inset, no wood plank),
 * then nudged down so Beginnings / the tap oval clear the sky clouds.
 */
const OCEAN_VIEWPORT_TOP = `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} + ${OCEAN_CONTENT_NUDGE_PX}px)`;
/**
 * Sky-cloud band top — flush with the safe area so puffs sit in the sky gap.
 * Height is fixed (not tied to OCEAN_VIEWPORT_TOP) so the nudge does not
 * stretch the overlay back over the islands.
 */
const MAP_SKY_CLOUD_TOP = `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H})`;
const MAP_SKY_CLOUD_H = '130px';

/**
 * Globe-limb mask on the ocean WATER frame — soft feather along the curve so
 * the water blends into sky. Curve stays locked under the safe-area sky.
 */
const OCEAN_HORIZON_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 400" preserveAspectRatio="none">
    <defs>
      <linearGradient id="feather" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="18">
        <stop offset="0" stop-color="white" stop-opacity="0"/>
        <stop offset="0.55" stop-color="white" stop-opacity="0.55"/>
        <stop offset="1" stop-color="white" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <path d="M0,16 Q50,1 100,16 L100,400 L0,400 Z" fill="url(#feather)"/>
  </svg>`,
)}")`;

/**
 * Soft atmospheric haze along the locked horizon curve (sky → ocean).
 * Same viewBox/path as the globe-limb mask so the mist tracks the curve exactly;
 * gradient feathers light blue/white downward into clear water.
 */
const OCEAN_HORIZON_HAZE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 400" preserveAspectRatio="none">
    <defs>
      <linearGradient id="haze" gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="68">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.58"/>
        <stop offset="0.18" stop-color="#eaf5fc" stop-opacity="0.4"/>
        <stop offset="0.45" stop-color="#b8dff8" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#7ec8f8" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,16 Q50,1 100,16 L100,68 L0,68 Z" fill="url(#haze)"/>
  </svg>`,
)}")`;

type Island = OceanMapIsland;

const islandHasMainMap = (island: Island): boolean =>
  Boolean(
    (island.mainMapUrl && island.mainMapUrl.trim()) ||
      (island.mainMapVideoUrl && island.mainMapVideoUrl.trim()),
  );

const ISLAND_ART_SIZE = 225;

/**
 * Voyage layout.
 *
 * The CMS exposes a `mapPosition` per island but authors every one of them at
 * the same default (x 50 / y 50), so laying islands out by those coordinates
 * stacks the whole voyage on one spot. Percentages also can't express spacing,
 * because a node's real height depends on how long its label planks wrap.
 *
 * So the path is computed here: a serpentine weave down the water where each
 * island gets a slot as tall as the node actually measured, plus a gap. Slot
 * tops are pixels, which makes spacing independent of viewport and island count.
 */
/** Horizontal swing either side of the centre line, in % of the water width. */
const VOYAGE_X_AMPLITUDE = 19;
/** Islands per full centre → right → centre → left weave. */
const VOYAGE_X_PERIOD = 4;
/**
 * Clear water above the first island, below the locked horizon curve.
 * 48px water nudge + this pad puts the 0/7 / “Tap Island” oval fully under
 * the 130px cloud band (the badge paints a bit above the node box).
 */
const VOYAGE_TOP_PAD = 132;
/** Clear water between one island's lowest plank and the next island's badge. */
const VOYAGE_GAP = 64;
/** Clear water past the last island so its planks clear the footer nav. */
const VOYAGE_BOTTOM_PAD = 96;
/** Slot height assumed until a node reports its measured height. */
const VOYAGE_ESTIMATED_NODE_H = 260;
/** Keeps a node's art fully on screen where the path swings widest. */
const VOYAGE_EDGE_PAD = 8;

/** Normalised length the sailing route's dash pattern is measured against. */
const VOYAGE_TRAIL_PATH_LENGTH = 1000;

/** Serpentine centre-line offset for the island at `index`. */
const voyageX = (index: number): number =>
  50 + VOYAGE_X_AMPLITUDE * Math.sin((index * 2 * Math.PI) / VOYAGE_X_PERIOD);

/**
 * Sail-the-island cinematic — same punch-in + white fade as Explore / WorldPage.
 * The lower-island wait is skipped (islands already sit on the water).
 *
 * Timing (~2.35s):
 *   0ms         clear chrome
 *   350ms       zoom into the tapped island
 *   1550ms      white fade
 *   2350ms      navigate /sail/:id
 */
const MAP_SAIL_CLEAR_MS = 280;
const MAP_SAIL_HOLD_MS = 350;
const MAP_SAIL_ZOOM_MS = 1400;
const MAP_SAIL_FADE_MS = 700;
const MAP_SAIL_FADE_START_MS = 1550;
const MAP_SAIL_NAVIGATE_MS = 2350;
const MAP_SAIL_REDUCED_NAVIGATE_MS = 220;
const MAP_SAIL_ZOOM_SCALE = 2.35;
const MAP_SAIL_ZOOM_EASE = 'cubic-bezier(0.72, 0.0, 0.88, 0.28)';

const IslandNode: React.FC<{
  island: Island;
  index: number;
  /** Slot top on the voyage, in px from the top of the islands layer. */
  top: number;
  /** Serpentine centre offset, in % of the water width. */
  x: number;
  bubbleReady: boolean;
  storiesComplete: number;
  storiesTotal: number;
  isZoomTarget: boolean;
  cinematic: boolean;
  interactive?: boolean;
  showTapCue?: boolean;
  onMeasure: (id: string, height: number) => void;
  onSelect: (island: Island, node: HTMLElement) => void;
}> = ({
  island,
  index,
  top,
  x,
  bubbleReady,
  storiesComplete,
  storiesTotal,
  isZoomTarget,
  cinematic,
  interactive = true,
  showTapCue = false,
  onMeasure,
  onSelect,
}) => {
  const nodeRef = useRef<HTMLButtonElement>(null);
  const isLocked = island.status === 'locked';
  const isComplete = island.status === 'complete';
  const isCurrent = island.status === 'current';
  const artSrc = getOceanIslandArtSrc(island);
  const hasArt = Boolean(artSrc);
  const artSize = island.mapArtUrl ? Math.min(ISLAND_ART_SIZE, 200) : ISLAND_ART_SIZE;
  const reduceMotion = prefersReducedMotion();
  /** CMS islands often repeat the book label as the description — show it once. */
  const blurb =
    island.title.trim() === island.book.trim() ? '' : island.title.trim();
  const showProgress = storiesTotal > 0;
  const allStoriesDone = showProgress && storiesComplete >= storiesTotal;
  const nodeWidth = hasArt ? artSize + 12 : 112;
  /** Half the node plus a margin — the closest its centre may sit to an edge. */
  const edgeInset = nodeWidth / 2 + VOYAGE_EDGE_PAD;

  // Report the height this node actually rendered (label planks wrap to any
  // number of lines) so the parent can size its slot and space the next island.
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const report = () => onMeasure(island.id, el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [island.id, onMeasure]);

  const discStyle: React.CSSProperties = isLocked
    ? { background: 'radial-gradient(circle at 35% 30%, #8fa3ad, #5b6f78)' }
    : isComplete
    ? { background: 'radial-gradient(circle at 35% 30%, #7bd66a, #3f9e3a)' }
    : { background: 'radial-gradient(circle at 35% 30%, #ffd98a, #e0a94a 45%, #c98a3a)' };

  return (
    <button
      ref={nodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (cinematic || !interactive) return;
        onSelect(island, e.currentTarget);
      }}
      data-globe-node
      className="absolute -translate-x-1/2 z-10 flex flex-col items-center focus:outline-none active:scale-95 transition-transform touch-manipulation"
      style={{
        // clamp() keeps the widest art on screen when the path swings out.
        left: `clamp(${edgeInset}px, ${x}%, calc(100% - ${edgeInset}px))`,
        top: `${top}px`,
        width: nodeWidth,
        // Inline — must beat parent overlay pointer-events:none (Tailwind class alone is easy to miss).
        pointerEvents: cinematic || !interactive ? 'none' : 'auto',
        filter: !interactive ? 'grayscale(1) brightness(0.72)' : undefined,
      }}
      aria-label={`${island.book}: ${island.title}${
        showProgress ? `, ${storiesComplete} of ${storiesTotal} stories complete` : ''
      }${isLocked ? ' (locked)' : ''}`}
    >
      {/* Inner wrapper carries the per-node "globe" 3D transform so the outer
          button keeps its stable x/y positioning + measurable rect. */}
      <div
        data-globe-inner
        className="flex flex-col items-center w-full"
        style={{ transformOrigin: 'center center', backfaceVisibility: 'hidden' }}
      >
      {/* Bubble pop-in lives inside globe transform so scroll-globe can still apply.
          Flex column: badge / art / label must be block-level flex items so their
          own margins and padding create real vertical space. */}
      <div
        className={`flex w-full flex-col items-center ${
          bubbleReady && !reduceMotion ? 'map-island-bubble-in' : ''
        }`}
        style={
          bubbleReady && !reduceMotion
            ? { animationDelay: `${0.06 + index * 0.09}s` }
            : reduceMotion
              ? undefined
              : { opacity: 0 }
        }
      >
      {/* Status flag / ribbon — keep Complete lightly; skip Current pill on art islands */}
      {showTapCue && (
        <span className="ob-tap-island mb-2 pointer-events-none" aria-hidden>
          Tap Island
        </span>
      )}
      {showProgress && (
        <span
          className={`mb-1 flex flex-col items-center pointer-events-none ${
            cinematic && !isZoomTarget ? 'opacity-0' : ''
          }`}
          style={{ transition: 'opacity 180ms ease' }}
        >
          <span
            className="min-w-[46px] px-2 py-0.5 rounded-full text-[11px] font-display font-black tabular-nums tracking-wide shadow border"
            style={{
              background: allStoriesDone
                ? 'linear-gradient(180deg, #7bd66a 0%, #3f9e3a 100%)'
                : 'linear-gradient(180deg, #ffe9b0 0%, #e8c76a 100%)',
              color: allStoriesDone ? '#fff' : '#5c3d1e',
              borderColor: allStoriesDone ? '#1B5E20' : '#c9a76b',
              textShadow: allStoriesDone
                ? '0 1px 1px rgba(0,0,0,0.35)'
                : '0 1px 0 rgba(255,255,255,0.45)',
            }}
          >
            {storiesComplete}/{storiesTotal}
          </span>
          <span
            aria-hidden
            className="w-0 h-0 -mt-px"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: allStoriesDone ? '6px solid #3f9e3a' : '6px solid #e8c76a',
            }}
          />
        </span>
      )}

      {/* Island art or placeholder disc.
          Art islands: dedicated relative wrapper around ONLY the img + shore
          rings (Complete badge stays outside) so rings center on the image. */}
      {hasArt && artSrc ? (
        <div
          data-island-focus
          className="relative"
          style={{
            width: artSize,
            filter: isZoomTarget
              ? 'drop-shadow(0 0 18px rgba(255, 236, 160, 0.65))'
              : undefined,
          }}
        >
          {/* Shore ripples — absolute inset-0 over the img box; each ellipse
              centers with left 50% / top 58% + translate(-50%, -50%) so rings
              sit on the water pad, not mid-image (trees bias the art upward). */}
          <div className="absolute inset-0 pointer-events-none z-0" aria-hidden>
            <div className="map-island-shore map-island-shore-1" />
            <div className="map-island-shore map-island-shore-2" />
            <div className="map-island-shore map-island-shore-3" />
          </div>
          <img
            src={artSrc}
            alt=""
            draggable={false}
            className={`relative z-[1] block h-auto w-full pointer-events-none select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)] ${
              isLocked ? 'grayscale opacity-75' : ''
            }`}
          />
          {isLocked && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] w-10 h-10 rounded-full bg-black/40 border-2 border-white/30 flex items-center justify-center">
              <Lock size={18} className="text-white" strokeWidth={2.5} />
            </span>
          )}
          {isCurrent && (
            <span className="absolute map-ship-bob -right-2 bottom-4 z-[2]">
              <Ship size={30} className="text-[#7a4a20] drop-shadow" fill="#C4884A" strokeWidth={1.5} />
            </span>
          )}
        </div>
      ) : (
        <div className="relative" data-island-focus style={{ opacity: 0.8 }}>
          <div
            className={`w-[64px] h-[64px] rounded-full border-4 shadow-[0_6px_14px_rgba(0,0,0,0.35)] flex items-center justify-center ${
              isLocked ? 'border-white/40 grayscale-[35%]' : 'border-white/70'
            } ${isCurrent ? 'map-node-pulse' : ''}`}
            style={discStyle}
          >
            {isComplete && (
              <span className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                <Check size={18} className="text-[#2E7D32]" strokeWidth={3} />
              </span>
            )}
            {isCurrent && <Star size={26} className="text-white drop-shadow" fill="#FFD700" strokeWidth={1.5} />}
            {isLocked && (
              <span className="w-8 h-8 rounded-full bg-black/35 flex items-center justify-center">
                <Lock size={18} className="text-white" strokeWidth={2.5} />
              </span>
            )}
          </div>
          {isCurrent && (
            <span className="absolute map-ship-bob -right-6 -bottom-2">
              <Ship size={30} className="text-[#7a4a20] drop-shadow" fill="#C4884A" strokeWidth={1.5} />
            </span>
          )}
        </div>
      )}

      {/* Label planks — book and blurb are separate block planks so each grows
          to its own text height. */}
      <span className="mt-2 flex w-full max-w-[136px] flex-col items-center gap-1 pointer-events-none">
        <span
          className="block w-full text-center leading-tight break-words px-2.5 py-1 rounded-lg bg-[#f3e3c4] text-[#5c3d1e] text-[11px] font-display font-black border border-[#c9a76b] shadow"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
        >
          {island.book}
        </span>
        {Boolean(blurb) && (
          <span
            className="block w-full text-center leading-tight break-words italic px-2 py-1 rounded-md bg-[#f7eeda] text-[#6b4a26] text-[10px] font-display font-bold border border-[#c9a76b]/80 shadow"
            style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
          >
            &ldquo;{blurb}&rdquo;
          </span>
        )}
      </span>
      </div>
      </div>
    </button>
  );
};

// Tuning for the "spinning globe" curvature. Larger PERSPECTIVE = gentler.
// Opacity fade is limb-gated: islands stay fully opaque across the main ocean
// and only soft-wrap (fade + tilt/scale) as they approach the top/bottom edge.
const GLOBE_PERSPECTIVE = 1300; // px
const GLOBE_MAX_TILT = 38; // deg of rotateX at the very edge
const GLOBE_MAX_DEPTH = 160; // px pushed back (translateZ) at the edge
const GLOBE_MAX_SCALE_FALLOFF = 0.22; // shrink amount at the edge
/** Opacity falloff only begins past this |norm| (0 = center, 1 = edge). */
const GLOBE_OPACITY_FADE_START = 0.72;
/** Max opacity removed at either edge once past the fade-start band. */
const GLOBE_MAX_FADE = 0.22;
/** Mild extra opacity removed only at the TOP (horizon) limb. */
const GLOBE_HORIZON_EXTRA_FADE = 0.12;

/** Soft globe-limb mask — ocean water PNG frame only. */
const OCEAN_FRAME_MASK_STYLE: React.CSSProperties = {
  WebkitMaskImage: OCEAN_HORIZON_MASK,
  maskImage: OCEAN_HORIZON_MASK,
  WebkitMaskSize: '100% 100%',
  maskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
};

const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Scroll-synced islands layer (translateY); sits below fixed horizon clouds. */
  const islandsSyncRef = useRef<HTMLDivElement>(null);
  const islandsLayerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const sailTimersRef = useRef<number[]>([]);
  const sailCinematicLockRef = useRef(false);
  /** Islands come only from the CMS — no hardcoded stand-in. Until the fetch
   *  settles the ocean is empty behind the loading card; on failure the stormy
   *  sea takes over. A fake island would be tappable and lead nowhere. */
  const [islands, setIslands] = useState<Island[]>([]);
  const [mapStories, setMapStories] = useState<OceanMapStoryRow[]>([]);
  /** Measured node heights by island id — drives voyage slot spacing. */
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  /** First island fetch still in flight — covers the empty ocean. */
  const [islandsLoading, setIslandsLoading] = useState(true);
  /** CMS unreachable or holding no islands — surfaced instead of empty ocean. */
  const [islandsError, setIslandsError] = useState(false);
  const [islandsRetrying, setIslandsRetrying] = useState(false);
  const [islandsReloadTick, setIslandsReloadTick] = useState(0);
  /** Gate bubble pop until first paint / after API settle so stagger plays on launch. */
  const [bubbleReady, setBubbleReady] = useState(false);
  const [progressTick, setProgressTick] = useState(0);
  const [sailCinematic, setSailCinematic] = useState(false);
  const [sailZoom, setSailZoom] = useState(false);
  const [sailFade, setSailFade] = useState(false);
  const [zoomIslandId, setZoomIslandId] = useState<string | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState('50% 42%');
  const location = useLocation();
  const { kids } = useUser();
  const guidedRef = useRef(false);
  /** First island of the voyage — the only tappable one during guided first
   *  run. Held in a ref so the cinematic callbacks keep stable identities. */
  const firstIslandIdRef = useRef<string | null>(null);
  const pendingIslandRef = useRef<Island | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [guided] = useState(
    () =>
      isOnboardingJourneyActive() ||
      Boolean((location.state as { onboardingJourney?: boolean } | null)?.onboardingJourney),
  );
  const perryArrive = Boolean(
    (location.state as { perryArrive?: boolean } | null)?.perryArrive,
  );
  const perryKidName =
    (location.state as { kidName?: string } | null)?.kidName || kids[0]?.name;
  const [cloudLanding, setCloudLanding] = useState(
    () =>
      !perryArrive &&
      (isOnboardingJourneyActive() ||
        Boolean((location.state as { onboardingJourney?: boolean } | null)?.onboardingJourney)),
  );
  const [showTapIsland, setShowTapIsland] = useState(() => perryArrive);
  const [introVideo, setIntroVideo] = useState(false);
  const [videoFadeOut, setVideoFadeOut] = useState(false);
  const videoLeaveRef = useRef(false);
  guidedRef.current = guided;

  useEffect(() => {
    if (!guided) return;
    document.body.setAttribute('data-modal-open', 'true');
    return () => {
      if (!introVideo) document.body.removeAttribute('data-modal-open');
    };
  }, [guided, introVideo]);

  const syncIslandsScroll = useCallback(() => {
    const scroller = scrollRef.current;
    const sync = islandsSyncRef.current;
    if (!scroller || !sync) return;
    sync.style.transform = `translate3d(0, ${-scroller.scrollTop}px, 0)`;
  }, []);

  const clearSailTimers = useCallback(() => {
    sailTimersRef.current.forEach((id) => window.clearTimeout(id));
    sailTimersRef.current = [];
  }, []);

  const islandProgress = useMemo(() => {
    const byId: Record<string, { complete: number; total: number }> = {};
    for (const island of islands) {
      const aliases = [island.id, island.cmsId].filter(Boolean) as string[];
      const aliasSet = new Set(aliases);
      const playable = mapStories.filter((row) => {
        if (!isPlayableMainMapStory(row)) return false;
        return storyIslandKeys(row).some((key) => aliasSet.has(key));
      });
      const completeFromStories = playable.filter((row) =>
        isStoryPackComplete(island.id, row),
      ).length;
      const complete =
        playable.length > 0
          ? completeFromStories
          : islandStoryProgressService.countReadCompleteStories(aliases);
      const total = Math.max(island.storiesTotal, playable.length, complete, 0);
      byId[island.id] = { complete, total };
    }
    return byId;
  }, [islands, mapStories, progressTick]);

  const handleNodeMeasure = useCallback((id: string, height: number) => {
    setNodeHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  /**
   * Stack islands down the water: every slot is as tall as the node measured,
   * so a three-line label pushes the next island further down instead of
   * bleeding into it. Voyage height then falls out of the last slot.
   */
  const voyage = useMemo(() => {
    let cursor = VOYAGE_TOP_PAD;
    const slots = islands.map((island, index) => {
      const height = nodeHeights[island.id] ?? VOYAGE_ESTIMATED_NODE_H;
      const slot = { top: cursor, x: voyageX(index), height };
      cursor += height + VOYAGE_GAP;
      return slot;
    });
    const height = Math.round(Math.max(VOYAGE_TOP_PAD, cursor - VOYAGE_GAP) + VOYAGE_BOTTOM_PAD);
    return { slots, height };
  }, [islands, nodeHeights]);

  /**
   * Dotted sailing route through the slot centres. Percentage coordinates in a
   * `preserveAspectRatio="none"` box, so no pixel width is needed; the dashes
   * keep their shape via non-scaling-stroke.
   */
  const voyageTrail = useMemo(() => {
    if (voyage.slots.length < 2) return '';
    const points = voyage.slots.map((slot) => {
      const centerY = ((slot.top + slot.height / 2) / voyage.height) * 100;
      return `${slot.x.toFixed(2)},${centerY.toFixed(3)}`;
    });
    return `M${points.join(' L')}`;
  }, [voyage]);

  /**
   * Tap an unlocked island → zoom in, white fade, then open the island's story
   * packs (or the onboarding video). The ship deck used to sit in the middle of
   * this path; it is now reached from the Journey plank on the crew deck, so a
   * tap lands a kid on the content rather than on a wheel they must steer first.
   * Timing (~2.35s): 350ms hold → zoom → 1550ms fade → 2350ms next beat.
   */
  const islandIsVoyageLocked = useCallback(
    (island: Island) => {
      const index = islands.findIndex((row) => row.id === island.id);
      if (index < 0) return island.status === 'locked';
      if (island.status === 'locked') return true;
      if (index === 0) return false;
      const prev = islands[index - 1];
      const progress = islandProgress[prev.id];
      return !(progress && progress.total > 0 && progress.complete >= progress.total);
    },
    [islands, islandProgress],
  );

  const openJourneyTrial = useCallback(() => {
    navigate('/onboarding/welcome', {
      state: { returnTo: '/map', reason: 'continue-journey' },
    });
  }, [navigate]);

  const handleSelect = useCallback(
    (island: Island, node: HTMLElement) => {
      if (islandIsVoyageLocked(island) && !guidedRef.current) {
        if (!hasPremiumAccess()) openJourneyTrial();
        return;
      }
      if (sailCinematicLockRef.current) return;
      if (guidedRef.current && island.id !== firstIslandIdRef.current) return;

      sailCinematicLockRef.current = true;
      pendingIslandRef.current = island;
      setShowTapIsland(false);

      const afterCinematic = () => {
        if (guidedRef.current) {
          setIntroVideo(true);
          return;
        }
        const title = `${island.book}: ${island.title}`;
        // Story packs live on the island's main map; islands with no main-map
        // art fall back to the legacy island scene (same rule the sail deck used).
        if (islandHasMainMap(island)) {
          navigate(`/map/${encodeURIComponent(island.id)}/main`, {
            state: { title },
          });
          return;
        }
        navigate(`/sail/${encodeURIComponent(island.id)}/lesson`, {
          state: { title },
        });
      };

      const layer = islandsLayerRef.current;
      if (layer) {
        layer.querySelectorAll<HTMLElement>('[data-globe-inner]').forEach((el) => {
          el.style.transform = '';
          el.style.opacity = '1';
        });
        const focus =
          node.querySelector<HTMLElement>('[data-island-focus]') || node;
        const layerRect = layer.getBoundingClientRect();
        const focusRect = focus.getBoundingClientRect();
        const cx = focusRect.left + focusRect.width / 2;
        const cy = focusRect.top + focusRect.height / 2;
        if (layerRect.width > 0 && layerRect.height > 0) {
          const ox = ((cx - layerRect.left) / layerRect.width) * 100;
          const oy = ((cy - layerRect.top) / layerRect.height) * 100;
          setZoomOrigin(`${ox}% ${oy}%`);
        }
      }

      clearSailTimers();
      document.body.setAttribute('data-modal-open', 'true');
      setZoomIslandId(island.id);
      setSailCinematic(true);
      setSailZoom(false);
      setSailFade(false);

      if (prefersReducedMotion()) {
        setSailFade(true);
        const id = window.setTimeout(afterCinematic, MAP_SAIL_REDUCED_NAVIGATE_MS);
        sailTimersRef.current = [id];
        return;
      }

      const zoomId = window.setTimeout(() => setSailZoom(true), MAP_SAIL_HOLD_MS);
      const fadeId = window.setTimeout(() => setSailFade(true), MAP_SAIL_FADE_START_MS);
      const nextId = window.setTimeout(afterCinematic, MAP_SAIL_NAVIGATE_MS);
      sailTimersRef.current = [zoomId, fadeId, nextId];
    },
    [navigate, clearSailTimers, islandIsVoyageLocked, openJourneyTrial],
  );

  const finishCloudLanding = useCallback(() => {
    setCloudLanding(false);
    setShowTapIsland(true);
  }, []);

  const goToFirstIsland = useCallback(() => {
    const island = pendingIslandRef.current;
    const dest = island || islands[0];
    if (!dest) return;
    const title = `${dest.book}: ${dest.title}`;
    navigate(`/sail/${encodeURIComponent(dest.id)}`, {
      state: {
        onboardingJourney: true,
        title,
        hasMainMap: islandHasMainMap(dest),
        mainMapUrl: dest.mainMapUrl,
        mainMapVideoUrl: dest.mainMapVideoUrl,
      },
    });
  }, [islands, navigate]);

  /** Video ends → white fade, then sail deck. */
  const finishIntroVideo = useCallback(() => {
    if (videoLeaveRef.current) return;
    videoLeaveRef.current = true;
    setVideoFadeOut(true);
    const delay = prefersReducedMotion() ? 0 : MAP_SAIL_FADE_MS;
    const id = window.setTimeout(goToFirstIsland, delay);
    sailTimersRef.current.push(id);
  }, [goToFirstIsland]);

  useEffect(() => {
    if (!guided) return;
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'video';
    preload.href = ONBOARDING_GENESIS_VIDEO;
    document.head.appendChild(preload);
    return () => {
      preload.remove();
    };
  }, [guided]);

  useEffect(() => {
    if (!introVideo) return;
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;
    el.muted = true;
    const attempt = el.play();
    if (attempt && typeof attempt.then === 'function') {
      void attempt
        .then(() => {
          if (cancelled) return;
          el.muted = false;
        })
        .catch(() => {
          if (cancelled) return;
          el.muted = true;
          void el.play().catch(() => {
            /* keep overlay; ended/error handlers advance */
          });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [introVideo]);

  // Fetch published islands; the CMS is the only source, so a failure or an
  // empty list raises the stormy-sea retry rather than inventing an island.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(() => controller.abort(), CMS_ISLANDS_TIMEOUT_MS);

    const load = async () => {
      try {
        const mapped = await fetchOceanMapIslands(controller.signal);
        if (cancelled) return;
        if (mapped) {
          setIslands(mapped);
          setIslandsError(false);
          const backgrounds = mapped.flatMap((island) =>
            [getOceanIslandArtSrc(island), island.sailArtUrl, island.mainMapUrl, island.mainMapVideoUrl].filter(
              (url): url is string => Boolean(url),
            ),
          );
          void cacheAssetUrls([MAP_OCEAN_SCROLL, MAP_SKY_CLOUD_A, MAP_SKY_CLOUD_B, ...backgrounds]);
          // Tripwire: shout in dev if the hardcoded free island is gone.
          assertFreeTierIslandExists(mapped);
        } else {
          // A reachable CMS with no islands is still a voyage kids can't sail.
          setIslandsError(true);
        }
      } catch {
        if (!cancelled) setIslandsError(true);
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) {
          setIslandsLoading(false);
          setIslandsRetrying(false);
          setBubbleReady(false);
          requestAnimationFrame(() => {
            if (!cancelled) setBubbleReady(true);
          });
        }
      }

      try {
        const stories = await fetchPublishedMapStories();
        if (!cancelled && stories) setMapStories(stories);
      } catch {
        /* markers fall back to local progress */
      }
    };

    void load();
    // Fallback path: still pop bubbles if fetch is slow/hangs until abort.
    requestAnimationFrame(() => {
      if (!cancelled) setBubbleReady(true);
    });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, [islandsReloadTick]);

  const retryIslands = useCallback(() => {
    setIslandsRetrying(true);
    setIslandsReloadTick((tick) => tick + 1);
  }, []);

  // Guided first run only lets the kid tap the island the voyage starts on.
  useEffect(() => {
    firstIslandIdRef.current = islands[0]?.id ?? null;
  }, [islands]);

  useEffect(() => {
    const onProgress = () => setProgressTick((t) => t + 1);
    window.addEventListener('islandStoryProgressUpdated', onProgress);
    const unsub = profileService.onProfileChange(onProgress);
    const onVisible = () => {
      if (document.visibilityState === 'visible') onProgress();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('islandStoryProgressUpdated', onProgress);
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(
    () => () => {
      clearSailTimers();
      sailCinematicLockRef.current = false;
      document.body.removeAttribute('data-modal-open');
    },
    [clearSailTimers],
  );

  // Map each node's distance from the viewport's vertical center onto a curved
  // (spherical) transform: nodes at center sit flat & upright; nodes toward the
  // top/bottom edges tilt away, recede in depth, shrink and fade — like the
  // horizon of a globe rolling past as you scroll.
  const applyGlobe = useCallback(() => {
    rafRef.current = null;
    if (sailCinematicLockRef.current) return;
    const scroller = scrollRef.current;
    const islandsRoot = islandsLayerRef.current;
    if (!scroller || !islandsRoot) return;

    const viewRect = scroller.getBoundingClientRect();
    const viewportCenterY = viewRect.top + viewRect.height / 2;
    const half = viewRect.height / 2 || 1;

    // Islands live in a sibling overlay (above clouds), not inside the scroller.
    const nodes = islandsRoot.querySelectorAll<HTMLElement>('[data-globe-node]');

    // Batch reads first (measure the untransformed outer wrapper so the rect is
    // stable and there is no measure/transform feedback loop).
    const work: { inner: HTMLElement; norm: number; nearSky: boolean }[] = [];
    nodes.forEach((outer) => {
      const inner = outer.querySelector('[data-globe-inner]') as HTMLElement | null;
      if (!inner) return;
      const r = outer.getBoundingClientRect();
      const centerY = r.top + r.height / 2;
      const norm = Math.max(-1, Math.min(1, (centerY - viewportCenterY) / half));
      // First-island rest pose sits just under the 130px cloud band; a positive
      // rotateX folds that tap oval back into the clouds.
      work.push({ inner, norm, nearSky: r.top < 210 });
    });

    // Then batch writes.
    work.forEach(({ inner, norm, nearSky }) => {
      const mag = Math.abs(norm);
      // norm < 0 => above center: recede the TOP edge (rotateX +) toward horizon.
      // norm > 0 => below center: recede the BOTTOM edge (rotateX -).
      let rotateX = -norm * GLOBE_MAX_TILT;
      if (nearSky && rotateX > 0) rotateX = 0;
      // Keep translateZ at 0 — any negative Z breaks hit-testing on the
      // island button in WebKit/Blink even when the outer button is on top.
      const translateZ = 0;
      // Slightly stronger scale falloff when rolling over the top limb —
      // keep the sky-adjacent island closer to full size so the tap oval stays readable.
      const scaleFalloff = nearSky && norm < 0
        ? GLOBE_MAX_SCALE_FALLOFF * 0.35
        : norm < 0
          ? GLOBE_MAX_SCALE_FALLOFF * 1.15
          : GLOBE_MAX_SCALE_FALLOFF;
      const scale = 1 - mag * scaleFalloff;
      // Soft wrap: keep full opacity through the main ocean; only fade in the
      // outer limb band so islands near the top but still on water stay solid.
      const fadeT =
        mag <= GLOBE_OPACITY_FADE_START
          ? 0
          : (mag - GLOBE_OPACITY_FADE_START) / (1 - GLOBE_OPACITY_FADE_START);
      const topBias = norm < 0 ? fadeT * GLOBE_HORIZON_EXTRA_FADE : 0;
      const opacity = Math.max(0, 1 - fadeT * GLOBE_MAX_FADE - topBias);
      inner.style.transform = `perspective(${GLOBE_PERSPECTIVE}px) translateZ(${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`;
      inner.style.opacity = String(opacity);
      // Keep hit geometry on the flat plane of the button (not pushed into 3D).
      inner.style.transformStyle = 'flat';
    });
  }, []);

  const scheduleGlobe = useCallback(() => {
    if (reducedMotionRef.current || sailCinematicLockRef.current) return;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(applyGlobe);
    }
  }, [applyGlobe]);

  // Hard-clamp scroll so overscroll can't pull content upward past the locked horizon.
  const clampScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (scroller && scroller.scrollTop < 0) scroller.scrollTop = 0;
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    const islandsRoot = islandsLayerRef.current;
    if (!scroller || !islandsRoot) return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clearTransforms = () => {
      islandsRoot.querySelectorAll<HTMLElement>('[data-globe-inner]').forEach((el) => {
        el.style.transform = '';
        el.style.opacity = '';
      });
    };
    const syncReducedMotion = () => {
      reducedMotionRef.current = mql.matches;
      if (mql.matches) {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        clearTransforms();
      } else {
        scheduleGlobe();
      }
    };

    syncIslandsScroll();
    syncReducedMotion();
    scheduleGlobe();

    const onScroll = () => {
      clampScroll();
      syncIslandsScroll();
      scheduleGlobe();
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => {
      syncIslandsScroll();
      scheduleGlobe();
    };
    window.addEventListener('resize', onResize);
    if (mql.addEventListener) mql.addEventListener('change', syncReducedMotion);
    else mql.addListener(syncReducedMotion);

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (mql.removeEventListener) mql.removeEventListener('change', syncReducedMotion);
      else mql.removeListener(syncReducedMotion);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleGlobe, clampScroll, syncIslandsScroll]);

  // Re-apply globe once API islands replace fallback nodes, or slots re-measure.
  useEffect(() => {
    syncIslandsScroll();
    scheduleGlobe();
  }, [islands, voyage, syncIslandsScroll, scheduleGlobe]);

  useEffect(() => {
    if (!sailCinematic) return;
    const islandsRoot = islandsLayerRef.current;
    if (!islandsRoot) return;
    islandsRoot.querySelectorAll<HTMLElement>('[data-globe-inner]').forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '1';
    });
    const scroller = scrollRef.current;
    if (scroller) scroller.style.overflowY = 'hidden';
    return () => {
      if (scroller) scroller.style.overflowY = '';
    };
  }, [sailCinematic]);

  const cameraStyle: React.CSSProperties | undefined = sailCinematic
    ? {
        transform: sailZoom ? `scale(${MAP_SAIL_ZOOM_SCALE})` : 'scale(1)',
        transformOrigin: zoomOrigin,
        transition: `transform ${MAP_SAIL_ZOOM_MS}ms ${MAP_SAIL_ZOOM_EASE}`,
        willChange: 'transform',
        filter: 'saturate(1.08) brightness(1.05)',
      }
    : undefined;

  const chromeTransition = `opacity ${MAP_SAIL_CLEAR_MS}ms ease`;

  return (
    <div className={`relative w-full h-full overflow-hidden${sailCinematic ? ' sail-cinematic-active' : ''}`}>
      {/* Default app Header omitted on Map — sky sits under the safe area. */}

      {/* Bottom wood rope footer is owned by BottomNavigation (shared 4-tab bar). */}

      {/* ── Fixed sky (outside the scroller) — gradient through the locked horizon cutout. */}
      <div
        className="fixed top-0 left-0 right-0 z-[5] pointer-events-none overflow-hidden"
        style={{
          height: `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} + ${OCEAN_CONTENT_NUDGE_PX}px + 140px)`,
          background:
            'linear-gradient(180deg, #1a6fd4 0%, #3aa0ef 40%, #7ec8f8 70%, #a8daf8 100%)',
        }}
        aria-hidden
      />

      {/* ── Fixed sky clouds (portaled) — viewport-pinned at the ocean horizon.
          NOT inside scrollRef / islandsSyncRef: islands/ocean scroll underneath;
          this layer stays put (position:fixed on body).
          z-[45] > islands (32), < popup (60). Clouds overlay the water.
          pointer-events none so island taps still work.
          Seamless L→R marquee: duplicated strips, translateX(-50%→0) linear infinite. */}
      {createPortal(
        <div
          data-map-sky-clouds=""
          className="fixed left-0 right-0 z-[45] pointer-events-none overflow-hidden"
          style={{
            /* Flush with the safe-area sky; z < nav / popup. Height stays
               fixed so the water nudge does not grow this overlay. */
            top: MAP_SKY_CLOUD_TOP,
            height: MAP_SKY_CLOUD_H,
            opacity: sailCinematic ? 0.35 : 1,
            transition: chromeTransition,
          }}
          aria-hidden
        >
          <div
            className="map-sky-cloud-track"
            style={{ '--cloud-loop-duration': `${MAP_SKY_CLOUD_LOOP_SEC}s` } as React.CSSProperties}
          >
            {[0, 1].map((copy) => (
              <div key={copy} className="map-sky-cloud-strip" aria-hidden={copy === 1 ? true : undefined}>
                {MAP_SKY_CLOUDS.map((cloud) => {
                  const cloudStyle = {
                    width: `${cloud.widthPct}%`,
                    left: cloud.leftPct != null ? `${cloud.leftPct}%` : undefined,
                    right: cloud.rightPct != null ? `${cloud.rightPct}%` : undefined,
                    top: cloud.topPct != null ? `${cloud.topPct}%` : undefined,
                    bottom: cloud.bottomPct != null ? `${cloud.bottomPct}%` : undefined,
                    opacity: cloud.opacity,
                  } as React.CSSProperties;
                  return (
                    <img
                      key={`${copy}-${cloud.id}`}
                      src={cloud.src}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="map-sky-cloud pointer-events-none select-none absolute max-w-none h-auto"
                      style={cloudStyle}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Horizon haze — soft mist along the locked globe curve.
          z-[24]: above ocean (z-10), below islands (z-32) / clouds (z-45). */}
      <div
        className="absolute left-0 right-0 bottom-0 z-[24] pointer-events-none"
        style={{
          top: OCEAN_VIEWPORT_TOP,
          backgroundImage: OCEAN_HORIZON_HAZE,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          opacity: sailCinematic ? 0 : 1,
          transition: chromeTransition,
        }}
        aria-hidden
      />

      {/* ── Ocean frame (fixed curve) + inner scroller ──
          Outer box owns the soft globe-limb mask (water PNG only) and does NOT scroll,
          so the horizon stays locked under the safe-area sky. Islands are a sibling
          overlay with a soft feathered limb + globe fade. z-10: behind haze/clouds/islands.
          overscroll-behavior:none blocks rubber-band pull-up. */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10 overflow-hidden"
        style={{
          top: OCEAN_VIEWPORT_TOP,
          background: '#1a8fd1',
          ...OCEAN_FRAME_MASK_STYLE,
          ...cameraStyle,
        }}
      >
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto no-scrollbar"
          style={{
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: guided ? 'auto' : 'touch',
            overflowY: guided ? 'hidden' : undefined,
          }}
        >
          {/* Water tiles down the voyage — the strip is sized by width, so a
              long island list needs more of it than one strip provides. */}
          <div
            className="relative w-full pointer-events-none select-none"
            aria-hidden
            style={{
              height: voyage.height,
              minHeight: `calc(100vw * ${OCEAN_SCROLL_ASPECT})`,
              backgroundImage: `url("${MAP_OCEAN_SCROLL}")`,
              backgroundSize: '100% auto',
              backgroundRepeat: 'repeat-y',
              backgroundPosition: 'top center',
            }}
          />

          {/* Extra clearance for footer frame + wood tab lift + nav */}
          <div
            style={{
              height: `calc(var(--safe-area-bottom, 0px) + var(--wood-tab-lift, 12px) + ${MAP_FOOTER_H} + var(--map-footer-scroll-pad, 28px))`,
            }}
          />
        </div>
      </div>

      {/* ── Islands overlay (scroll-synced) ──
          Portaled to document.body so it escapes App's z-10 content stacking
          context (BottomNavigation is a z-40 sibling).
          z-[32]: above ocean/haze, BELOW fixed horizon clouds (z-45) so islands
          tuck under the cloud bank as they scroll up; also below nav (40) /
          popup (60). Empty overlay stays pointer-events:none so
          water scrolls and footer nav stays usable in gaps.
          No CSS mask — mask + pointer-events:none breaks hit testing for auto
          children in WebKit/Blink; limb fade is handled by applyGlobe opacity. */}
      {createPortal(
        <div
          ref={islandsLayerRef}
          className={`fixed left-0 right-0 bottom-0 z-[32] overflow-hidden pointer-events-none${
            sailCinematic ? ' sail-cinematic-active' : ''
          }`}
          style={{
            top: OCEAN_VIEWPORT_TOP,
            ...cameraStyle,
          }}
        >
          <div
            ref={islandsSyncRef}
            className="relative w-full will-change-transform"
            style={{ height: voyage.height, minHeight: `calc(100vw * ${OCEAN_SCROLL_ASPECT})` }}
          >
            <div className="absolute inset-0">
              {Boolean(voyageTrail) && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={voyageTrail}
                    fill="none"
                    stroke="rgba(255,255,255,0.72)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    // pathLength normalises the dashes: without it the 100×100
                    // viewBox stretches them into long streaks and huge gaps.
                    pathLength={VOYAGE_TRAIL_PATH_LENGTH}
                    strokeDasharray="2 6"
                    vectorEffect="non-scaling-stroke"
                    className="map-trail"
                  />
                </svg>
              )}

              {islands.map((island, index) => {
                const progress = islandProgress[island.id] || {
                  complete: island.storiesComplete,
                  total: island.storiesTotal,
                };
                const slot = voyage.slots[index];
                const voyageLocked = islandIsVoyageLocked(island);
                const shown = voyageLocked ? { ...island, status: 'locked' as const } : island;
                return (
                  <IslandNode
                    key={island.id}
                    island={shown}
                    index={index}
                    top={slot.top}
                    x={slot.x}
                    bubbleReady={bubbleReady}
                    storiesComplete={guided ? 0 : progress.complete}
                    storiesTotal={guided ? 0 : progress.total}
                    isZoomTarget={zoomIslandId === island.id}
                    cinematic={sailCinematic}
                    interactive={!guided || (index === 0 && !perryArrive)}
                    showTapCue={guided && !perryArrive && showTapIsland && !introVideo && !sailCinematic && index === 0}
                    onMeasure={handleNodeMeasure}
                    onSelect={handleSelect}
                  />
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── First island fetch in flight. Without a hardcoded stand-in island
          the ocean is genuinely empty until the CMS answers (up to the abort
          timeout on a cold dyno), so say what's happening instead. */}
      {islandsLoading &&
        !islandsError &&
        !guided &&
        !sailCinematic &&
        createPortal(
          <div
            className="fixed left-0 right-0 bottom-0 z-[34] flex items-center justify-center px-4"
            style={{
              top: OCEAN_VIEWPORT_TOP,
              background: 'rgba(9, 58, 92, 0.45)',
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <Compass
                size={44}
                className="text-[#f3e3c4] drop-shadow-lg map-compass-spin"
                strokeWidth={1.75}
              />
              <p className="text-white text-lg font-display font-black drop-shadow">
                Charting your islands&hellip;
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* ── CMS islands unreachable / empty — say so rather than leaving bare ocean.
          z-[34]: over the islands overlay (32), under nav (40). */}
      {islandsError &&
        !guided &&
        !sailCinematic &&
        createPortal(
          <div
            className="fixed left-0 right-0 bottom-0 z-[34] flex items-center justify-center overflow-y-auto no-scrollbar px-4"
            style={{
              top: OCEAN_VIEWPORT_TOP,
              // Deep-water scrim so the message reads over the island art.
              background: 'rgba(9, 58, 92, 0.62)',
            }}
          >
            <StormySeaError
              onRetry={retryIslands}
              isLoading={islandsRetrying}
              message="We couldn't reach the island map!"
            />
          </div>,
          document.body,
        )}

      {sailCinematic &&
        createPortal(
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              zIndex: 99980,
              background: '#fff',
              opacity: sailFade ? 1 : 0,
              transition: `opacity ${MAP_SAIL_FADE_MS}ms ease-in`,
            }}
            aria-hidden
          />,
          document.body,
        )}

      {cloudLanding &&
        createPortal(<CloudFlythrough onComplete={finishCloudLanding} />, document.body)}

      <OnboardingGuideCard
        active={guided && !perryArrive && showTapIsland && !cloudLanding && !introVideo && !sailCinematic}
      />

      {perryArrive &&
        !cloudLanding &&
        !introVideo &&
        !sailCinematic &&
        createPortal(
          <PerryMapGuide
            kidName={perryKidName}
            canSail={Boolean(islands[0])}
            onSetSail={goToFirstIsland}
          />,
          document.body,
        )}

      {introVideo &&
        createPortal(
          <div className="fixed inset-0 z-[99995] bg-white flex items-center justify-center">
            <video
              ref={videoRef}
              src={ONBOARDING_GENESIS_VIDEO}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
              preload="auto"
              controls={false}
              onEnded={finishIntroVideo}
              onError={finishIntroVideo}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: '#fff',
                opacity: videoFadeOut ? 1 : 0,
                transition: prefersReducedMotion()
                  ? 'none'
                  : `opacity ${MAP_SAIL_FADE_MS}ms ease-in`,
              }}
              aria-hidden
            />
          </div>,
          document.body,
        )}

      <style>{`
        /* Banner heights on :root so portaled islands overlay inherits the same inset.
           Footer height matches BottomNavigation wood tab bar (compact). */
        :root {
          --map-header-h: 0px;
          --wood-tab-lift: 12px;
          --map-footer-h: min(
            calc(100vw * ${MAP_FOOTER_ASPECT}),
            ${MAP_FOOTER_MAX_VH}vh,
            ${MAP_FOOTER_MAX_PX}px
          );
          --map-footer-scroll-pad: 28px;
        }
        @media (min-width: 768px) {
          :root {
            --map-header-h: 0px;
            --map-footer-h: min(
              calc(100vw * ${MAP_FOOTER_ASPECT}),
              ${MAP_FOOTER_MAX_VH_TABLET}vh,
              ${MAP_FOOTER_MAX_PX_TABLET}px
            );
            --map-footer-scroll-pad: 24px;
          }
        }
        /* Survive parent overlay pointer-events:none even if utility CSS is late/missing */
        [data-globe-node] {
          pointer-events: auto !important;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        [data-globe-inner] {
          will-change: transform, opacity;
        }
        /* Sky clouds — seamless L→R marquee (no alternate / reverse).
           Track is 200% wide with two identical strips; animating -50% → 0
           moves content right so twins enter from the left as copies exit right. */
        .map-sky-cloud-track {
          --cloud-loop-duration: 90s;
          display: flex;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: map-sky-cloud-scroll var(--cloud-loop-duration) linear infinite;
        }
        .map-sky-cloud-strip {
          position: relative;
          flex: 0 0 50%;
          width: 50%;
          height: 100%;
        }
        .map-sky-cloud {
          filter: drop-shadow(0 2px 6px rgba(40, 80, 120, 0.18));
        }
        @keyframes map-sky-cloud-scroll {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        /* Island shore ripples — wide × short ellipses over the img box.
           Center sits below geometric mid so rings track the circular water
           pad / shore (not the tree tops in the upper half of the art). */
        .map-island-shore {
          position: absolute;
          left: 50%;
          top: 58%;
          border-radius: 50%;
          border: 2.5px solid rgba(255,255,255,0.55);
          box-shadow: 0 0 10px 2px rgba(180,230,255,0.25);
          transform: translate(-50%, -50%);
          pointer-events: none;
          box-sizing: border-box;
        }
        .map-island-shore-1 {
          width: 96%;
          height: 42%;
          animation: map-island-shore-pulse 3.2s ease-out infinite;
        }
        .map-island-shore-2 {
          width: 108%;
          height: 48%;
          border-width: 2px;
          border-color: rgba(255,255,255,0.38);
          animation: map-island-shore-pulse 3.2s ease-out infinite;
          animation-delay: 1.05s;
        }
        .map-island-shore-3 {
          width: 120%;
          height: 54%;
          border-width: 1.5px;
          border-color: rgba(255,255,255,0.22);
          animation: map-island-shore-pulse 3.2s ease-out infinite;
          animation-delay: 2.1s;
        }
        @keyframes map-island-shore-pulse {
          0% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.75; }
          70% { opacity: 0.25; }
          100% { transform: translate(-50%, -50%) scale(1.18); opacity: 0; }
        }
        .map-trail {
          stroke-dashoffset: 0;
          animation: map-trail-flow 18s linear infinite;
        }
        @keyframes map-trail-flow {
          to { stroke-dashoffset: -100; }
        }
        .map-node-pulse {
          animation: map-node-pulse 2.4s ease-in-out infinite;
        }
        @keyframes map-node-pulse {
          0%, 100% { box-shadow: 0 6px 14px rgba(0,0,0,0.35), 0 0 0 0 rgba(42,157,244,0.5); }
          50% { box-shadow: 0 6px 14px rgba(0,0,0,0.35), 0 0 0 10px rgba(42,157,244,0); }
        }
        .map-ship-bob {
          animation: map-ship-bob 3s ease-in-out infinite;
        }
        @keyframes map-ship-bob {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-4px) rotate(4deg); }
        }
        .ob-tap-island {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 14px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.04em;
          color: #3E1F07;
          background: linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%);
          border: 2px solid #B8860B;
          box-shadow: 0 3px 0 #8B6914, 0 8px 16px rgba(0,0,0,0.35);
          animation: ob-tap-island-bounce 1.15s ease-in-out infinite;
          text-shadow: 0 1px 0 rgba(255,255,255,0.45);
        }
        @keyframes ob-tap-island-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        /* Island bubble pop-in on map launch (staggered via animation-delay). */
        .map-island-bubble-in {
          transform-origin: center center;
          animation: map-island-bubble-in 0.58s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes map-island-bubble-in {
          0% { transform: scale(0); opacity: 0; }
          55% { transform: scale(1.16); opacity: 1; }
          78% { transform: scale(0.94); }
          100% { transform: scale(1); opacity: 1; }
        }
        /* Compass on the "charting your islands" loading card. */
        .map-compass-spin {
          animation: map-compass-spin 2.4s linear infinite;
        }
        @keyframes map-compass-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sail-cinematic-active .map-island-shore-1,
        .sail-cinematic-active .map-island-shore-2,
        .sail-cinematic-active .map-island-shore-3,
        .sail-cinematic-active .map-trail,
        .sail-cinematic-active .map-node-pulse,
        .sail-cinematic-active .map-ship-bob {
          animation: none;
        }
        body[data-modal-open="true"] .bottom-nav-bar {
          display: none !important;
          pointer-events: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .map-sky-cloud-track {
            --cloud-loop-duration: 220s;
          }
          .map-island-shore-1,
          .map-island-shore-2,
          .map-island-shore-3,
          .map-trail,
          .map-node-pulse,
          .map-ship-bob,
          .map-island-bubble-in {
            animation: none;
          }
          .map-compass-spin {
            animation-duration: 6s;
          }
        }
      `}</style>
    </div>
  );
};

export default MapPage;
