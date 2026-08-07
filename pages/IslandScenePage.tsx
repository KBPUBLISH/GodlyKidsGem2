import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Check, Lock, Volume2, VolumeX, List } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import {
  islandStoryProgressService,
  type IslandStoryProgress,
} from '../services/islandStoryProgressService';
import { bookCompletionService } from '../services/bookCompletionService';
import { attachReliableLoop } from '../utils/audioLoop';
import RewardsLootModal from '../components/rewards/RewardsLootModal';
import {
  resolveRewardPool,
  rewardsService,
  type RewardDefinition,
} from '../services/rewardsService';

/** Public assets under Vite `public/` (respects base path). */
const publicAsset = (path: string): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${base}${path.replace(/^\//, '')}`;
};

const SCENE_BG_VIDEO = publicAsset('assets/videos/island-scene-bg.mp4');
const WOOD_TEX = publicAsset('assets/images/wheel-background-wood.png');
const ACTIVITIES_SIGN = `${publicAsset('assets/images/island-activities-sign.png')}?v=4`;
/** Built-in ACTIVITIES tray art (?v=4 = new Game Assets board + NoText icons). */
const ICON_READ = `${publicAsset('assets/images/island-activity-read-story.png')}?v=4`;
const ICON_QUIZ = `${publicAsset('assets/images/island-activity-quiz.png')}?v=4`;
const ICON_PUZZLE = `${publicAsset('assets/images/island-activity-puzzle.png')}?v=4`;
const ICON_COLORING = `${publicAsset('assets/images/island-activity-coloring.png')}?v=4`;
const ICON_REWARDS = `${publicAsset('assets/images/rewards-gamepad-icon.png')}?v=1`;
const ICON_GAME = `${publicAsset('assets/images/island-activity-game.png')}?v=4`;
const ICON_MENU = `${publicAsset('assets/images/island-activity-menu.png')}?v=3`;
const ICON_DIALOGUE = publicAsset('assets/images/dialogue-tap-to-talk.png');

const WHITE_FADE_MS = 800;
/** Arrival: scene mounts under white, then white fades out to reveal it. */
const ARRIVAL_WHITE_FADE_MS = 500;
/** Scene → white before a tap-to-talk / trigger animation starts. */
const TRIGGER_PRE_FADE_MS = 450;
const CMS_FETCH_TIMEOUT_MS = 2_000;
/**
 * New ACTIVITIES board has no post feet — keep flush to the bottom edge.
 * Safe-area padding is applied on the pinned tray container instead.
 */
const ACTIVITIES_BOARD_CROP = 0;

type SceneNavState = {
  title?: string;
  fromSail?: boolean;
  /** Came from island main map (CMS flow) — back goes to main map. */
  fromMainMap?: boolean;
  /** Return navigation (reader/quiz/etc.) — skip the arrival white fade. */
  skipIntro?: boolean;
} | null;

/** Nav state when returning to main map (keeps sail in the back stack). */
type MainMapReturnState = {
  title?: string;
  fromSail?: boolean;
};

type ActivityId = 'read' | 'quiz' | 'puzzle' | 'coloring' | 'rewards';
type CmsActivityId = ActivityId | 'game';

type ActivityDef = {
  id: ActivityId;
  label: string;
  iconSrc: string;
  locked: boolean;
  /** Rewards only: chest opened + reward game played — done, not clickable. */
  claimed?: boolean;
};

type SceneButtonLayout = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  iconUrl?: string;
  label?: string;
  lockedUntil?: 'always' | 'content' | 'trigger';
};

type SceneDeviceLayout = {
  showActivitiesBoard?: boolean;
  buttons?: SceneButtonLayout[];
};

type SceneAnimation = {
  id: string;
  label?: string;
  videoUrl: string;
};

type SceneTrigger = {
  id: string;
  fromButtonId: string;
  animationId?: string;
  after?: 'navigate' | 'stay';
  navigateTo?: CmsActivityId | '';
};

const ACTIVITIES: ActivityDef[] = [
  { id: 'read', label: 'READ STORY', iconSrc: ICON_READ, locked: false },
  { id: 'quiz', label: 'QUIZZ', iconSrc: ICON_QUIZ, locked: true },
  { id: 'puzzle', label: 'PUZZLE', iconSrc: ICON_PUZZLE, locked: true },
  { id: 'coloring', label: 'COLORING', iconSrc: ICON_COLORING, locked: true },
  { id: 'rewards', label: 'REWARDS', iconSrc: ICON_REWARDS, locked: true },
];

const ACTIVITY_ICON: Record<ActivityId, string> = {
  read: ICON_READ,
  quiz: ICON_QUIZ,
  puzzle: ICON_PUZZLE,
  coloring: ICON_COLORING,
  rewards: ICON_REWARDS,
};

const isActivityId = (id: string): boolean =>
  id === 'read' ||
  id === 'quiz' ||
  id === 'puzzle' ||
  id === 'coloring' ||
  id === 'rewards' ||
  id === 'game';

const normalizeActivityId = (id: string): ActivityId | null => {
  if (id === 'game' || id === 'rewards') return 'rewards';
  if (id === 'read' || id === 'quiz' || id === 'puzzle' || id === 'coloring') return id;
  return null;
};

const activityIconFor = (id: string): string => {
  const n = normalizeActivityId(id);
  return (n && ACTIVITY_ICON[n]) || ICON_REWARDS;
};

