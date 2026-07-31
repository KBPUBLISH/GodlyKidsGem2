import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Gamepad2, Lock, MessageCircleQuestionMark, X } from 'lucide-react';
import { getApiBaseUrl } from '../services/apiService';

const LESSON_BG = '/assets/images/island-lesson-bg-leaves.png';
const LESSON_HERO = '/assets/images/island-lesson-hero-eden.png';

type LessonContent = {
  title: string;
  scriptureRef: string;
  readSubtitle: string;
  verse: string;
  verseRef: string;
};

type ReadingLevelKey = 'ages_3_5' | 'ages_6_7' | 'ages_8_plus';

const AGE_OPTIONS: Array<{ key: ReadingLevelKey; label: string; hint: string }> = [
  { key: 'ages_3_5', label: 'Ages 3–5', hint: 'Short & simple' },
  { key: 'ages_6_7', label: 'Ages 6–7', hint: 'Clear story' },
  { key: 'ages_8_plus', label: 'Ages 8+', hint: 'Fuller story' },
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
 * Standalone (no bottom nav).
 */
const IslandLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const { islandId = 'genesis' } = useParams<{ islandId: string }>();
  const location = useLocation();

  const fallbackLesson = LESSON_BY_ISLAND[islandId] ?? {
    ...DEFAULT_LESSON,
    title: `1. ${titleCase(islandId)}`,
    scriptureRef: titleCase(islandId),
    readSubtitle: `Read ${titleCase(islandId)}`,
  };

  const [lesson, setLesson] = useState<LessonContent>(fallbackLesson);
  const [cmsBookId, setCmsBookId] = useState<string | null>(null);
  const [showAgePicker, setShowAgePicker] = useState(false);

  const navState = location.state as { title?: string; fromScene?: boolean } | null;
  const sceneBackPath = `/sail/${islandId}/lesson`;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
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
        const primary = [...stories].sort(
          (a: { order?: number }, b: { order?: number }) =>
            (a.order ?? 0) - (b.order ?? 0),
        )[0] as
          | {
              _id?: string;
              bookId?: string | { _id?: string };
              displayTitle?: string;
              title?: string;
              scriptureRef?: string;
              verse?: string;
              verseRef?: string;
            }
          | undefined;

        if (primary) {
          const bookRaw = primary.bookId;
          const bookId =
            typeof bookRaw === 'object' && bookRaw?._id
              ? String(bookRaw._id)
              : bookRaw
                ? String(bookRaw)
                : null;
          if (bookId) setCmsBookId(bookId);

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
  }, [islandId, fallbackLesson.title, fallbackLesson.scriptureRef, fallbackLesson.readSubtitle, fallbackLesson.verse, fallbackLesson.verseRef]);

  const openRead = useCallback(
    (level: ReadingLevelKey) => {
      setShowAgePicker(false);
      if (cmsBookId) {
        navigate(`/read/${cmsBookId}?readingLevel=${encodeURIComponent(level)}`, {
          state: {
            fromIslandLesson: islandId,
            readingLevel: level,
          },
        });
        return;
      }
      navigate('/read', { state: { fromIslandLesson: islandId } });
    },
    [cmsBookId, islandId, navigate],
  );

  const activities = useMemo(
    () => [
      {
        id: 'read',
        step: 1,
        title: 'Read the Story',
        subtitle: lesson.readSubtitle,
        iconBg: 'bg-[#F5C518]',
        Icon: BookOpen,
        status: 'done' as const,
        cta: cmsBookId ? 'Choose age' : 'Read Again',
        ctaTone: 'primary' as const,
        onAction: () => {
          if (cmsBookId) setShowAgePicker(true);
          else navigate('/read', { state: { fromIslandLesson: islandId } });
        },
      },
      {
        id: 'quiz',
        step: 2,
        title: 'Complete Quiz',
        subtitle: 'Answer 5 questions',
        iconBg: 'bg-[#9B5DE5]',
        Icon: MessageCircleQuestionMark,
        status: 'todo' as const,
        cta: 'Start Quiz',
        ctaTone: 'primary' as const,
        onAction: () => navigate(`/sail/${islandId}/lesson/quiz`),
      },
      {
        id: 'game',
        step: 3,
        title: 'Unlock Game',
        subtitle: 'Play and learn',
        iconBg: 'bg-[#3BA4F0]',
        Icon: Gamepad2,
        status: 'locked' as const,
        cta: 'Locked',
        ctaTone: 'locked' as const,
        onAction: undefined,
      },
    ],
    [cmsBookId, islandId, lesson.readSubtitle, navigate],
  );

  const completedCount = activities.filter((a) => a.status === 'done').length;
  const progressPct = (completedCount / activities.length) * 100;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#2d6b3a]">
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
                state: {
                  skipIntro: true,
                  title: navState?.title,
                },
              })
            }
            className="flex items-center justify-center w-11 h-11 rounded-full bg-[#3D2914]/90 border-2 border-[#6B4423] text-white shadow-md active:scale-95 transition-transform"
            aria-label="Back to island scene"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
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
            className="rounded-[28px] px-4 pt-3 pb-3"
            style={{
              background: 'linear-gradient(180deg, #F3E5C0 0%, #E8D5A8 100%)',
              border: '3px solid #D4B896',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45)',
            }}
          >
            <ul className="relative flex flex-col gap-3">
              <span
                className="absolute left-[22px] top-8 bottom-16 w-0 border-l-2 border-dashed border-[#A67C52]/55 pointer-events-none"
                aria-hidden
              />

              {activities.map((activity) => {
                const Icon = activity.Icon;
                return (
                  <li key={activity.id} className="relative flex items-center gap-3">
                    <div
                      className={`relative z-[1] flex-shrink-0 w-11 h-11 rounded-full ${activity.iconBg} flex items-center justify-center shadow-md border-2 border-white/40`}
                    >
                      <Icon size={22} className="text-white" strokeWidth={2.4} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display font-bold text-[#5D4037] text-[0.95rem] truncate">
                          {activity.step}. {activity.title}
                        </p>
                        {activity.status === 'done' && (
                          <Check size={16} className="text-[#3D9B3D] flex-shrink-0" strokeWidth={3} />
                        )}
                        {activity.status === 'locked' && (
                          <Lock size={14} className="text-[#A67C52] flex-shrink-0" />
                        )}
                      </div>
                      <p className="font-display text-[#8B6914] text-xs truncate">
                        {activity.subtitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!activity.onAction || activity.status === 'locked'}
                      onClick={() => activity.onAction?.()}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full font-display font-bold text-xs active:scale-95 transition-transform ${
                        activity.ctaTone === 'locked'
                          ? 'bg-[#C4A574]/50 text-[#7a5230] cursor-not-allowed'
                          : 'bg-[#3D9B3D] text-white shadow-md'
                      }`}
                    >
                      {activity.cta}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 px-1">
              <div className="h-2.5 rounded-full bg-[#D4B896]/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5CB85C] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="font-display text-center text-[#8B6914] text-xs mt-1.5 font-semibold">
                {completedCount}/{activities.length} complete
              </p>
            </div>
          </div>
        </div>
      </div>

      {showAgePicker && (
        <div
          className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose reading age"
        >
          <div
            className="w-full max-w-sm rounded-3xl p-5 mb-[max(var(--safe-area-bottom),16px)]"
            style={{
              background: 'linear-gradient(180deg, #F5E6C8 0%, #E8D4A8 100%)',
              border: '3px solid #C4A574',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display font-black text-[#5D4037] text-lg">
                  Pick your reading age
                </h2>
                <p className="font-display text-[#8B6914] text-xs mt-0.5">
                  Same pictures — words match your age
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAgePicker(false)}
                className="w-9 h-9 rounded-full bg-[#3D2914]/90 text-white flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => openRead(opt.key)}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-white/80 border-2 border-[#C4A574] active:scale-[0.98] transition-transform"
                >
                  <p className="font-display font-bold text-[#5D4037] text-base">{opt.label}</p>
                  <p className="font-display text-[#8B6914] text-xs">{opt.hint}</p>
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
