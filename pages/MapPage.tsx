import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Lock, Star, Check, Ship, X, BookOpen } from 'lucide-react';

/** Full-width light wooden plank header (irregular edges; black keyed to alpha). */
const MAP_HEADER_FRAME = '/assets/images/map-header-frame.png';
/** Native size of map-header-frame.png (1024×268) — phone height = width × aspect. */
const MAP_HEADER_ASPECT = 268 / 1024;
/** Native size of map-footer-frame.png (846×295) — used for --map-footer-h scroll clearance. */
const MAP_FOOTER_ASPECT = 295 / 846;
/**
 * Resolved banner heights (CSS vars). Header: phone keeps width×aspect;
 * footer is capped on ALL viewports (phone uncapped 100vw×aspect was ~30%+ of screen).
 */
const MAP_HEADER_H = 'var(--map-header-h)';
const MAP_FOOTER_H = 'var(--map-footer-h)';
/** iPad / tablet max header height — ocean dominates. */
const MAP_HEADER_MAX_VH_TABLET = 14;
/**
 * Footer caps — match BottomNavigation compact wood tab bar.
 * Phone ~70–78px / tablet ~80–88px.
 */
const MAP_FOOTER_MAX_VH = 10;
const MAP_FOOTER_MAX_PX = 78;
const MAP_FOOTER_MAX_VH_TABLET = 8.5;
const MAP_FOOTER_MAX_PX_TABLET = 88;
/** Genesis island art (includes parchment banner — no CSS label needed). */
const MAP_ISLAND_GENESIS = '/assets/images/map-island-genesis.png';
/** Tall painted ocean strip (scrolls with voyage content). Native 2816×11392. */
const MAP_OCEAN_SCROLL = '/assets/images/map-ocean-scroll.png';
/** Native aspect of map-ocean-scroll.png — sizes the scroll trail to the strip. */
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
 * Horizon cloud bank — modest sky strip under the wood limb, resting on the
 * ocean horizon (matches the “good” crop). Assets have ~20% top alpha padding
 * so topPct near 0 still leaves a thin sky gap before the white puffs.
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
 * Ocean frame top — just under the wood header so the locked horizon sits snug
 * beneath the title (matches the intended “good” Map screenshot).
 */
const OCEAN_VIEWPORT_TOP = `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} - 8px)`;

