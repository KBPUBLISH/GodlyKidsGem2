import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Gift, PartyPopper, X } from 'lucide-react';
import WoodBackButton from '../components/WoodBackButton';
import { getApiBaseUrl } from '../services/apiService';
import { islandStoryProgressService } from '../services/islandStoryProgressService';
import {
  resolveRewardPool,
  type RewardDefinition,
} from '../services/rewardsService';
import { resolveBibleMapMediaUrl } from '../utils/bibleMapApi';
import {
  buildIslandSceneNavState,
  buildIslandScenePath,
} from '../utils/islandSceneReturn';
import { useAudio } from '../context/AudioContext';
import { isOnboardingJourneyActive } from '../utils/onboardingJourney';
import { noteJourneyStep } from '../utils/journeyStudy';
import { storyPackUnlockUxService } from '../services/storyPackUnlockUxService';
import PackUnlockCelebration from '../components/world/PackUnlockCelebration';
import { usePackUnlockCelebration } from '../hooks/usePackUnlockCelebration';
import {
  isPlayableMainMapStory,
  type PackUnlockCoverStory,
} from '../utils/mainMapStoryUnlock';
import { storyHasTryIt, type TryItPayload } from '../utils/tryItContent';
import { primeTryItVideoFromTap } from '../utils/tryItPlayback';

const WOOD_TEX = '/assets/images/wheel-background-wood.png';

type QuizLevel = 'easy' | 'medium' | 'hard';

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type StoryCms = {
  _id?: string;
  order?: number;
  status?: string;
  title?: string;
  displayTitle?: string;
  quizMode?: 'book_quiz' | 'custom' | 'none';
  customQuestions?: QuizQuestion[];
  quiz?: {
    defaultLevel?: QuizLevel;
    levels?: Partial<Record<QuizLevel, QuizQuestion[]>>;
  };
  bookId?: string | { _id?: string };
  mapIconUrl?: string;
  heroImageUrl?: string;
  tryIt?: TryItPayload;
  puzzle?: {
    enabled?: boolean;
    type?: string;
    imageUrl?: string;
  };
  coloringPageIds?: Array<
    | string
    | {
        _id?: string;
        backgroundUrl?: string;
        files?: { background?: { url?: string } };
      }
  >;
  /** Story pack rewards config (used for the Claim Treasure reveal). */
  rewards?: { enabled?: boolean; pool?: RewardDefinition[] };
  game?: {
    enabled?: boolean;
    kind?: string;
    gameId?: string;
    webview?: { title?: string; url?: string; coverImage?: string };
  };
};

type Phase = 'loading' | 'pick' | 'playing' | 'done' | 'missing';

