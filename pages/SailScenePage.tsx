import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Star } from 'lucide-react';

/** Looping ocean background video (portrait; shown full-bleed cover). */
const SAIL_SCENE_BG = '/assets/videos/sail-ocean-bg.mp4';
/** First-person boat bow interior (1024×829) — black keyed to alpha. */
const SAIL_SHIP_DECK = '/assets/images/sail-ship-deck.png';
const SAIL_STEERING_WHEEL = '/assets/images/sail-steering-wheel.png';
/** Light wood plank for the sail-scene top banner. */
const SAIL_WOOD_HEADER = '/assets/images/sail-wood-header.png';
/** Shared wood texture for circular header controls. */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';
/** Sail-scene bottom overlay — crew roster (three characters on wood plaque). */
const SAIL_BTN_CREW = '/assets/images/sail-btn-crew.png';
/** Sail-scene bottom overlay — explore / world (open book on wood plaque). */
const SAIL_BTN_EXPLORE = '/assets/images/sail-btn-explore.png';
/**
 * Fraction of wood-header height pulled above the viewport so the wavy plank
 * top is straight-cropped at screen y=0 (intentional edge flush).
 * Lower = taller visible plank (was 0.2).
 */
const WOOD_HEADER_CROP = 0.08;
/** Extra scale so the plank reads taller while top stays flush-cropped. */
const WOOD_HEADER_SCALE = 1.14;
/**
 * Vertical center of the remaining visible plank band (for Back / title).
 * Accounts for top-origin scale + crop translate.
 */
const WOOD_HEADER_BTN_TOP = `${((WOOD_HEADER_SCALE - WOOD_HEADER_CROP) / 2) * 100}%`;

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

/** Sky cloud A — wide bank (970×453; alpha already keyed). */
const SAIL_BG_CLOUD_A = '/assets/images/sail-bg-cloud-a.png';
/** Sky cloud B — compact cluster (769×306; alpha already keyed). */
const SAIL_BG_CLOUD_B = '/assets/images/sail-bg-cloud-b.png';
/** Distant left island (black keyed to alpha). */
const SAIL_BG_ISLAND_A = '/assets/images/sail-bg-island-a.png';
/** Distant right island (black keyed to alpha). */
const SAIL_BG_ISLAND_B = '/assets/images/sail-bg-island-b.png';

/**
 * Layered sky clouds for the seamless marquee strip (same pattern as Map).
 * Track is duplicated side-by-side; animates translateX(-50% → 0) linear infinite.
 */
type SailSkyCloudSpec = {
  id: string;
  src: string;
  widthPct: number;
  leftPct?: number;
  rightPct?: number;
  topPct?: number;
  opacity: number;
};

const SAIL_SKY_CLOUDS: SailSkyCloudSpec[] = [
  {
    id: 'a-left',
    src: SAIL_BG_CLOUD_A,
    widthPct: 48,
    leftPct: -14,
    topPct: 4,
    opacity: 0.92,
  },
  {
    id: 'b-right',
    src: SAIL_BG_CLOUD_B,
    widthPct: 38,
    rightPct: -10,
    topPct: 10,
    opacity: 0.88,
  },
  {
    id: 'a-mid',
    src: SAIL_BG_CLOUD_A,
    widthPct: 32,
    leftPct: 34,
    topPct: 0,
    opacity: 0.78,
  },
  {
    id: 'b-high',
    src: SAIL_BG_CLOUD_B,
    widthPct: 24,
    leftPct: 58,
    topPct: 6,
    opacity: 0.7,
  },
];

/** Full loop duration for the duplicated cloud track (linear infinite). */
const SAIL_SKY_CLOUD_LOOP_SEC = 95;

/**
 * Distant horizon islands — behind the carousel focal island.
 * Viewport-fixed (not ocean-frame %) so they stay visible on the water
 * left/right of the focal island despite the wide letterboxed ocean frame.
 * Kept small / high so they read as scenery, not competing focal points.
 */