/** Reject empty / placeholder CMS media strings. */
const isUsableMediaUrl = (url: string | undefined | null): boolean => {
  const t = (url || '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return lower !== 'null' && lower !== 'undefined';
};

/**
 * Prefer CMS absolute layout only when editors uploaded at least one button icon.
 * Position-only defaults from Scene Studio (no iconUrl) → built-in ACTIVITIES tray.
 */
const cmsLayoutHasCustomIcons = (buttons: SceneButtonLayout[] | undefined): boolean =>
  Array.isArray(buttons) &&
  buttons.length > 0 &&
  buttons.some((b) => isUsableMediaUrl(b.iconUrl));

type ActivityIconProps = {
  /** Optional CMS override (may 404). Built-in tray omits this. */
  primarySrc?: string;
  /** Bundled local PNG for this activity — always preferred when CMS fails. */
  localSrc: string;
  locked?: boolean;
  imgClassName?: string;
};

/**
 * Show real activity PNG art (never Lucide substitutes).
 * Order: CMS URL (if any) → local `/assets/images/island-activity-*.png`.
 * Locked: grayscale filter; gold padlock is rendered by the parent overlay.
 */
const ActivityIcon: React.FC<ActivityIconProps> = ({
  primarySrc,
  localSrc,
  locked = false,
  imgClassName = '',
}) => {
  // Local first when no CMS icon; when CMS is present try it then fall back to local art.
  const candidates = (
    isUsableMediaUrl(primarySrc) ? [primarySrc!, localSrc] : [localSrc]
  ).filter(
    (src, i, arr): src is string =>
      isUsableMediaUrl(src) && arr.indexOf(src) === i,
  );
  const [srcIndex, setSrcIndex] = useState(0);
  const src = candidates[Math.min(srcIndex, Math.max(candidates.length - 1, 0))];

  if (!src) return null;

  return (
    <img
      key={src}
      src={src}
      alt=""
      className={`${imgClassName} ${locked ? 'grayscale' : ''}`}
      draggable={false}
      onError={() => {
        if (srcIndex + 1 < candidates.length) {
          setSrcIndex((i) => i + 1);
        }
      }}
    />
  );
};

/** Gold padlock badge over locked activity art (matches reference board). */
const ActivityLockBadge: React.FC<{ size?: number }> = ({ size = 32 }) => (
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

/** Green check badge over the REWARDS post once its game reward was played. */
const ActivityClaimedBadge: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <span
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    aria-hidden
  >
    <span
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle at 35% 30%, #7ed491, #2E7D32 55%, #1B5E20)',
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(220,255,225,0.5)',
        border: '1.5px solid #C8E6C9',
      }}
    >
      <Check
        size={Math.round(size * 0.55)}
        className="text-white"
        strokeWidth={3}
      />
    </span>
  </span>
);

/** Activities that show a "New" tag until the kid first opens them (per story). */
const NEW_BADGE_ACTIVITIES: ReadonlyArray<ActivityId> = ['puzzle', 'coloring', 'rewards'];

const seenActivityStorageKey = (storyKey: string, activityId: ActivityId): string =>
  `gk_seen_activity_${storyKey}_${activityId}`;

const readSeenActivities = (storyKey: string): ReadonlySet<ActivityId> => {
  const seen = new Set<ActivityId>();
  if (!storyKey) return seen;
  try {
    for (const id of NEW_BADGE_ACTIVITIES) {
      if (window.localStorage.getItem(seenActivityStorageKey(storyKey, id))) {
        seen.add(id);
      }
    }
  } catch {
    /* storage unavailable — no badges persist */
  }
  return seen;
};

const writeSeenActivity = (storyKey: string, activityId: ActivityId): void => {
  if (!storyKey) return;
  try {
    window.localStorage.setItem(seenActivityStorageKey(storyKey, activityId), '1');
  } catch {
    /* ignore */
  }
};

/** Bright "New" pill over unlocked-but-not-yet-opened activity buttons. */
const ActivityNewBadge: React.FC = () => (
  <span
    className="absolute z-[2] pointer-events-none select-none font-display font-black uppercase text-white"
    style={{
      top: '3%',
      right: '2%',
      fontSize: '0.5rem',
      lineHeight: 1,
      letterSpacing: '0.06em',
      padding: '3px 7px 2px',
      borderRadius: 9999,
      background: 'linear-gradient(180deg, #FFB03B 0%, #F4511E 100%)',
      border: '1.5px solid rgba(255,255,255,0.9)',
      boxShadow: '0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,235,200,0.6)',
      textShadow: '0 1px 2px rgba(0,0,0,0.35)',
      animation: 'gk-new-badge-wiggle 2.4s ease-in-out infinite',
    }}
    aria-hidden
  >
    New
    <style>{`@keyframes gk-new-badge-wiggle{0%,20%,100%{transform:rotate(-4deg) scale(1)}6%{transform:rotate(5deg) scale(1.12)}12%{transform:rotate(-4deg) scale(1)}}`}</style>
  </span>
);

const TABLET_MIN_WIDTH = 768;

/** Content present in CMS (independent of kid progress). */
type ActivityContent = {
  available: boolean;
  storyId?: string;
};

/** MapStory.rewards pool (plus sensible defaults). */
type RewardsContent = {
  available: boolean;
  storyId?: string;
  title?: string;
  pool: RewardDefinition[];
};

type SceneProgress = IslandStoryProgress;

const storyHasQuizContent = (s: {
  quizMode?: string;
  bookId?: unknown;
  customQuestions?: unknown[];
  quiz?: {
    levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
  };
}): boolean => {
  if (!s || s.quizMode === 'none') return false;
  const levels = s.quiz?.levels;
  const leveled =
    (Array.isArray(levels?.easy) && levels!.easy!.length > 0) ||
    (Array.isArray(levels?.medium) && levels!.medium!.length > 0) ||
    (Array.isArray(levels?.hard) && levels!.hard!.length > 0);
  if (leveled) return true;
  if (Array.isArray(s.customQuestions) && s.customQuestions.length > 0) return true;
  if (s.quizMode === 'book_quiz' && s.bookId) return true;
  return false;
};

const SCENE_TITLE_BY_ISLAND: Record<string, string> = {
  genesis: '1. THE BEGINNING',
};

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

/** Resolve CMS media URLs (GCS absolute or /uploads relative) for <video src>. */
const resolveMediaUrl = (url: string | undefined | null): string => {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/assets/')
  ) {
    return trimmed;
  }
  const base = getApiBaseUrl().replace(/\/$/, '');
  // If base already ends with /api and url is /uploads/..., strip /api for static files
  const origin = base.replace(/\/api$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
};

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

/**
 * Island garden scene — revealed with a white fade-in after the sail map.
 * Fullscreen looping video BG, wood chrome, ACTIVITIES tray.
 * Standalone (no main WoodTabBar).
 */
