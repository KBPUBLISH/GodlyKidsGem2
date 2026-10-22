import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Lock, MapPin, Volume2, VolumeX } from 'lucide-react';
import { useSailMusic } from '../hooks/useSailMusic';
import {
  getBibleMapApiRoot,
  prefersReducedMotion,
  resolveBibleMapMediaUrl,
  TABLET_MIN_WIDTH,
} from '../utils/bibleMapApi';
import {
  isPlayableMainMapStory,
  isStorySequentiallyUnlocked,
  isStoryUnlocked,
  laterStoryPackNeedsTrial,
} from '../utils/mainMapStoryUnlock';
import { profileService } from '../services/profileService';
import {
  STORY_PACK_UX_EVENT,
  storyPackUnlockUxService,
} from '../services/storyPackUnlockUxService';
import { isOnboardingJourneyActive } from '../utils/onboardingJourney';
import { noteJourneyStep } from '../utils/journeyStudy';
import { rememberLastStoryIsland } from '../utils/lastStoryIsland';
import StoryPackNewBadge from '../components/world/StoryPackNewBadge';
import PackUnlockCelebration from '../components/world/PackUnlockCelebration';
import { usePackUnlockCelebration } from '../hooks/usePackUnlockCelebration';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const CMS_FETCH_TIMEOUT_MS = 4_000;

/** Sky clouds — same assets/marquee pattern as MapPage / ExploreMapBackdrop. */
const MAP_SKY_CLOUD_A = '/assets/images/map-sky-cloud-a.png';
const MAP_SKY_CLOUD_B = '/assets/images/map-sky-cloud-b.png';

type MainMapSkyCloudSpec = {
  id: string;
  src: string;
  widthPct: number;
  leftPct?: number;
  rightPct?: number;
  topPct?: number;
  opacity: number;
};

const MAIN_MAP_SKY_CLOUDS: MainMapSkyCloudSpec[] = [
  { id: 'a-left', src: MAP_SKY_CLOUD_A, widthPct: 44, leftPct: -12, topPct: 0, opacity: 0.95 },
  { id: 'b-right', src: MAP_SKY_CLOUD_B, widthPct: 36, rightPct: -8, topPct: 4, opacity: 0.92 },
  { id: 'a-mid', src: MAP_SKY_CLOUD_A, widthPct: 30, leftPct: 32, topPct: 0, opacity: 0.82 },
  { id: 'b-high', src: MAP_SKY_CLOUD_B, widthPct: 22, leftPct: 52, topPct: 2, opacity: 0.74 },
  { id: 'a-low', src: MAP_SKY_CLOUD_A, widthPct: 32, leftPct: 10, topPct: 14, opacity: 0.58 },
];

const MAIN_MAP_SKY_CLOUD_LOOP_SEC = 90;

/** Form-factor layout keys (must match CMS / backend). */
export type MainMapLayoutKey = 'phone_se' | 'phone' | 'phone_max' | 'tablet';

type MainMapPoint = { x: number; y: number };
type MainMapSize = { w: number; h: number };
type MainMapPositionAnchor = 'topLeft' | 'badgeCenter';

/** Missing key → walk this chain (phone_max → phone → phone_se → tablet, etc.). */
const FALLBACK_CHAIN: Record<MainMapLayoutKey, MainMapLayoutKey[]> = {
  phone_se: ['phone_se', 'phone', 'phone_max', 'tablet'],
  phone: ['phone', 'phone_se', 'phone_max', 'tablet'],
  phone_max: ['phone_max', 'phone', 'phone_se', 'tablet'],
  tablet: ['tablet', 'phone_max', 'phone', 'phone_se'],
};

const DEFAULT_ICON_SIZE: Record<MainMapLayoutKey, MainMapSize> = {
  phone_se: { w: 17, h: 13 },
  phone: { w: 16, h: 12 },
  phone_max: { w: 15, h: 11 },
  tablet: { w: 14, h: 11 },
};

/** Aspect long/short below this → compact SE-class phones (~16:9). */
const PHONE_SE_ASPECT_MAX = 1.92;
/** Short-side CSS px at/above this → large phone (Phone Max class). */
const PHONE_MAX_SHORT_MIN = 425;

/** Approx. label height as % of frame (legacy chip had label inside the box). */
const LEGACY_LABEL_RESERVE_PCT = 2.2;