const SAIL_BG_ISLANDS = [
  {
    id: 'bg-left',
    src: SAIL_BG_ISLAND_A,
    /** Far background: much smaller than carousel (~28% / max 235). */
    width: 'min(14vw, 96px)',
    left: '10%',
    top: '28%',
    opacity: 0.94,
  },
  {
    id: 'bg-right',
    src: SAIL_BG_ISLAND_B,
    width: 'min(11vw, 76px)',
    left: '90%',
    top: '30%',
    opacity: 0.9,
  },
] as const;

/**
 * Wheel-driven island carousel overlays (ocean keyed out; island + sign remain).
 * Order = look stops left → right (clockwise wheel advances index).
 */
const CAROUSEL_ISLANDS = [
  {
    id: 'genesis',
    title: 'Genesis',
    src: '/assets/images/sail-carousel-genesis.png',
  },
  {
    id: 'exodus',
    title: 'Exodus',
    src: '/assets/images/sail-carousel-exodus.png',
  },
  {
    id: 'daniel',
    title: 'Daniel',
    src: '/assets/images/sail-carousel-daniel.png',
  },
  {
    id: 'joshua',
    title: 'Joshua',
    src: '/assets/images/sail-carousel-joshua.png',
  },
  {
    id: '1-samuel',
    title: '1 Samuel',
    src: '/assets/images/sail-carousel-1-samuel.png',
  },
] as const;

/**
 * Per-island adventure completion (mock for now — wire to real progress later).
 * Total matches IslandScene activities (read / quiz / puzzle / coloring / game).
 * Swap this map (or `getIslandProgress`) for live progress when available.
 */
const ISLAND_ADVENTURE_PROGRESS: Record<
  (typeof CAROUSEL_ISLANDS)[number]['id'],
  { completed: number; total: number }
> = {
  genesis: { completed: 4, total: 5 },
  exodus: { completed: 1, total: 5 },
  daniel: { completed: 0, total: 5 },
  joshua: { completed: 2, total: 5 },
  '1-samuel': { completed: 0, total: 5 },
};

/** First carousel level — always unlocked; completing it unlocks the rest. */
const FIRST_ISLAND_ID: (typeof CAROUSEL_ISLANDS)[number]['id'] = 'genesis';

const getIslandProgress = (islandId: string) =>
  ISLAND_ADVENTURE_PROGRESS[islandId as keyof typeof ISLAND_ADVENTURE_PROGRESS] ?? {
    completed: 0,
    total: 5,
  };

/** Island is complete when all adventures are done (completed === total). */
const isIslandComplete = (islandId: string): boolean => {
  const { completed, total } = getIslandProgress(islandId);
  return total > 0 && completed >= total;
};

/**
 * Unlock rule (easy to swap later):
 * - Genesis (FIRST_ISLAND_ID) is always available.
 * - Every other carousel island unlocks only after Genesis is fully complete.
 */
const isIslandUnlocked = (islandId: string): boolean => {
  if (islandId === FIRST_ISLAND_ID) return true;
  return isIslandComplete(FIRST_ISLAND_ID);
};

/** Stars + N/M Adventures — wood header. */
const AdventureProgress: React.FC<{
  completed: number;
  total: number;
  starSize?: number;
  compact?: boolean;
}> = ({ completed, total, starSize = 16, compact = false }) => {
  const filled = Math.max(0, Math.min(total, completed));
  return (
    <div
      className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}
      aria-label={`${filled} of ${total} adventures complete`}
    >
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const on = i < filled;
          return (
            <Star
              key={i}
              size={starSize}
              strokeWidth={on ? 0 : 1.75}
              className={
                on
                  ? 'text-[#FFD700] drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]'
                  : 'text-[#8B6914]/55'
              }
              fill={on ? '#FFD700' : 'rgba(139,105,20,0.18)'}
            />
          );
        })}
      </div>
      <div className="flex flex-col leading-none text-[#5C3D1E]">
        <span
          className={`font-display font-black tabular-nums ${
            compact ? 'text-[0.65rem]' : 'text-[0.95rem]'
          }`}
        >
          {filled}/{total}
        </span>
        <span
          className={`font-display font-bold text-[#6B4423]/90 ${
            compact ? 'text-[0.5rem]' : 'text-[0.7rem]'
          }`}
        >
          Adventures
        </span>
      </div>
    </div>
  );
};

