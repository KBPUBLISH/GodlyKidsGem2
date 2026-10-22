import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Lock, Volume2, VolumeX } from 'lucide-react';
import {
  getBibleMapApiRoot,
  resolveBibleMapMediaUrl,
} from '../utils/bibleMapApi';
import {
  isOnboardingJourneyActive,
  subscribeOnboardingJourney,
} from '../utils/onboardingJourney';
import { noteBoatSession, noteJourneyStep } from '../utils/journeyStudy';
import {
  CMS_ISLANDS_TIMEOUT_MS,
  fetchOceanMapIslands,
  getSailIslandArtSrc,
  type OceanMapIsland,
} from '../utils/oceanMapIslands';
import { useSailMusic } from '../hooks/useSailMusic';
import { hasPremiumAccess } from '../utils/freeTierAccess';

/** Looping ocean background video (portrait; shown full-bleed cover). */
const SAIL_SCENE_BG = '/assets/videos/sail-ocean-bg.mp4';
/** Static ocean poster / fallback if the video fails to load. */
const SAIL_SCENE_BG_STILL = '/assets/images/sail-scene-bg.png';
/** First-person boat bow interior (1024×829) — black keyed to alpha. */
const SAIL_SHIP_DECK = '/assets/images/sail-ship-deck.png';
const SAIL_STEERING_WHEEL = '/assets/images/sail-steering-wheel.png';
/** Sail-scene bottom overlay — crew roster (three characters on wood plaque). */
const SAIL_BTN_CREW = '/assets/images/sail-btn-crew.png';
/** Sail-scene bottom overlay — explore / world (open book on wood plaque). */
const SAIL_BTN_EXPLORE = '/assets/images/sail-btn-explore.png';
/** Shared wood texture for Travel Here CTA (matches IslandScene chrome). */
const WOOD_TEX = '/assets/images/wheel-background-wood.png';
/** One-time steering-wheel turn hint — hide after first drag. */
const WHEEL_HINT_STORAGE_KEY = 'godlykids_sail_wheel_hint_seen';
/** White cover after onboarding intro video — matches map cinematic fade. */
const ARRIVAL_WHITE_FADE_MS = 700;