/**
 * Globe-limb mask on the ocean WATER frame — soft feather along the curve so
 * the water blends into sky. Curve stays locked under the header.
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

type IslandStatus = 'complete' | 'current' | 'locked';

interface Island {
  id: string;
  book: string;
  title: string;
  status: IslandStatus;
  storiesComplete: number;
  storiesTotal: number;
  x: number;
  y: number;
}

const ISLANDS: Island[] = [
  { id: 'genesis', book: 'Genesis', title: 'Creation', status: 'complete', storiesComplete: 10, storiesTotal: 10, x: 50, y: 3.5 },
  { id: 'exodus', book: 'Exodus', title: 'God Rescues', status: 'current', storiesComplete: 1, storiesTotal: 10, x: 47, y: 30 },
  { id: 'psalms', book: 'Psalms', title: 'Songs of Faith', status: 'locked', storiesComplete: 0, storiesTotal: 10, x: 27, y: 49 },
  { id: 'gospels', book: 'Gospels', title: 'The Good News', status: 'locked', storiesComplete: 0, storiesTotal: 10, x: 65, y: 67 },
  { id: 'acts', book: 'Acts', title: 'The Church Begins', status: 'locked', storiesComplete: 0, storiesTotal: 10, x: 36, y: 86 },
];

const TRAIL_PATH =
  'M50,3.5 C 50,12 48,21 47,30 C 53,37 29,41 27,49 C 25,58 62,58 65,67 C 68,76 44,79 36,86';

const GENESIS_ISLAND_SIZE = 225;

const IslandDetailPopup: React.FC<{
  island: Island;
  onClose: () => void;
  onSail: (island: Island) => void;
}> = ({ island, onClose, onSail }) => {
  const isLocked = island.status === 'locked';
  const progressPct = Math.round((island.storiesComplete / Math.max(1, island.storiesTotal)) * 100);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-[max(1.5rem,var(--safe-area-bottom))] pt-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="island-popup-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border-2"
        style={{
          background: 'linear-gradient(180deg, #C4884A 0%, #A56B3A 55%, #8B5A2B 100%)',
          borderColor: '#5C3D1E',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/25 border border-white/20 text-white flex items-center justify-center active:scale-95"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-5 pt-6 pb-5">
          <p className="text-center text-[#FFE9B0] font-display font-black text-xs uppercase tracking-widest mb-1">
            {island.book}
          </p>
          <h2
            id="island-popup-title"
            className="text-center font-display font-black text-2xl text-white leading-tight"
            style={{ textShadow: '0 2px 0 #5C3D1E' }}
          >
            {island.title}
          </h2>

          {/* Progress */}
          <div
            className="mt-4 rounded-2xl px-3.5 py-3 border"
            style={{ background: 'rgba(61,41,20,0.45)', borderColor: 'rgba(92,61,30,0.8)' }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-1.5 text-[#FFE9B0] font-display font-bold text-sm">
                <BookOpen size={15} className="text-[#FFD700]" />
                Stories
              </span>
              <span className="text-white font-display font-black text-sm tabular-nums">
                {island.storiesComplete}/{island.storiesTotal} complete
              </span>
            </div>
            <div className="h-3 rounded-full bg-[#2a1a0c] border border-[#5C3D1E] overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #FFE55C, #FFD700 60%, #DAA520)',
                }}
              />
            </div>
          </div>

          {isLocked ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-2">
              <span className="w-12 h-12 rounded-full bg-black/30 border-2 border-white/20 flex items-center justify-center">
                <Lock size={22} className="text-white" />
              </span>
              <p className="text-white/85 font-display font-bold text-sm text-center">
                Keep sailing to unlock this island!
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSail(island)}
              className="mt-4 w-full py-3.5 rounded-2xl font-display font-black text-lg text-[#3E1F07] border-2 border-[#B8860B] active:translate-y-[2px] transition-transform"
              style={{
                background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                boxShadow: '0 4px 0 #8B6914, inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              Sail There
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const IslandNode: React.FC<{ island: Island; onSelect: (island: Island) => void }> = ({ island, onSelect }) => {
  const isLocked = island.status === 'locked';
  const isComplete = island.status === 'complete';
  const isCurrent = island.status === 'current';
  const hasArt = island.id === 'genesis';

  const discStyle: React.CSSProperties = isLocked
    ? { background: 'radial-gradient(circle at 35% 30%, #8fa3ad, #5b6f78)' }
    : isComplete
    ? { background: 'radial-gradient(circle at 35% 30%, #7bd66a, #3f9e3a)' }
    : { background: 'radial-gradient(circle at 35% 30%, #ffd98a, #e0a94a 45%, #c98a3a)' };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(island);
      }}
      data-globe-node
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center focus:outline-none active:scale-95 transition-transform touch-manipulation"
      style={{
        left: `${island.x}%`,
        top: `${island.y}%`,
        width: hasArt ? GENESIS_ISLAND_SIZE + 12 : 112,
        // Inline — must beat parent overlay pointer-events:none (Tailwind class alone is easy to miss).
        pointerEvents: 'auto',
      }}
      aria-label={`${island.book}: ${island.title}${isLocked ? ' (locked)' : ''}`}
    >
      {/* Inner wrapper carries the per-node "globe" 3D transform so the outer
          button keeps its stable x/y positioning + measurable rect. */}
      <div
        data-globe-inner
        className="flex flex-col items-center w-full"
        style={{ transformOrigin: 'center center', backfaceVisibility: 'hidden' }}
      >
      {/* Status flag / ribbon — keep Complete lightly; skip Current pill on art islands */}
      {isComplete && (
        <span className="mb-1 px-2 py-0.5 rounded-full bg-[#2E7D32] text-white text-[10px] font-black uppercase tracking-wide shadow border border-[#1B5E20]">
          Complete
        </span>
      )}
      {isCurrent && !hasArt && (
        <span className="mb-1 px-2 py-0.5 rounded-full bg-[#2a9df4] text-white text-[10px] font-black uppercase tracking-wide shadow border border-[#1668b3]">
          Current
        </span>
      )}

      {/* Island art or placeholder disc.
          Art islands: dedicated relative wrapper around ONLY the img + shore
          rings (Complete badge stays outside) so rings center on the image. */}
      {hasArt ? (
        <div
          className="relative"
          style={{ width: GENESIS_ISLAND_SIZE }}
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
            src={MAP_ISLAND_GENESIS}
            alt=""
            draggable={false}
            className="relative z-[1] block h-auto w-full pointer-events-none select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
          />
          {isCurrent && (
            <span className="absolute map-ship-bob -right-2 bottom-4 z-[2]">
              <Ship size={30} className="text-[#7a4a20] drop-shadow" fill="#C4884A" strokeWidth={1.5} />
            </span>
          )}
        </div>
      ) : (
        <div className="relative" style={{ opacity: 0.8 }}>
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

      {/* Label pill — skip when art already includes the parchment banner */}
      {!hasArt && (
        <span
          className="mt-2 max-w-[124px] text-center leading-tight px-2.5 py-1 rounded-lg bg-[#f3e3c4] text-[#5c3d1e] text-[11px] font-display font-black border border-[#c9a76b] shadow"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}
        >
          {island.book}: <span className="italic">&ldquo;{island.title}&rdquo;</span>
        </span>
      )}
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
  const [selectedIsland, setSelectedIsland] = useState<Island | null>(null);

  const syncIslandsScroll = useCallback(() => {
    const scroller = scrollRef.current;
    const sync = islandsSyncRef.current;
    if (!scroller || !sync) return;
    sync.style.transform = `translate3d(0, ${-scroller.scrollTop}px, 0)`;
  }, []);

  const handleSelect = useCallback((island: Island) => {
    setSelectedIsland(island);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedIsland(null);
  }, []);

  /** Skip sail-transition video — go straight to the steer-ship scene. */
  const handleSailThere = useCallback(
    (island: Island) => {
      setSelectedIsland(null);
      navigate(`/sail/${island.id}`, {
        state: { title: `${island.book}: ${island.title}` },
      });
    },
    [navigate],
  );

  // Hide map bottom nav while island popup is open
  useEffect(() => {
    if (selectedIsland) {
      document.body.setAttribute('data-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-modal-open');
    }
    return () => document.body.removeAttribute('data-modal-open');
  }, [selectedIsland]);

  // Map each node's distance from the viewport's vertical center onto a curved
  // (spherical) transform: nodes at center sit flat & upright; nodes toward the
  // top/bottom edges tilt away, recede in depth, shrink and fade — like the
  // horizon of a globe rolling past as you scroll.
  const applyGlobe = useCallback(() => {
    rafRef.current = null;
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
    const work: { inner: HTMLElement; norm: number }[] = [];
    nodes.forEach((outer) => {
      const inner = outer.querySelector('[data-globe-inner]') as HTMLElement | null;
      if (!inner) return;
      const r = outer.getBoundingClientRect();
      const centerY = r.top + r.height / 2;
      const norm = Math.max(-1, Math.min(1, (centerY - viewportCenterY) / half));
      work.push({ inner, norm });
    });

    // Then batch writes.
    work.forEach(({ inner, norm }) => {
      const mag = Math.abs(norm);
      // norm < 0 => above center: recede the TOP edge (rotateX +) toward horizon.
      // norm > 0 => below center: recede the BOTTOM edge (rotateX -).
      const rotateX = -norm * GLOBE_MAX_TILT;
      // Keep translateZ at 0 — any negative Z breaks hit-testing on the
      // island button in WebKit/Blink even when the outer button is on top.
      const translateZ = 0;
      // Slightly stronger scale falloff when rolling over the top limb.
      const scaleFalloff = norm < 0 ? GLOBE_MAX_SCALE_FALLOFF * 1.15 : GLOBE_MAX_SCALE_FALLOFF;
      const scale = 1 - mag * scaleFalloff;
      // Soft wrap: keep full opacity through the main ocean; only fade in the
      // outer limb band so Genesis (near top but still on water) stays solid.
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
    if (reducedMotionRef.current) return;
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

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Default app Header omitted on Map — wood frame is the page chrome. */}

      {/* ── TOP wood plank (portaled) — above clouds so the limb stays in front.
          z-[50] > clouds (45) / islands (32) / nav (40); < popup (60). */}
      {createPortal(
        <div
          className="fixed top-0 left-0 right-0 z-[50] pointer-events-none"
          aria-hidden
        >
          <div
            style={{
              height: 'var(--safe-area-top, 0px)',
              background: 'linear-gradient(180deg, #c9945e 0%, #b87d4a 100%)',
            }}
          />
          <img
            src={MAP_HEADER_FRAME}
            alt=""
            className="block w-full select-none"
            draggable={false}
            style={{
              width: '100%',
              height: MAP_HEADER_H,
              objectFit: 'cover',
              objectPosition: 'center 42%',
            }}
          />
        </div>,
        document.body,
      )}

      {/* Title over the wood plank — above header art */}
      {createPortal(
        <div
          className="fixed left-0 right-0 z-[51] pointer-events-none px-4 text-center"
          style={{
            top: `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} * 0.28)`,
          }}
        >
          <h1
            className="font-display font-black text-[clamp(1.35rem,5.2vw,2.15rem)] leading-none"
            style={{
              color: '#ffe9b0',
              textShadow: '0 2px 0 #5c2e12, 0 3px 8px rgba(0,0,0,0.45)',
            }}
          >
            God&apos;s Word Adventure
          </h1>
          <p
            className="mt-0.5 font-display font-bold text-[clamp(0.7rem,2.8vw,0.9rem)] tracking-wide"
            style={{
              color: 'rgba(255,245,220,0.92)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            Sail. Learn. Grow.
          </p>
        </div>,
        document.body,
      )}

      {/* Bottom wood rope footer is owned by BottomNavigation (shared 4-tab bar). */}

      {/* ── Fixed sky (outside the scroller) — gradient through the locked horizon cutout. */}
      <div
        className="fixed top-0 left-0 right-0 z-[5] pointer-events-none overflow-hidden"
        style={{
          height: `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} + 72px)`,
          background:
            'linear-gradient(180deg, #1a6fd4 0%, #3aa0ef 40%, #7ec8f8 70%, #a8daf8 100%)',
        }}
        aria-hidden
      />

      {/* ── Fixed sky clouds (portaled) — viewport-pinned at the ocean horizon.
          NOT inside scrollRef / islandsSyncRef: islands/ocean scroll underneath;
          this layer stays put (position:fixed on body).
          z-[45] > islands (32), < wood header (50) / title (51) / popup (60).
          pointer-events none so island taps still work.
          Seamless L→R marquee: duplicated strips, translateX(-50%→0) linear infinite. */}
      {createPortal(
        <div
          data-map-sky-clouds=""
          className="fixed left-0 right-0 z-[45] pointer-events-none overflow-hidden"
          style={{
            /* Raised toward wood limb / horizon; still visible under plank (z < wood). */
            top: `calc(var(--safe-area-top, 0px) + ${MAP_HEADER_H} * 0.78)`,
            height: `calc(${OCEAN_VIEWPORT_TOP} - (var(--safe-area-top, 0px) + ${MAP_HEADER_H} * 0.78) + 88px)`,
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
        }}
        aria-hidden
      />

      {/* ── Ocean frame (fixed curve) + inner scroller ──
          Outer box owns the soft globe-limb mask (water PNG only) and does NOT scroll,
          so the horizon stays locked under the wood header. Islands are a sibling
          overlay with a soft feathered limb + globe fade. z-10: behind haze/clouds/islands.
          overscroll-behavior:none blocks rubber-band pull-up. */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10 overflow-hidden"
        style={{
          top: OCEAN_VIEWPORT_TOP,
          background: '#1a8fd1',
          ...OCEAN_FRAME_MASK_STYLE,
        }}
      >
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto no-scrollbar"
          style={{
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            className="relative w-full"
            style={{ minHeight: `calc(100vw * ${OCEAN_SCROLL_ASPECT})` }}
          >
            <img
              src={MAP_OCEAN_SCROLL}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none select-none block w-full h-auto"
              style={{ imageRendering: 'auto' }}
            />
          </div>

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
          wood (50) / popup (60). Empty overlay stays pointer-events:none so
          water scrolls and footer nav stays usable in gaps.
          No CSS mask — mask + pointer-events:none breaks hit testing for auto
          children in WebKit/Blink; limb fade is handled by applyGlobe opacity. */}
      {createPortal(
        <div
          ref={islandsLayerRef}
          className="fixed left-0 right-0 bottom-0 z-[32] overflow-hidden pointer-events-none"
          style={{
            top: OCEAN_VIEWPORT_TOP,
          }}
        >
          <div
            ref={islandsSyncRef}
            className="relative w-full will-change-transform"
            style={{ minHeight: `calc(100vw * ${OCEAN_SCROLL_ASPECT})` }}
          >
            <div className="absolute inset-0">
              {/* Small inset so the top island isn't flush against the locked curve */}
              <div style={{ height: 28 }} aria-hidden />
              <div className="relative w-full" style={{ height: 'calc(100% - 28px)' }}>
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={TRAIL_PATH}
                    fill="none"
                    stroke="rgba(255,255,255,0.72)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray="0.2 3.2"
                    vectorEffect="non-scaling-stroke"
                    className="map-trail"
                  />
                </svg>

                {ISLANDS.map((island) => (
                  <IslandNode key={island.id} island={island} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <style>{`
        /* Banner heights on :root so portaled islands overlay inherits the same inset.
           Footer height matches BottomNavigation wood tab bar (compact). */
        :root {
          --map-header-h: calc(100vw * ${MAP_HEADER_ASPECT});
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
            --map-header-h: min(calc(100vw * ${MAP_HEADER_ASPECT}), ${MAP_HEADER_MAX_VH_TABLET}vh);
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
        /* Genesis shore ripples — wide × short ellipses over the img box.
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
        @media (prefers-reduced-motion: reduce) {
          .map-sky-cloud-track {
            --cloud-loop-duration: 220s;
          }
          .map-island-shore-1,
          .map-island-shore-2,
          .map-island-shore-3,
          .map-trail,
          .map-node-pulse,
          .map-ship-bob {
            animation: none;
          }
        }
      `}</style>

      {selectedIsland &&
        createPortal(
          <IslandDetailPopup
            island={selectedIsland}
            onClose={handleClosePopup}
            onSail={handleSailThere}
          />,
          document.body,
        )}
    </div>
  );
};

export default MapPage;