const LOOK_COUNT = CAROUSEL_ISLANDS.length;
/** Wheel rest angle center (Daniel) when starting mid-voyage; start index may differ. */
const CENTER_INDEX = Math.floor((LOOK_COUNT - 1) / 2);

/** Deck art aspect (h/w) for matching wheel bottom to pedestal. */
const DECK_ASPECT_H_OVER_W = 829 / 1024;
/**
 * Scale above full-bleed width so the bow feels closer to camera.
 * (maxHeight alone often doesn't bite — natural height is already under 56vh.)
 */
const DECK_SCALE = 1.28;
/** Cap deck height so ocean / island stay visible above the bow. */
const DECK_MAX_HEIGHT = '72vh';
/**
 * Sink the deck below the viewport so more of the bow is cropped.
 * Fraction of scaled deck height (negative bottom offset).
 */
const DECK_SINK = 0.28;
/**
 * Pedestal top sits ~72% up from the bottom of the deck image.
 * Wheel hub is centered on that line.
 */
const PEDESTAL_FROM_BOTTOM = 0.72;
/** Resolved deck height used for bottom / pedestal calc. */
const DECK_HEIGHT_EXPR = `min(${DECK_MAX_HEIGHT}, ${DECK_SCALE * 100}vw * ${DECK_ASPECT_H_OVER_W})`;

/**
 * Island carousel framing uses the legacy landscape horizon aspect so island
 * overlays stay aligned while the ocean video fills the viewport with cover.
 */
const BG_ASPECT = 1024 / 703;
/** Fraction of height-fit scale — lower = more zoomed out (letterboxed). */
const BG_COVER_ZOOM = 0.65;

/** Soft sky fallback behind the ocean video (visible while loading / letterbox). */
const SKY_GRADIENT =
  'linear-gradient(180deg, #7ec8f8 0%, #a6dffc 32%, #d4f2ff 55%, #eef9ff 72%, #c8eef6 100%)';

/** Degrees between carousel stops — matches bottom-nav ITEM_ANGLE. */
const STEP_ANGLE = 36;
/** Degrees of movement below which we treat as a tap (same as bottom nav). */
const TAP_THRESHOLD = 22;
/** Settle easing after release — matches bottom-nav wheel. */
const SNAP_EASING = 'transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)';
const ISLAND_FADE_MS = 420;
/** Boat sails toward the tapped island — kid-friendly ease-in-out. */
const SAIL_DURATION_MS = 2100;
const SAIL_EASING = 'cubic-bezier(0.45, 0.05, 0.25, 1)';
/** Short hop when prefers-reduced-motion is on, then navigate. */
const SAIL_REDUCED_MS = 120;

const clampIndex = (i: number) => Math.max(0, Math.min(LOOK_COUNT - 1, i));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const normalizeIslandId = (value: string) =>
  value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');

const resolveStartIndex = (islandId?: string): number => {
  if (!islandId) return 0;
  const id = normalizeIslandId(islandId);
  const exact = CAROUSEL_ISLANDS.findIndex((island) => island.id === id);
  if (exact >= 0) return exact;
  if (id === '1samuel' || id === 'samuel') {
    return CAROUSEL_ISLANDS.findIndex((island) => island.id === '1-samuel');
  }
  return 0; // Genesis default
};

/**
 * First-person sail scene — opened when tapping an island on the Map.
 * Turn the wheel like the app nav: release and it snaps to the next island.
 */