const travelHereBtnStyle: React.CSSProperties = {
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
/** Distant horizon slots — art comes from the same CMS icons as the ocean map. */

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

type SailCarouselIsland = {
  id: string;
  title: string;
  src: string;
  hasMainMap: boolean;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  storiesComplete: number;
  storiesTotal: number;
};

const getIslandProgress = (island: SailCarouselIsland) => ({
  completed: island.storiesComplete,
  total: island.storiesTotal,
});

/** Island is complete when all adventures are done (completed === total). */
const isIslandComplete = (island: SailCarouselIsland | undefined): boolean => {
  if (!island) return false;
  const { completed, total } = getIslandProgress(island);
  return total > 0 && completed >= total;
};

/**
 * Unlock rule:
 * - First CMS island (voyage start) is always available.
 * - Every other carousel island unlocks only after the first is fully complete.
 */
const isIslandUnlocked = (
  islandId: string,
  islands: SailCarouselIsland[],
): boolean => {
  const first = islands[0];
  if (!first) return false;
  if (islandId === first.id) return true;
  return isIslandComplete(first);
};

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
/**
 * How far apart islands sit, in vw from the screen center.
 * Index 0 rests in the center; every later island waits to its left.
 */
const ISLAND_SPACING_VW = 46;
/** Degrees of movement below which we treat as a tap (same as bottom nav). */
const TAP_THRESHOLD = 22;
/**
 * Gear-shift detents. The wheel does NOT follow the finger smoothly: it sits
 * on the current notch, creeps a little against resistance, and once the
 * finger has turned DETENT_THRESHOLD degrees it clunks to the next notch and
 * sticks there. The island carousel shifts at the same instant.
 */
const DETENT_THRESHOLD = STEP_ANGLE * 0.5;
/** Fraction of finger travel shown as creep before the shift (resistance). */
const DETENT_RESIST = 0.25;
/** Creep at the first / last notch where there is nothing to shift into. */
const DETENT_END_RESIST = 0.12;
/** The clunk: quick turn with a small overshoot, then hold. */
const DETENT_EASING = 'transform 0.2s cubic-bezier(0.2, 1.35, 0.45, 1)';
const DETENT_LOCK_MS = 200;
/** Release: creep springs back to the notch. */
const SNAP_EASING = 'transform 0.78s cubic-bezier(0.22, 0.9, 0.28, 1)';
const ISLAND_POP = '0.62s cubic-bezier(0.16, 1.45, 0.32, 1)';
const ISLAND_FADE_MS = 420;
/** Boat sails toward the tapped island — kid-friendly ease-in-out. */
const SAIL_DURATION_MS = 2100;
const SAIL_EASING = 'cubic-bezier(0.45, 0.05, 0.25, 1)';
/** Short hop when prefers-reduced-motion is on, then navigate. */
const SAIL_REDUCED_MS = 120;

const clampIndex = (i: number, lookCount: number) =>
  Math.max(0, Math.min(Math.max(lookCount, 1) - 1, i));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const normalizeIslandId = (value: string) =>
  value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');

const resolveStartIndex = (
  islands: SailCarouselIsland[],
  islandId?: string,
): number => {
  if (!islands.length) return 0;
  if (!islandId) return 0;
  const id = normalizeIslandId(islandId);
  const exact = islands.findIndex((island) => island.id === id);
  if (exact >= 0) return exact;
  return 0;
};

type SailNavState = {
  title?: string;
  hasMainMap?: boolean;
  mainMapUrl?: string;
  mainMapVideoUrl?: string;
  onboardingJourney?: boolean;
} | null;

const mediaIndicatesMainMap = (
  mainMapUrl?: string | null,
  mainMapVideoUrl?: string | null,
): boolean =>
  Boolean(
    (mainMapUrl && mainMapUrl.trim()) ||
      (mainMapVideoUrl && mainMapVideoUrl.trim()),
  );

const toCarouselIsland = (island: OceanMapIsland): SailCarouselIsland | null => {
  const src = getSailIslandArtSrc(island);
  if (!src) return null;
  const title = (island.book && island.book.trim()) || island.title;
  return {
    id: island.id,
    title,
    src,
    hasMainMap: mediaIndicatesMainMap(island.mainMapUrl, island.mainMapVideoUrl),
    mainMapUrl: island.mainMapUrl,
    mainMapVideoUrl: island.mainMapVideoUrl,
    storiesComplete: island.storiesComplete,
    storiesTotal: island.storiesTotal || 5,
  };
};

/** Fetch whether a CMS island has a main-map PNG/video (legacy if unknown/fail). */
const fetchIslandHasMainMap = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(
      `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(id)}`,
    );
    if (!res.ok) return false;
    const data = (await res.json()) as {
      island?: { mainMapUrl?: string; mainMapVideoUrl?: string };
    };
    return mediaIndicatesMainMap(
      resolveBibleMapMediaUrl(data.island?.mainMapUrl),
      resolveBibleMapMediaUrl(data.island?.mainMapVideoUrl),
    );
  } catch {
    return false;
  }
};

/**
 * First-person sail scene — opened when tapping an island on the Map.
 * Turn the wheel like the app nav: release and it snaps to the next island.
 */
