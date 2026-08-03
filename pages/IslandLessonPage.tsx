import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Gamepad2, Lock, MessageCircleQuestionMark, Star, X } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import { readingProgressService } from '../services/readingProgressService';
import {
  appendIslandSceneReturnParams,
  buildIslandSceneNavState,
  buildIslandScenePath,
  type IslandSceneReturnContext,
} from '../utils/islandSceneReturn';

const LESSON_BG = '/assets/images/island-lesson-bg-leaves.png';
const LESSON_HERO = '/assets/images/island-lesson-hero-eden.png';
const STAR_FILLED = '/assets/images/island-star-win.png';

type LessonContent = {
  title: string;
  scriptureRef: string;
  readSubtitle: string;
  verse: string;
  verseRef: string;
};

type ReadingLevelKey = 'ages_3_5' | 'ages_6_7' | 'ages_8_plus';

const AGE_OPTIONS: Array<{ key: ReadingLevelKey; label: string; hint: string }> = [
  { key: 'ages_3_5', label: '3–5', hint: 'Short words' },
  { key: 'ages_6_7', label: '6–7', hint: 'Easy story' },
  { key: 'ages_8_plus', label: '8+', hint: 'Longer story' },
];

const LESSON_BY_ISLAND: Record<string, LessonContent> = {
  genesis: {
    title: '1. The Beginning',
    scriptureRef: 'Genesis 1-2',
    readSubtitle: 'Read Genesis 1-2',
    verse: 'In the beginning, God created the heavens and the earth.',
    verseRef: 'Genesis 1:1',
  },
};

const DEFAULT_LESSON: LessonContent = {
  title: '1. The Beginning',
  scriptureRef: 'Genesis 1-2',
  readSubtitle: 'Read Genesis 1-2',
  verse: 'In the beginning, God created the heavens and the earth.',
  verseRef: 'Genesis 1:1',
};

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

/**
 * Island lesson Read hub — opened from the garden scene via READ STORY.
 * Kid-friendly: big Start/Continue → age pick → reader.
 * Standalone (no bottom nav).
 */
const IslandLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storyIdParam = searchParams.get('storyId')?.trim() || '';

  const fallbackLesson = LESSON_BY_ISLAND[islandId] ?? {
    ...DEFAULT_LESSON,
    title: `1. ${titleCase(islandId)}`,
    scriptureRef: titleCase(islandId),
    readSubtitle: `Read ${titleCase(islandId)}`,
  };

  const [lesson, setLesson] = useState<LessonContent>(fallbackLesson);
  const [cmsBookId, setCmsBookId] = useState<string | null>(null);
  const [cmsStoryId, setCmsStoryId] = useState('');
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [readDone, setReadDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [hasQuizContent, setHasQuizContent] = useState(true);
  const [hasStartedReading, setHasStartedReading] = useState(false);
  const [readStars, setReadStars] = useState(0);
  const [celebrateRead, setCelebrateRead] = useState(false);

  const navState = location.state as {
    title?: string;
    fromScene?: boolean;
    fromMainMap?: boolean;
    fromSail?: boolean;
    celebrateRead?: boolean;
    readStars?: number;
  } | null;

  const returnStoryId = storyIdParam || cmsStoryId;
  const sceneReturnCtx = useMemo<IslandSceneReturnContext>(
    () => ({
      islandId,
      storyId: returnStoryId || undefined,
      fromMainMap: Boolean(navState?.fromMainMap),
      fromSail: Boolean(navState?.fromSail),
      title: navState?.title || lesson.title,
    }),
    [
      islandId,
      returnStoryId,
      navState?.fromMainMap,
      navState?.fromSail,
      navState?.title,
      lesson.title,
    ],
  );
  const sceneBackPath = buildIslandScenePath({
    islandId,
    storyId: returnStoryId || undefined,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setCmsBookId(null);
    setCmsStoryId('');
    setHasQuizContent(true);
    const load = async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const stories = Array.isArray(data.stories) ? data.stories : [];
        const sorted = [...stories].sort(
          (a: { order?: number }, b: { order?: number }) =>
            (a.order ?? 0) - (b.order ?? 0),
        );
        const primary = (
          (storyIdParam
            ? sorted.find((s: { _id?: string }) => s._id === storyIdParam)
            : undefined) || sorted[0]
        ) as
          | {
              _id?: string;
              bookId?: string | { _id?: string };
              displayTitle?: string;
              title?: string;
              scriptureRef?: string;
              verse?: string;
              verseRef?: string;
              quizMode?: string;
              customQuestions?: unknown[];
              quiz?: {
                levels?: Partial<Record<'easy' | 'medium' | 'hard', unknown[]>>;
              };
            }
          | undefined;

        if (primary) {
          if (primary._id) setCmsStoryId(primary._id);
          const bookRaw = primary.bookId;
          const bookId =
            typeof bookRaw === 'object' && bookRaw?._id
              ? String(bookRaw._id)
              : bookRaw
                ? String(bookRaw)
                : null;
          if (bookId) setCmsBookId(bookId);

          const levels = primary.quiz?.levels;
          const hasQuiz =
            primary.quizMode !== 'none' &&
            ((Array.isArray(levels?.easy) && levels!.easy!.length > 0) ||
              (Array.isArray(levels?.medium) && levels!.medium!.length > 0) ||
              (Array.isArray(levels?.hard) && levels!.hard!.length > 0) ||
              (Array.isArray(primary.customQuestions) &&
                primary.customQuestions.length > 0) ||
              (primary.quizMode === 'book_quiz' && Boolean(bookId)));
          setHasQuizContent(hasQuiz);

          setLesson({
            title:
              (primary.displayTitle && primary.displayTitle.trim()) ||
              (primary.title && primary.title.trim()) ||
              fallbackLesson.title,
            scriptureRef: primary.scriptureRef || fallbackLesson.scriptureRef,
            readSubtitle: primary.scriptureRef
              ? `Read ${primary.scriptureRef}`
              : fallbackLesson.readSubtitle,
            verse: primary.verse || fallbackLesson.verse,
            verseRef: primary.verseRef || fallbackLesson.verseRef,
          });
        }
      } catch {
        /* keep hardcoded fallbacks */
      }
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [islandId, storyIdParam, fallbackLesson.title, fallbackLesson.scriptureRef, fallbackLesson.readSubtitle, fallbackLesson.verse, fallbackLesson.verseRef]);

  // Refresh progress when hub mounts / story resolves / after returning from reader/quiz
  useEffect(() => {
    const sid = storyIdParam || cmsStoryId;
    if (!sid) {
      setReadDone(false);
      setQuizDone(false);
      setHasStartedReading(false);
      setReadStars(0);
      setCelebrateRead(false);
      return;
    }
    const p = islandStoryProgressService.get(islandId, sid);
    setReadDone(p.read);
    setQuizDone(p.quiz);
    const starsFromStorage =
      typeof p.readStars === 'number' && p.readStars >= 1
        ? Math.min(3, Math.floor(p.readStars))
        : 0;
    const starsFromNav =
      typeof navState?.readStars === 'number' && navState.readStars >= 1
        ? Math.min(3, Math.floor(navState.readStars))
        : 0;
    setReadStars(Math.max(starsFromStorage, starsFromNav));

    const bookProgress =
      cmsBookId != null ? readingProgressService.getProgress(cmsBookId) : null;
    setHasStartedReading(Boolean(p.read) || bookProgress != null);

    if (navState?.celebrateRead && p.read) {
      setCelebrateRead(true);
      const t = window.setTimeout(() => setCelebrateRead(false), 2800);
      return () => window.clearTimeout(t);
    }
  }, [islandId, storyIdParam, cmsStoryId, cmsBookId, location.key, navState?.celebrateRead, navState?.readStars]);

  const openRead = useCallback(
    (level: ReadingLevelKey) => {
      setShowAgePicker(false);
      const returnCtx: IslandSceneReturnContext = {
        islandId,
        storyId: returnStoryId || undefined,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
        title: navState?.title || lesson.title,
      };
      if (cmsBookId) {
        const params = new URLSearchParams();
        params.set('readingLevel', level);
        appendIslandSceneReturnParams(params, returnCtx);
        navigate(`/read/${cmsBookId}?${params.toString()}`, {
          state: {
            fromIslandLesson: islandId,
            fromIslandScene: true,
            islandId,
            storyId: returnCtx.storyId,
            fromMainMap: returnCtx.fromMainMap,
            fromSail: returnCtx.fromSail,
            title: returnCtx.title,
            readingLevel: level,
          },
        });
        return;
      }
      navigate('/read', {
        state: {
          fromIslandLesson: islandId,
          fromIslandScene: true,
          ...returnCtx,
        },
      });
    },
    [
      cmsBookId,
      islandId,
      navigate,
      returnStoryId,
      navState?.fromMainMap,
      navState?.fromSail,
      navState?.title,
      lesson.title,
    ],
  );

  const handlePrimaryCta = useCallback(() => {
    if (cmsBookId) {
      setShowAgePicker(true);
      return;
    }
    navigate('/read', {
      state: {
        fromIslandLesson: islandId,
        fromIslandScene: true,
        ...sceneReturnCtx,
      },
    });
  }, [cmsBookId, islandId, navigate, sceneReturnCtx]);

  const openQuiz = useCallback(() => {
    const qs = returnStoryId
      ? `?storyId=${encodeURIComponent(returnStoryId)}`
      : '';
    navigate(`/sail/${islandId}/lesson/quiz${qs}`);
  }, [islandId, navigate, returnStoryId]);

  const quizLocked = !readDone;
  const gameLocked = !(readDone && (quizDone || !hasQuizContent));

  const steps = useMemo(
    () => [
      {
        id: 'read',
        title: 'Story',
        Icon: BookOpen,
        iconBg: 'bg-[#F5C518]',
        status: (readDone ? 'done' : 'todo') as 'done' | 'todo' | 'locked',
        hint: readDone
          ? readStars >= 3
            ? '3 stars!'
            : readStars === 2
              ? '2 stars!'
              : readStars === 1
                ? '1 star!'
                : 'Done!'
          : hasStartedReading
            ? 'Keep going'
            : 'Let’s read',
      },
      {
        id: 'quiz',
        title: 'Quiz',
        Icon: MessageCircleQuestionMark,
        iconBg: 'bg-[#9B5DE5]',
        status: (!hasQuizContent
          ? 'done'
          : quizDone
            ? 'done'
            : quizLocked
              ? 'locked'
              : 'todo') as 'done' | 'todo' | 'locked',
        hint: !hasQuizContent
          ? 'Skip'
          : quizDone
            ? 'Done!'
            : quizLocked
              ? 'After story'
              : 'Ready!',
        onAction:
          !hasQuizContent || quizLocked ? undefined : openQuiz,
      },
      {
        id: 'game',
        title: 'Game',
        Icon: Gamepad2,
        iconBg: 'bg-[#3BA4F0]',
        status: (gameLocked ? 'locked' : 'todo') as 'done' | 'todo' | 'locked',
        hint: gameLocked ? 'Soon' : 'Soon',
      },
    ],
    [
      readDone,
      readStars,
      hasStartedReading,
      hasQuizContent,
      quizDone,
      quizLocked,
      gameLocked,
      openQuiz,
    ],
  );

  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progressPct = (completedCount / steps.length) * 100;
  const primaryLabel = hasStartedReading ? 'Continue' : 'Start';

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#2d6b3a]">
      <style>{`
        @keyframes islandStarPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes islandStarTwinkle {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          70% { transform: scale(1.15) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes islandCheckPop {
          0% { transform: scale(0); opacity: 0; }
          55% { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="absolute inset-0" aria-hidden>
        <img
          src={LESSON_BG}
          alt=""
          className="w-full h-full object-cover scale-110 blur-[2px]"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/25" />
      </div>

      <div
        className="relative z-10 flex flex-col h-full overflow-y-auto overscroll-contain"
        style={{
          paddingTop: 'max(var(--safe-area-top, 0px), 10px)',
          paddingBottom: 'max(var(--safe-area-bottom, 0px), 16px)',
          scrollbarWidth: 'none',
        }}
      >
        <div className="flex items-center px-4 mb-1">
          <button
            type="button"
            onClick={() =>
              navigate(sceneBackPath, {
                state: buildIslandSceneNavState(sceneReturnCtx),
              })
            }
            className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3D2914]/90 border-2 border-[#6B4423] text-white shadow-md active:scale-95 transition-transform"
            aria-label="Back to island scene"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="relative flex justify-center px-6 mt-1 mb-2">
          <div
            className="relative px-8 py-2.5 min-w-[70%] text-center"
            style={{
              background: 'linear-gradient(180deg, #5CB85C 0%, #3D9B3D 55%, #2E8B2E 100%)',
              borderRadius: '14px',
              boxShadow:
                '0 4px 0 #1f6b1f, 0 8px 16px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.25)',
            }}
          >
            <h1
              className="font-display font-black text-white text-[1.35rem] tracking-wide"
              style={{ textShadow: '0 2px 0 rgba(0,0,0,0.25)' }}
            >
              {navState?.title || lesson.title}
            </h1>
          </div>
        </div>

        <div className="flex justify-center mb-3 px-6">
          <div
            className="px-5 py-1.5 rounded-full"
            style={{
              background: 'linear-gradient(180deg, #D4A574 0%, #C4956A 40%, #A67C52 100%)',
              boxShadow:
                '0 3px 0 #7a5230, 0 4px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.35)',
              border: '2px solid #8B6914',
            }}
          >
            <p className="font-display font-bold text-[#3D2914] text-sm tracking-wide">
              {lesson.scriptureRef}
            </p>
          </div>
        </div>

        <div className="px-4 mb-3">
          <div
            className="relative overflow-hidden rounded-[28px] border-[3px] border-white/70"
            style={{ boxShadow: '0 10px 28px rgba(0,0,0,0.3)' }}
          >
            <img
              src={LESSON_HERO}
              alt=""
              className="block w-full h-auto object-cover aspect-[4/3]"
              draggable={false}
            />
            <div
              className="absolute left-1/2 bottom-3 w-[88%] -translate-x-1/2 px-4 py-3 text-center"
              style={{
                background: 'linear-gradient(180deg, #F5E6C8 0%, #E8D4A8 100%)',
                borderRadius: '18px',
                border: '2px solid #C4A574',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              <p className="font-display font-semibold text-[#5D4037] text-[0.95rem] leading-snug">
                “{lesson.verse}”
              </p>
              <p className="font-display font-bold text-[#8B6914] text-sm mt-1">
                {lesson.verseRef}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-2 mt-auto">
          <div
            className="rounded-[28px] px-4 pt-4 pb-4"
            style={{
              background: 'linear-gradient(180deg, #F3E5C0 0%, #E8D5A8 100%)',
              border: '3px solid #D4B896',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45)',
            }}
          >
            {/* Progress */}
            <div className="px-1 mb-4">
              <div className="h-3.5 rounded-full bg-[#D4B896]/80 overflow-hidden border border-[#C4A574]/60">
                <div
                  className="h-full rounded-full bg-[#5CB85C] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="font-display text-center text-[#8B6914] text-sm mt-1.5 font-bold">
                {completedCount} of {steps.length} done
              </p>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="w-full min-h-[64px] rounded-[22px] font-display font-black text-white text-[1.75rem] tracking-wide active:scale-[0.98] transition-transform mb-4"
              style={{
                background: 'linear-gradient(180deg, #6BCF6B 0%, #3D9B3D 55%, #2E8B2E 100%)',
                boxShadow:
                  '0 5px 0 #1f6b1f, 0 10px 20px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.28)',
                textShadow: '0 2px 0 rgba(0,0,0,0.2)',
              }}
              aria-label={primaryLabel}
            >
              {primaryLabel}
            </button>

            {/* Bible Map hunt stars (after story complete) */}
            {readDone && readStars > 0 && (
              <div
                className={`flex flex-col items-center mb-3 ${
                  celebrateRead ? 'animate-[islandStarPop_0.7s_cubic-bezier(0.175,0.885,0.32,1.275)]' : ''
                }`}
                aria-label={`${readStars} out of 3 stars`}
              >
                <p className="font-display font-bold text-[#8B6914] text-sm mb-1.5">
                  {celebrateRead ? 'Great job!' : 'Your stars'}
                </p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((n) => {
                    const filled = n <= readStars;
                    return (
                      <div
                        key={n}
                        className={`relative w-12 h-12 flex items-center justify-center ${
                          celebrateRead && filled
                            ? 'animate-[islandStarTwinkle_0.55s_ease-out]'
                            : ''
                        }`}
                        style={
                          celebrateRead && filled
                            ? { animationDelay: `${(n - 1) * 120}ms`, animationFillMode: 'both' }
                            : undefined
                        }
                      >
                        {filled ? (
                          <img
                            src={STAR_FILLED}
                            alt=""
                            className="w-11 h-11 object-contain drop-shadow-md"
                            draggable={false}
                          />
                        ) : (
                          <Star
                            size={40}
                            className="text-[#C4A574]/55"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Secondary steps — status only */}
            <ul className="relative flex flex-col gap-2.5">
              {steps.map((step) => {
                const Icon = step.Icon;
                const canTap = Boolean(step.onAction);
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={!canTap}
                      onClick={() => step.onAction?.()}
                      className={`relative w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-transform ${
                        canTap
                          ? 'bg-white/55 border-2 border-[#C4A574]/70 active:scale-[0.98]'
                          : 'bg-white/30 border-2 border-transparent'
                      } ${!canTap ? 'cursor-default' : ''}`}
                    >
                      <div
                        className={`relative z-[1] flex-shrink-0 w-12 h-12 rounded-full ${step.iconBg} flex items-center justify-center shadow-md border-2 border-white/40`}
                      >
                        <Icon size={24} className="text-white" strokeWidth={2.4} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-[#5D4037] text-base truncate">
                          {step.title}
                        </p>
                        <p className="font-display text-[#8B6914] text-sm truncate">
                          {step.hint}
                        </p>
                      </div>

                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center border border-[#C4A574]/50 overflow-hidden">
                        {step.status === 'done' && (
                          <Check
                            size={20}
                            className={`text-[#3D9B3D] ${
                              step.id === 'read' && celebrateRead
                                ? 'animate-[islandCheckPop_0.65s_cubic-bezier(0.175,0.885,0.32,1.275)]'
                                : ''
                            }`}
                            strokeWidth={3}
                          />
                        )}
                        {step.status === 'locked' && (
                          <Lock size={16} className="text-[#A67C52]" strokeWidth={2.5} />
                        )}
                        {step.status === 'todo' && canTap && (
                          <span className="font-display font-black text-[#3D9B3D] text-xs">
                            GO
                          </span>
                        )}
                        {step.status === 'todo' && !canTap && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#C4A574]" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {showAgePicker && (
        <div
          className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="How old are you?"
        >
          <div
            className="w-full max-w-sm rounded-3xl p-5 mb-[max(var(--safe-area-bottom),16px)]"
            style={{
              background: 'linear-gradient(180deg, #F5E6C8 0%, #E8D4A8 100%)',
              border: '3px solid #C4A574',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h2 className="font-display font-black text-[#5D4037] text-xl">
                  How old are you?
                </h2>
                <p className="font-display text-[#8B6914] text-sm mt-0.5">
                  Pick one
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAgePicker(false)}
                className="w-11 h-11 rounded-full bg-[#3D2914]/90 text-white flex items-center justify-center active:scale-95"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => openRead(opt.key)}
                  className="w-full min-h-[64px] flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-white/90 border-[3px] border-[#C4A574] active:scale-[0.98] transition-transform"
                >
                  <span className="font-display font-black text-[#5D4037] text-2xl">
                    {opt.label}
                  </span>
                  <span className="font-display font-bold text-[#8B6914] text-sm">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IslandLessonPage;
