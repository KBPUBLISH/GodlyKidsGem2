import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Lock, Volume2, VolumeX } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { attachReliableLoop } from '../utils/audioLoop';

const INTRO_VIDEO = '/assets/videos/island-lesson-intro.mp4';
const SCENE_BG_VIDEO = '/assets/videos/island-scene-bg.mp4';
const WOOD_TEX = '/assets/images/wheel-background-wood.png';
const ACTIVITIES_SIGN = '/assets/images/island-activities-sign.png?v=2';
const ICON_READ = '/assets/images/island-activity-read-story.png';
const ICON_QUIZ = '/assets/images/island-activity-quiz.png';
const ICON_PUZZLE = '/assets/images/island-activity-puzzle.png';
const ICON_COLORING = '/assets/images/island-activity-coloring.png';
const ICON_GAME = '/assets/images/island-activity-game.png';
const ICON_MENU = '/assets/images/island-activity-menu.png';

const WHITE_FADE_MS = 800;
const INTRO_SAFETY_TIMEOUT_MS = 45_000;
const CMS_FETCH_TIMEOUT_MS = 2_000;
/**
 * Fraction of ACTIVITIES sign height sunk below the viewport so the post
 * feet crop off (mirrors sail wood-header top crop). Posts ≈ bottom 27% of
 * the asset; buttons sit above that (bottom: 34%). Keep crop ≲ 0.22 so
 * labels stay above the home indicator.
 */
const ACTIVITIES_BOARD_CROP = 0.2;

type IntroPhase = 'video' | 'whiteIn' | 'whiteOut' | 'done';

type SceneNavState = {
  title?: string;
  fromSail?: boolean;
  skipIntro?: boolean;
} | null;

type ActivityId = 'read' | 'quiz' | 'puzzle' | 'coloring' | 'game';

type ActivityDef = {
  id: ActivityId;
  label: string;
  iconSrc: string;
  locked: boolean;
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
  navigateTo?: ActivityId | '';
};

const ACTIVITIES: ActivityDef[] = [
  { id: 'read', label: 'READ STORY', iconSrc: ICON_READ, locked: false },
  { id: 'quiz', label: 'QUIZZ', iconSrc: ICON_QUIZ, locked: true },
  { id: 'puzzle', label: 'PUZZLE', iconSrc: ICON_PUZZLE, locked: true },
  { id: 'coloring', label: 'COLORING', iconSrc: ICON_COLORING, locked: true },
  { id: 'game', label: 'GAME', iconSrc: ICON_GAME, locked: true },
];

const ACTIVITY_ICON: Record<ActivityId, string> = {
  read: ICON_READ,
  quiz: ICON_QUIZ,
  puzzle: ICON_PUZZLE,
  coloring: ICON_COLORING,
  game: ICON_GAME,
};

const isActivityId = (id: string): id is ActivityId =>
  id === 'read' ||
  id === 'quiz' ||
  id === 'puzzle' ||
  id === 'coloring' ||
  id === 'game';

const TABLET_MIN_WIDTH = 768;

type PuzzleUnlock = {
  unlocked: boolean;
  storyId?: string;
};

type ColoringUnlock = {
  unlocked: boolean;
  storyId?: string;
};

type QuizUnlock = {
  unlocked: boolean;
  storyId?: string;
};

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
 * Island garden scene — after sail + intro video.
 * Fullscreen looping video BG, wood chrome, ACTIVITIES tray.
 * Standalone (no main WoodTabBar).
 */