const SailScenePage: React.FC = () => {
  const { soundOn, toggleSound } = useSailMusic();
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId } = useParams<{ islandId?: string }>();
  const navState = location.state as SailNavState;
  const arrowMarkerId = `gk-sail-helm-arrow-${useId().replace(/:/g, '')}`;

  const wheelRef = useRef<HTMLDivElement>(null);
  const oceanVideoRef = useRef<HTMLVideoElement>(null);
  /** When true, show static ocean still instead of (failed) video. */
  const [oceanStill, setOceanStill] = useState(false);
  const draggingRef = useRef(false);
  /** Finger angle at the last move (re-based every move so wrap-around is per-step). */
  const lastAngleRef = useRef(0);
  /** Degrees turned since the last detent (signed, clamped to ±STEP_ANGLE). */
  const detentAccumRef = useRef(0);
  const totalMoveRef = useRef(0);
  const lastTouchEndRef = useRef(0);
  const shiftLockTimerRef = useRef<number | null>(null);
  const lookIndexRef = useRef(0);
  const isSailingRef = useRef(false);
  const sailTimerRef = useRef<number | null>(null);
  /** Cache: island id → has CMS main map (PNG/video). */
  const mainMapCacheRef = useRef<Record<string, boolean>>({});
  const navStateRef = useRef(navState);
  const routeIslandIdRef = useRef(islandId);
  const carouselIslandsRef = useRef<SailCarouselIsland[]>([]);

  const [carouselIslands, setCarouselIslands] = useState<SailCarouselIsland[]>([]);
  const [lookIndex, setLookIndex] = useState(0);
  /** Degrees of creep off the current notch while dragging (resistance feel). */
  const [creep, setCreep] = useState(0);
  /** True for DETENT_LOCK_MS after a shift: wheel animates to the notch and holds. */
  const [shifting, setShifting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  /** True while the boat is sailing toward the tapped island. */
  const [isSailing, setIsSailing] = useState(false);
  /** Brief shake when tapping a locked island (no sail / navigate). */
  const [lockShakeId, setLockShakeId] = useState<string | null>(null);
  const lockShakeTimerRef = useRef<number | null>(null);
  /** First-time (or until first turn) animated arrow around the wheel. */
  const [showWheelHint, setShowWheelHint] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(WHEEL_HINT_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const fromOnboarding = Boolean(navState?.onboardingJourney);
  const [journeyActive, setJourneyActive] = useState(() =>
    isOnboardingJourneyActive() || fromOnboarding,
  );
  /** Home + Crew planks stay off during guided first-run; return after it ends. */
  const hideDeckNav = journeyActive;
  const [arrivalWhite, setArrivalWhite] = useState(fromOnboarding);
  const [arrivalWhiteOpacity, setArrivalWhiteOpacity] = useState(
    fromOnboarding ? 1 : 0,
  );

  lookIndexRef.current = lookIndex;
  isSailingRef.current = isSailing;
  navStateRef.current = navState;
  routeIslandIdRef.current = islandId;
  carouselIslandsRef.current = carouselIslands;

  const lookCount = Math.max(carouselIslands.length, 1);
  const firstIsland = carouselIslands[0];

  useEffect(() => {
    const sync = () => setJourneyActive(isOnboardingJourneyActive());
    sync();
    return subscribeOnboardingJourney(sync);
  }, []);

  useEffect(() => {
    if (fromOnboarding || journeyActive) noteJourneyStep('sail_deck');
  }, [fromOnboarding, journeyActive]);

  useEffect(() => {
    noteBoatSession();
  }, []);

  // Onboarding: land under white (same overlay the intro video faded to) and reveal.
  useEffect(() => {
    if (!fromOnboarding) return;
    if (prefersReducedMotion()) {
      setArrivalWhiteOpacity(0);
      setArrivalWhite(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setArrivalWhiteOpacity(0));
    });
    const doneId = window.setTimeout(
      () => setArrivalWhite(false),
      ARRIVAL_WHITE_FADE_MS,
    );
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(doneId);
    };
  }, [fromOnboarding]);

  // Seed main-map cache from Map → Sail navigation state.
  useEffect(() => {
    if (!islandId) return;
    const key = normalizeIslandId(islandId);
    if (typeof navState?.hasMainMap === 'boolean') {
      mainMapCacheRef.current[key] = navState.hasMainMap;
      return;
    }
    if (
      mediaIndicatesMainMap(navState?.mainMapUrl, navState?.mainMapVideoUrl)
    ) {
      mainMapCacheRef.current[key] = true;
    }
  }, [islandId, navState?.hasMainMap, navState?.mainMapUrl, navState?.mainMapVideoUrl]);

  // Prefetch main-map flag for the route island (and common carousel ids).
  useEffect(() => {
    if (!islandId) return;
    const key = normalizeIslandId(islandId);
    if (typeof mainMapCacheRef.current[key] === 'boolean') return;
    let cancelled = false;
    void fetchIslandHasMainMap(key).then((has) => {
      if (!cancelled) mainMapCacheRef.current[key] = has;
    });
    return () => {
      cancelled = true;
    };
  }, [islandId]);

  // CMS islands — same voyage list / mapArtUrl icons as the ocean map.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const failSafe = window.setTimeout(
      () => controller.abort(),
      CMS_ISLANDS_TIMEOUT_MS,
    );

    const load = async () => {
      try {
        const mapped = await fetchOceanMapIslands(controller.signal);
        if (cancelled || !mapped) return;
        const next = mapped
          .map(toCarouselIsland)
          .filter((row): row is SailCarouselIsland => row != null);
        if (!next.length) return;
        setCarouselIslands(next);
        for (const island of next) {
          if (typeof island.hasMainMap === 'boolean') {
            mainMapCacheRef.current[island.id] = island.hasMainMap;
          }
        }
        // Always open on the first island. Later islands wait to the left
        // and the wheel brings them in.
        setLookIndex(0);
        lookIndexRef.current = 0;
      } catch {
        /* leave the ocean bare rather than inventing genesis art */
      } finally {
        window.clearTimeout(failSafe);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, []);

  // Keep the voyage starting on the first island even if the route names
  // a later one. The wheel is how you reach the rest.

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

  const activeIsland = carouselIslands[lookIndex] ?? firstIsland;
  const firstIslandTitle = firstIsland?.title || 'the first island';

  const restingRotation = lookIndex * STEP_ANGLE;
  /** Wheel sits on its notch; while dragging it only creeps until the shift. */
  const visualRotation = isDragging && !shifting ? restingRotation + creep : restingRotation;
  /**
   * 0 = first island centered. Islands only move on a detent shift (never
   * with the creep), so each notch feels like a gear change.
   */
  const carouselProgress = lookIndex;
  const wheelTransition = isSailing
    ? 'none'
    : isDragging
      ? shifting
        ? DETENT_EASING
        : 'none'
      : SNAP_EASING;

  const sailDurationMs = prefersReducedMotion() ? SAIL_REDUCED_MS : SAIL_DURATION_MS;
  const sailTransition = isSailing
    ? `transform ${sailDurationMs}ms ${SAIL_EASING}, opacity ${sailDurationMs}ms ${SAIL_EASING}`
    : undefined;

  /**
   * After ship sail animation: MainMap if island has mainMapUrl/video, else legacy lesson.
   * When sailing the island we arrived for from Map, prefer the route slug (CMS id).
   */
  const continueAfterSail = useCallback(
    (carouselIsland: SailCarouselIsland) => {
      const islands = carouselIslandsRef.current;
      const routeId = routeIslandIdRef.current;
      const arrivedForThis =
        !!routeId &&
        resolveStartIndex(islands, routeId) ===
          islands.findIndex((i) => i.id === carouselIsland.id);
      const destId = arrivedForThis
        ? normalizeIslandId(routeId!)
        : carouselIsland.id;
      const state = navStateRef.current;
      const title =
        (arrivedForThis && state?.title) ||
        carouselIsland.title;

      const go = (hasMainMap: boolean) => {
        const nextState = {
          title,
          fromSail: true,
          onboardingJourney: Boolean(state?.onboardingJourney),
        };
        if (hasMainMap) {
          navigate(`/map/${encodeURIComponent(destId)}/main`, {
            state: nextState,
          });
          return;
        }
        navigate(`/sail/${encodeURIComponent(destId)}/lesson`, {
          state: nextState,
        });
      };

      const cached = mainMapCacheRef.current[destId];
      if (typeof cached === 'boolean') {
        go(cached);
        return;
      }
      if (
        arrivedForThis &&
        (typeof state?.hasMainMap === 'boolean' ||
          mediaIndicatesMainMap(state?.mainMapUrl, state?.mainMapVideoUrl))
      ) {
        const has =
          typeof state?.hasMainMap === 'boolean'
            ? state.hasMainMap
            : mediaIndicatesMainMap(state?.mainMapUrl, state?.mainMapVideoUrl);
        mainMapCacheRef.current[destId] = has;
        go(has);
        return;
      }

      void fetchIslandHasMainMap(destId).then((has) => {
        mainMapCacheRef.current[destId] = has;
        go(has);
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

  const dismissWheelHint = useCallback(() => {
    setShowWheelHint((prev) => {
      if (!prev) return prev;
      try {
        localStorage.setItem(WHEEL_HINT_STORAGE_KEY, 'true');
      } catch {
        /* ignore quota / private mode */
      }
      return false;
    });
  }, []);

  const startSailToIsland = useCallback(
    (island: SailCarouselIsland) => {
      if (isSailingRef.current) return;

      // Locked islands: shake only — no sail-forward / lesson navigation.
      if (!isIslandUnlocked(island.id, carouselIslandsRef.current)) {
        pulseLockedFeedback(island.id);
        if (!hasPremiumAccess()) {
          navigate('/onboarding/welcome', {
            state: { returnTo: '/map', reason: 'continue-journey' },
          });
        }
        return;
      }

      // Cancel any in-progress wheel drag so carousel state stays clean.
      draggingRef.current = false;
      setIsDragging(false);
      setCreep(0);

      if (prefersReducedMotion()) {
        continueAfterSail(island);
        return;
      }

      isSailingRef.current = true;
      setIsSailing(true);

      if (sailTimerRef.current != null) {
        window.clearTimeout(sailTimerRef.current);
      }
      sailTimerRef.current = window.setTimeout(() => {
        sailTimerRef.current = null;
        continueAfterSail(island);
      }, SAIL_DURATION_MS);
    },
    [continueAfterSail, pulseLockedFeedback, navigate],
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
      dismissWheelHint();
      draggingRef.current = true;
      lastAngleRef.current = getAngle(clientX, clientY);
      detentAccumRef.current = 0;
      totalMoveRef.current = 0;
      setCreep(0);
      setIsDragging(true);
    },
    [dismissWheelHint, getAngle],
  );

  /** Clunk one notch over: islands shift, wheel animates to the notch and holds. */
  const shiftDetent = useCallback((direction: 1 | -1) => {
    const count = carouselIslandsRef.current.length;
    const next = clampIndex(lookIndexRef.current + direction, count);
    if (next === lookIndexRef.current) return false;
    lookIndexRef.current = next;
    detentAccumRef.current = 0;
    setLookIndex(next);
    setCreep(0);
    setShifting(true);
    if (shiftLockTimerRef.current != null) window.clearTimeout(shiftLockTimerRef.current);
    shiftLockTimerRef.current = window.setTimeout(() => {
      shiftLockTimerRef.current = null;
      setShifting(false);
    }, DETENT_LOCK_MS);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptics */
    }
    return true;
  }, []);

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!draggingRef.current) return;

      const currentAngle = getAngle(clientX, clientY);
      // Standard physics (bottom nav): CW drag increases rotation
      let delta = currentAngle - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      lastAngleRef.current = currentAngle;

      totalMoveRef.current += Math.abs(delta);
      // Degrees turned since the last notch; clamp so a long pull past the
      // end stop doesn't bank up turns.
      const accum = Math.max(
        -STEP_ANGLE,
        Math.min(STEP_ANGLE, detentAccumRef.current + delta),
      );
      detentAccumRef.current = accum;

      // Shift when the finger has turned far enough — one notch per threshold.
      if (accum >= DETENT_THRESHOLD && shiftDetent(1)) return;
      if (accum <= -DETENT_THRESHOLD && shiftDetent(-1)) return;

      // No shift (not far enough, or at an end stop): show resistance creep.
      const count = carouselIslandsRef.current.length;
      const atEnd =
        (accum > 0 && lookIndexRef.current >= count - 1) ||
        (accum < 0 && lookIndexRef.current <= 0);
      setCreep(accum * (atEnd ? DETENT_END_RESIST : DETENT_RESIST));
    },
    [getAngle, shiftDetent],
  );

  const onEnd = useCallback(() => {
    if (!draggingRef.current || isSailingRef.current) return;
    // Shifts already committed on the way; release just springs the creep
    // back onto the current notch.
    draggingRef.current = false;
    detentAccumRef.current = 0;
    setCreep(0);
    setIsDragging(false);
  }, []);

  useEffect(
    () => () => {
      if (shiftLockTimerRef.current != null) window.clearTimeout(shiftLockTimerRef.current);
    },
    [],
  );

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

  const lookLabel = `Island: ${activeIsland?.title ?? 'Island'}`;

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
          {/* Static still always under video — avoids empty sky if mp4 404s / fails */}
          <img
            src={SAIL_SCENE_BG_STILL}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          />
          {!oceanStill && (
            <video
              ref={oceanVideoRef}
              src={SAIL_SCENE_BG}
              poster={SAIL_SCENE_BG_STILL}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              aria-hidden
              onError={() => setOceanStill(true)}
            />
          )}
        </div>

        {/* Viewport-fixed sky clouds — above video sky, behind carousel islands.
            Not inside sail zoom so they don’t drift with the approach.
            Taller band now that the wood plank header is gone. */}
        <div
          className="absolute left-0 right-0 top-0 z-[1] pointer-events-none overflow-hidden"
          style={{ height: '40%' }}
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
          {/* Island carousel — first island centered, the rest queued to the left.
              Turning the wheel slides the next one in from the left. */}
          {carouselIslands.map((island, i) => {
            const offset = i - carouselProgress;
            const distance = Math.abs(offset);
            const active = i === lookIndex && !isDragging;
            const unlocked = isIslandUnlocked(island.id, carouselIslands);
            // Center island reads close; each step back shrinks and lifts toward the horizon.
            const scale = Math.max(0.4, 1.34 - distance * 0.74);
            const yPct = -42 - distance * 16;
            const xVw = -offset * ISLAND_SPACING_VW;
            const baseTransform = `translate(-50%, ${yPct}%) scale(${scale})`;
            const sailTransform = `translate(-50%, -48%) scale(${scale * 1.28})`;
            const progress = getIslandProgress(island);
            const shaking = lockShakeId === island.id;
            const visible = distance < 2.8;
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
                      : `${island.title} locked — complete ${firstIslandTitle} to unlock`
                    : undefined
                }
                aria-disabled={active && !unlocked ? true : undefined}
                tabIndex={active && !isSailing ? 0 : -1}
                className={`absolute p-0 m-0 border-0 bg-transparent appearance-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg${
                  shaking ? ' sail-island-lock-shake' : ''
                }`}
                style={{
                  left: `calc(50% + ${xVw}vw)`,
                  top: '18%',
                  width: 'min(34vw, 220px)',
                  opacity: visible ? Math.max(0.38, 1 - distance * 0.34) : 0,
                  transform: isSailing && active ? sailTransform : baseTransform,
                  // Islands pop to the next slot on each detent shift (also mid-drag).
                  transition: isSailing
                    ? sailTransition
                    : `opacity ${ISLAND_FADE_MS}ms ease, transform ${ISLAND_POP}, left ${ISLAND_POP}`,
                  zIndex: Math.max(1, 8 - Math.round(distance * 2)),
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

          {/* Travel Here — kid CTA over the focused island; same sail path as tapping it */}
          {!isSailing && !isDragging && activeIsland && (
            <button
              type="button"
              onClick={() => startSailToIsland(activeIsland)}
              aria-label={
                isIslandUnlocked(activeIsland.id, carouselIslands)
                  ? `Travel here to ${activeIsland.title}`
                  : `${activeIsland.title} locked — complete ${firstIslandTitle} to unlock`
              }
              className="absolute z-20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl appearance-none whitespace-nowrap font-display font-black uppercase tracking-[0.08em] text-[0.7rem] sm:text-[0.8rem] leading-none text-[#F5E6C8] active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{
                ...travelHereBtnStyle,
                left: '50%',
                /* Sit over the canopy of the focused island (same anchor as carousel). */
                top: '2%',
                transform: 'translate(-50%, -50%)',
                textShadow:
                  '0 1px 0 #5C2E0B, 0 2px 0 #3E1F07, 0 2px 4px rgba(0,0,0,0.45)',
                pointerEvents: 'auto',
                cursor: isIslandUnlocked(activeIsland.id, carouselIslands)
                  ? 'pointer'
                  : 'not-allowed',
                opacity: isIslandUnlocked(activeIsland.id, carouselIslands) ? 1 : 0.85,
              }}
            >
              Travel Here
            </button>
          )}
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
        /* First-time wheel hint — curved arrow rocks to suggest turn/drag. */
        @keyframes sail-wheel-hint-rock {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes sail-wheel-hint-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .sail-wheel-hint {
          animation:
            sail-wheel-hint-rock 1.6s ease-in-out infinite,
            sail-wheel-hint-fade 1.6s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
        @media (prefers-reduced-motion: reduce) {
          .sail-wheel-hint {
            animation: none;
            opacity: 0.9;
            transform: rotate(0deg);
          }
        }
      `}</style>

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
          decoding="async"
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
          onError={(e) => {
            /* Last-resort: keep layout, hide broken-icon wireframe */
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
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
          aria-valuemax={Math.max(lookCount - 1, 0)}
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
              transition: wheelTransition,
            }}
          />
          {/* One-time turn hint — hide on first wheel interaction (localStorage). */}
          {showWheelHint && !isSailing && (
            <div
              className="absolute inset-0 pointer-events-none sail-wheel-hint"
              aria-hidden
            >
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
              >
                <defs>
                  <marker
                    id={arrowMarkerId}
                    viewBox="0 0 10 10"
                    refX="0.35"
                    refY="5"
                    markerWidth="2.8"
                    markerHeight="2.8"
                    markerUnits="strokeWidth"
                    orient="auto"
                  >
                    <path d="M 0 0.6 L 10 5 L 0 9.4 Z" fill="#F5E6C8" />
                  </marker>
                </defs>
                {/* Clockwise rim arc; marker orients to the end tangent (down). */}
                <path
                  d="M 72 22 A 36 36 0 0 1 88 58"
                  fill="none"
                  stroke="#F5E6C8"
                  strokeWidth="4.5"
                  strokeLinecap="butt"
                  markerEnd={`url(#${arrowMarkerId})`}
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSound}
        className="absolute z-[30] flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          ...travelHereBtnStyle,
          top: 'max(12px, var(--safe-area-top))',
          left: 'max(12px, var(--safe-area-left, 0px))',
        }}
        aria-label={soundOn ? 'Sound off' : 'Sound on'}
      >
        {soundOn ? (
          <Volume2 size={20} className="text-white drop-shadow" strokeWidth={2.6} />
        ) : (
          <VolumeX size={20} className="text-white/80 drop-shadow" strokeWidth={2.6} />
        )}
      </button>

      {/* Bottom overlay — Crew | Home on the ship deck (hidden during first-run). */}
      {!hideDeckNav && (
      <div
        className="absolute left-0 right-0 z-[25] flex items-end justify-between pointer-events-none"
        style={{
          // Raised a bit above the home indicator / deck edge
          bottom: `max(calc(var(--safe-area-bottom, 0px) + 20px), calc(${DECK_HEIGHT_EXPR} * 0.07))`,
          paddingLeft: 'min(4vw, 14px)',
          paddingRight: 'min(4vw, 14px)',
        }}
      >
        {(
          [
            {
              id: 'crew',
              src: SAIL_BTN_CREW,
              label: 'CREW',
              ariaLabel: 'Crew',
              to: '/crew' as string | null,
            },
            {
              id: 'home',
              src: SAIL_BTN_EXPLORE,
              label: 'Home',
              ariaLabel: 'Home',
              to: '/world' as string | null,
            },
          ] as const
        ).map((btn) => (
          <button
            key={btn.id}
            type="button"
            disabled={isSailing}
            onClick={() => {
              if (!btn.to) return;
              navigate(btn.to);
            }}
            className="pointer-events-auto flex flex-col items-center gap-0 p-0 m-0 border-0 bg-transparent appearance-none active:scale-95 transition-transform disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
            style={{
              width: 'min(18vw, 80px)',
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
      )}

      {arrivalWhite && (
        <div
          className="absolute inset-0 z-[80] pointer-events-none"
          style={{
            background: '#fff',
            opacity: arrivalWhiteOpacity,
            transition: prefersReducedMotion()
              ? 'none'
              : `opacity ${ARRIVAL_WHITE_FADE_MS}ms ease-out`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
};

export default SailScenePage;