type MainMapStory = {
  _id: string;
  order?: number;
  title?: string;
  displayTitle?: string;
  mapIconUrl?: string;
  heroImageUrl?: string;
  mainMapPosition?: Partial<Record<MainMapLayoutKey, Partial<MainMapPoint>>> | null;
  mainMapSize?: Partial<Record<MainMapLayoutKey, Partial<MainMapSize>>> | null;
  /**
   * Coordinate semantics for mainMapPosition.
   * - badgeCenter (current CMS): center of the circular badge
   * - topLeft (legacy only): top-left of the old icon+label chip
   * Missing → badgeCenter (CMS layout editor always saves centers; prod may omit the field).
   */
  mainMapPositionAnchor?: MainMapPositionAnchor | null;
  status?: string;
  /** Used for sequential unlock (quiz gate when previous pack has no quiz). */
  quizMode?: string;
  bookId?: unknown;
  customQuestions?: unknown[];
  quiz?: {
    levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
  };
};

/** Gold padlock over locked story icons (matches Island Scene activity lock). */
const StoryLockBadge: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <span
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    aria-hidden
  >
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(180deg, #F0D78C 0%, #D4A017 45%, #8B6914 100%)',
        boxShadow:
          '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,240,200,0.55)',
        border: '1.5px solid #F5E6A3',
      }}
    >
      <Lock
        size={Math.round(size * 0.45)}
        className="text-[#5c3a1a]"
        strokeWidth={2.8}
        fill="rgba(92,58,26,0.2)"
      />
    </span>
  </span>
);

type NavState = {
  title?: string;
  /** Arrived from ship sail scene — back returns to sail. */
  fromSail?: boolean;
  onboardingJourney?: boolean;
} | null;

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hasPoint(p?: Partial<MainMapPoint> | null): p is MainMapPoint {
  return (
    !!p &&
    typeof p.x === 'number' &&
    Number.isFinite(p.x) &&
    typeof p.y === 'number' &&
    Number.isFinite(p.y)
  );
}

function hasSize(s?: Partial<MainMapSize> | null): s is MainMapSize {
  return (
    !!s &&
    typeof s.w === 'number' &&
    Number.isFinite(s.w) &&
    typeof s.h === 'number' &&
    Number.isFinite(s.h) &&
    s.w > 0 &&
    s.h > 0
  );
}

/** Viewport size — prefer visualViewport when present (Despia / mobile chrome). */
function readViewportSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 390, h: 844 };
  const vv = window.visualViewport;
  const w = vv?.width && vv.width > 0 ? vv.width : window.innerWidth;
  const h = vv?.height && vv.height > 0 ? vv.height : window.innerHeight;
  return { w, h };
}

type MediaBox = { w: number; h: number };
type StageBox = { left: number; top: number; width: number; height: number };

/**
 * Fit the island on a phone. A straight contain-fit leaves a tall empty sky,
 * so on a narrow screen the map grows toward full-bleed and only a slim
 * strip of the outer coast is cropped.
 */
function fitMediaStage(view: { w: number; h: number }, media: MediaBox): StageBox {
  const widthFit = view.w / media.w;
  const heightFit = view.h / media.h;
  const contain = Math.min(widthFit, heightFit);
  const tallPhone = widthFit < heightFit;
  const scale = tallPhone ? contain + (heightFit - contain) * 0.78 : contain;
  const width = media.w * scale;
  const height = media.h * scale;
  return {
    left: (view.w - width) / 2,
    top: view.h - height,
    width,
    height,
  };
}

/**
 * CMS saves badge centers against an object-cover frame. Map that point onto
 * the full image so it stays on the same landmark once the sides are visible.
 */
function coverPointToImagePercent(
  point: MainMapPoint,
  view: { w: number; h: number },
  media: MediaBox,
): MainMapPoint {
  const s = Math.max(view.w / media.w, view.h / media.h);
  const coverW = media.w * s;
  const coverH = media.h * s;
  const coverX = (view.w - coverW) / 2;
  const coverY = view.h - coverH;
  const imgX = ((point.x / 100) * view.w - coverX) / coverW;
  const imgY = ((point.y / 100) * view.h - coverY) / coverH;
  return {
    x: clamp(imgX * 100, 0, 100),
    y: clamp(imgY * 100, 0, 100),
  };
}