const IslandScenePage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const location = useLocation();
  const navState = location.state as SceneNavState;

  const fallbackTitle =
    SCENE_TITLE_BY_ISLAND[islandId] ?? `1. ${titleCase(islandId).toUpperCase()}`;
  const sailBackPath = `/sail/${islandId}`;
  const hubPath = `/sail/${islandId}/lesson/hub`;
  const puzzlePath = `/sail/${islandId}/lesson/puzzle`;
  const coloringPath = `/sail/${islandId}/lesson/coloring`;
  const quizPath = `/sail/${islandId}/lesson/quiz`;

  const [introSrc, setIntroSrc] = useState(INTRO_VIDEO);
  const [bgSrc, setBgSrc] = useState(SCENE_BG_VIDEO);
  const [cmsTitle, setCmsTitle] = useState<string | null>(null);
  const [puzzleUnlock, setPuzzleUnlock] = useState<PuzzleUnlock>({ unlocked: false });
  const [coloringUnlock, setColoringUnlock] = useState<ColoringUnlock>({
    unlocked: false,
  });
  const [quizUnlock, setQuizUnlock] = useState<QuizUnlock>({ unlocked: false });
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
  const [sceneMusicSrc, setSceneMusicSrc] = useState<string | null>(null);
  const sceneMusicRef = useRef<HTMLAudioElement | null>(null);
  const sceneMusicLoopDetachRef = useRef<(() => void) | null>(null);
  const [isTablet, setIsTablet] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= TABLET_MIN_WIDTH,
  );
  const pendingNavigateRef = useRef<ActivityId | null>(null);

  const skipIntroOnMount =
    prefersReducedMotion() || Boolean(navState?.skipIntro);

  const [introPhase, setIntroPhase] = useState<IntroPhase>(() =>
    skipIntroOnMount ? 'done' : 'video',
  );
  const [whiteOpacity, setWhiteOpacity] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const triggerVideoRef = useRef<HTMLVideoElement>(null);
  /** Uploaded scene videos: start muted for autoplay; kid can unmute. */
  const [sceneSoundOn, setSceneSoundOn] = useState(false);
  const sceneSoundOnRef = useRef(false);
  useEffect(() => {
    sceneSoundOnRef.current = sceneSoundOn;
  }, [sceneSoundOn]);
  const phaseRef = useRef<IntroPhase>(introPhase);
  const fadeTimersRef = useRef<number[]>([]);
  const safetyTimerRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  const sceneTitle = navState?.title || cmsTitle || fallbackTitle;

  useEffect(() => {
    const onResize = () => setIsTablet(window.innerWidth >= TABLET_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Resolve CMS intro / scene BG videos (story pack preferred, island fallback)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setSourcesReady(false);
    setIntroSrc(INTRO_VIDEO);
    setBgSrc(SCENE_BG_VIDEO);
    setCmsTitle(null);
    setPuzzleUnlock({ unlocked: false });
    setColoringUnlock({ unlocked: false });
    setQuizUnlock({ unlocked: false });
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
            introVideoUrl?: string;
            sceneBgVideoUrl?: string;
            description?: string;
            bookLabel?: string;
            title?: string;
          };
          stories?: Array<{
            _id?: string;
            order?: number;
            displayTitle?: string;
            introVideoUrl?: string;
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
          }>;
        };
        const island = data.island;
        if (cancelled || !island) return;

        const stories = Array.isArray(data.stories) ? data.stories : [];
        const primaryStory = [...stories].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        )[0];

        const cmsIntro = resolveMediaUrl(
          primaryStory?.introVideoUrl || island.introVideoUrl,
        );
        const cmsBg = resolveMediaUrl(
          primaryStory?.sceneBgVideoUrl || island.sceneBgVideoUrl,
        );
        if (cmsIntro) setIntroSrc(cmsIntro);
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

        const puzzleStory = stories.find(
          (s) =>
            s.puzzle?.enabled &&
            s.puzzle?.type === 'sliding_image' &&
            s.puzzle?.imageUrl &&
            String(s.puzzle.imageUrl).trim(),
        );
        if (puzzleStory) {
          setPuzzleUnlock({
            unlocked: true,
            storyId: puzzleStory._id,
          });
        }

        const coloringStory = stories.find((s) => {
          const ids = s.coloringPageIds;
          return Array.isArray(ids) && ids.length > 0;
        });
        if (coloringStory) {
          setColoringUnlock({
            unlocked: true,
            storyId: coloringStory._id,
          });
        }

        const quizStory = stories.find((s) => storyHasQuizContent(s));
        if (quizStory) {
          setQuizUnlock({
            unlocked: true,
            storyId: quizStory._id,
          });
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
  }, [islandId]);

  useEffect(() => {
    phaseRef.current = introPhase;
  }, [introPhase]);

  const clearFadeTimers = useCallback(() => {
    for (const id of fadeTimersRef.current) window.clearTimeout(id);
    fadeTimersRef.current = [];
  }, []);

  const finishIntro = useCallback(() => {
    if (finishingRef.current) return;
    if (
      phaseRef.current === 'done' ||
      phaseRef.current === 'whiteIn' ||
      phaseRef.current === 'whiteOut'
    ) {
      return;
    }
    finishingRef.current = true;

    if (safetyTimerRef.current != null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    }

    if (prefersReducedMotion()) {
      setWhiteOpacity(0);
      setIntroPhase('done');
      return;
    }

    setIntroPhase('whiteIn');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setWhiteOpacity(1));
    });

    clearFadeTimers();
    const peakId = window.setTimeout(() => {
      setIntroPhase('whiteOut');
      setWhiteOpacity(0);
      const doneId = window.setTimeout(() => {
        setIntroPhase('done');
      }, WHITE_FADE_MS);
      fadeTimersRef.current.push(doneId);
    }, WHITE_FADE_MS);
    fadeTimersRef.current.push(peakId);
  }, [clearFadeTimers]);

  useEffect(() => {
    if (!sourcesReady || introPhase !== 'video') return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const tryPlay = async () => {
      video.playsInline = true;
      video.muted = !sceneSoundOnRef.current;
      try {
        await video.play();
        if (cancelled) return;
      } catch {
        if (cancelled) return;
        // Autoplay with sound often blocked — fall back muted, keep toggle available
        video.muted = true;
        setSceneSoundOn(false);
        try {
          await video.play();
        } catch {
          /* safety timeout / skip advances */
        }
      }
    };

    void tryPlay();

    safetyTimerRef.current = window.setTimeout(() => {
      finishIntro();
    }, INTRO_SAFETY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      if (safetyTimerRef.current != null) {
        window.clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  }, [introPhase, finishIntro, sourcesReady, introSrc]);

  useEffect(() => {
    return () => {
      clearFadeTimers();
      if (safetyTimerRef.current != null) {
        window.clearTimeout(safetyTimerRef.current);
      }
    };
  }, [clearFadeTimers]);

  // Keep all scene videos in sync with the sound toggle
  useEffect(() => {
    for (const ref of [videoRef, bgVideoRef, triggerVideoRef]) {
      const el = ref.current;
      if (el) el.muted = !sceneSoundOn;
    }
  }, [sceneSoundOn]);

  // Looping scene background once intro is done / revealing
  useEffect(() => {
    if (!sourcesReady || introPhase === 'video') return;
    const bg = bgVideoRef.current;
    if (!bg) return;
    bg.muted = !sceneSoundOnRef.current;
    bg.loop = true;
    bg.playsInline = true;
    void bg.play().catch(() => {
      /* autoplay may still fail; poster stays */
    });
  }, [introPhase, sourcesReady, bgSrc]);

  const toggleSceneSound = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSceneSoundOn((on) => {
      const next = !on;
      for (const ref of [videoRef, bgVideoRef, triggerVideoRef]) {
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

  // Scene background music — loops after intro; muted with the sound toggle; paused during trigger clips
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
      introPhase === 'done' &&
      !triggerVideoUrl &&
      sceneSoundOn;
    if (shouldPlay) {
      void music.play().catch(() => {
        /* autoplay may be blocked until unmute tap */
      });
    } else {
      music.pause();
    }
  }, [sourcesReady, introPhase, triggerVideoUrl, sceneSoundOn, sceneMusicSrc]);

  const showVideo =
    sourcesReady && (introPhase === 'video' || introPhase === 'whiteIn');
  const showWhite = introPhase === 'whiteIn' || introPhase === 'whiteOut';
  const showScene =
    sourcesReady &&
    (introPhase === 'whiteOut' || introPhase === 'done' || introPhase === 'whiteIn');
  const sceneInteractive = introPhase === 'done';

  const goHub = useCallback(() => {
    navigate(hubPath, {
      state: {
        title: navState?.title || cmsTitle || undefined,
        fromScene: true,
      },
    });
  }, [navigate, hubPath, navState?.title, cmsTitle]);

  const goQuiz = useCallback(() => {
    const qs = quizUnlock.storyId
      ? `?storyId=${encodeURIComponent(quizUnlock.storyId)}`
      : '';
    navigate(`${quizPath}${qs}`, {
      state: {
        title: navState?.title || cmsTitle || undefined,
        fromScene: true,
      },
    });
  }, [navigate, quizPath, quizUnlock.storyId, navState?.title, cmsTitle]);

  const goPuzzle = useCallback(() => {
    const qs = puzzleUnlock.storyId
      ? `?storyId=${encodeURIComponent(puzzleUnlock.storyId)}`
      : '';
    navigate(`${puzzlePath}${qs}`, {
      state: {
        title: navState?.title || cmsTitle || undefined,
        fromScene: true,
      },
    });
  }, [navigate, puzzlePath, puzzleUnlock.storyId, navState?.title, cmsTitle]);

  const goColoring = useCallback(() => {
    const qs = coloringUnlock.storyId
      ? `?storyId=${encodeURIComponent(coloringUnlock.storyId)}`
      : '';
    navigate(`${coloringPath}${qs}`, {
      state: {
        title: navState?.title || cmsTitle || undefined,
        fromScene: true,
      },
    });
  }, [navigate, coloringPath, coloringUnlock.storyId, navState?.title, cmsTitle]);

  const navigateToActivity = useCallback(
    (id: ActivityId) => {
      if (id === 'read') goHub();
      else if (id === 'quiz') goQuiz();
      else if (id === 'puzzle') goPuzzle();
      else if (id === 'coloring') goColoring();
      // game: reserved — no dedicated route yet
    },
    [goHub, goQuiz, goPuzzle, goColoring],
  );

  const finishTriggerVideo = useCallback(() => {
    const next = pendingNavigateRef.current;
    pendingNavigateRef.current = null;
    setTriggerVideoUrl(null);
    if (next) navigateToActivity(next);
  }, [navigateToActivity]);

  useEffect(() => {
    if (!triggerVideoUrl) return;
    const video = triggerVideoRef.current;
    if (!video) return;
    let cancelled = false;
    const play = async () => {
      video.playsInline = true;
      video.muted = !sceneSoundOnRef.current;
      try {
        await video.play();
      } catch {
        if (cancelled) return;
        video.muted = true;
        setSceneSoundOn(false);
        try {
          await video.play();
        } catch {
          if (!cancelled) finishTriggerVideo();
        }
      }
    };
    void play();
    return () => {
      cancelled = true;
    };
  }, [triggerVideoUrl, finishTriggerVideo]);

  const onActivity = useCallback(
    (id: ActivityId, locked: boolean) => {
      if (locked || !sceneInteractive || triggerVideoUrl) return;

      const trigger = sceneTriggers.find((t) => t.fromButtonId === id);
      const anim = trigger?.animationId
        ? sceneAnimations.find((a) => a.id === trigger.animationId)
        : undefined;
      const animUrl = resolveMediaUrl(anim?.videoUrl);

      if (trigger && animUrl) {
        const navTarget =
          trigger.after === 'stay'
            ? null
            : trigger.navigateTo && isActivityId(trigger.navigateTo)
              ? trigger.navigateTo
              : id;
        pendingNavigateRef.current = navTarget;
        setTriggerVideoUrl(animUrl);
        return;
      }

      navigateToActivity(id);
    },
    [
      sceneInteractive,
      triggerVideoUrl,
      sceneTriggers,
      sceneAnimations,
      navigateToActivity,
    ],
  );

  const activities = useMemo(
    () =>
      ACTIVITIES.map((a) => {
        if (a.id === 'quiz') return { ...a, locked: !quizUnlock.unlocked };
        if (a.id === 'puzzle') return { ...a, locked: !puzzleUnlock.unlocked };
        if (a.id === 'coloring') return { ...a, locked: !coloringUnlock.unlocked };
        return a;
      }),
    [quizUnlock.unlocked, puzzleUnlock.unlocked, coloringUnlock.unlocked],
  );

  const cmsDeviceLayout = isTablet
    ? sceneLayoutTablet || sceneLayoutPhone
    : sceneLayoutPhone || sceneLayoutTablet;
  const useCmsButtons = !!(
    cmsDeviceLayout?.buttons && cmsDeviceLayout.buttons.length > 0
  );
  const showActivitiesBoard = cmsDeviceLayout?.showActivitiesBoard !== false;

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
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
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
                onClick={() =>
                  navigate(sailBackPath, {
                    state:
                      navState?.title || cmsTitle
                        ? { title: navState?.title || cmsTitle || undefined }
                        : undefined,
                  })
                }
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform"
                style={woodBtnStyle}
                aria-label="Back to sail scene"
                tabIndex={sceneInteractive ? 0 : -1}
              >
                <ArrowLeft size={22} className="text-white drop-shadow" strokeWidth={2.6} />
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

              <button
                type="button"
                onClick={goHub}
                className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full active:scale-95 transition-transform overflow-hidden"
                style={woodBtnStyle}
                aria-label="Open lesson hub"
                tabIndex={sceneInteractive ? 0 : -1}
              >
                <img
                  src={ICON_MENU}
                  alt=""
                  className="w-9 h-9 object-contain"
                  draggable={false}
                />
              </button>
            </header>

            {/* Garden mid band — spacer between header and activities board */}
            <div className="relative flex-1 min-h-0" aria-hidden />

            {/* CMS-authored absolute buttons (% of full scene frame) */}
            {useCmsButtons &&
              cmsDeviceLayout!.buttons!.map((btn) => {
                const activityId = isActivityId(btn.id) ? btn.id : null;
                const activity = activityId
                  ? activities.find((a) => a.id === activityId)
                  : undefined;
                const locked = activity ? activity.locked : true;
                const label =
                  btn.label ||
                  activity?.label ||
                  (activityId ? activityId.toUpperCase() : btn.id);
                const iconSrc =
                  resolveMediaUrl(btn.iconUrl) ||
                  activity?.iconSrc ||
                  (activityId ? ACTIVITY_ICON[activityId] : ICON_READ);
                return (
                  <button
                    key={btn.id}
                    type="button"
                    disabled={locked || !sceneInteractive}
                    onClick={() => {
                      if (activityId) onActivity(activityId, locked);
                    }}
                    className={`absolute z-20 flex flex-col items-center justify-end active:scale-95 transition-transform ${
                      locked ? 'cursor-not-allowed' : ''
                    }`}
                    style={{
                      left: `${btn.x}%`,
                      top: `${btn.y}%`,
                      width: `${btn.w}%`,
                      height: `${btn.h}%`,
                    }}
                    aria-label={locked ? `${label} (locked)` : label}
                    tabIndex={sceneInteractive && !locked ? 0 : -1}
                  >
                    <span className="relative flex items-center justify-center w-full flex-1 min-h-0 mb-0.5">
                      <img
                        src={iconSrc}
                        alt=""
                        className={`max-w-full max-h-full object-contain drop-shadow-md ${
                          activityId === 'coloring' ? 'scale-[0.84]' : ''
                        } ${locked ? 'opacity-55' : ''}`}
                        draggable={false}
                      />
                      {locked && (
                        <span
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          aria-hidden
                        >
                          <span
                            className="flex items-center justify-center w-8 h-8 rounded-full"
                            style={{
                              background:
                                'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                              boxShadow:
                                '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.4)',
                              border: '1.5px solid #E8C060',
                            }}
                          >
                            <Lock size={14} className="text-white" strokeWidth={2.8} />
                          </span>
                        </span>
                      )}
                    </span>
                    <span
                      className="font-display font-black text-white text-[0.55rem] sm:text-[0.65rem] leading-tight tracking-wide text-center px-0.5 w-full truncate"
                      style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}

            {/* Default ACTIVITIES wood sign + buttons (when no CMS layout) */}
            {!useCmsButtons && (
              <div
                className="absolute left-0 right-0 z-10 mx-auto w-full px-1"
                style={{
                  maxWidth: 560,
                  bottom: 0,
                  transform: `translateY(${ACTIVITIES_BOARD_CROP * 100}%)`,
                }}
              >
                <div className="relative w-full">
                  <img
                    src={ACTIVITIES_SIGN}
                    alt=""
                    className="block w-full h-auto select-none pointer-events-none"
                    draggable={false}
                  />

                  <p
                    className="absolute left-[18%] right-[18%] text-center font-display font-black text-[#FFF6E8] text-[clamp(0.95rem,4.2vw,1.45rem)] tracking-[0.14em] pointer-events-none select-none leading-none"
                    style={{
                      top: '12%',
                      textShadow:
                        '0 2px 0 #5c3a1a, 0 3px 6px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.5)',
                    }}
                    aria-hidden
                  >
                    ACTIVITIES
                  </p>

                  <div
                    className="absolute left-[8%] right-[8%] flex items-stretch justify-between gap-1 z-10"
                    style={{ top: '33%', bottom: '34%' }}
                  >
                    {activities.map((activity) => {
                      const locked = activity.locked;
                      return (
                        <button
                          key={activity.id}
                          type="button"
                          disabled={locked || !sceneInteractive}
                          onClick={() => onActivity(activity.id, locked)}
                          className={`relative flex flex-col items-center justify-end flex-1 min-w-0 h-full pb-1 active:scale-95 transition-transform ${
                            locked ? 'cursor-not-allowed' : ''
                          }`}
                          aria-label={
                            locked ? `${activity.label} (locked)` : activity.label
                          }
                          tabIndex={sceneInteractive && !locked ? 0 : -1}
                        >
                          <span className="relative flex items-center justify-center w-full aspect-square max-h-[72%] mb-0.5">
                            <img
                              src={activity.iconSrc}
                              alt=""
                              className={`w-full h-full object-contain drop-shadow-md ${
                                activity.id === 'coloring' ? 'scale-[0.84]' : ''
                              } ${locked ? 'opacity-55' : ''}`}
                              draggable={false}
                            />
                            {locked && (
                              <span
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                                aria-hidden
                              >
                                <span
                                  className="flex items-center justify-center w-8 h-8 rounded-full"
                                  style={{
                                    background:
                                      'linear-gradient(180deg, #D4A574 0%, #8B6914 100%)',
                                    boxShadow:
                                      '0 2px 0 #5c3a1a, 0 3px 8px rgba(0,0,0,0.4)',
                                    border: '1.5px solid #E8C060',
                                  }}
                                >
                                  <Lock
                                    size={14}
                                    className="text-white"
                                    strokeWidth={2.8}
                                  />
                                </span>
                              </span>
                            )}
                          </span>
                          <span
                            className="font-display font-black text-white text-[0.55rem] sm:text-[0.65rem] leading-tight tracking-wide text-center px-0.5"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                          >
                            {activity.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Optional board chrome under CMS buttons */}
            {useCmsButtons && showActivitiesBoard && (
              <div
                className="absolute left-0 right-0 z-10 mx-auto w-full px-1 pointer-events-none"
                style={{
                  maxWidth: 560,
                  bottom: 0,
                  transform: `translateY(${ACTIVITIES_BOARD_CROP * 100}%)`,
                }}
                aria-hidden
              >
                <img
                  src={ACTIVITIES_SIGN}
                  alt=""
                  className="block w-full h-auto select-none opacity-95"
                  draggable={false}
                />
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

      {/* Fullscreen intro video */}
      {showVideo && (
        <div
          className="absolute inset-0 z-40 bg-black"
          onClick={finishIntro}
          role="presentation"
        >
          <video
            ref={videoRef}
            key={introSrc}
            src={introSrc}
            className="absolute inset-0 w-full h-full object-cover"
            muted={!sceneSoundOn}
            playsInline
            preload="auto"
            onEnded={finishIntro}
            onError={finishIntro}
            aria-label="Lesson intro video"
          />
          <button
            type="button"
            onClick={toggleSceneSound}
            className="absolute z-50 flex items-center justify-center w-11 h-11 rounded-full bg-black/45 border border-white/35 active:scale-95 transition-transform"
            style={{
              top: 'max(var(--safe-area-top, 0px), 12px)',
              left: 16,
            }}
            aria-label={sceneSoundOn ? 'Mute intro' : 'Unmute intro'}
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
              finishIntro();
            }}
            className="absolute z-50 px-4 py-2 rounded-full font-display font-bold text-sm text-white/95 bg-black/45 border border-white/35 active:scale-95 transition-transform"
            style={{
              top: 'max(var(--safe-area-top, 0px), 12px)',
              right: 16,
            }}
            aria-label="Skip intro"
          >
            Skip
          </button>
        </div>
      )}

      {showWhite && (
        <div
          className="absolute inset-0 z-50 pointer-events-none"
          style={{
            background: '#ffffff',
            opacity: whiteOpacity,
            transition: `opacity ${WHITE_FADE_MS}ms ease-in-out`,
          }}
          aria-hidden
        />
      )}
    </div>
  );
};

export default IslandScenePage;