const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const woodBtnStyle: React.CSSProperties = {
  backgroundImage: `url(${WOOD_TEX})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  boxShadow:
    '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,230,180,0.35)',
  border: '2px solid #6B4423',
};

const getBibleMapApiRoot = (): string => {
  const base = (getApiBaseUrl() || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
};

const normalizeQuestions = (list: QuizQuestion[] | undefined): QuizQuestion[] =>
  (Array.isArray(list) ? list : [])
    .map((q) => {
      const rawOptions = (Array.isArray(q.options) ? q.options : []).map((o) =>
        String(o ?? '').trim(),
      );
      const rawCorrect =
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 ? q.correctIndex : 0;
      // Drop empty slots without sliding the correct choice to the wrong index.
      const kept = rawOptions
        .map((text, orig) => ({ text, orig }))
        .filter((o) => o.text)
        .slice(0, 4);
      const mapped = kept.findIndex((o) => o.orig === rawCorrect);
      return {
        question: String(q.question || '').trim(),
        options: kept.map((o) => o.text),
        correctIndex: mapped >= 0 ? mapped : 0,
        explanation: String(q.explanation || '').trim(),
      };
    })
    .filter((q) => q.question && q.options.length >= 2);

/** Fisher-Yates per question so CMS "correct is always first" is not always A. */
const shuffleQuestionOptions = (q: QuizQuestion): QuizQuestion => {
  const items = q.options.map((text, i) => ({
    text,
    isCorrect: i === q.correctIndex,
  }));
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  const correctIndex = items.findIndex((it) => it.isCorrect);
  return {
    ...q,
    options: items.map((it) => it.text),
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  };
};

/** Kids play this many questions, even when a story pack has more saved. */
const QUIZ_LENGTH = 5;

const preparePlayQuestions = (list: QuizQuestion[]): QuizQuestion[] =>
  list.slice(0, QUIZ_LENGTH).map(shuffleQuestionOptions);

const levelsFromStory = (
  story: StoryCms | undefined,
): { levels: Partial<Record<QuizLevel, QuizQuestion[]>>; defaultLevel: QuizLevel } => {
  const easy = normalizeQuestions(story?.quiz?.levels?.easy);
  const medium = normalizeQuestions(story?.quiz?.levels?.medium);
  const hard = normalizeQuestions(story?.quiz?.levels?.hard);
  if (easy.length || medium.length || hard.length) {
    const defaultLevel =
      story?.quiz?.defaultLevel === 'medium' || story?.quiz?.defaultLevel === 'hard'
        ? story.quiz.defaultLevel
        : 'easy';
    return { levels: { easy, medium, hard }, defaultLevel };
  }
  const legacy = normalizeQuestions(story?.customQuestions);
  return { levels: { easy: legacy, medium: [], hard: [] }, defaultLevel: 'easy' };
};

const IslandQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { islandId = 'genesis' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navState = location.state as {
    title?: string;
    fromMainMap?: boolean;
    fromSail?: boolean;
    onboardingJourney?: boolean;
  } | null;
  const { playSuccess } = useAudio();
  const onboardingJourney =
    Boolean(navState?.onboardingJourney) || isOnboardingJourneyActive();

  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('QUIZZ');
  const [storyId, setStoryId] = useState('');
  const [available, setAvailable] = useState<QuizLevel[]>([]);
  const [difficulty, setDifficulty] = useState<QuizLevel>('easy');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [score, setScore] = useState(0);
  /** Full CMS story — needed for its reward pool when claiming treasure. */
  const [rewardStory, setRewardStory] = useState<StoryCms | null>(null);
  const [hasTryIt, setHasTryIt] = useState(false);
  const [tryItDone, setTryItDone] = useState(false);
  const [tryItVideoUrl, setTryItVideoUrl] = useState('');
  const [unlockStories, setUnlockStories] = useState<PackUnlockCoverStory[]>([]);

  useEffect(() => {
    if (onboardingJourney) noteJourneyStep('quiz_started');
  }, [onboardingJourney]);

  useEffect(() => {
    if (onboardingJourney && phase === 'done') noteJourneyStep('quiz_done');
  }, [onboardingJourney, phase]);

  const autoAdvanceRef = useRef<number | null>(null);
  /** Prevents double-advance if tap + Next + timeout fire in the same tick. */
  const advanceLockRef = useRef(false);

  const current = questions[index];

  const returnStoryId =
    storyId || searchParams.get('storyId')?.trim() || undefined;

  const sceneBackPath =
    buildIslandScenePath({
      islandId,
      storyId: returnStoryId,
    }) || `/sail/${islandId}/lesson`;

  const goBackToScene = useCallback(() => {
    navigate(sceneBackPath, {
      state: {
        ...buildIslandSceneNavState({
          islandId,
          storyId: returnStoryId,
          fromMainMap: Boolean(navState?.fromMainMap),
          fromSail: Boolean(navState?.fromSail),
          title: navState?.title || title,
        }),
        onboardingJourney,
      },
    });
  }, [navigate, sceneBackPath, islandId, returnStoryId, navState, title, onboardingJourney]);

  /**
   * True when this results screen is the kid's first ever completion of this
   * story's quiz and its reward has not been claimed yet — the "Continue to
   * reward" button is shown then (any score), so the first finish always leads
   * on to the treasure instead of dead-ending at Play again.
   */
  const [firstTimeReward, setFirstTimeReward] = useState(false);

  // Persist quiz completion as soon as the results screen is shown
  useEffect(() => {
    if (phase !== 'done') return;
    const sid = storyId || searchParams.get('storyId') || '';
    if (!sid) return;
    const before = islandStoryProgressService.get(islandId, sid);
    if (!before.quiz && !before.rewards) setFirstTimeReward(true);
    storyPackUnlockUxService.markActivityAndFlagUnlock(islandId, sid, 'quiz');
  }, [phase, islandId, storyId, searchParams]);

  const { celebration, dismissCelebration } = usePackUnlockCelebration(
    islandId,
    unlockStories,
    phase === 'done' && unlockStories.length > 0,
  );

  const loadStoryQuiz = useCallback(
    async (controller: AbortController) => {
      const res = await fetch(
        `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error('Island not found');
      const data = (await res.json()) as { stories?: StoryCms[] };
      const stories = Array.isArray(data.stories) ? data.stories : [];
      setUnlockStories(
        stories
          .filter((s) => s._id && isPlayableMainMapStory({ _id: s._id, status: s.status }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((s) => ({
            _id: s._id as string,
            order: s.order,
            status: s.status,
            quizMode: s.quizMode,
            bookId: s.bookId,
            customQuestions: s.customQuestions,
            quiz: s.quiz,
            tryIt: s.tryIt,
            mapIconUrl: s.mapIconUrl,
            heroImageUrl: s.heroImageUrl,
            title: s.title,
            displayTitle: s.displayTitle,
          })),
      );
      const wantedId = searchParams.get('storyId');

      const story =
        (wantedId && stories.find((s) => s._id === wantedId)) ||
        stories.find((s) => {
          if (s.quizMode === 'none') return false;
          const { levels } = levelsFromStory(s);
          return (['easy', 'medium', 'hard'] as QuizLevel[]).some(
            (l) => (levels[l]?.length || 0) > 0,
          );
        }) ||
        stories.find((s) => s.quizMode === 'custom' || s.quizMode === 'book_quiz');

      if (!story || story.quizMode === 'none') {
        setPhase('missing');
        return;
      }

      const { levels, defaultLevel } = levelsFromStory(story);
      const diffs = (['easy', 'medium', 'hard'] as QuizLevel[]).filter(
        (l) => (levels[l]?.length || 0) > 0,
      );

      // book_quiz with no custom levels — send kids to book reader quiz for now
      if (diffs.length === 0) {
        const bookId =
          typeof story.bookId === 'object' ? story.bookId?._id : story.bookId;
        if (story.quizMode === 'book_quiz' && bookId) {
          navigate(`/book/${bookId}`, {
            replace: true,
            state: { fromIslandLesson: islandId, openQuiz: true },
          });
          return;
        }
        setPhase('missing');
        return;
      }

      const urlDiff = searchParams.get('difficulty') as QuizLevel | null;
      const resolved =
        urlDiff && diffs.includes(urlDiff)
          ? urlDiff
          : diffs.includes(defaultLevel)
            ? defaultLevel
            : diffs[0]!;

      setTitle((story.displayTitle || story.title || 'QUIZZ').toUpperCase());
      setStoryId(story._id || wantedId || '');
      setRewardStory(story);
      const packHasTryIt = storyHasTryIt(story);
      setHasTryIt(packHasTryIt);
      setTryItVideoUrl(
        packHasTryIt ? resolveBibleMapMediaUrl(story.tryIt?.videoUrl) : '',
      );
      const sid = story._id || wantedId || '';
      setTryItDone(
        sid
          ? Boolean(islandStoryProgressService.get(islandId, sid).tryIt)
          : false,
      );
      setAvailable(diffs);
      setDifficulty(resolved);

      if (diffs.length === 1 || searchParams.get('difficulty')) {
        setQuestions(preparePlayQuestions(levels[resolved] || []));
        setIndex(0);
        setSelected(null);
        setRevealed(false);
        setWasCorrect(false);
        setScore(0);
        setPhase('playing');
      } else {
        setPhase('pick');
      }
    },
    [islandId, navigate, searchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    setPhase('loading');
    void loadStoryQuiz(controller).catch(() => setPhase('missing'));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandId]);

  const startLevel = (level: QuizLevel) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('difficulty', level);
        if (storyId) next.set('storyId', storyId);
        return next;
      },
      { replace: true },
    );
    // Reload questions for chosen level from already-fetched available path:
    // re-fetch quickly to stay consistent with CMS
    void (async () => {
      try {
        const res = await fetch(
          `${getBibleMapApiRoot()}/bible-map/islands/${encodeURIComponent(islandId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { stories?: StoryCms[] };
        const stories = Array.isArray(data.stories) ? data.stories : [];
        const story =
          (storyId && stories.find((s) => s._id === storyId)) ||
          stories.find((s) => levelsFromStory(s).levels[level]?.length);
        const qs = levelsFromStory(story).levels[level] || [];
        if (story) setRewardStory(story);
        setDifficulty(level);
        setQuestions(preparePlayQuestions(qs));
        setIndex(0);
        setSelected(null);
        setRevealed(false);
        setWasCorrect(false);
        setScore(0);
        setPhase(qs.length ? 'playing' : 'missing');
      } catch {
        setPhase('missing');
      }
    })();
  };

  const onPick = (optionIndex: number) => {
    if (!current || revealed) return;
    const correct = optionIndex === current.correctIndex;
    setSelected(optionIndex);
    setRevealed(true);
    setWasCorrect(correct);
    if (correct) {
      playSuccess();
      setScore((s) => s + 1);
    }
  };

  const advanceQuestion = useCallback(() => {
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    if (autoAdvanceRef.current != null) {
      window.clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    if (index >= questions.length - 1) {
      setPhase('done');
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setWasCorrect(false);
  }, [index, questions.length]);

  // Unlock after we land on the next question (or results) so the same tap can't skip two.
  useEffect(() => {
    advanceLockRef.current = false;
  }, [index, phase]);

  // After answering, wait 3s so kids can read feedback, then advance automatically.
  // A tap anywhere on the quiz screen (once revealed) uses the same advanceQuestion.
  useEffect(() => {
    if (phase !== 'playing' || !revealed) return;
    autoAdvanceRef.current = window.setTimeout(() => {
      advanceQuestion();
    }, 3000);
    return () => {
      if (autoAdvanceRef.current != null) {
        window.clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [phase, revealed, index, advanceQuestion]);

  /** Empty-space taps only advance after an answer is locked in. */
  const onQuizScreenTap = useCallback(() => {
    if (phase !== 'playing' || !revealed) return;
    advanceQuestion();
  }, [phase, revealed, advanceQuestion]);

  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return ((index + (revealed ? 1 : 0)) / questions.length) * 100;
  }, [index, questions.length, revealed]);

  /** Treasure is earned at half right or better — but only after Try It when present. */
  const earnedTreasure = questions.length > 0 && score / questions.length >= 0.5;
  const needsTryIt = hasTryIt && !tryItDone;

  const openTryIt = useCallback(() => {
    const sid = storyId || searchParams.get('storyId')?.trim() || '';
    const qs = sid ? `?storyId=${encodeURIComponent(sid)}` : '';
    if (tryItVideoUrl) {
      primeTryItVideoFromTap(tryItVideoUrl);
    }
    navigate(`/sail/${islandId}/lesson/try-it${qs}`, {
      state: {
        title: navState?.title,
        fromMainMap: Boolean(navState?.fromMainMap),
        fromSail: Boolean(navState?.fromSail),
        onboardingJourney,
      },
    });
  }, [
    storyId,
    searchParams,
    tryItVideoUrl,
    navigate,
    islandId,
    navState,
    onboardingJourney,
  ]);

  const claimTreasure = useCallback(() => {
    if (needsTryIt) {
      openTryIt();
      return;
    }
    const sid = storyId || searchParams.get('storyId')?.trim() || '';
    if (sid) {
      islandStoryProgressService.markComplete(islandId, sid, 'rewards');
    }
    navigate('/sail/treasure', {
      state: {
        islandId,
        storyId: sid,
        storyTitle:
          rewardStory?.displayTitle || rewardStory?.title || navState?.title,
        pool: resolveRewardPool(rewardStory),
        returnTo: sceneBackPath,
        onboardingJourney,
      },
    });
  }, [
    needsTryIt,
    openTryIt,
    navigate,
    storyId,
    searchParams,
    islandId,
    rewardStory,
    navState?.title,
    sceneBackPath,
    onboardingJourney,
  ]);

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden"
      style={{
        backgroundImage: `url(${WOOD_TEX})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Warm brown darken — same as puzzle/coloring; avoid green under translucent wood */}
      <div className="absolute inset-0 bg-[#2a1810]/70 pointer-events-none" aria-hidden />

      <div
        className="relative z-10 flex flex-col h-full px-4 pt-[max(12px,var(--safe-area-top))] pb-[max(12px,var(--safe-area-bottom))]"
        onClick={onQuizScreenTap}
      >
        <div className="flex items-center gap-3 mb-3">
          {!onboardingJourney ? (
            <WoodBackButton
              onClick={goBackToScene}
              className="w-11 h-11 flex-shrink-0"
              aria-label="Back"
            />
          ) : (
            <span className="w-11 h-11 flex-shrink-0" aria-hidden />
          )}
          <h1
            className="flex-1 text-center text-white text-xl font-black tracking-wide drop-shadow"
            style={{ fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif' }}
          >
            {title}
          </h1>
          <div className="w-11" />
        </div>

        {phase === 'loading' && (
          <div className="flex-1 flex items-center justify-center text-white/90 font-bold">
            Loading quiz…
          </div>
        )}

        {phase === 'missing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <p className="text-white text-lg font-bold mb-2">Quiz coming soon</p>
            <p className="text-white/80 text-sm mb-6">
              This island doesn&apos;t have quiz questions yet.
            </p>
            <button
              type="button"
              onClick={goBackToScene}
              className="px-5 py-2.5 rounded-xl text-white font-bold"
              style={woodBtnStyle}
            >
              Back to activities
            </button>
          </div>
        )}

        {phase === 'pick' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <p className="text-white text-lg font-bold drop-shadow mb-2">Choose a level</p>
            {available.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => startLevel(level)}
                className="w-full max-w-xs py-3 rounded-xl text-white text-lg font-black active:scale-95 transition-transform"
                style={woodBtnStyle}
              >
                {LEVEL_LABEL[level]}
              </button>
            ))}
          </div>
        )}

        {phase === 'playing' && current && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-3">
              <div className="flex justify-between text-white/90 text-xs font-bold mb-1">
                <span>
                  {LEVEL_LABEL[difficulty]} · {index + 1}/{questions.length}
                </span>
                <span>{score} correct</span>
              </div>
              <div className="h-2 rounded-full bg-black/25 overflow-hidden">
                <div
                  className="h-full bg-[#F5C518] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl bg-[#FFF8E7]/95 border-2 border-[#6B4423] p-4 shadow-lg">
              <h2
                className="text-[#3E2723] text-xl font-black mb-4 leading-snug"
                style={{ fontFamily: '"Nunito", "Segoe UI", system-ui, sans-serif' }}
              >
                {current.question}
              </h2>

              <div className="space-y-2.5">
                {current.options.map((opt, oi) => {
                  const isCorrect = oi === current.correctIndex;
                  const isSelected = selected === oi;
                  let cls =
                    'w-full text-left px-3 py-3 rounded-xl border-2 font-bold transition-all ';
                  if (!revealed) {
                    cls +=
                      'border-[#c4a574] bg-white text-[#3E2723] active:scale-[0.98] hover:border-[#8B4513]';
                  } else if (isCorrect) {
                    cls += 'border-[#2E7D32] bg-[#C8E6C9] text-[#1B5E20]';
                  } else if (isSelected) {
                    cls += 'border-[#C62828] bg-[#FFCDD2] text-[#B71C1C] line-through';
                  } else {
                    cls += 'border-transparent bg-[#eee6d6] text-[#5D4037]/70';
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (revealed) {
                          advanceQuestion();
                          return;
                        }
                        onPick(oi);
                      }}
                      className={cls}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[#d4c59a] text-[#3E2723] text-sm flex items-center justify-center shrink-0">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {revealed && isCorrect && (
                          <Check className="w-5 h-5 text-[#2E7D32] shrink-0" />
                        )}
                        {revealed && isSelected && !isCorrect && (
                          <X className="w-5 h-5 text-[#C62828] shrink-0" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div
                  className={`mt-4 rounded-xl px-3 py-3 text-sm font-semibold ${
                    wasCorrect
                      ? 'bg-[#E8F5E9] text-[#1B5E20] border border-[#81C784]'
                      : 'bg-[#FFF3E0] text-[#E65100] border border-[#FFB74D]'
                  }`}
                >
                  {wasCorrect ? (
                    <p>Great job! That&apos;s right.</p>
                  ) : (
                    <>
                      <p className="mb-1">
                        Not quite — the correct answer is{' '}
                        <span className="font-black">
                          {current.options[current.correctIndex]}
                        </span>
                        .
                      </p>
                      {current.explanation ? (
                        <p className="text-[#5D4037] font-medium">{current.explanation}</p>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>

            {revealed && (
              <p className="mt-3 text-center text-white/75 text-sm font-semibold">
                Tap anywhere for the next question…
              </p>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative">
            <style>{`
              @keyframes ob-claim-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.06); }
              }
              .ob-claim-pulse {
                animation: ob-claim-pulse 1.15s ease-in-out infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .ob-claim-pulse { animation: none; }
              }
            `}</style>
            <PartyPopper className="w-14 h-14 text-[#F5C518] mb-3 drop-shadow" />
            <h2 className="text-white text-2xl font-black mb-2 drop-shadow">Quiz complete!</h2>
            <p className="text-white/90 text-lg font-bold mb-6">
              You got {score} of {questions.length} right
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {needsTryIt ? (
                <button
                  type="button"
                  onClick={openTryIt}
                  className="py-3.5 rounded-xl font-black text-lg text-[#3d2314] ob-claim-pulse active:scale-95 transition-transform"
                  style={{
                    background:
                      'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
                    boxShadow:
                      '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
                    border: '2px solid #F5E6A3',
                  }}
                >
                  Try it!
                </button>
              ) : onboardingJourney ? (
                <button
                  type="button"
                  onClick={goBackToScene}
                  className="py-3.5 rounded-xl font-black text-lg text-[#3d2314] ob-claim-pulse active:scale-95 transition-transform"
                  style={{
                    background:
                      'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
                    boxShadow:
                      '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
                    border: '2px solid #F5E6A3',
                  }}
                >
                  Back to Story Pack
                </button>
              ) : (
                <>
                  {(earnedTreasure || firstTimeReward) && (
                    <button
                      type="button"
                      onClick={claimTreasure}
                      className={`py-3.5 rounded-xl font-black text-lg text-[#3d2314] flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                        firstTimeReward ? 'ob-claim-pulse' : ''
                      }`}
                      style={{
                        background:
                          'linear-gradient(180deg, #F0D78C 0%, #D4A017 50%, #B8860B 100%)',
                        boxShadow:
                          '0 3px 0 #5c3a1a, 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,240,200,0.5)',
                        border: '2px solid #F5E6A3',
                      }}
                    >
                      <Gift size={22} strokeWidth={2.4} />
                      {firstTimeReward ? 'Continue to reward' : 'Claim Treasure'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setQuestions((prev) => preparePlayQuestions(prev));
                      setIndex(0);
                      setSelected(null);
                      setRevealed(false);
                      setWasCorrect(false);
                      setScore(0);
                      setPhase(available.length > 1 ? 'pick' : 'playing');
                    }}
                    className="py-3 rounded-xl text-white font-black"
                    style={woodBtnStyle}
                  >
                    Play again
                  </button>
                  <button
                    type="button"
                    onClick={goBackToScene}
                    className="py-3 rounded-xl text-white/95 font-bold border-2 border-white/40"
                  >
                    Back to activities
                  </button>
                </>
              )}
              {needsTryIt && !onboardingJourney && (
                <button
                  type="button"
                  onClick={goBackToScene}
                  className="py-3 rounded-xl text-white/95 font-bold border-2 border-white/40"
                >
                  Back to activities
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {celebration && (
        <PackUnlockCelebration payload={celebration} onDone={dismissCelebration} />
      )}
    </div>
  );
};

export default IslandQuizPage;