const IslandScenePage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navState = location.state as SceneNavState;
  const storyIdParam = searchParams.get('storyId')?.trim() || '';

  const fallbackTitle =
    SCENE_TITLE_BY_ISLAND[islandId] ?? `1. ${titleCase(islandId).toUpperCase()}`;
  const mainMapPath = `/map/${encodeURIComponent(islandId)}/main`;
  const hubPath = `/sail/${islandId}/lesson/hub`;
  const puzzlePath = `/sail/${islandId}/lesson/puzzle`;
  const coloringPath = `/sail/${islandId}/lesson/coloring`;
  const quizPath = `/sail/${islandId}/lesson/quiz`;

  const [bgSrc, setBgSrc] = useState(SCENE_BG_VIDEO);
  const [cmsTitle, setCmsTitle] = useState<string | null>(null);
  const [quizContent, setQuizContent] = useState<ActivityContent>({ available: false });
  const [puzzleContent, setPuzzleContent] = useState<ActivityContent>({ available: false });
  const [coloringContent, setColoringContent] = useState<ActivityContent>({
    available: false,
  });
  const [rewardsContent, setRewardsContent] = useState<RewardsContent>({
    available: false,
    pool: [],
  });
  const [rewardsOpen, setRewardsOpen] = useState(false);
  /** Kid progress for the active story (localStorage). */
  const [sceneProgress, setSceneProgress] = useState<SceneProgress>({
    read: false,
    quiz: false,
  });
  /** Resolved story for this scene (URL storyId or first CMS story). */
  const [activeStoryId, setActiveStoryId] = useState('');
  const [sourcesReady, setSourcesReady] = useState(false);
  const [sceneLayoutPhone, setSceneLayoutPhone] = useState<SceneDeviceLayout | null>(
    null,
  );
  const [sceneLayoutTablet, setSceneLayoutTablet] = useState<SceneDeviceLayout | null>(
    null,
  );
  const [sceneAnimations, setSceneAnimations] = useState<SceneAnimation[]>([]);
  const [sceneTriggers, setSceneTriggers] = useState<SceneTrigger[]>([]);
  const [triggerVideoUrl, setTriggerVideoUrl] = useState<string | null>(null);
  /**
   * White fade around a wired button animation:
   * preWhiteIn / preWhiteOut = scene → white → reveal video;
   * whiteIn / whiteOut = end of clip → white → scene.
   */
  const [triggerFade, setTriggerFade] = useState<
    'idle' | 'preWhiteIn' | 'preWhiteOut' | 'whiteIn' | 'whiteOut'
  >('idle');
  const [sceneMusicSrc, setSceneMusicSrc] = useState<string | null>(null);
  const sceneMusicRef = useRef<HTMLAudioElement | null>(null);
  const sceneMusicLoopDetachRef = useRef<(() => void) | null>(null);
  const [isTablet, setIsTablet] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= TABLET_MIN_WIDTH,
  );
  const pendingNavigateRef = useRef<ActivityId | null>(null);
  const pendingTriggerUrlRef = useRef<string | null>(null);
  const finishingTriggerRef = useRef(false);
  const triggerFadeTimersRef = useRef<number[]>([]);

  const skipArrivalFadeOnMount =
    prefersReducedMotion() || Boolean(navState?.skipIntro);

  /** Arrival reveal: scene mounts under full white, white fades out once ready. */
  const [arrivalDone, setArrivalDone] = useState(skipArrivalFadeOnMount);
  const [whiteOpacity, setWhiteOpacity] = useState(() =>
    skipArrivalFadeOnMount ? 0 : 1,
  );

  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const triggerVideoRef = useRef<HTMLVideoElement>(null);
  /** Prefer sound on; if unmuted autoplay is blocked, fall back muted then unlock on next gesture. */
  const [sceneSoundOn, setSceneSoundOn] = useState(true);
  const [menuIconFailed, setMenuIconFailed] = useState(false);
  const [boardImgFailed, setBoardImgFailed] = useState(false);
  const sceneSoundOnRef = useRef(true);
  /** True after autoplay-with-sound was blocked — unmute on the next user gesture. */
  const pendingAutoUnmuteRef = useRef(false);
  useEffect(() => {
    sceneSoundOnRef.current = sceneSoundOn;
  }, [sceneSoundOn]);

  const sceneTitle = navState?.title || cmsTitle || fallbackTitle;

  useEffect(() => {
    const onResize = () => setIsTablet(window.innerWidth >= TABLET_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Resolve CMS scene BG video (story pack preferred, island fallback)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setSourcesReady(false);
    setBgSrc(SCENE_BG_VIDEO);
    setCmsTitle(null);
    setQuizContent({ available: false });
    setPuzzleContent({ available: false });
    setColoringContent({ available: false });
    setRewardsContent({ available: false, pool: [] });
    setRewardsOpen(false);
    setSceneProgress({ read: false, quiz: false });
    setActiveStoryId('');
    setSceneLayoutPhone(null);
    setSceneLayoutTablet(null);
    setSceneAnimations([]);
    setSceneTriggers([]);
    setSceneMusicSrc(null);

    const failSafe = window.setTimeout(() => {
      controller.abort();
      if (!cancelled) setSourcesReady(true);
    }, CMS_FETCH_TIMEOUT_MS);

    const load = async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          island?: {
            sceneBgVideoUrl?: string;
            description?: string;
            bookLabel?: string;
            title?: string;
          };
          stories?: Array<{
            _id?: string;
            order?: number;
            displayTitle?: string;
            sceneBgVideoUrl?: string;
            sceneMusicUrl?: string;
            sceneLayout?: {
              phone?: SceneDeviceLayout;
              tablet?: SceneDeviceLayout;
            };
            sceneAnimations?: SceneAnimation[];
            sceneTriggers?: SceneTrigger[];
            quizMode?: string;
            bookId?: unknown;
            customQuestions?: unknown[];
            quiz?: {
              levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
            };
            puzzle?: {
              enabled?: boolean;
              type?: string;
              imageUrl?: string;
            };
            coloringPageIds?: Array<
              | string
              | {
                  _id?: string;
                  tapFill?: { enabled?: boolean; regionMapUrl?: string };
                  backgroundUrl?: string;
                  files?: { background?: { url?: string } };
                }
            >;
            game?: {
              enabled?: boolean;
              kind?: 'catalog' | 'webview' | 'none';
              gameId?: string;
              webview?: {
                title?: string;
                url?: string;
                coverImage?: string;
                description?: string;
              };
            };
          }>;
        };
        const island = data.island;
        if (cancelled || !island) return;

        const stories = Array.isArray(data.stories) ? data.stories : [];
        const sorted = [...stories].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        const primaryStory =
          (storyIdParam
            ? sorted.find((s) => s._id === storyIdParam)
            : undefined) || sorted[0];
        const resolvedStoryId = primaryStory?._id || '';
        if (resolvedStoryId) setActiveStoryId(resolvedStoryId);

        const cmsBg = resolveMediaUrl(
          primaryStory?.sceneBgVideoUrl || island.sceneBgVideoUrl,
        );
        if (cmsBg) setBgSrc(cmsBg);
        const cmsMusic = resolveMediaUrl(primaryStory?.sceneMusicUrl);
        setSceneMusicSrc(cmsMusic || null);

        if (primaryStory?.sceneLayout?.phone?.buttons?.length) {
          setSceneLayoutPhone(primaryStory.sceneLayout.phone);
        }
        if (primaryStory?.sceneLayout?.tablet?.buttons?.length) {
          setSceneLayoutTablet(primaryStory.sceneLayout.tablet);
        }
        if (Array.isArray(primaryStory?.sceneAnimations)) {
          setSceneAnimations(
            primaryStory.sceneAnimations.filter(
              (a) => a && a.id && a.videoUrl,
            ),
          );
        }
        if (Array.isArray(primaryStory?.sceneTriggers)) {
          setSceneTriggers(
            primaryStory.sceneTriggers.filter((t) => t && t.id && t.fromButtonId),
          );
        }

        const label =
          (primaryStory?.displayTitle && primaryStory.displayTitle.trim()) ||
          (island.description && island.description.trim()) ||
          (island.bookLabel && island.bookLabel.trim()) ||
          (island.title && island.title.trim()) ||
          '';
        if (label) setCmsTitle(label.toUpperCase());

        const storyHasPuzzle = (s: (typeof stories)[number] | undefined) =>
          !!(
            s?.puzzle?.enabled &&
            s.puzzle?.type === 'sliding_image' &&
            s.puzzle?.imageUrl &&
            String(s.puzzle.imageUrl).trim()
          );
        const puzzleStory = storyHasPuzzle(primaryStory)
          ? primaryStory
          : stories.find(storyHasPuzzle);
        setPuzzleContent(
          puzzleStory
            ? { available: true, storyId: puzzleStory._id }
            : { available: false },
        );

        const storyHasColoring = (s: (typeof stories)[number] | undefined) => {
          const ids = s?.coloringPageIds;
          return Array.isArray(ids) && ids.length > 0;
        };
        const coloringStory = storyHasColoring(primaryStory)
          ? primaryStory
          : stories.find(storyHasColoring);
        setColoringContent(
          coloringStory
            ? { available: true, storyId: coloringStory._id }
            : { available: false },
        );

        const quizStory =
          primaryStory && storyHasQuizContent(primaryStory)
            ? primaryStory
            : stories.find((s) => storyHasQuizContent(s));
        setQuizContent(
          quizStory
            ? { available: true, storyId: quizStory._id }
            : { available: false },
        );

        // Rewards: available after read+quiz (defaults if CMS pool empty).
        const rewardsStory = primaryStory || stories[0];
        if (rewardsStory) {
          const pool = resolveRewardPool(
            rewardsStory as Parameters<typeof resolveRewardPool>[0],
          );
          setRewardsContent({
            available: true,
            storyId: String(rewardsStory._id),
            title:
              (rewardsStory.displayTitle &&
                String(rewardsStory.displayTitle).trim()) ||
              (rewardsStory.title && String(rewardsStory.title).trim()) ||
              undefined,
            pool,
          });
        } else {
          setRewardsContent({
            available: true,
            storyId: storyIdParam || '',
            pool: resolveRewardPool(null),
          });
        }

        // Sync read progress from book completion if kid finished this pack's book before
        if (resolvedStoryId && primaryStory) {
          const bookRaw = primaryStory.bookId;
          const bookId =
            typeof bookRaw === 'object' &&
            bookRaw &&
            '_id' in (bookRaw as object) &&
            (bookRaw as { _id?: string })._id
              ? String((bookRaw as { _id?: string })._id)
              : bookRaw
                ? String(bookRaw)
                : '';
          if (bookId && bookCompletionService.isBookCompleted(bookId)) {
            islandStoryProgressService.markComplete(
              islandId,
              resolvedStoryId,
              'read',
            );
          }
          setSceneProgress(
            islandStoryProgressService.get(islandId, resolvedStoryId),
          );
        }
      } catch {
        /* keep bundled fallbacks (incl. abort on timeout) */
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setSourcesReady(true);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(failSafe);
    };
  }, [islandId, storyIdParam]);

  // Re-read progress whenever we land on the scene (e.g. return from reader/quiz)
  useEffect(() => {
    const sid = storyIdParam || activeStoryId;
    if (!sid) return;
    setSceneProgress(islandStoryProgressService.get(islandId, sid));
  }, [islandId, storyIdParam, activeStoryId, location.key]);

  /** Per-story "New" badge seen-state (persisted in localStorage). */
  const sceneStoryKey = storyIdParam || activeStoryId || `island-${islandId}`;
  const [seenActivities, setSeenActivities] = useState<ReadonlySet<ActivityId>>(
    () => readSeenActivities(sceneStoryKey),
  );
  useEffect(() => {
    setSeenActivities(readSeenActivities(sceneStoryKey));
  }, [sceneStoryKey, location.key]);

  const markActivitySeen = useCallback(
    (id: ActivityId) => {
      if (!NEW_BADGE_ACTIVITIES.includes(id)) return;
      writeSeenActivity(sceneStoryKey, id);
      setSeenActivities((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [sceneStoryKey],
  );

  /** "New" = unlocked, badge-eligible, and never opened by this kid. */
  const isNewActivity = useCallback(
    (id: ActivityId, locked: boolean): boolean =>
      !locked && NEW_BADGE_ACTIVITIES.includes(id) && !seenActivities.has(id),
    [seenActivities],
  );

  // Arrival reveal — once sources are ready, fade the white overlay out.
  useEffect(() => {
    if (arrivalDone || !sourcesReady) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWhiteOpacity(0));
    });
    const doneId = window.setTimeout(() => {
      setArrivalDone(true);
    }, ARRIVAL_WHITE_FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(doneId);
    };
  }, [arrivalDone, sourcesReady]);

  // Keep all scene videos in sync with the sound toggle
  useEffect(() => {
    for (const ref of [bgVideoRef, triggerVideoRef]) {
      const el = ref.current;
      if (el) el.muted = !sceneSoundOn;
    }
  }, [sceneSoundOn]);

  // Looping scene background — starts as soon as sources resolve
  useEffect(() => {
    if (!sourcesReady) return;
    const bg = bgVideoRef.current;
    if (!bg) return;
    let cancelled = false;
    bg.loop = true;
    bg.playsInline = true;
    const start = async () => {
      // Prefer unmuted — navigation taps (Sail / story) often unlock audio.
      bg.muted = !sceneSoundOnRef.current;
      try {
        await bg.play();
      } catch {
        if (cancelled) return;
        // Autoplay with sound blocked — fall back muted; toggle re-enables.
        bg.muted = true;
        sceneSoundOnRef.current = false;
        setSceneSoundOn(false);
        pendingAutoUnmuteRef.current = true;
        void bg.play().catch(() => {
          /* autoplay may still fail; poster stays */
        });
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [sourcesReady, bgSrc]);

  const toggleSceneSound = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Manual toggle wins over pending auto-unmute from autoplay policy
    pendingAutoUnmuteRef.current = false;
    setSceneSoundOn((on) => {
      const next = !on;
      for (const ref of [bgVideoRef, triggerVideoRef]) {
        const el = ref.current;
        if (!el) continue;
        el.muted = !next;
        if (next && el.paused) {
          void el.play().catch(() => {
            /* ignore */
          });
        }
      }
      const music = sceneMusicRef.current;
      if (music) {
        music.muted = !next;
        if (next && music.paused && !triggerVideoUrl) {
          void music.play().catch(() => {
            /* ignore — needs user gesture on some browsers */
          });
        }
      }
      return next;
    });
  }, [triggerVideoUrl]);

  // Scene background music — loops once revealed; muted with the sound toggle; paused during trigger clips
  useEffect(() => {
    sceneMusicLoopDetachRef.current?.();
    sceneMusicLoopDetachRef.current = null;
    if (sceneMusicRef.current) {
      sceneMusicRef.current.pause();
      sceneMusicRef.current = null;
    }
    if (!sceneMusicSrc) return;

    const audio = new Audio(sceneMusicSrc);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.35;
    audio.muted = !sceneSoundOnRef.current;
    sceneMusicRef.current = audio;
    sceneMusicLoopDetachRef.current = attachReliableLoop(audio, true);

    return () => {
      sceneMusicLoopDetachRef.current?.();
      sceneMusicLoopDetachRef.current = null;
      audio.pause();
      if (sceneMusicRef.current === audio) sceneMusicRef.current = null;
    };
  }, [sceneMusicSrc]);

  useEffect(() => {
    const music = sceneMusicRef.current;
    if (!music) return;
    music.muted = !sceneSoundOn;
  }, [sceneSoundOn]);

  useEffect(() => {
    const music = sceneMusicRef.current;
    if (!music || !sceneMusicSrc) return;
    const shouldPlay =
      sourcesReady &&
      arrivalDone &&
      !triggerVideoUrl &&
      triggerFade === 'idle' &&
      sceneSoundOn;
    if (shouldPlay) {
      void music.play().catch(() => {
        /* autoplay may be blocked until unmute tap */
      });
    } else {
      music.pause();
    }
  }, [sourcesReady, arrivalDone, triggerVideoUrl, triggerFade, sceneSoundOn, sceneMusicSrc]);

  const showWhite = !arrivalDone || triggerFade !== 'idle';
  const showScene = sourcesReady;
  const sceneInteractive = arrivalDone;

  const goHub = useCallback(() => {
    const storyId = storyIdParam || activeStoryId;
    const qs = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
    navigate(`${hubPath}${qs}`, {
      state: {
        title: navState?.title || cmsTitle || undefined,
        fromScene: true,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
      },
    });
  }, [
    navigate,
    hubPath,
    storyIdParam,
    activeStoryId,
    navState?.title,
    navState?.fromMainMap,
    navState?.fromSail,
    cmsTitle,
  ]);

  /** Menu (left) exits scene → island main map explore. */
  const goMainMap = useCallback(() => {
    const state: MainMapReturnState = {
      title: navState?.title || cmsTitle || undefined,
      // Keep sail in the back stack when arriving via sail, or when main map already had fromSail.
      fromSail: navState?.fromMainMap
        ? Boolean(navState?.fromSail)
        : true,
    };
    navigate(mainMapPath, { state });
  }, [
    navigate,
    mainMapPath,
    navState?.title,
    navState?.fromSail,
    navState?.fromMainMap,
    cmsTitle,
  ]);

  const activityReturnState = useCallback(
    () => ({
      title: navState?.title || cmsTitle || undefined,
      fromScene: true,
      fromMainMap: Boolean(navState?.fromMainMap),
      fromSail: Boolean(navState?.fromSail),
    }),
    [navState?.title, navState?.fromMainMap, navState?.fromSail, cmsTitle],
  );

  const goQuiz = useCallback(() => {
    const qs = quizContent.storyId
      ? `?storyId=${encodeURIComponent(quizContent.storyId)}`
      : '';
    navigate(`${quizPath}${qs}`, { state: activityReturnState() });
  }, [navigate, quizPath, quizContent.storyId, activityReturnState]);

  const goPuzzle = useCallback(() => {
    const qs = puzzleContent.storyId
      ? `?storyId=${encodeURIComponent(puzzleContent.storyId)}`
      : '';
    navigate(`${puzzlePath}${qs}`, { state: activityReturnState() });
  }, [navigate, puzzlePath, puzzleContent.storyId, activityReturnState]);

  const goColoring = useCallback(() => {
    const qs = coloringContent.storyId
      ? `?storyId=${encodeURIComponent(coloringContent.storyId)}`
      : '';
    navigate(`${coloringPath}${qs}`, { state: activityReturnState() });
  }, [navigate, coloringPath, coloringContent.storyId, activityReturnState]);

  const goRewards = useCallback(() => {
    const sid =
      rewardsContent.storyId || storyIdParam || activeStoryId || '';
    if (sid) {
      islandStoryProgressService.markComplete(islandId, sid, 'rewards');
      setSceneProgress(islandStoryProgressService.get(islandId, sid));
    }
    // Reveal via the buried treasure digging game (chest opens → reward cards).
    navigate('/sail/treasure', {
      state: {
        storyId: sid,
        storyTitle: rewardsContent.title,
        pool: rewardsContent.pool,
        returnTo: `${location.pathname}${location.search || ''}`,
      },
    });
  }, [
    rewardsContent.storyId,
    rewardsContent.title,
    rewardsContent.pool,
    storyIdParam,
    activeStoryId,
    islandId,
    navigate,
    location.pathname,
    location.search,
  ]);

  const navigateToActivity = useCallback(
    (id: ActivityId) => {
      const normalized = normalizeActivityId(id) || id;
      if (normalized === 'read') goHub();
      else if (normalized === 'quiz') goQuiz();
      else if (normalized === 'puzzle') goPuzzle();
      else if (normalized === 'coloring') goColoring();
      else if (normalized === 'rewards') goRewards();
    },
    [goHub, goQuiz, goPuzzle, goColoring, goRewards],
  );

  const clearTriggerFadeTimers = useCallback(() => {
    for (const id of triggerFadeTimersRef.current) window.clearTimeout(id);
    triggerFadeTimersRef.current = [];
  }, []);

  /** Fade scene to white, then mount/play the trigger video under a white fade-out. */
  const beginTriggerVideo = useCallback(
    (animUrl: string) => {
      pendingTriggerUrlRef.current = animUrl;
      finishingTriggerRef.current = false;

      if (prefersReducedMotion()) {
        pendingTriggerUrlRef.current = null;
        setTriggerFade('idle');
        setWhiteOpacity(0);
        setTriggerVideoUrl(animUrl);
        return;
      }

      clearTriggerFadeTimers();
      setTriggerVideoUrl(null);
      setTriggerFade('preWhiteIn');
      setWhiteOpacity(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setWhiteOpacity(1));
      });

      const peakId = window.setTimeout(() => {
        const url = pendingTriggerUrlRef.current;
        pendingTriggerUrlRef.current = null;
        if (!url) {
          setTriggerFade('idle');
          setWhiteOpacity(0);
          return;
        }
        // Video mounts under full white, then white fades out to reveal playback
        setTriggerVideoUrl(url);
        setTriggerFade('preWhiteOut');
        setWhiteOpacity(0);
        const doneId = window.setTimeout(() => {
          setTriggerFade('idle');
        }, TRIGGER_PRE_FADE_MS);
        triggerFadeTimersRef.current.push(doneId);
      }, TRIGGER_PRE_FADE_MS);
      triggerFadeTimersRef.current.push(peakId);
    },
    [clearTriggerFadeTimers],
  );

  const finishTriggerVideo = useCallback(() => {
    if (finishingTriggerRef.current) return;
    finishingTriggerRef.current = true;

    if (pendingAutoUnmuteRef.current) {
      pendingAutoUnmuteRef.current = false;
      sceneSoundOnRef.current = true;
      setSceneSoundOn(true);
    }

    const video = triggerVideoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    }

    const next = pendingNavigateRef.current;

    if (prefersReducedMotion()) {
      pendingNavigateRef.current = null;
      setTriggerVideoUrl(null);
      setTriggerFade('idle');
      setWhiteOpacity(0);
      finishingTriggerRef.current = false;
      if (next) navigateToActivity(next);
      return;
    }

    clearTriggerFadeTimers();
    setTriggerFade('whiteIn');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setWhiteOpacity(1));
    });

    const peakId = window.setTimeout(() => {
      // Reveal scene under full white, then fade white out
      setTriggerVideoUrl(null);
      setTriggerFade('whiteOut');
      setWhiteOpacity(0);
      const doneId = window.setTimeout(() => {
        setTriggerFade('idle');
        pendingNavigateRef.current = null;
        finishingTriggerRef.current = false;
        if (next) navigateToActivity(next);
      }, WHITE_FADE_MS);
      triggerFadeTimersRef.current.push(doneId);
    }, WHITE_FADE_MS);
    triggerFadeTimersRef.current.push(peakId);
  }, [clearTriggerFadeTimers, navigateToActivity]);

  useEffect(() => {
    if (!triggerVideoUrl) return;
    finishingTriggerRef.current = false;
    const video = triggerVideoRef.current;
    if (!video) return;
    let cancelled = false;
    let unlockSound: (() => void) | null = null;

    const detachUnlock = () => {
      if (!unlockSound) return;
      window.removeEventListener('click', unlockSound);
      window.removeEventListener('keydown', unlockSound);
      unlockSound = null;
    };

    const play = async () => {
      video.playsInline = true;
      const wantSound = sceneSoundOnRef.current;
      video.muted = !wantSound;
      try {
        await video.play();
      } catch {
        if (cancelled) return;
        if (wantSound) {
          video.muted = true;
          sceneSoundOnRef.current = false;
          setSceneSoundOn(false);
          pendingAutoUnmuteRef.current = true;
          try {
            await video.play();
          } catch {
            if (!cancelled) finishTriggerVideo();
            return;
          }
          if (cancelled) return;
          unlockSound = () => {
            if (cancelled || !pendingAutoUnmuteRef.current) return;
            pendingAutoUnmuteRef.current = false;
            detachUnlock();
            video.muted = false;
            sceneSoundOnRef.current = true;
            setSceneSoundOn(true);
            if (video.paused) {
              void video.play().catch(() => {
                /* ignore */
              });
            }
          };
          window.addEventListener('click', unlockSound);
          window.addEventListener('keydown', unlockSound);
        } else {
          if (!cancelled) finishTriggerVideo();
        }
      }
    };
    void play();
    return () => {
      cancelled = true;
      detachUnlock();
    };
  }, [triggerVideoUrl, finishTriggerVideo]);

  useEffect(() => () => clearTriggerFadeTimers(), [clearTriggerFadeTimers]);

  /** Activity tray or CMS-placed button (incl. dialogue / tap-to-talk). */
  const onSceneButton = useCallback(
    (id: string, locked: boolean) => {
      if (
        locked ||
        !sceneInteractive ||
        triggerVideoUrl ||
        triggerFade !== 'idle'
      ) {
        return;
      }

      const tappedActivity = normalizeActivityId(id);
      if (tappedActivity) markActivitySeen(tappedActivity);

      const trigger = sceneTriggers.find((t) => t.fromButtonId === id);
      const anim = trigger?.animationId
        ? sceneAnimations.find((a) => a.id === trigger.animationId)
        : undefined;
      const animUrl = resolveMediaUrl(anim?.videoUrl);

      if (trigger && animUrl) {
        const navTarget =
          trigger.after === 'stay'
            ? null
            : trigger.navigateTo && normalizeActivityId(trigger.navigateTo)
              ? normalizeActivityId(trigger.navigateTo)
              : normalizeActivityId(id);
        pendingNavigateRef.current = navTarget;
        beginTriggerVideo(animUrl);
        return;
      }

      if (isActivityId(id)) {
        const next = normalizeActivityId(id);
        if (next) navigateToActivity(next);
      }
    },
    [
      sceneInteractive,
      triggerVideoUrl,
      triggerFade,
      sceneTriggers,
      sceneAnimations,
      navigateToActivity,
      beginTriggerVideo,
      markActivitySeen,
    ],
  );

  const onActivity = useCallback(
    (id: ActivityId, locked: boolean) => onSceneButton(id, locked),
    [onSceneButton],
  );

  /**
   * Rewards become "Claimed" (check mark, not clickable) as soon as this
   * story's treasure chest was dug up and its rewards collected. Re-read on
   * each visit (location.key) so returning from the dig reflects the state.
   */
  const rewardsStorySid =
    rewardsContent.storyId || storyIdParam || activeStoryId || '';
  const rewardsClaimed = useMemo(
    () =>
      rewardsStorySid
        ? rewardsService.hasCollectedStoryRewards(rewardsStorySid)
        : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rewardsStorySid, location.key],
  );

  /**
   * Product unlock rules (prefer over sequential CMS unlockOrder):
   * - read: always open
   * - quiz: after read (and CMS has quiz content)
   * - puzzle / coloring / rewards: after BOTH read + quiz (and CMS has that content)
   * If the story has no quiz content, quiz is skipped so read alone unlocks the rest.
   */
  const activities = useMemo(() => {
    const readDone = sceneProgress.read;
    const quizDone = sceneProgress.quiz || !quizContent.available;
    const gatesOpen = readDone && quizDone;

    return ACTIVITIES.map((a) => {
      if (a.id === 'read') return { ...a, locked: false };
      if (a.id === 'quiz') {
        return {
          ...a,
          locked: !(quizContent.available && readDone),
        };
      }
      if (a.id === 'puzzle') {
        return {
          ...a,
          locked: !(puzzleContent.available && gatesOpen),
        };
      }
      if (a.id === 'coloring') {
        return {
          ...a,
          locked: !(coloringContent.available && gatesOpen),
        };
      }
      if (a.id === 'rewards') {
        // Same gate as former Game: unlock after read+quiz
        return {
          ...a,
          locked: !gatesOpen,
          claimed: rewardsClaimed && gatesOpen,
        };
      }
      return a;
    });
  }, [
    sceneProgress.read,
    sceneProgress.quiz,
    quizContent.available,
    puzzleContent.available,
    coloringContent.available,
    rewardsClaimed,
  ]);

  const cmsDeviceLayout = isTablet
    ? sceneLayoutTablet || sceneLayoutPhone
    : sceneLayoutPhone || sceneLayoutTablet;
  // Icon-less Scene Studio defaults must not replace the built-in tray
  const useCmsButtons = cmsLayoutHasCustomIcons(cmsDeviceLayout?.buttons);
  const showActivitiesBoard = cmsDeviceLayout?.showActivitiesBoard !== false;
  /**
   * When Scene Studio uploaded activity icons + board chrome, stale absolute %
   * (often y≈72) float above the flush-bottom plank. Pin those activities into
   * the board tray; keep dialogue / custom hotspots on free CMS coords.
   */
  const pinCmsActivitiesToBoard = useCmsButtons && showActivitiesBoard;
  const cmsButtons = cmsDeviceLayout?.buttons ?? [];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#1a4a28]">
      {!sourcesReady && (
        <div className="absolute inset-0 z-30 bg-black" aria-busy="true" aria-label="Loading scene" />
      )}

      {showScene && (
        <>
          {/* Looping garden scene video */}
          <div className="absolute inset-0" aria-hidden>
            <video
              ref={bgVideoRef}
              key={bgSrc}
              src={bgSrc}
              className="absolute inset-0 w-full h-full object-cover"
              muted={!sceneSoundOn}
              loop
              playsInline
              autoPlay
              preload="auto"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/15 pointer-events-none" />
          </div>

          <div
            className="relative z-10 flex flex-col h-full"
            style={{
              paddingTop: 'max(var(--safe-area-top, 0px), 8px)',
              /* Bottom safe-area is applied on the pinned ACTIVITIES board */
              pointerEvents: sceneInteractive ? 'auto' : 'none',
            }}
            aria-hidden={!sceneInteractive}
          >
            {/* Wood top bar */}
            <header
              className="relative mx-0 flex items-center gap-2 px-3 py-2.5"
              style={{
                backgroundImage: `url(${WOOD_TEX})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow:
                  '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.3), inset 0 -2px 4px rgba(60,30,8,0.25)',
                borderBottom: '3px solid #5c3a1a',
              }}
            >
              <button
                type="button"
                onClick={goMainMap}
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform overflow-hidden"
                style={woodBtnStyle}
                aria-label="Open island map"
                tabIndex={sceneInteractive ? 0 : -1}
              >
                {menuIconFailed ? (
                  <List size={20} className="text-white drop-shadow" strokeWidth={2.6} />
                ) : (
                  <img
                    src={ICON_MENU}
                    alt=""
                    className="w-9 h-9 object-contain"
                    draggable={false}
                    onError={() => setMenuIconFailed(true)}
                  />
                )}
              </button>

              <h1
                className="flex-1 text-center font-display font-black text-white text-[1.05rem] sm:text-lg tracking-wide truncate px-1"
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.55)' }}
              >
                {sceneTitle}
              </h1>

              <button
                type="button"
                onClick={toggleSceneSound}
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform"
                style={woodBtnStyle}
                aria-label={sceneSoundOn ? 'Mute scene sound' : 'Unmute scene sound'}
                tabIndex={sceneInteractive ? 0 : -1}
              >
                {sceneSoundOn ? (
                  <Volume2 size={20} className="text-white drop-shadow" strokeWidth={2.6} />
                ) : (
                  <VolumeX size={20} className="text-white/80 drop-shadow" strokeWidth={2.6} />
                )}
              </button>
            </header>

            {/* Garden mid band — spacer between header and activities board */}
            <div className="relative flex-1 min-h-0" aria-hidden />

            {/* CMS hotspots / free-placed buttons (% of full scene frame).
                Activity icons with board chrome are pinned into the tray below. */}
            {useCmsButtons &&
              cmsButtons
                .filter((btn) => !(pinCmsActivitiesToBoard && isActivityId(btn.id)))
                .map((btn) => {
                const activityId = normalizeActivityId(btn.id);
                const activity = activityId
                  ? activities.find((a) => a.id === activityId)
                  : undefined;
                // Dialogue / custom hotspot buttons stay tappable (not activity-gated).
                const locked = activity ? activity.locked : false;
                const claimed = Boolean(activity?.claimed);
                const inert = locked || claimed;
                const label = claimed
                  ? 'CLAIMED'
                  : btn.label ||
                    activity?.label ||
                    (activityId ? activityId.toUpperCase() : btn.id);
                const isDialogue =
                  btn.id === 'dialogue' || btn.id.startsWith('dialogue_');
                const localSrc =
                  activity?.iconSrc ||
                  (activityId ? activityIconFor(activityId) : undefined) ||
                  (isDialogue ? ICON_DIALOGUE : ICON_READ);
                const cmsIcon = isUsableMediaUrl(btn.iconUrl)
                  ? resolveMediaUrl(btn.iconUrl)
                  : '';
                // Without board chrome, pull legacy Scene Studio activity Y into the lower band.
                const topPct =
                  activityId && btn.y < 80 ? Math.min(88, btn.y + 14) : btn.y;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={inert || !sceneInteractive || triggerFade !== 'idle'}
                    onClick={() => onSceneButton(btn.id, inert)}
                    className={`absolute z-20 flex items-center justify-center active:scale-95 transition-transform ${
                      inert ? 'cursor-not-allowed' : ''
                    }`}
                    style={{
                      left: `${btn.x}%`,
                      top: `${topPct}%`,
                      width: `${btn.w}%`,
                      height: `${btn.h}%`,
                    }}
                    aria-label={
                      locked
                        ? `${label} (locked)`
                        : claimed
                          ? 'Rewards (claimed)'
                          : label
                    }
                    tabIndex={
                      sceneInteractive && !inert && triggerFade === 'idle' ? 0 : -1
                    }
                  >
                    <span className="relative flex items-center justify-center w-full h-full min-h-0">
                      <ActivityIcon
                        key={`${cmsIcon}|${localSrc}`}
                        primarySrc={cmsIcon || undefined}
                        localSrc={localSrc}
                        locked={inert}
                        imgClassName="max-w-full max-h-full object-contain drop-shadow-md"
                      />
                      {locked && <ActivityLockBadge size={32} />}
                      {claimed && <ActivityClaimedBadge size={32} />}
                      {activityId && isNewActivity(activityId, inert) && (
                        <ActivityNewBadge />
                      )}
                      {!isDialogue && (
                        <span
                          className="absolute left-0 right-0 z-[1] font-display font-black text-white text-[0.55rem] sm:text-[0.65rem] leading-tight tracking-wide text-center px-0.5 truncate pointer-events-none"
                          style={{
                            bottom: '16%',
                            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                          }}
                        >
                          {label}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}

            {/* ACTIVITIES wood sign + buttons (built-in tray, or CMS icons pinned to board) */}
            {(!useCmsButtons || pinCmsActivitiesToBoard) && (
              <div
                className="absolute left-0 right-0 z-10 mx-auto w-full px-1"
                style={{
                  maxWidth: 560,
                  bottom: 0,
                  paddingBottom: 'var(--safe-area-bottom, 0px)',
                  transform:
                    ACTIVITIES_BOARD_CROP > 0
                      ? `translateY(${ACTIVITIES_BOARD_CROP * 100}%)`
                      : undefined,
                }}
              >
                <div className="relative w-full">
                  {boardImgFailed ? (
                    <div
                      className="block w-full select-none pointer-events-none rounded-t-md"
                      style={{
                        aspectRatio: '1024 / 401',
                        background:
                          'linear-gradient(180deg, rgba(107,68,35,0.92) 0%, rgba(92,58,26,0.96) 45%, rgba(60,30,8,0.98) 100%)',
                        border: '2px solid #6B4423',
                        boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
                      }}
                      aria-hidden
                    />
                  ) : (
                    <img
                      src={ACTIVITIES_SIGN}
                      alt=""
                      className="block w-full h-auto select-none pointer-events-none"
                      draggable={false}
                      onError={() => setBoardImgFailed(true)}
                    />
                  )}

                  {/*
                    Board art: small ACTIVITIES header (~0–28%) + main plank (~30–100%).
                    Activity PNGs are the vertical button posts — labels overlay the
                    lower face of each post (not a flex sibling under the base beam).
                  */}
                  <div
                    className="absolute left-[5%] right-[5%] flex items-stretch justify-between gap-0.5 z-10"
                    style={{ top: '30%', bottom: '6%' }}
                  >
                    {activities.map((activity) => {
                      const claimed = Boolean(activity.claimed);
                      const locked = activity.locked;
                      const inert = locked || claimed;
                      const cmsBtn = pinCmsActivitiesToBoard
                        ? cmsButtons.find((b) => b.id === activity.id)
                        : undefined;
                      const label = claimed
                        ? 'CLAIMED'
                        : cmsBtn?.label || activity.label;
                      const cmsIcon = isUsableMediaUrl(cmsBtn?.iconUrl)
                        ? resolveMediaUrl(cmsBtn!.iconUrl)
                        : '';
                      return (
                        <button
                          key={activity.id}
                          type="button"
                          disabled={inert || !sceneInteractive || triggerFade !== 'idle'}
                          onClick={() => onActivity(activity.id, inert)}
                          className={`relative flex items-center justify-center flex-1 min-w-0 h-full active:scale-95 transition-transform ${
                            inert ? 'cursor-not-allowed' : ''
                          }`}
                          aria-label={
                            locked
                              ? `${label} (locked)`
                              : claimed
                                ? 'Rewards (claimed)'
                                : label
                          }
                          tabIndex={
                            sceneInteractive && !inert && triggerFade === 'idle'
                              ? 0
                              : -1
                          }
                        >
                          <span className="relative flex items-center justify-center w-full h-full min-h-0">
                            <ActivityIcon
                              key={`${cmsIcon}|${activity.iconSrc}`}
                              primarySrc={cmsIcon || undefined}
                              localSrc={activity.iconSrc}
                              locked={inert}
                              imgClassName="w-full h-full object-contain drop-shadow-md"
                            />
                            {locked && <ActivityLockBadge size={34} />}
                            {claimed && <ActivityClaimedBadge size={34} />}
                            {isNewActivity(activity.id, inert) && <ActivityNewBadge />}
                            <span
                              className="absolute left-0 right-0 z-[1] font-display font-black text-white text-[0.55rem] sm:text-[0.65rem] leading-tight tracking-wide text-center px-0.5 pointer-events-none"
                              style={{
                                bottom: '16%',
                                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                              }}
                            >
                              {label}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Button-triggered animation video overlay */}
      {triggerVideoUrl && (
        <div
          className="absolute inset-0 z-[60] bg-black"
          onClick={finishTriggerVideo}
          role="presentation"
        >
          <video
            ref={triggerVideoRef}
            key={triggerVideoUrl}
            src={triggerVideoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted={!sceneSoundOn}
            playsInline
            preload="auto"
            onEnded={finishTriggerVideo}
            onError={finishTriggerVideo}
            aria-label="Activity animation"
          />
          <button
            type="button"
            onClick={toggleSceneSound}
            className="absolute z-[61] flex items-center justify-center w-11 h-11 rounded-full bg-black/45 border border-white/35 active:scale-95 transition-transform"
            style={{
              top: 'max(var(--safe-area-top, 0px), 12px)',
              left: 16,
            }}
            aria-label={sceneSoundOn ? 'Mute animation' : 'Unmute animation'}
          >
            {sceneSoundOn ? (
              <Volume2 size={20} className="text-white" />
            ) : (
              <VolumeX size={20} className="text-white/85" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              finishTriggerVideo();
            }}
            className="absolute z-[61] px-4 py-2 rounded-full font-display font-bold text-sm text-white/95 bg-black/45 border border-white/35 active:scale-95 transition-transform"
            style={{
              top: 'max(var(--safe-area-top, 0px), 12px)',
              right: 16,
            }}
            aria-label="Skip animation"
          >
            Skip
          </button>
        </div>
      )}

      {showWhite && (
        <div
          className="absolute inset-0 z-[70] pointer-events-none"
          style={{
            background: '#ffffff',
            opacity: whiteOpacity,
            transition: `opacity ${
              triggerFade === 'preWhiteIn' || triggerFade === 'preWhiteOut'
                ? TRIGGER_PRE_FADE_MS
                : arrivalDone
                  ? WHITE_FADE_MS
                  : ARRIVAL_WHITE_FADE_MS
            }ms ease-in-out`,
          }}
          aria-hidden
        />
      )}

      <RewardsLootModal
        open={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        storyId={
          rewardsContent.storyId ||
          storyIdParam ||
          activeStoryId ||
          `island-${islandId}`
        }
        storyTitle={rewardsContent.title || sceneTitle}
        pool={
          rewardsContent.pool.length
            ? rewardsContent.pool
            : resolveRewardPool(null)
        }
      />
    </div>
  );
};

export default IslandScenePage;