function sampleSkyColor(el: HTMLImageElement | HTMLVideoElement): string | null {
  const sw =
    'videoWidth' in el && el.videoWidth > 0
      ? el.videoWidth
      : (el as HTMLImageElement).naturalWidth;
  if (!sw) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(el, Math.floor(sw / 2), 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

function coverSizeToImagePercent(
  size: MainMapSize,
  view: { w: number; h: number },
  media: MediaBox,
): MainMapSize {
  const s = Math.max(view.w / media.w, view.h / media.h);
  const coverW = media.w * s;
  const coverH = media.h * s;
  return {
    w: Math.max(4, ((size.w / 100) * view.w) / coverW * 100),
    h: Math.max(4, ((size.h / 100) * view.h) / coverH * 100),
  };
}

/**
 * Detect main-map layout key from screen class (aspect + size buckets).
 * Despia UA is only a soft boost, not the sole signal.
 *
 * Thresholds:
 * - width ≥ 768 (or short side ≥ 768) → tablet
 * - long/short aspect < 1.92 → phone_se
 * - short side ≥ 425 → phone_max
 * - else → phone
 */
export function detectMainMapLayoutKey(
  width?: number,
  height?: number,
  userAgent?: string,
): MainMapLayoutKey {
  const { w: vw, h: vh } =
    width != null && height != null ? { w: width, h: height } : readViewportSize();
  const short = Math.min(vw, vh);
  const long = Math.max(vw, vh);
  const aspect = long / Math.max(short, 1);
  const ua = (userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  const isDespia = ua.includes('despia');
  const despiaIpad = isDespia && ua.includes('ipad');
  const despiaIphone = isDespia && ua.includes('iphone');

  if (vw >= TABLET_MIN_WIDTH || short >= TABLET_MIN_WIDTH || despiaIpad) {
    return 'tablet';
  }

  if (aspect < PHONE_SE_ASPECT_MAX) {
    return 'phone_se';
  }

  // Soft boost: large Despia iPhone near the Max boundary
  const maxBoost = despiaIphone && short >= 414;
  if (short >= PHONE_MAX_SHORT_MIN || maxBoost) {
    return 'phone_max';
  }

  return 'phone';
}

/** Legacy top-left-of-chip → badge-center (matches portal). */
function legacyTopLeftToBadgeCenter(pos: MainMapPoint, size: MainMapSize): MainMapPoint {
  const labelReserve = Math.min(LEGACY_LABEL_RESERVE_PCT, Math.max(1.2, size.h * 0.22));
  return {
    x: clamp(pos.x + size.w / 2, 0, 100),
    y: clamp(pos.y + (size.h - labelReserve) / 2, 0, 100),
  };
}

/** Staggered defaults when CMS coords are unset (badge-center; matches portal). */
function defaultPoint(index: number, total: number): MainMapPoint {
  const n = Math.max(total, 1);
  const t = n === 1 ? 0.5 : index / (n - 1);
  const y = clamp(12 + t * 70, 6, 86);
  const phase = index % 2 === 0 ? -1 : 1;
  const x = clamp(50 + phase * (18 + (index % 3) * 4), 10, 78);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

function resolveSize(story: MainMapStory, device: MainMapLayoutKey): MainMapSize {
  const fallback = DEFAULT_ICON_SIZE[device];
  for (const key of FALLBACK_CHAIN[device]) {
    const raw = story.mainMapSize?.[key];
    if (!hasSize(raw)) continue;
    return {
      w: clamp(Number(raw.w), 7, 32),
      h: clamp(Number(raw.h), 7, 32),
    };
  }
  return { ...fallback };
}

/**
 * Resolve badge-center (x,y).
 * Only explicit `topLeft` gets the legacy chip→center conversion. Missing anchor means
 * badge-center (matches CMS editor + current saved Genesis coords).
 */
function resolvePoint(
  story: MainMapStory,
  device: MainMapLayoutKey,
  index: number,
  total: number,
): MainMapPoint {
  for (const key of FALLBACK_CHAIN[device]) {
    const explicit = story.mainMapPosition?.[key];
    if (!hasPoint(explicit)) continue;
    const raw = {
      x: clamp(Number(explicit.x), 0, 100),
      y: clamp(Number(explicit.y), 0, 100),
    };
    if (story.mainMapPositionAnchor === 'topLeft') {
      return legacyTopLeftToBadgeCenter(raw, resolveSize(story, key));
    }
    return raw;
  }
  return defaultPoint(index, total);
}

/**
 * Island main map — video/PNG background + story icons.
 * Map → MainMap → IslandScene (intro → Scene Studio).
 *
 * (x,y) = center of the circular badge (same as CMS layout editor).
 * The map is shown in full (no side crop). Saved cover-frame points are
 * mapped onto that full image so badges stay on their landmarks.
 */
const MainMapPage: React.FC = () => {
  const { soundOn, toggleSound } = useSailMusic();
  const navigate = useNavigate();
  const { islandId = '' } = useParams<{ islandId: string }>();
  const location = useLocation();
  const navState = location.state as NavState;
  const onboardingJourney =
    Boolean(navState?.onboardingJourney) || isOnboardingJourneyActive();

  useEffect(() => {
    if (onboardingJourney) noteJourneyStep('story_map');
  }, [onboardingJourney]);

  const [layoutKey, setLayoutKey] = useState<MainMapLayoutKey>(() =>
    detectMainMapLayoutKey(),
  );
  const [viewSize, setViewSize] = useState(readViewportSize);
  const [mediaSize, setMediaSize] = useState<MediaBox | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [skyColor, setSkyColor] = useState('#5ca3c5');
  const [loading, setLoading] = useState(true);
  const [mainMapUrl, setMainMapUrl] = useState('');
  const [mainMapVideoUrl, setMainMapVideoUrl] = useState('');
  const [stories, setStories] = useState<MainMapStory[]>([]);
  const [loadError, setLoadError] = useState(false);
  /** Bumped on mount / focus / navigate-back so locks re-read local progress. */
  const [progressTick, setProgressTick] = useState(0);
  const [lockHint, setLockHint] = useState<string | null>(null);
  const lockHintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => {
      setLayoutKey(detectMainMapLayoutKey());
      setViewSize(readViewportSize());
    };
    window.addEventListener('resize', onResize);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      vv?.removeEventListener('resize', onResize);
    };
  }, []);

  // Re-check sequential locks when returning from a scene (location.key) or remounting.
  useEffect(() => {
    setProgressTick((t) => t + 1);
  }, [islandId, location.key]);

  useEffect(() => {
    if (!islandId) return;
    rememberLastStoryIsland(islandId, {
      title: navState?.title,
      path: `/map/${encodeURIComponent(islandId)}/main`,
    });
  }, [islandId, navState?.title]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setProgressTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const onProgress = () => setProgressTick((t) => t + 1);
    window.addEventListener('islandStoryProgressUpdated', onProgress);
    window.addEventListener(STORY_PACK_UX_EVENT, onProgress);
    const unsub = profileService.onProfileChange(onProgress);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('islandStoryProgressUpdated', onProgress);
      window.removeEventListener(STORY_PACK_UX_EVENT, onProgress);
      unsub();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (lockHintTimerRef.current != null) {
        window.clearTimeout(lockHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!islandId) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    const failSafe = window.setTimeout(() => {
      controller.abort();
      if (!cancelled) {
        setLoading(false);
        setLoadError(true);
      }
    }, CMS_FETCH_TIMEOUT_MS);

    const load = async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          island?: {
            slug?: string;
            title?: string;
            bookLabel?: string;
            description?: string;
            mainMapUrl?: string;
            mainMapVideoUrl?: string;
          };
          stories?: MainMapStory[];
        };
        if (cancelled) return;
        const island = data.island;
        if (!island) throw new Error('No island');

        setMediaSize(null);
        setMediaFailed(false);
        setMainMapUrl(resolveBibleMapMediaUrl(island.mainMapUrl));
        setMainMapVideoUrl(resolveBibleMapMediaUrl(island.mainMapVideoUrl));
        const list = Array.isArray(data.stories) ? data.stories : [];
        setStories(
          [...list]
            .filter((s) => isPlayableMainMapStory(s))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        );
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, [islandId]);

  const reduceMotion = prefersReducedMotion();

  // progressTick re-reads islandStoryProgressService after scene return / focus.
  const markers = useMemo(() => {
    const total = stories.length;
    return stories.map((story, index) => ({
      story,
      position: resolvePoint(story, layoutKey, index, total),
      size: resolveSize(story, layoutKey),
      iconUrl: resolveBibleMapMediaUrl(story.mapIconUrl),
      label: story.displayTitle || story.title || `Story ${story.order ?? index + 1}`,
      locked: !isStoryUnlocked(islandId, stories, index),
      isNew:
        !isStoryUnlocked(islandId, stories, index)
          ? false
          : storyPackUnlockUxService.isPackNew(islandId, story._id),
    }));
  }, [stories, layoutKey, islandId, progressTick]);

  const { celebration, dismissCelebration } = usePackUnlockCelebration(
    islandId,
    stories,
    !loading && stories.length > 0,
  );

  const stage = useMemo(() => {
    if (!mediaSize || viewSize.w < 1 || viewSize.h < 1) return null;
    return fitMediaStage(viewSize, mediaSize);
  }, [mediaSize, viewSize]);

  const placedMarkers = useMemo(() => {
    if (!stage || !mediaSize) {
      return markers.map((marker) => ({
        ...marker,
        place: marker.position,
        box: marker.size,
      }));
    }
    return markers.map((marker) => ({
      ...marker,
      place: coverPointToImagePercent(marker.position, viewSize, mediaSize),
      box: coverSizeToImagePercent(marker.size, viewSize, mediaSize),
    }));
  }, [markers, stage, mediaSize, viewSize]);

  const firstPack = useMemo(
    () => placedMarkers.find((m) => !m.locked) || placedMarkers[0] || null,
    [placedMarkers],
  );

  const hintRef = useRef<HTMLSpanElement>(null);
  const hintNudgeRef = useRef(0);
  const [hintNudge, setHintNudge] = useState(0);

  useEffect(() => {
    const el = hintRef.current;
    if (!el || !firstPack) {
      hintNudgeRef.current = 0;
      setHintNudge(0);
      return;
    }
    const fit = () => {
      const rect = el.getBoundingClientRect();
      const applied = hintNudgeRef.current;
      const naturalLeft = rect.left - applied;
      const naturalRight = rect.right - applied;
      const pad = 12;
      let nudge = 0;
      if (naturalLeft < pad) nudge = pad - naturalLeft;
      else if (naturalRight > window.innerWidth - pad) {
        nudge = window.innerWidth - pad - naturalRight;
      }
      if (Math.abs(nudge - applied) < 0.5) return;
      hintNudgeRef.current = nudge;
      setHintNudge(nudge);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [firstPack, stage, viewSize]);

  const noteMediaSize = (el: HTMLImageElement | HTMLVideoElement, w: number, h: number) => {
    if (w > 0 && h > 0) {
      setMediaSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    }
    const sky = sampleSkyColor(el);
    if (sky) setSkyColor(sky);
  };

  const showLockHint = useCallback(() => {
    setLockHint('Finish the story before this one!');
    if (lockHintTimerRef.current != null) {
      window.clearTimeout(lockHintTimerRef.current);
    }
    lockHintTimerRef.current = window.setTimeout(() => {
      setLockHint(null);
      lockHintTimerRef.current = null;
    }, 2200);
  }, []);

  const handleBack = useCallback(() => {
    // Prefer sail (previous step); otherwise ocean map.
    if (navState?.fromSail) {
      navigate(`/sail/${encodeURIComponent(islandId)}`, {
        state: {
          title: navState.title,
          hasMainMap: true,
        },
      });
      return;
    }
    navigate('/map');
  }, [navigate, islandId, navState?.fromSail, navState?.title]);

  const handleStoryTap = useCallback(
    (story: MainMapStory, label: string, index: number) => {
      if (!isStorySequentiallyUnlocked(islandId, stories, index)) {
        showLockHint();
        return;
      }
      if (laterStoryPackNeedsTrial(index)) {
        navigate('/onboarding/welcome', {
          state: {
            returnTo: `/map/${encodeURIComponent(islandId)}/main`,
            reason: 'continue-journey',
          },
        });
        return;
      }
      if (onboardingJourney && firstPack && story._id !== firstPack.story._id) {
        return;
      }
      storyPackUnlockUxService.markPackOpened(islandId, story._id);
      // Story intro plays only after icon tap (IslandScene), not on main map.
      const qs = `?storyId=${encodeURIComponent(story._id)}`;
      navigate(`/sail/${encodeURIComponent(islandId)}/lesson${qs}`, {
        state: {
          title: label,
          heroImageUrl: resolveBibleMapMediaUrl(story.heroImageUrl) || undefined,
          fromMainMap: true,
          fromSail: Boolean(navState?.fromSail),
          onboardingJourney: Boolean(onboardingJourney),
        },
      });
    },
    [navigate, islandId, stories, navState?.fromSail, showLockHint, onboardingJourney, firstPack],
  );

  useEffect(() => {
    const need = Boolean((location.state as { needAccount?: boolean } | null)?.needAccount);
    if (!need) return;
    navigate('/onboarding/welcome', {
      replace: true,
      state: {
        returnTo: `/map/${encodeURIComponent(islandId)}/main`,
        reason: 'continue-journey',
      },
    });
  }, [location.state, islandId, navigate]);

  const hasVideo = Boolean(mainMapVideoUrl);
  const hasImage = Boolean(mainMapUrl);
  const hasBg = hasVideo || hasImage;

  return (
    <div className="fixed inset-0 z-[70] text-white overflow-hidden" style={{ background: skyColor }}>
      {/* Full island. Until its size is known, contain keeps the edges on screen. */}
      {hasVideo ? (
        <video
          key={mainMapVideoUrl}
          src={mainMapVideoUrl}
          className="absolute select-none"
          style={
            stage
              ? {
                  left: stage.left,
                  top: stage.top,
                  width: stage.width,
                  height: stage.height,
                  maxWidth: 'none',
                  maxHeight: 'none',
                }
              : { inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }
          }
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={mainMapUrl || undefined}
          onLoadedMetadata={(e) =>
            noteMediaSize(e.currentTarget, e.currentTarget.videoWidth, e.currentTarget.videoHeight)
          }
          onError={() => setMediaFailed(true)}
        />
      ) : hasImage ? (
        <img
          src={mainMapUrl}
          alt=""
          className="absolute select-none"
          style={
            stage
              ? {
                  left: stage.left,
                  top: stage.top,
                  width: stage.width,
                  height: stage.height,
                  maxWidth: 'none',
                  maxHeight: 'none',
                }
              : { inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom' }
          }
          draggable={false}
          onLoad={(e) =>
            noteMediaSize(e.currentTarget, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
          }
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, #2a6f9e 0%, #164868 45%, #0b1e33 100%)',
          }}
        />
      )}

      {/* Drifting sky clouds — overlay only the top band; does not affect icon % space */}
      <div
        className="absolute inset-x-0 top-0 z-[2] pointer-events-none overflow-hidden"
        style={{ height: 'min(28vh, 220px)' }}
        aria-hidden
      >
        <div
          className="main-map-sky-cloud-track"
          style={
            {
              '--cloud-loop-duration': reduceMotion
                ? '220s'
                : `${MAIN_MAP_SKY_CLOUD_LOOP_SEC}s`,
            } as React.CSSProperties
          }
        >
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="main-map-sky-cloud-strip"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {MAIN_MAP_SKY_CLOUDS.map((cloud) => (
                <img
                  key={`${copy}-${cloud.id}`}
                  src={cloud.src}
                  alt=""
                  draggable={false}
                  className="main-map-sky-cloud absolute max-w-none h-auto select-none"
                  style={{
                    width: `${cloud.widthPct}%`,
                    left: cloud.leftPct != null ? `${cloud.leftPct}%` : undefined,
                    right: cloud.rightPct != null ? `${cloud.rightPct}%` : undefined,
                    top: cloud.topPct != null ? `${cloud.topPct}%` : undefined,
                    opacity: cloud.opacity,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Soft vignette so labels stay readable */}
      <div
        className="absolute inset-0 pointer-events-none z-[3]"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
        }}
        aria-hidden
      />

      {/*
        Story icons sit on the fitted map. (x,y) is the badge center.
      */}
      {!loading && hasBg && placedMarkers.length > 0 && (stage || mediaFailed) && (
        <div
          className="absolute z-10"
          style={
            stage
              ? { left: stage.left, top: stage.top, width: stage.width, height: stage.height }
              : { inset: 0 }
          }
        >
          {placedMarkers.map((marker, index) => {
            const { story, place, box, iconUrl, label, locked, isNew } = marker;
            return (
              <button
                key={story._id}
                type="button"
                onClick={() => handleStoryTap(story, label, index)}
                className={`absolute flex items-center justify-center touch-manipulation focus:outline-none ${
                  locked || (onboardingJourney && firstPack && story._id !== firstPack.story._id)
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                style={{
                  left: `${place.x}%`,
                  top: `${place.y}%`,
                  width: `${box.w}%`,
                  height: `${box.h}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents:
                    onboardingJourney && firstPack && story._id !== firstPack.story._id
                      ? 'none'
                      : 'auto',
                  filter:
                    onboardingJourney && firstPack && story._id !== firstPack.story._id
                      ? 'grayscale(1) brightness(0.65)'
                      : undefined,
                  animation: reduceMotion
                    ? undefined
                    : `main-map-icon-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both`,
                  animationDelay: reduceMotion ? undefined : `${0.08 + index * 0.07}s`,
                }}
                aria-label={
                  locked ? `${label} (locked)` : isNew ? `${label} (new)` : label
                }
                aria-disabled={locked}
              >
                <span
                  className={`relative flex items-center justify-center w-full h-full transition-transform ${
                    locked ? '' : 'active:scale-95'
                  }`}
                >
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt=""
                      className={`max-w-full max-h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] pointer-events-none rounded-full ${
                        locked ? 'grayscale' : ''
                      }`}
                      draggable={false}
                    />
                  ) : (
                    <span
                      className={`flex items-center justify-center w-[90%] aspect-square rounded-full border-2 text-white shadow-md ${
                        locked
                          ? 'grayscale bg-emerald-700/70 border-emerald-400/60'
                          : 'bg-emerald-700/90 border-emerald-300'
                      }`}
                    >
                      <MapPin className="w-[42%] h-[42%]" strokeWidth={2.2} />
                    </span>
                  )}
                  {locked && <StoryLockBadge size={Math.min(40, 28 + Math.round(box.w))} />}
                  {!locked && isNew && <StoryPackNewBadge />}
                </span>
                <span
                  className="absolute left-1/2 top-full -translate-x-1/2 mt-0.5 text-[10px] sm:text-xs leading-tight font-display font-black text-white tracking-wide truncate max-w-[140%] text-center px-0.5 pointer-events-none"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {onboardingJourney && firstPack && (stage || mediaFailed) && (
        <div
          className="absolute z-30 pointer-events-none flex flex-col items-center"
          style={{
            left: stage
              ? stage.left + (firstPack.place.x / 100) * stage.width
              : `${firstPack.place.x}%`,
            top: stage
              ? stage.top + (firstPack.place.y / 100) * stage.height
              : `${firstPack.place.y}%`,
            transform: `translate(calc(-50% + ${hintNudge}px), calc(-100% - 18px))`,
          }}
        >
          <span ref={hintRef} className="ob-tap-story-pack">
            Tap the first story pack
          </span>
        </div>
      )}

      {/* Floating chrome — back (hidden during first-sail) + sound */}
      {!onboardingJourney && (
      <button
        type="button"
        onClick={handleBack}
        className="absolute z-30 left-3 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform pointer-events-auto"
        style={{
          ...woodBtnStyle,
          top: 'max(calc(var(--safe-area-top, 0px) + 8px), 12px)',
        }}
        aria-label="Back to ocean map"
      >
        <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
      </button>
      )}
      <button
        type="button"
        onClick={toggleSound}
        className="absolute z-30 right-3 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform pointer-events-auto"
        style={{
          ...woodBtnStyle,
          top: 'max(calc(var(--safe-area-top, 0px) + 8px), 12px)',
        }}
        aria-label={soundOn ? 'Sound off' : 'Sound on'}
      >
        {soundOn ? (
          <Volume2 size={20} className="text-white drop-shadow" strokeWidth={2.6} />
        ) : (
          <VolumeX size={20} className="text-white/80 drop-shadow" strokeWidth={2.6} />
        )}
      </button>

      <div className="absolute inset-0 z-20 pointer-events-none">
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 pointer-events-auto">
            <p className="font-display font-bold text-white/90 text-sm bg-black/40 px-4 py-2 rounded-xl">
              Loading map…
            </p>
          </div>
        )}

        {!loading && (loadError || !hasBg) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center pointer-events-auto">
            <p className="font-display font-black text-lg text-white drop-shadow">
              {loadError ? 'Couldn’t load this island map' : 'No main map yet'}
            </p>
            <p className="text-white/80 text-sm max-w-xs">
              {loadError
                ? 'Check your connection or try again from the ocean map.'
                : 'Add a main map video or PNG in the CMS, then publish the island.'}
            </p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-2 px-5 py-2.5 rounded-2xl font-display font-black text-[#3E1F07] border-2 border-[#B8860B] active:translate-y-[1px]"
              style={{
                background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                boxShadow: '0 3px 0 #8B6914',
              }}
            >
              Back to Map
            </button>
          </div>
        )}

        {/* Published island with no story packs yet. The ocean
            map taps straight in here now, so a kid can land on it: give the
            same wood-and-gold way out the load-error state has instead of a
            caption on an island they can do nothing with. */}
        {!loading && hasBg && markers.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center pointer-events-auto">
            <p className="font-display font-black text-lg text-white drop-shadow">
              No stories on this island yet!
            </p>
            <p className="text-white/80 text-sm max-w-xs">
              This one is still being built. Sail back and pick another island.
            </p>
            <button
              type="button"
              onClick={handleBack}
              className="mt-2 px-5 py-2.5 rounded-2xl font-display font-black text-[#3E1F07] border-2 border-[#B8860B] active:translate-y-[1px]"
              style={{
                background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                boxShadow: '0 3px 0 #8B6914',
              }}
            >
              Back to Map
            </button>
          </div>
        )}

        {lockHint && (
          <div
            className="absolute inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
            style={{ bottom: 'max(calc(var(--safe-area-bottom, 0px) + 48px), 56px)' }}
            role="status"
          >
            <p className="text-center text-sm font-display font-black text-[#3E1F07] px-4 py-2.5 rounded-2xl max-w-[90%] border-2 border-[#B8860B]"
              style={{
                background: 'linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%)',
                boxShadow: '0 3px 0 #8B6914, 0 6px 16px rgba(0,0,0,0.35)',
              }}
            >
              {lockHint}
            </p>
          </div>
        )}
      </div>

      <style>{`
        .main-map-sky-cloud-track {
          --cloud-loop-duration: 90s;
          display: flex;
          width: 200%;
          height: 100%;
          will-change: transform;
          backface-visibility: hidden;
          animation: main-map-sky-cloud-scroll var(--cloud-loop-duration) linear infinite;
        }
        .main-map-sky-cloud-strip {
          position: relative;
          flex: 0 0 50%;
          width: 50%;
          height: 100%;
        }
        .main-map-sky-cloud {
          filter: drop-shadow(0 2px 6px rgba(40, 80, 120, 0.18));
        }
        @keyframes main-map-sky-cloud-scroll {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @keyframes main-map-icon-pop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          55% { transform: translate(-50%, -50%) scale(1.14); opacity: 1; }
          75% { transform: translate(-50%, -50%) scale(0.94); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .ob-tap-story-pack {
          display: inline-flex;
          padding: 7px 14px;
          border-radius: 999px;
          font-family: inherit;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.03em;
          color: #3E1F07;
          white-space: nowrap;
          background: linear-gradient(180deg, #FFE55C 0%, #FFD700 45%, #DAA520 100%);
          border: 2px solid #B8860B;
          box-shadow: 0 3px 0 #8B6914, 0 8px 16px rgba(0,0,0,0.35);
          animation: ob-tap-story-bounce 1.15s ease-in-out infinite;
          text-shadow: 0 1px 0 rgba(255,255,255,0.45);
        }
        @keyframes ob-tap-story-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .main-map-sky-cloud-track {
            --cloud-loop-duration: 220s;
          }
          @keyframes main-map-icon-pop {
            from { opacity: 1; transform: translate(-50%, -50%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        }
      `}</style>
      {celebration && (
        <PackUnlockCelebration payload={celebration} onDone={dismissCelebration} />
      )}
    </div>
  );
};

export default MainMapPage;