const SailScenePage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId } = useParams<{ islandId?: string }>();
  const startIndex = resolveStartIndex(islandId);

  const wheelRef = useRef<HTMLDivElement>(null);
  const oceanVideoRef = useRef<HTMLVideoElement>(null);
  const draggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const totalMoveRef = useRef(0);
  const lastTouchEndRef = useRef(0);
  const dragRotationRef = useRef<number | null>(null);
  const lookIndexRef = useRef(startIndex);
  const isSailingRef = useRef(false);
  const sailTimerRef = useRef<number | null>(null);

  const [lookIndex, setLookIndex] = useState(startIndex);
  const [dragRotation, setDragRotation] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /** True while the boat is sailing toward the tapped island. */
  const [isSailing, setIsSailing] = useState(false);
  /** Brief shake when tapping a locked island (no sail / navigate). */
  const [lockShakeId, setLockShakeId] = useState<string | null>(null);
  const lockShakeTimerRef = useRef<number | null>(null);

  lookIndexRef.current = lookIndex;
  dragRotationRef.current = dragRotation;
  isSailingRef.current = isSailing;

  // Sync start when route island changes (e.g. map → sail).
  useEffect(() => {
    const next = resolveStartIndex(islandId);
    setLookIndex(next);
    lookIndexRef.current = next;
  }, [islandId]);

  useEffect(
    () => () => {
      if (sailTimerRef.current != null) {
        window.clearTimeout(sailTimerRef.current);
        sailTimerRef.current = null;
      }
      if (lockShakeTimerRef.current != null) {
        window.clearTimeout(lockShakeTimerRef.current);
        lockShakeTimerRef.current = null;
      }
    },
    [],
  );

  const activeIsland = CAROUSEL_ISLANDS[lookIndex] ?? CAROUSEL_ISLANDS[0];

  const restingRotation = (lookIndex - CENTER_INDEX) * STEP_ANGLE;
  const visualRotation =
    isDragging && dragRotation !== null ? dragRotation : restingRotation;

  const sailDurationMs = prefersReducedMotion() ? SAIL_REDUCED_MS : SAIL_DURATION_MS;
  const sailTransition = isSailing
    ? `transform ${sailDurationMs}ms ${SAIL_EASING}, opacity ${sailDurationMs}ms ${SAIL_EASING}`
    : undefined;

  const goToIslandLesson = useCallback(
    (id: string) => {
      navigate(`/sail/${id}/lesson`, {
        state: { fromSail: true, title: CAROUSEL_ISLANDS.find((i) => i.id === id)?.title },
      });
    },
    [navigate],
  );

  const pulseLockedFeedback = useCallback((islandId: string) => {
    if (prefersReducedMotion()) return;
    setLockShakeId(islandId);
    if (lockShakeTimerRef.current != null) {
      window.clearTimeout(lockShakeTimerRef.current);
    }
    lockShakeTimerRef.current = window.setTimeout(() => {
      lockShakeTimerRef.current = null;
      setLockShakeId(null);
    }, 420);
  }, []);

  const startSailToIsland = useCallback(
    (island: (typeof CAROUSEL_ISLANDS)[number]) => {
      if (isSailingRef.current) return;

      // Locked islands: shake only — no sail-forward / lesson navigation.
      if (!isIslandUnlocked(island.id)) {
        pulseLockedFeedback(island.id);
        return;
      }

      // Cancel any in-progress wheel drag so carousel state stays clean.
      draggingRef.current = false;
      setIsDragging(false);
      setDragRotation(null);

      if (prefersReducedMotion()) {
        goToIslandLesson(island.id);
        return;
      }

      isSailingRef.current = true;
      setIsSailing(true);

      if (sailTimerRef.current != null) {
        window.clearTimeout(sailTimerRef.current);
      }
      sailTimerRef.current = window.setTimeout(() => {
        sailTimerRef.current = null;
        goToIslandLesson(island.id);
      }, SAIL_DURATION_MS);
    },
    [goToIslandLesson, pulseLockedFeedback],
  );

  // Ocean visual width as % of viewport (height-fit × cover zoom).
  const [oceanWidthVw, setOceanWidthVw] = useState(() => {
    if (typeof window === 'undefined') return 100;
    const { innerWidth: w, innerHeight: h } = window;
    if (w <= 0) return 100;
    return ((BG_ASPECT * h) / w) * BG_COVER_ZOOM * 100;
  });

  useEffect(() => {
    const update = () => {
      const { innerWidth: w, innerHeight: h } = window;
      if (w <= 0) return;
      setOceanWidthVw(((BG_ASPECT * h) / w) * BG_COVER_ZOOM * 100);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Autoplay policies require muted + playsInline; nudge play() after mount/load.
  useEffect(() => {
    const video = oceanVideoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => {
      if (video.paused) {
        void video.play().catch(() => {
          /* Autoplay may still be blocked; muted + playsInline is the main fix. */
        });
      }
    };
    tryPlay();
    video.addEventListener('loadeddata', tryPlay);
    return () => video.removeEventListener('loadeddata', tryPlay);
  }, []);

  const getAngle = useCallback((clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  }, []);

  const onStart = useCallback(
    (clientX: number, clientY: number) => {
      if (isSailingRef.current) return;
      draggingRef.current = true;
      startAngleRef.current = getAngle(clientX, clientY);
      // Rest angle for current island (center index at 0°, like nav index * STEP)
      startRotationRef.current =
        (lookIndexRef.current - CENTER_INDEX) * STEP_ANGLE;
      totalMoveRef.current = 0;
      setDragRotation(startRotationRef.current);
      setIsDragging(true);
    },
    [getAngle],
  );

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;

      const currentAngle = getAngle(clientX, clientY);
      // Standard physics (bottom nav): CW drag increases rotation
      let delta = currentAngle - startAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      totalMoveRef.current += Math.abs(delta);
      // Continuous follow — no clamp while dragging (snap clamps on release)
      setDragRotation(startRotationRef.current + delta);
    },
    [getAngle],
  );

  const snapToIndex = useCallback((index: number) => {
    draggingRef.current = false;
    setLookIndex(clampIndex(index));
    setDragRotation(null);
    setIsDragging(false);
  }, []);

  const onEnd = useCallback(() => {
    if (!draggingRef.current || isSailingRef.current) return;

    const currentDrag = dragRotationRef.current;
    if (currentDrag === null) {
      draggingRef.current = false;
      setIsDragging(false);
      setDragRotation(null);
      return;
    }

    if (totalMoveRef.current < TAP_THRESHOLD) {
      // Tap / tiny move: settle back to the current island stop
      snapToIndex(lookIndexRef.current);
      return;
    }

    // Swipe: snap to nearest carousel stop (same Math.round pattern as bottom nav)
    const rawIndex = Math.round(currentDrag / STEP_ANGLE) + CENTER_INDEX;
    snapToIndex(rawIndex);
  }, [snapToIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    onMove(e.touches[0].clientX, e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    lastTouchEndRef.current = Date.now();
    onEnd();
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchEndRef.current < 400) return;
    e.preventDefault();
    onStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => onEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMove, onEnd]);

  // Non-passive touchmove so preventDefault stops scroll from stealing the gesture
  // (same pattern as bottom-nav hit area).
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const preventDefault = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', preventDefault, { passive: false });
    return () => el.removeEventListener('touchmove', preventDefault);
  }, []);

  const lookLabel = `Island: ${activeIsland.title}`;
  const activeProgress = getIslandProgress(activeIsland.id);

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: SKY_GRADIENT }}
    >
      {/* Fixed ocean video — full-bleed cover; islands keep legacy framing */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: SKY_GRADIENT }}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: isSailing ? 'scale(1.12)' : 'scale(1)',
            transition: sailTransition,
            transformOrigin: '50% 42%',
          }}
        >
          <video
            ref={oceanVideoRef}
            src={SAIL_SCENE_BG}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            aria-hidden
          />
        </div>

        {/* Viewport-fixed sky clouds — above video sky, behind carousel islands.
            Not inside sail zoom so they don’t drift with the approach. */}
        <div
          className="absolute left-0 right-0 top-0 z-[1] pointer-events-none overflow-hidden"
          style={{ height: '34%' }}
          aria-hidden
        >
          <div
            className="sail-sky-cloud-track"
            style={
              {
                '--sail-cloud-loop-duration': `${SAIL_SKY_CLOUD_LOOP_SEC}s`,
              } as React.CSSProperties
            }
          >
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="sail-sky-cloud-strip"
                aria-hidden={copy === 1 ? true : undefined}
              >
                {SAIL_SKY_CLOUDS.map((cloud) => (
                  <img
                    key={`${copy}-${cloud.id}`}
                    src={cloud.src}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="sail-sky-cloud pointer-events-none select-none absolute max-w-none h-auto"
                    style={{
                      width: `${cloud.widthPct}%`,
                      left: cloud.leftPct != null ? `${cloud.leftPct}%` : undefined,
                      right:
                        cloud.rightPct != null ? `${cloud.rightPct}%` : undefined,
                      top: cloud.topPct != null ? `${cloud.topPct}%` : undefined,
                      opacity: cloud.opacity,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Distant bg islands — horizon L/R, behind carousel (z < frame). */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
          aria-hidden
        >
          {SAIL_BG_ISLANDS.map((island) => (
            <img
              key={island.id}
              src={island.src}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute pointer-events-none select-none max-w-none h-auto"
              style={{
                left: island.left,
                top: island.top,
                width: island.width,
                opacity: island.opacity,
                transform: 'translate(-50%, -40%)',
              }}
            />
          ))}
        </div>

        <div
          className="absolute left-1/2 top-1/2 z-[2] max-w-none select-none"
          style={{
            width: `${oceanWidthVw}vw`,
            aspectRatio: `${BG_ASPECT}`,
            // Ocean frame zooms with the sail so islands stay locked to the water
            transform: isSailing
              ? 'translate(-50%, -50%) scale(1.18)'
              : 'translate(-50%, -50%) scale(1)',
            transition: sailTransition,
            transformOrigin: '50% 40%',
            pointerEvents: isSailing ? 'none' : 'auto',
          }}
        >
          {/* Island carousel — one overlay at a time, high on the water */}
          {CAROUSEL_ISLANDS.map((island, i) => {
            const offset = i - lookIndex;
            const active = i === lookIndex;
            const unlocked = isIslandUnlocked(island.id);
            const baseTransform = `translate(calc(-50% + ${offset * 14}%), -42%)`;
            const sailTransform = `${baseTransform} scale(1.55) translateY(-6%)`;
            const progress = getIslandProgress(island.id);
            const shaking = lockShakeId === island.id;
            return (
              <button
                key={island.id}
                type="button"
                disabled={!active || isSailing}
                onClick={() => {
                  if (!active || isSailing) return;
                  startSailToIsland(island);
                }}
                aria-label={
                  active
                    ? unlocked
                      ? `Visit ${island.title}, ${progress.completed} of ${progress.total} adventures complete`
                      : `${island.title} locked — complete Genesis to unlock`
                    : undefined
                }
                aria-disabled={active && !unlocked ? true : undefined}
                tabIndex={active && !isSailing ? 0 : -1}
                className={`absolute p-0 m-0 border-0 bg-transparent appearance-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg${
                  shaking ? ' sail-island-lock-shake' : ''
                }`}
                style={{
                  left: '50%',
                  top: '18%',
                  width: '28%',
                  maxWidth: 235,
                  opacity: active ? 1 : 0,
                  transform: isSailing && active ? sailTransform : baseTransform,
                  transition: isSailing
                    ? sailTransition
                    : `opacity ${ISLAND_FADE_MS}ms ease, transform ${ISLAND_FADE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`,
                  zIndex: active ? 2 : 1,
                  pointerEvents: active && !isSailing ? 'auto' : 'none',
                  cursor:
                    active && !isSailing
                      ? unlocked
                        ? 'pointer'
                        : 'not-allowed'
                      : 'default',
                }}
              >
                <span className="relative block w-full">
                  <img
                    src={island.src}
                    alt=""
                    draggable={false}
                    className="block w-full h-auto pointer-events-none select-none"
                    style={
                      unlocked
                        ? undefined
                        : {
                            filter: 'grayscale(100%) brightness(0.88)',
                          }
                    }
                  />
                    {/* Gold padlock — same badge pattern as IslandScene activity locks.
                      Sized as % of island so it scales with carousel framing. */}
                  {!unlocked && (
                    <span
                      className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                      style={{ width: '30%' }}
                      aria-hidden
                    >
                      <span
                        className="flex items-center justify-center w-full aspect-square rounded-full"
                        style={{
                          background:
                            'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                          boxShadow:
                            '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.4)',
                          border: '1.5px solid #E8C060',
                        }}
                      >
                        <Lock
                          className="w-[48%] h-[48%] text-white"
                          strokeWidth={2.8}
                        />
                      </span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        /* Sky clouds — seamless L→R marquee (no alternate / reverse).
           Track is 200% wide with two identical strips; animating -50% → 0
           moves content right so twins enter from the left as copies exit right. */
        .sail-sky-cloud-track {
          --sail-cloud-loop-duration: 95s;
          display: flex;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: sail-sky-cloud-scroll var(--sail-cloud-loop-duration) linear infinite;
        }
        .sail-sky-cloud-strip {
          position: relative;
          flex: 0 0 50%;
          width: 50%;
          height: 100%;
        }
        .sail-sky-cloud {
          filter: drop-shadow(0 2px 6px rgba(40, 80, 120, 0.16));
        }
        @keyframes sail-sky-cloud-scroll {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sail-sky-cloud-track {
            animation: none;
            transform: translate3d(-25%, 0, 0);
          }
        }
        /* Locked-island tap feedback — brief horizontal shake; no sail. */
        @keyframes sail-island-lock-shake {
          0%, 100% { translate: 0 0; }
          20% { translate: -7px 0; }
          40% { translate: 7px 0; }
          60% { translate: -5px 0; }
          80% { translate: 5px 0; }
        }
        .sail-island-lock-shake {
          animation: sail-island-lock-shake 0.42s ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .sail-island-lock-shake {
            animation: none;
          }
        }
      `}</style>

      {/* Wood header — plank top cropped flush with screen top; Back + island title on visible band */}
      <div className="absolute top-0 left-0 right-0 z-30 overflow-hidden">
        <div className="relative w-full max-w-[min(100%,480px)] mx-auto">
          <img
            src={SAIL_WOOD_HEADER}
            alt=""
            aria-hidden
            draggable={false}
            className="block w-full h-auto select-none pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
            style={{
              transform: `translateY(-${WOOD_HEADER_CROP * 100}%) scale(${WOOD_HEADER_SCALE})`,
              transformOrigin: 'top center',
            }}
          />

          <button
            type="button"
            onClick={() => navigate('/map')}
            disabled={isSailing}
            className="absolute left-[3%] z-10 flex items-center justify-center w-11 h-11 -translate-y-1/2 rounded-full text-white active:scale-95 transition-transform disabled:opacity-60"
            style={{
              ...woodBtnStyle,
              // Center on visible plank; floor at safe-area so taps clear the notch
              top: `max(${WOOD_HEADER_BTN_TOP}, calc(var(--safe-area-top, 0px) + 10px))`,
            }}
            aria-label="Back to Map"
          >
            <ArrowLeft size={22} className="drop-shadow" strokeWidth={2.6} />
          </button>

          {/* Island name (left) + progress (right, larger) on the visible plank band */}
          <div
            className="absolute left-[14%] right-[4%] z-10 flex items-center justify-between gap-2 pointer-events-none -translate-y-1/2"
            style={{
              top: `max(${WOOD_HEADER_BTN_TOP}, calc(var(--safe-area-top, 0px) + 10px))`,
            }}
          >
            <h1
              className="font-display font-black uppercase tracking-wide leading-none text-[1.15rem] sm:text-[1.35rem] text-left min-w-0 truncate"
              style={{
                color: '#F5E6C8',
                textShadow:
                  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 1px 0 0 #5C2E0B, -1px 0 0 #5C2E0B, 0 2px 4px rgba(0,0,0,0.35)',
              }}
            >
              {activeIsland.title}
            </h1>
            <AdventureProgress
              completed={activeProgress.completed}
              total={activeProgress.total}
              starSize={18}
            />
          </div>
        </div>
      </div>

      {/* Ship bow / deck — sunk below viewport so bow crops and wheel sits lower */}
      <div
        className="absolute left-0 right-0 z-10 pointer-events-none overflow-visible will-change-transform"
        style={{
          bottom: `calc(${DECK_HEIGHT_EXPR} * ${-DECK_SINK})`,
          // Sail forward: deck rises toward camera and grows
          transform: isSailing
            ? 'translateY(-18%) scale(1.22)'
            : 'translateY(0) scale(1)',
          transition: sailTransition,
          transformOrigin: '50% 100%',
        }}
        aria-hidden
      >
        <img
          src={SAIL_SHIP_DECK}
          alt=""
          draggable={false}
          className="block h-auto select-none"
          style={{
            width: `${DECK_SCALE * 100}%`,
            maxWidth: 'none',
            maxHeight: DECK_MAX_HEIGHT,
            marginLeft: '50%',
            transform: 'translateX(-50%)',
            objectFit: 'contain',
            objectPosition: 'bottom center',
            filter: 'drop-shadow(0 -4px 16px rgba(0,0,0,0.35))',
          }}
        />
      </div>

      {/* Interactive steering wheel — hub sits on the deck pedestal */}
      <div
        className="absolute left-0 right-0 z-20 flex justify-center pointer-events-none will-change-transform"
        style={{
          // Pedestal line = sunk deck bottom + fraction of scaled deck height
          bottom: `calc(${DECK_HEIGHT_EXPR} * ${PEDESTAL_FROM_BOTTOM - DECK_SINK})`,
          transform: isSailing
            ? 'translateY(-28%) scale(1.18)'
            : 'translateY(0) scale(1)',
          transition: sailTransition,
          transformOrigin: '50% 100%',
        }}
      >
        <div
          ref={wheelRef}
          className="relative touch-none select-none"
          style={{
            width: 'min(62vw, 300px)',
            aspectRatio: '1',
            // Center hub on the pedestal line (bottom edge → hub)
            transform: 'translateY(50%)',
            cursor: isSailing ? 'default' : isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.45))',
            pointerEvents: isSailing ? 'none' : 'auto',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          role="slider"
          aria-label="Steer to change island"
          aria-valuemin={0}
          aria-valuemax={LOOK_COUNT - 1}
          aria-valuenow={lookIndex}
          aria-valuetext={lookLabel}
          aria-disabled={isSailing}
        >
          <img
            src={SAIL_STEERING_WHEEL}
            alt=""
            draggable={false}
            className="w-full h-full object-contain pointer-events-none select-none will-change-transform"
            style={{
              transform: `rotate(${visualRotation}deg)`,
              transition: isDragging || isSailing ? 'none' : SNAP_EASING,
            }}
          />
        </div>
      </div>

      {/* Bottom overlay — Crew (left) + Explore (right) on the ship deck,
          flanking the wheel so taps stay clear of the hub. */}
      <div
        className="absolute left-0 right-0 z-[25] flex items-end justify-between pointer-events-none"
        style={{
          // Low on the visible deck planks beside the wheel (above safe-area;
          // may partially overlap the wheel rim — still tappable)
          bottom: `max(calc(var(--safe-area-bottom, 0px) + 8px), calc(${DECK_HEIGHT_EXPR} * 0.04))`,
          paddingLeft: 'min(5vw, 16px)',
          paddingRight: 'min(5vw, 16px)',
          // Keep a clear center channel for the steering wheel
          gap: 'min(42vw, 200px)',
        }}
      >
        {(
          [
            {
              id: 'crew',
              src: SAIL_BTN_CREW,
              label: 'CREW',
              ariaLabel: 'Crew',
              to: '/crew',
            },
            {
              id: 'explore',
              src: SAIL_BTN_EXPLORE,
              label: 'EXPLORE',
              ariaLabel: 'Explore',
              to: '/world',
            },
          ] as const
        ).map((btn) => (
          <button
            key={btn.id}
            type="button"
            disabled={isSailing}
            onClick={() => navigate(btn.to)}
            className="pointer-events-auto flex flex-col items-center gap-0 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
            style={{
              width: 'min(20vw, 84px)',
              filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.4))',
            }}
            aria-label={btn.ariaLabel}
          >
            <img
              src={btn.src}
              alt=""
              draggable={false}
              className="block w-full h-auto select-none pointer-events-none"
            />
            <span
              className="font-display font-black uppercase tracking-[0.1em] text-[0.5rem] sm:text-[0.55rem] leading-none text-[#F5E6C8]"
              style={{
                textShadow:
                  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
              }}
            >
              {btn.label}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
};

export default SailScenePage;
